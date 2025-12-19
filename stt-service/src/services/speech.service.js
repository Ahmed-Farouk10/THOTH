const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

// Initialize Gemini with the existing API Key
let genAI;
let model;

try {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    logger.warn("GOOGLE_API_KEY not set. Transcription will fail until configured.");
  } else {
    genAI = new GoogleGenerativeAI(apiKey);
    // DEBUG: List models to debug availability
    // Note: SDK doesn't expose listModels directly on genAI instance easily in all versions, 
    // but we can try a test generation with gemini-pro to verify connection
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    logger.info("Gemini 1.5 Flash initialized for STT");

    // Quick model availability check (async but fire-and-forget for logs)
    (async () => {
      try {
        const m = genAI.getGenerativeModel({ model: "gemini-pro" });
        const r = await m.generateContent("Test");
        logger.info("Gemini Pro Connection Test: SUCCESS");
      } catch (e) {
        logger.error("Gemini Pro Connection Test: FAILED", e.message);
      }
    })();
  }
} catch (error) {
  logger.error("Failed to initialize Gemini:", error);
}

/**
 * Transcribe audio using Gemini 1.5 Flash (Multimodal)
 * This replaces the need for local Whisper/Python
 * 
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} encoding - (Ignored by Gemini, auto-detects)
 * @param {number} sampleRateHertz - (Ignored)
 * @param {string} languageCode - Target language hint
 * @returns {Object} - { transcription: string, confidence: number }
 */
const transcribeAudio = async (
  audioBuffer,
  encoding = "LINEAR16", // Kept for interface compatibility
  sampleRateHertz = 16000,
  languageCode = "en-US",
  mimeType = "audio/webm" // Accept mimetype from caller
) => {
  try {
    if (!genAI) {
      throw new Error("Gemini not initialized. Check GOOGLE_API_KEY environment variable.");
    }

    logger.info(
      `Sending ${audioBuffer.length} bytes to Gemini for transcription (${mimeType})...`
    );

    // Convert Buffer to Base64
    const audioBase64 = audioBuffer.toString("base64");

    const prompt = `Please transcribe this audio file accurately in ${languageCode}. 
                    Return ONLY the transcription text. Do not add timestamps or speaker labels unless requested.`;

    const request = [
      {
        inlineData: {
          mimeType: mimeType,
          data: audioBase64
        }
      },
      { text: prompt }
    ];

    // List of models to try in order (based on actual API key availability)
    const modelsToTry = [
      "models/gemini-2.5-flash",
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-exp"
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        logger.info(`Attempting transcription with model: ${modelName}`);
        const currentModel = genAI.getGenerativeModel({ model: modelName });

        const result = await currentModel.generateContent(request);
        const response = await result.response;
        const transcriptionText = response.text();

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          logger.warn(`Empty result from ${modelName}`);
          continue; // Try next model
        }

        logger.info(`Transcription successful with ${modelName}`);
        return {
          transcription: transcriptionText.trim(),
          confidence: 0.95,
        };

      } catch (err) {
        logger.warn(`Failed with ${modelName}: ${err.message}`);
        lastError = err;
        // Continue to next model
      }
    }

    // If all failed
    throw lastError || new Error("All models failed to transcribe audio");

  } catch (error) {
    logger.error("Gemini Transcription Final Error:", error);

    return {
      transcription: `[ERROR] Transcription failed: ${error.message}`,
      confidence: 0.0,
    };
  }
};

/**
 * Long-running transcription (same as regular for API-based approach)
 */
const transcribeAudioLongRunning = async (
  gcsUri,
  encoding = "LINEAR16",
  sampleRateHertz = 16000,
  languageCode = "en-US",
  mimeType = "audio/webm"
) => {
  logger.info("Long-running transcription - using same Gemini API endpoint");
  // For API-based approach, we use the same method
  // Note: gcsUri would need to be downloaded first if it's an S3 URL
  return transcribeAudio(gcsUri, encoding, sampleRateHertz, languageCode, mimeType);
};

module.exports = { transcribeAudio, transcribeAudioLongRunning };
