const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connect = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/tts_service";
    await mongoose.connect(mongoURI);
    logger.info("MongoDB connected successfully");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    throw error;
  }
};

const disconnect = async () => {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  } catch (error) {
    logger.error("MongoDB disconnection error:", error);
  }
};

module.exports = { connect, disconnect };
