const Audio = require("../models/Audio");
const { synthesizeText } = require("../services/speech.service");
const { uploadToS3 } = require("../services/s3.service");
const { publishEvent } = require("../services/kafka.service");
const logger = require("../utils/logger");

/**
 * Synthesize speech from text
 * POST /api/tts/synthesize
 */
const synthesizeSpeech = async (req, res) => {
  try {
    const {
      text,
      language = "en-US",
      voice,  // Changed from voiceName for frontend compatibility
      audioEncoding = "MP3",
      userId,
    } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Text is required" });
    }

    // Create audio record
    const audio = new Audio({
      text,
      audioFileUrl: "pending",
      language,
      voiceName: voice,
      audioEncoding,
      userId,
      status: "processing",
    });
    await audio.save();

    logger.info(`Processing TTS ${audio._id}`);

    // Synthesize speech using GTTS
    const audioContent = await synthesizeText(
      text,
      language,
      voice,
      audioEncoding
    );

    // Upload audio to S3 (skip if using placeholder credentials)
    let audioUrl =
      "data:audio/mpeg;base64," + Buffer.from(audioContent).toString("base64");

    if (
      process.env.AWS_ACCESS_KEY_ID &&
      !process.env.AWS_ACCESS_KEY_ID.includes("PLACEHOLDER")
    ) {
      try {
        audioUrl = await uploadToS3(
          Buffer.from(audioContent),
          `${audio._id}.mp3`,
          "audio/mpeg"
        );
      } catch (error) {
        logger.warn("S3 upload failed, returning base64 audio:", error.message);
      }
    }

    // Update audio record
    audio.audioFileUrl = audioUrl;
    audio.status = "completed";
    await audio.save();

    // Publish event to Kafka (optional)
    try {
      await publishEvent("audio.generation.completed", {
        event_type: "audio.generation.completed.v1",
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        audio_id: audio._id.toString(),
        user_id: userId,
        audio_url: audioUrl,
        text: text.substring(0, 200),
        timestamp: new Date().toISOString(),
        service: "tts-service",
      });
    } catch (error) {
      logger.warn("Kafka publish failed:", error.message);
    }

    logger.info(`TTS ${audio._id} completed successfully`);

    // Return audio blob directly instead of JSON
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="speech-${audio._id}.mp3"`);
    res.send(Buffer.from(audioContent));
  } catch (error) {
    logger.error("Speech synthesis error:", error);
    res.status(500).json({
      error: "Failed to synthesize speech",
      message: error.message,
    });
  }
};

/**
 * Get audio by ID
 * GET /api/tts/audio/:id
 */
const getAudio = async (req, res) => {
  try {
    const { id } = req.params;

    const audio = await Audio.findById(id);

    if (!audio) {
      return res.status(404).json({ error: "Audio not found" });
    }

    res.status(200).json(audio);
  } catch (error) {
    logger.error("Get audio error:", error);
    res.status(500).json({
      error: "Failed to retrieve audio",
      message: error.message,
    });
  }
};

/**
 * Get all audios
 * GET /api/tts/audios
 */
const getAllAudios = async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const audios = await Audio.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Audio.countDocuments(query);

    res.status(200).json({
      audios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Get all audios error:", error);
    res.status(500).json({
      error: "Failed to retrieve audios",
      message: error.message,
    });
  }
};

module.exports = {
  synthesizeSpeech,
  getAudio,
  getAllAudios,
};
