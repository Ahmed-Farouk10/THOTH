# TTS Service (Text-to-Speech)

## Overview

The **TTS Service** converts text into natural-sounding speech audio using the **gtts** (Google Text-to-Speech) npm package. This service operates without requiring Google Cloud credentials and returns audio as base64-encoded data URLs for immediate playback in web applications.

---

## Features

- ✅ Text-to-speech conversion using GTTS (no authentication required)
- ✅ Returns base64-encoded MP3 audio data URLs
- ✅ MongoDB storage for audio metadata
- ✅ Kafka event streaming for asynchronous communication
- ✅ RESTful API endpoints
- ✅ Docker containerization with Docker Compose
- ✅ Winston logging for debugging and monitoring
- ✅ Health check endpoint

---

## Technology Stack

- **Runtime**: Node.js 18 (Alpine Linux)
- **Framework**: Express 4.18.2
- **Database**: MongoDB 7
- **ODM**: Mongoose 8.0.3
- **Message Queue**: Apache Kafka 7.5.0
- **TTS Engine**: gtts 0.2.1 (npm package)
- **Logging**: Winston 3.11.0
- **Containerization**: Docker & Docker Compose

---

## Architecture

```
Client → Express API → GTTS Engine → Base64 Audio → MongoDB
                                                     ↓
                                               Kafka Events
```

### Request Flow

1. Client sends POST request with text
2. Express controller validates input
3. MongoDB record created (status: processing)
4. GTTS generates MP3 audio from text
5. Audio encoded as base64 data URL
6. MongoDB record updated with audioUrl
7. Kafka event published
8. Response returned to client with audio data

---

## Installation & Setup

### Prerequisites

- Docker and Docker Compose installed
- Port 8004 available
- Port 27018 available (MongoDB)
- Port 9093 available (Kafka)
- Port 2182 available (Zookeeper)

### Quick Start

```powershell
# Navigate to service directory
cd Phase2_V2\tts-service

# Start all services
docker-compose up -d

# Wait 30 seconds for initialization

# Check health
curl http://127.0.0.1:8004/health
```

Expected response: `{"status":"healthy"}`

---

## API Documentation

### Base URL

`http://127.0.0.1:8004/api/tts`

### Endpoints

#### **POST /synthesize**

Converts text to speech and returns base64-encoded MP3 audio.

**Request:**

```json
POST /api/tts/synthesize
Content-Type: application/json

{
  "text": "Hello, this is a test of the text to speech system."
}
```

**Response:**

```json
{
  "id": "674f8a1b2c3d4e5f6a7b8c9d",
  "text": "Hello, this is a test of the text to speech system.",
  "audioUrl": "data:audio/mpeg;base64,//uQxAAAAA...(37000+ characters)",
  "status": "completed",
  "createdAt": "2025-12-05T12:34:56.789Z",
  "updatedAt": "2025-12-05T12:34:57.123Z"
}
```

**PowerShell Example:**

```powershell
$body = @{ text = "The quick brown fox jumps over the lazy dog." } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8004/api/tts/synthesize" -Method POST -Body $body -ContentType "application/json"

# Display response (audio truncated for readability)
$response | ConvertTo-Json

# The audioUrl can be used directly in HTML <audio> elements
Write-Host "Audio URL length: $($response.audioUrl.Length) characters"
```

**cURL Example:**

```bash
curl -X POST http://127.0.0.1:8004/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}'
```

**Using in HTML:**

```html
<audio controls>
  <source src="data:audio/mpeg;base64,//uQxAAAAA..." type="audio/mpeg" />
</audio>
```

#### **GET /health**

Health check endpoint.

**Response:**

```json
{
  "status": "healthy"
}
```

---

## Environment Variables

Configure via `docker-compose.yml`:

```yaml
TTS_PORT=8004                              # Service port
MONGODB_URI=mongodb://mongodb:27017/tts-service  # MongoDB connection
KAFKA_BROKER=kafka:9093                    # Kafka broker address
KAFKA_CLIENT_ID=tts-service                # Kafka client identifier
KAFKA_TOPIC=tts-events                     # Kafka topic name
AWS_ACCESS_KEY_ID=PLACEHOLDER              # S3 credentials (optional)
AWS_SECRET_ACCESS_KEY=PLACEHOLDER          # S3 credentials (optional)
AWS_REGION=us-east-1                       # AWS region
S3_BUCKET_NAME=tts-audio-bucket            # S3 bucket name
LOG_LEVEL=info                             # Logging level
```

---

## MongoDB Schema

### Audio Collection

```javascript
{
  text: String,           // Input text (required)
  audioUrl: String,       // Base64 audio data URL or S3 URL
  status: String,         // "processing" | "completed" | "failed"
  createdAt: Date,        // Timestamp
  updatedAt: Date         // Timestamp
}
```

