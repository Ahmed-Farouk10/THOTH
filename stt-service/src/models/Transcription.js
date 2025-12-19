const mongoose = require("mongoose");

const transcriptionSchema = new mongoose.Schema(
  {
    audioFileUrl: {
      type: String,
      required: true,
    },
    transcription: {
      type: String,
      required: false,
      default: "",
    },
    confidence: {
      type: Number,
      default: 0,
    },
    language: {
      type: String,
      default: "en-US",
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
transcriptionSchema.index({ userId: 1, createdAt: -1 });
transcriptionSchema.index({ status: 1 });

module.exports = mongoose.model("Transcription", transcriptionSchema);
