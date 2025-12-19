const { Kafka } = require("kafkajs");
const logger = require("../utils/logger");
const { transcribeAudio } = require("./speech.service");
const { downloadFromS3, uploadToS3 } = require("./s3.service");
const Transcription = require("../models/Transcription");

let kafka;
let producer;
let consumer;

const initKafka = async () => {
  try {
    kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "stt-service",
      brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
      retry: {
        retries: 10,
        initialRetryTime: 1000,
      },
    });

    producer = kafka.producer();
    await producer.connect();
    logger.info("Kafka producer connected");

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || "stt-service-group",
    });
    await consumer.connect();
    
    // FIX: Match the Aggregator's topic name
    await consumer.subscribe({
      topic: "audio.transcription.requested",
      fromBeginning: true,
    });

    logger.info("Kafka consumer connected and subscribed to audio.transcription.requested");

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          logger.info(`Received event: ${data.event_type}`, { id: data.event_id });
          
          // FIX: Actually process the request
          if (topic === "audio.transcription.requested") {
            await handleTranscriptionRequest(data);
          }
        } catch (error) {
          logger.error("Error processing Kafka message:", error);
        }
      },
    });
  } catch (error) {
    logger.error("Kafka initialization error:", error);
    // Don't throw, let it retry or fail gracefully so container stays up
  }
};

// Logic to handle async Kafka requests
const handleTranscriptionRequest = async (data) => {
  try {
    const { user_id, audio_id, s3_uri, request_id } = data;
    
    if (!s3_uri) {
      logger.warn("No S3 URI provided in transcription request");
      return;
    }
    
    logger.info(`Processing async STT for user ${user_id}, request ${request_id}`);
    
    // Create transcription record
    const transcription = new Transcription({
      audioFileUrl: s3_uri,
      transcription: "",
      language: "en-US",
      userId: user_id,
      status: "processing",
    });
    await transcription.save();
    
    // 1. Download audio from S3
    let audioBuffer;
    try {
      audioBuffer = await downloadFromS3(s3_uri);
      logger.info(`Downloaded audio from S3: ${audioBuffer.length} bytes`);
    } catch (s3Error) {
      logger.error(`Failed to download from S3: ${s3Error.message}`);
      transcription.status = "failed";
      transcription.transcription = `Failed to download audio: ${s3Error.message}`;
      await transcription.save();
      return;
    }
    
    // 2. Transcribe using Gemini
    const result = await transcribeAudio(audioBuffer, "LINEAR16", 16000, "en-US");
    
    // 3. Update transcription record
    transcription.transcription = result.transcription;
    transcription.confidence = result.confidence;
    transcription.status = result.confidence > 0 ? "completed" : "failed";
    await transcription.save();
    
    // 4. Publish Completion Event (Notification Service will pick this up)
    await publishEvent("audio.transcription.completed", {
      event_type: "audio.transcription.completed.v1",
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      request_id: request_id,
      user_id: user_id,
      audio_id: audio_id,
      transcription_id: transcription._id.toString(),
      transcription: result.transcription.substring(0, 200), // Log snippet
      confidence: result.confidence,
      timestamp: new Date().toISOString(),
      service: "stt-service",
    });
    
    logger.info(`Async STT completed and event published for request ${request_id}`);
  } catch (error) {
    logger.error("Async STT failed:", error);
    
    // Try to publish failure event
    try {
      await publishEvent("audio.transcription.completed", {
        event_type: "audio.transcription.completed.v1",
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        request_id: data.request_id,
        user_id: data.user_id,
        audio_id: data.audio_id,
        status: "failed",
        error: error.message,
        timestamp: new Date().toISOString(),
        service: "stt-service",
      });
    } catch (publishError) {
      logger.error("Failed to publish failure event:", publishError);
    }
  }
};

const publishEvent = async (topic, message) => {
  try {
    if (!producer) {
      logger.warn("Kafka producer not initialized, skipping event publish");
      return;
    }
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    logger.info(`Event published to topic ${topic}`);
  } catch (error) {
    logger.error("Error publishing Kafka event:", error);
    // Don't throw - allow service to continue even if Kafka publish fails
  }
};

const disconnectKafka = async () => {
  try {
    if (producer) {
      await producer.disconnect();
    }
    if (consumer) {
      await consumer.disconnect();
    }
    logger.info("Kafka disconnected");
  } catch (error) {
    logger.error("Error disconnecting Kafka:", error);
  }
};

module.exports = { initKafka, publishEvent, disconnectKafka };
