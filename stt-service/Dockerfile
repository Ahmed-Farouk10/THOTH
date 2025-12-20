# Production Dockerfile for STT Service
# Multi-stage build with non-root user

# Stage 1: Builder
FROM node:18-slim as builder

WORKDIR /app

# Copy package files
COPY stt-service/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Stage 2: Runtime
FROM node:18-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Security: Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy package files
COPY stt-service/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY stt-service/src ./src

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV ENVIRONMENT=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8007/health || exit 1

EXPOSE 8007

# Run the application
CMD ["node", "src/server.js"]
