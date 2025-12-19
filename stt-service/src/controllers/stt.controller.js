const Transcription = require("../models/Transcription");
const { transcribeAudio: transcribe } = require("../services/speech.service");
const { uploadToS3 } = require("../services/s3.service");
const { publishEvent } = require("../services/kafka.service");
const logger = require("../utils/logger");

/**
 * Transcribe audio file
 * POST /api/stt/transcribe
 */
const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const { language = "en-US", userId } = req.body;

    // Create transcription record
    const transcription = new Transcription({
      audioFileUrl: "pending",
      transcription: "",
      language,
      userId,
      status: "processing",
    });
    await transcription.save();

    logger.info(`Processing transcription ${transcription._id}`);

    // Upload audio to S3 (skip if using placeholder credentials)
    let audioUrl = "local-processing";
    if (
      process.env.AWS_ACCESS_KEY_ID &&
      !process.env.AWS_ACCESS_KEY_ID.includes("PLACEHOLDER")
    ) {
      try {
        audioUrl = await uploadToS3(buffer, originalname, mimetype);
        logger.info("Audio uploaded to S3 successfully");
      } catch (error) {
        logger.warn(
          "S3 upload failed, continuing without upload:",
          error.message
        );
      }
    } else {
      logger.info("Skipping S3 upload (placeholder credentials)");
    }

    transcription.audioFileUrl = audioUrl;
    await transcription.save();

    // Transcribe audio using Gemini with actual file mimetype
    const result = await transcribe(buffer, "LINEAR16", 16000, language, mimetype);

    // Validate transcription result
    if (
      !result ||
      !result.transcription ||
      result.transcription.trim() === ""
    ) {
      transcription.status = "failed";
      transcription.transcription =
        "Transcription failed - no speech detected or invalid audio format";
      await transcription.save();

      logger.warn(`Transcription ${transcription._id} produced no results`);

      return res.status(200).json({
        id: transcription._id,
        transcription: transcription.transcription,
        confidence: 0,
        audioUrl,
        status: "failed",
        message: "No speech detected in audio file",
      });
    }

    // Update transcription with result
    transcription.transcription = result.transcription;
    transcription.confidence = result.confidence;
    transcription.status = "completed";
    await transcription.save();

    // Publish event to Kafka
    await publishEvent("audio.transcription.completed", {
      event_type: "audio.transcription.completed.v1",
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      transcription_id: transcription._id.toString(),
      user_id: userId,
      transcription: result.transcription.substring(0, 200), // Log snippet
      confidence: result.confidence,
      audio_url: audioUrl,
      timestamp: new Date().toISOString(),
      service: "stt-service",
    });

    logger.info(`Transcription ${transcription._id} completed successfully`);

    res.status(200).json({
      id: transcription._id,
      transcription: result.transcription,
      confidence: result.confidence,
      audioUrl,
      status: "completed",
    });
  } catch (error) {
    logger.error("Transcription error:", error);
    res.status(500).json({
      error: "Failed to transcribe audio",
      message: error.message,
    });
  }
};

/**
 * Get transcription by ID
 * GET /api/stt/transcription/:id
 */
const getTranscription = async (req, res) => {
  try {
    const { id } = req.params;

    const transcription = await Transcription.findById(id);

    if (!transcription) {
      return res.status(404).json({ error: "Transcription not found" });
    }

    res.status(200).json(transcription);
  } catch (error) {
    logger.error("Get transcription error:", error);
    res.status(500).json({
      error: "Failed to retrieve transcription",
      message: error.message,
    });
  }
};

/**
 * Get all transcriptions
 * GET /api/stt/transcriptions
 */
const getAllTranscriptions = async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const transcriptions = await Transcription.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transcription.countDocuments(query);

    res.status(200).json({
      transcriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Get all transcriptions error:", error);
    res.status(500).json({
      error: "Failed to retrieve transcriptions",
      message: error.message,
    });
  }
};

module.exports = {
  transcribeAudio,
  getTranscription,
  getAllTranscriptions,
};
