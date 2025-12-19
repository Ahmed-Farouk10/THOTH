# STT Service (Speech-to-Text)

## Overview

The **STT Service** transcribes spoken audio into written text using the **HuggingFace Whisper API**. This service accepts audio file uploads and processes them through a cloud-based Whisper model without requiring local model installation.

---

## Features

- ✅ Audio file upload (WAV, MP3, etc.)
- ✅ Speech-to-text transcription via HuggingFace API
- ✅ MongoDB storage for transcription metadata
- ✅ Kafka event streaming for asynchronous communication
- ✅ RESTful API endpoints
- ✅ Docker containerization with Docker Compose
- ✅ Winston logging for debugging and monitoring
- ✅ Health check endpoint
- ⚠️ External API dependency (HuggingFace Whisper)

---

## Technology Stack

- **Runtime**: Node.js 18
- **Framework**: Express 4.18.2
- **Database**: MongoDB 7
- **ODM**: Mongoose 8.0.3
- **Message Queue**: Apache Kafka 7.5.0
- **STT Engine**: HuggingFace Whisper API (openai/whisper-tiny.en)
- **File Upload**: Multer 1.4.5
- **HTTP Client**: Axios 1.6.2
- **Logging**: Winston 3.11.0
- **Containerization**: Docker & Docker Compose

---

## Architecture

```
Client → File Upload → Express API → Whisper API → Transcription → MongoDB
                                                                      ↓
                                                                Kafka Events
```

### Request Flow

1. Client uploads audio file via multipart/form-data
2. Multer middleware receives file buffer
3. MongoDB record created (status: processing)
4. Audio buffer sent to HuggingFace Whisper API
5. API returns transcription text and confidence
6. MongoDB record updated with transcription
7. Kafka event published
8. Response returned to client

---

## Installation & Setup

### Prerequisites

- Docker and Docker Compose installed
- Port 8003 available
- Port 27017 available (MongoDB)
- Port 9092 available (Kafka)
- Port 2181 available (Zookeeper)
- Internet connection (for HuggingFace API)

### Quick Start

```powershell
# Navigate to service directory
cd Phase2_V2\stt-service

# Start all services
docker-compose up -d

# Wait 30 seconds for initialization

# Check health
curl http://127.0.0.1:8003/health
```

Expected response: `{"status":"healthy"}`

---

## API Documentation

### Base URL

`http://127.0.0.1:8003/api/stt`

### Endpoints

#### **POST /transcribe**

Transcribes audio file to text.

**Request:**

```
POST /api/stt/transcribe
Content-Type: multipart/form-data

audio: [file upload]
```

**Response:**

```json
{
  "id": "674f8b2c3d4e5f6a7b8c9d0e",
  "audioUrl": "local-processing",
  "transcription": "Hello, this is a test of the speech to text system.",
  "confidence": 0.85,
  "status": "completed",
  "createdAt": "2025-12-05T12:35:10.456Z",
  "updatedAt": "2025-12-05T12:35:45.789Z"
}
```

**PowerShell Example:**

```powershell
# Upload audio file
curl.exe -X POST http://127.0.0.1:8003/api/stt/transcribe `
  -F "audio=@test.wav;type=audio/wav"

# Or with Invoke-RestMethod
$headers = @{ "Content-Type" = "multipart/form-data" }
$form = @{ audio = Get-Item "test.wav" }
Invoke-RestMethod -Uri "http://127.0.0.1:8003/api/stt/transcribe" -Method POST -Form $form
```

**cURL Example:**

```bash
curl -X POST http://127.0.0.1:8003/api/stt/transcribe \
  -F "audio=@/path/to/audio.wav"
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
STT_PORT=8003                              # Service port
MONGODB_URI=mongodb://mongodb:27017/stt-service  # MongoDB connection
KAFKA_BROKER=kafka:9092                    # Kafka broker address
KAFKA_CLIENT_ID=stt-service                # Kafka client identifier
KAFKA_TOPIC=stt-events                     # Kafka topic name
AWS_ACCESS_KEY_ID=PLACEHOLDER              # S3 credentials (optional)
AWS_SECRET_ACCESS_KEY=PLACEHOLDER          # S3 credentials (optional)
AWS_REGION=us-east-1                       # AWS region
S3_BUCKET_NAME=stt-audio-bucket            # S3 bucket name
LOG_LEVEL=info                             # Logging level
```

---

## MongoDB Schema

### Transcription Collection

```javascript
{
  audioUrl: String,          // S3 URL or "local-processing"
  transcription: String,     // Transcribed text (optional, default: "")
  confidence: Number,        // Confidence score (0.0 - 1.0)
  status: String,            // "processing" | "completed" | "failed"
  createdAt: Date,           // Timestamp
  updatedAt: Date            // Timestamp
}
```

---

## Kafka Events

### Topic: `stt-events`

Published when transcription completes.

**Event Schema:**

```json
{
  "key": "674f8b2c3d4e5f6a7b8c9d0e",
  "value": {
    "id": "674f8b2c3d4e5f6a7b8c9d0e",
    "transcription": "Hello world",
    "confidence": 0.85,
    "audioUrl": "local-processing",
    "status": "completed",
    "timestamp": "2025-12-05T12:35:45.789Z"
  }
}
```

---

## Project Structure

```
stt-service/
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
    │   └── stt.controller.js   # API handlers
    ├── models/
    │   └── Transcription.js    # Mongoose schema
    ├── routes/
    │   └── index.js            # Route definitions
    ├── services/
    │   ├── kafka.service.js    # Kafka producer/consumer
    │   ├── s3.service.js       # S3 upload (optional)
    │   └── speech.service.js   # Whisper API integration
    └── utils/
        └── logger.js           # Winston logging
