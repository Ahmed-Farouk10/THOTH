const mongoose = require("mongoose");

const audioSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    audioFileUrl: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      default: "en-US",
    },
    voiceName: {
      type: String,
    },
    audioEncoding: {
      type: String,
      enum: ["MP3", "LINEAR16", "OGG_OPUS", "MULAW", "ALAW"],
      default: "MP3",
    },
    duration: {
      type: Number, // in seconds
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    userId: {
      type: String,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
audioSchema.index({ userId: 1, createdAt: -1 });
audioSchema.index({ status: 1 });

module.exports = mongoose.model("Audio", audioSchema);
