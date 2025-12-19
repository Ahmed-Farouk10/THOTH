FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY stt-service/package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY stt-service/ .

# FIX: Expose Port 8007 (8003 is Notification Service)
EXPOSE 8007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
	CMD node -e "require('http').get('http://localhost:8007/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["npm", "start"]
