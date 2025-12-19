const express = require("express");
const multer = require("multer");
const {
  transcribeAudio,
  getTranscription,
  getAllTranscriptions,
} = require("../controllers/stt.controller");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "audio/mpeg",
      "audio/wav",
      "audio/mp3",
      "audio/webm",
      "audio/ogg",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only audio files are allowed."));
    }
  },
});

// Routes
router.post("/transcribe", upload.single("audio"), transcribeAudio);
router.get("/transcription/:id", getTranscription);
router.get("/transcriptions", getAllTranscriptions);

module.exports = router;