---

## Kafka Events

### Topic: `tts-events`

Published when audio synthesis completes.

**Event Schema:**

```json
{
  "key": "674f8a1b2c3d4e5f6a7b8c9d",
  "value": {
    "id": "674f8a1b2c3d4e5f6a7b8c9d",
    "text": "Hello world",
    "audioUrl": "data:audio/mpeg;base64,...",
    "status": "completed",
    "timestamp": "2025-12-05T12:34:56.789Z"
  }
}
```

---

## Project Structure

```
tts-service/
├── docker-compose.yml       # Docker orchestration
├── Dockerfile               # Container definition
├── package.json             # Dependencies
├── package-lock.json        # Dependency lock
├── README.md                # This file
└── src/
    ├── index.js             # Entry point
    ├── config/
    │   └── database.js      # MongoDB connection
    ├── controllers/
    │   └── tts.controller.js   # API handlers
    ├── models/
    │   └── Audio.js            # Mongoose schema
    ├── routes/
    │   └── index.js            # Route definitions
    ├── services/
    │   ├── kafka.service.js    # Kafka producer/consumer
    │   ├── s3.service.js       # S3 upload (optional)
    │   └── speech.service.js   # GTTS integration
    └── utils/
        └── logger.js           # Winston logging
```

---

## Testing

### Basic Test

```powershell
# Test synthesis
$body = @{ text = "Testing one two three" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8004/api/tts/synthesize" -Method POST -Body $body -ContentType "application/json"

# Check response
$response.status  # Should be "completed"
$response.audioUrl.StartsWith("data:audio/mpeg;base64,")  # Should be True
```

### Save Audio to File

```powershell
# Extract base64 data and save as MP3
$base64 = $response.audioUrl -replace '^data:audio/mpeg;base64,', ''
$bytes = [Convert]::FromBase64String($base64)
[System.IO.File]::WriteAllBytes("C:\output.mp3", $bytes)

# Play the file
Start-Process "C:\output.mp3"
```

---

## Troubleshooting

### Service won't start

```powershell
# Check logs
docker logs tts-service-tts-service-1

# Common issues:
# - Port 8004 already in use
# - MongoDB not ready (wait longer)
# - Kafka not ready (wait longer)
```

### Port conflicts

Edit `docker-compose.yml` and change port mappings:

```yaml
ports:
  - "8005:8004" # Change 8005 to any available port
```

### MongoDB connection errors

```powershell
# Verify MongoDB is running
docker ps | Select-String mongodb

# Check MongoDB logs
docker logs tts-service-mongodb-1

# Restart MongoDB
docker-compose restart mongodb
```

### Kafka connection errors

Kafka takes 20-30 seconds to start. Wait before sending requests.

```powershell
# Check Kafka logs
docker logs tts-service-kafka-1

# Restart Kafka
docker-compose restart kafka zookeeper
```

---

## Development

### Local Development (without Docker)

```powershell
# Install dependencies
npm install

# Set environment variables
$env:TTS_PORT="8004"
$env:MONGODB_URI="mongodb://localhost:27017/tts-service"
$env:KAFKA_BROKER="localhost:9093"

# Run service
npm start
```

### Viewing Logs

```powershell
# Live logs
docker-compose logs -f tts-service

# Last 50 lines
docker logs tts-service-tts-service-1 --tail=50

# Follow specific patterns
docker logs tts-service-tts-service-1 -f | Select-String "error|info"
```

---

## Performance Considerations

- **Audio Size**: Base64 encoding increases size by ~33%
- **Response Time**: Typically 1-3 seconds for synthesis
- **Memory**: Each request uses ~5-10MB memory
- **Concurrency**: Can handle multiple concurrent requests
- **Caching**: Consider caching common phrases

---

## Security Notes

⚠️ **Production Considerations:**

- Add authentication (JWT, API keys)
- Add rate limiting
- Validate input text length
- Sanitize input text
- Enable HTTPS
- Add CORS restrictions
- Enable MongoDB authentication

---

## Known Limitations

1. **Language Support**: GTTS supports multiple languages but this implementation uses English by default
2. **Voice Options**: Limited voice customization compared to Google Cloud TTS API
3. **Audio Format**: Only MP3 format supported
4. **File Size**: Base64 encoding not ideal for very long texts
5. **No Streaming**: Entire audio generated before response

---

## License

MIT License

---

## Support

For issues:

1. Check service logs: `docker logs tts-service-tts-service-1`
2. Verify service health: `curl http://127.0.0.1:8004/health`
3. Check main README: `Phase2_V2/README.md`
4. Verify containers running: `docker ps`