```

---

## Testing

### Basic Test

```powershell
# Test with sample audio file
curl.exe -X POST http://127.0.0.1:8003/api/stt/transcribe -F "audio=@test.wav;type=audio/wav"

# Check response
# Should contain transcription text and confidence score
```

### Create Test Audio (using TTS service)

```powershell
# Generate audio using TTS service
$body = @{ text = "This is a test audio file for speech to text transcription." } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8004/api/tts/synthesize" -Method POST -Body $body -ContentType "application/json"

# Save audio to file
$base64 = $response.audioUrl -replace '^data:audio/mpeg;base64,', ''
$bytes = [Convert]::FromBase64String($base64)
[System.IO.File]::WriteAllBytes("test-audio.mp3", $bytes)

# Use the file for STT testing
curl.exe -X POST http://127.0.0.1:8003/api/stt/transcribe -F "audio=@test-audio.mp3;type=audio/mpeg"
```

---

## Troubleshooting

### Service won't start

```powershell
# Check logs
docker logs stt-service-stt-service-1

# Common issues:
# - Port 8003 already in use
# - MongoDB not ready (wait longer)
# - Kafka not ready (wait longer)
```

### HuggingFace API Errors

#### HTTP 503 (Model Loading)

The model is loading on HuggingFace servers. Wait 20-60 seconds and retry.

```json
{
  "transcription": "Model is loading on Hugging Face servers. Estimated time: 20 seconds. Please try again."
}
```

#### HTTP 410 (Model Deprecated)

The model has been removed or deprecated. Consider:

- Using a different Whisper model endpoint
- Integrating OpenAI Whisper API
- Using AssemblyAI or similar service
- Running Whisper locally (requires significant changes)

#### HTTP 429 (Rate Limited)

Too many requests. Wait a few minutes before retrying.

### Port conflicts

Edit `docker-compose.yml` and change port mappings:

```yaml
ports:
  - "8005:8003" # Change 8005 to any available port
```

### MongoDB connection errors

```powershell
# Verify MongoDB is running
docker ps | Select-String mongodb

# Check MongoDB logs
docker logs stt-service-mongodb-1

# Restart MongoDB
docker-compose restart mongodb
```

### Kafka connection errors

Kafka takes 20-30 seconds to start. Wait before sending requests.

```powershell
# Check Kafka logs
docker logs stt-service-kafka-1

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
$env:STT_PORT="8003"
$env:MONGODB_URI="mongodb://localhost:27017/stt-service"
$env:KAFKA_BROKER="localhost:9092"

# Run service
npm start
```

### Viewing Logs

```powershell
# Live logs
docker-compose logs -f stt-service

# Last 50 lines
docker logs stt-service-stt-service-1 --tail=50

# Follow specific patterns
docker logs stt-service-stt-service-1 -f | Select-String "Transcrib|error"
```

---

## Performance Considerations

- **API Latency**: HuggingFace API adds 5-30 seconds per request
- **File Size**: Larger audio files take longer to transcribe
- **Cold Start**: First request may take 20-60 seconds (model loading)
- **Rate Limits**: Free tier has request limits
- **Concurrent Requests**: Limited by HuggingFace API capacity

---

## Security Notes

⚠️ **Production Considerations:**

- Add authentication (JWT, API keys)
- Add rate limiting
- Validate audio file types and sizes
- Sanitize file uploads
- Enable HTTPS
- Add CORS restrictions
- Enable MongoDB authentication
- Consider using authenticated HuggingFace API

---

## Known Limitations

1. **External API Dependency**: Requires internet connection and HuggingFace availability
2. **Model Deprecation**: HuggingFace may deprecate models (HTTP 410)
3. **Rate Limiting**: Free tier has request limits
4. **Language Support**: Current implementation uses English-only model (whisper-tiny.en)
5. **Accuracy**: Tiny model has lower accuracy than larger variants
6. **File Size Limit**: Default 10MB upload limit (configurable in multer)
7. **No Streaming**: Entire file must upload before processing

---

## Alternative APIs

If HuggingFace API is unavailable, consider:

1. **OpenAI Whisper API**

   - Requires API key
   - Better accuracy
   - Faster processing
   - Cost per request

2. **AssemblyAI**

   - Free tier available
   - High accuracy
   - Real-time transcription
   - Requires API key

3. **Google Cloud Speech-to-Text**

   - Enterprise-grade
   - Multiple languages
   - Requires GCP account
   - Cost per request

4. **Local Whisper Model**
   - No external dependencies
   - Privacy
   - Requires GPU for good performance
   - Complex setup

---

## License

MIT License

---

## Support

For issues:

1. Check service logs: `docker logs stt-service-stt-service-1`
2. Verify service health: `curl http://127.0.0.1:8003/health`
3. Check main README: `Phase2_V2/README.md`
4. Verify containers running: `docker ps`
5. Test HuggingFace API directly
