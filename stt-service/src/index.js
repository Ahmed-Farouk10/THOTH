const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const db = require("./config/database");
const routes = require("./routes");
const { initKafka } = require("./services/kafka.service");

// Environment variables are loaded from Docker Compose
const app = express();
const PORT = process.env.PORT || 8007;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "stt-service" });
});

// API routes
app.use("/api/stt", routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  });
});

// Start server
let server;

const startServer = async () => {
  try {
    // Start Express server first so health checks work
    server = app.listen(PORT, () => {
      logger.info(`STT Service running on port ${PORT}`);
    });

    // Connect to database
    await db.connect();
    logger.info("Connected to MongoDB");

    // Initialize Kafka (don't block startup on Kafka)
    initKafka().catch((error) => {
      logger.error("Kafka initialization failed:", error);
      logger.info("Service will continue without Kafka");
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// ✅ GRACEFUL SHUTDOWN HANDLER
const { disconnectKafka } = require("./services/kafka.service");
const mongoose = require("mongoose");

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // 1. Stop accepting new HTTP requests
  if (server) {
    server.close(() => {
      logger.info("HTTP server closed.");
    });
  }

  // 2. Disconnect Kafka
  try {
    await disconnectKafka();
  } catch (error) {
    logger.error("Error disconnecting Kafka:", error);
  }

  // 3. Disconnect MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      await db.disconnect();
      logger.info("MongoDB disconnected.");
    }
  } catch (error) {
    logger.error("Error disconnecting MongoDB:", error);
  }

  logger.info("Graceful shutdown complete.");
  process.exit(0);
};

// Listen for Docker signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();

module.exports = app;
