const { Kafka } = require("kafkajs");
const logger = require("../utils/logger");
const { synthesizeText } = require("./speech.service");
const { uploadToS3 } = require("./s3.service");
const Audio = require("../models/Audio");

let kafka;
let producer;
let consumer;

const initKafka = async () => {
  try {
    kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "tts-service",
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
      groupId: process.env.KAFKA_GROUP_ID || "tts-service-group",
    });
    await consumer.connect();
    
    // FIX: Match the Aggregator's topic name
    await consumer.subscribe({
      topic: "audio.generation.requested",
      fromBeginning: true,
    });

    logger.info("Kafka consumer connected and subscribed to audio.generation.requested");

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          logger.info(`Received event: ${data.event_type}`, { id: data.event_id });
          
          // FIX: Actually process the request
          if (topic === "audio.generation.requested") {
            await handleAudioRequest(data);
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
const handleAudioRequest = async (data) => {
  try {
    const { user_id, text, request_id, voice = "default" } = data;
    
    if (!text) {
      logger.warn("No text provided in audio generation request");
      return;
    }
    
    logger.info(`Processing async TTS for user ${user_id}, request ${request_id}`);
    
    // Create audio record
    const audio = new Audio({
      text,
      audioFileUrl: "pending",
      language: "en-US",
      voiceName: voice,
      audioEncoding: "MP3",
      userId: user_id,
      status: "processing",
    });
    await audio.save();
    
    // 1. Generate audio
    const audioContent = await synthesizeText(text);
    
    // 2. Upload to S3
    let audioUrl = "failed";
    if (
      process.env.AWS_ACCESS_KEY_ID &&
      !process.env.AWS_ACCESS_KEY_ID.includes("PLACEHOLDER") &&
      process.env.AWS_ACCESS_KEY_ID !== "test"
    ) {
      try {
        audioUrl = await uploadToS3(
          Buffer.from(audioContent),
          `tts/${user_id}/${Date.now()}.mp3`,
          "audio/mpeg"
        );
      } catch (s3Error) {
        logger.warn("S3 upload failed, using base64 fallback:", s3Error.message);
        audioUrl = "data:audio/mpeg;base64," + Buffer.from(audioContent).toString("base64");
      }
    } else {
      // LocalStack or test mode - try S3 anyway
      try {
        audioUrl = await uploadToS3(
          Buffer.from(audioContent),
          `tts/${user_id}/${Date.now()}.mp3`,
          "audio/mpeg"
        );
      } catch (s3Error) {
        logger.warn("S3 upload failed, using base64 fallback:", s3Error.message);
        audioUrl = "data:audio/mpeg;base64," + Buffer.from(audioContent).toString("base64");
      }
    }
    
    // 3. Update audio record
    audio.audioFileUrl = audioUrl;
    audio.status = "completed";
    await audio.save();
    
    // 4. Publish Completion Event (Notification Service will pick this up)
    await publishEvent("audio.generation.completed", {
      event_type: "audio.generation.completed.v1",
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      request_id: request_id,
      user_id: user_id,
      audio_id: audio._id.toString(),
      audio_url: audioUrl,
      text: text.substring(0, 200), // Log snippet
      timestamp: new Date().toISOString(),
      service: "tts-service",
    });
    
    logger.info(`Async TTS completed and event published for request ${request_id}`);
  } catch (error) {
    logger.error("Async TTS failed:", error);
    
    // Try to publish failure event
    try {
      await publishEvent("audio.generation.completed", {
        event_type: "audio.generation.completed.v1",
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        request_id: data.request_id,
        user_id: data.user_id,
        status: "failed",
        error: error.message,
        timestamp: new Date().toISOString(),
        service: "tts-service",
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
