const express = require("express");
const {
  synthesizeSpeech,
  getAudio,
  getAllAudios,
} = require("../controllers/tts.controller");

const router = express.Router();

// Routes
router.post("/synthesize", synthesizeSpeech);
router.get("/audio/:id", getAudio);
router.get("/audios", getAllAudios);

module.exports = router;
