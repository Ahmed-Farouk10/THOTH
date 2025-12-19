FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY tts-service/package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY tts-service/ .

# Expose port (8006 - 8004 is taken by Quiz Service)
EXPOSE 8006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
	CMD node -e "require('http').get('http://localhost:8006/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["npm", "start"]
