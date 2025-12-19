# Aggregator Service (BFF - Backend for Frontend)

The Aggregator is the single entry point for all client requests. It orchestrates microservices and provides a unified API.

## Architecture

### Responsibilities

1. **JWT Authentication**: Verifies tokens using shared security module
2. **Request Orchestration**: Routes requests to appropriate microservices
3. **Kafka Command Publishing**: Publishes command events (quiz.requested, audio.generation.requested, etc.)
4. **Response Aggregation**: Combines responses from multiple services (future)

### Communication Patterns

#### HTTP Proxying (Document Service)
- **Why?** Maintains strict storage isolation
- **How:** Aggregator proxies file uploads to Document Service via HTTP
- **Benefit:** Only Document Service has write access to its S3 bucket

#### Kafka Commands (Quiz, TTS, STT)
- **Why?** Async processing for long-running operations
- **How:** Aggregator publishes command events to Kafka
- **Flow:** Command → Service processes → Completion event → Notification Service → User

## API Endpoints

### Health Check
```
GET /health
```

### Authentication Test
```
GET /api/test-auth
Headers: Authorization: Bearer <token>
```

### Document API (Proxy)
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `GET /api/documents/{id}` - Get document
- `GET /api/documents/{id}/notes` - Get notes
- `POST /api/documents/{id}/regenerate-notes` - Regenerate notes
- `DELETE /api/documents/{id}` - Delete document

### Quiz API (Kafka Commands)
- `POST /api/quiz/generate` - Request quiz generation
  - Query params: `document_id`, `difficulty`, `question_count`
  - Returns: 202 Accepted (async processing)

## Kafka Producer

The Aggregator includes a Kafka Producer initialized at startup using FastAPI's lifespan:

```python
from aggregator.main import get_kafka_producer
from aggregator.kafka_commands import publish_quiz_requested

producer = get_kafka_producer()
publish_quiz_requested(
    producer=producer,
    document_id="doc-123",
    user_id="user-456",
    difficulty="hard",
    question_count=15
)
```

### Available Commands

- `publish_quiz_requested()` - Request quiz generation
- `publish_audio_generation_requested()` - Request TTS
- `publish_audio_transcription_requested()` - Request STT

## Environment Variables

- `KAFKA_BOOTSTRAP_SERVERS` - Kafka broker address (default: `kafka:9092`)
- `DOCUMENT_SERVICE_URL` - Document Service URL (default: `http://document-service:8000`)
- `JWT_SECRET` - JWT secret key (must match User Service)
- `SERVICE_NAME` - Service name (default: `aggregator`)
- `LOG_LEVEL` - Logging level (default: `INFO`)

## Testing

### Test Quiz Generation

```bash
# 1. Get JWT token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"securepass123"}' \
  | jq -r '.access_token')

# 2. Request quiz generation
curl -X POST "http://localhost/api/quiz/generate?document_id=DOC_ID&difficulty=medium&question_count=10" \
  -H "Authorization: Bearer $TOKEN"

# Response: 202 Accepted
# Quiz Service will process and Notification Service will notify when ready
```

## Architecture Decisions

### HTTP Proxying for Document Upload ✅

**Decision:** Aggregator proxies file uploads to Document Service via HTTP

**Why?**
- **Storage Isolation**: Only Document Service has write access to its S3 bucket
- **Security Boundary**: Aggregator never directly accesses S3 buckets
- **Single Responsibility**: Document Service owns document storage logic

**Alternative (Rejected):**
- Aggregator uploading directly to S3 would require:
  - Aggregator having write permissions to Document Service's bucket
  - Violates storage isolation principle
  - Creates tight coupling between Aggregator and storage

### Kafka Commands for Long Operations ✅

**Decision:** Use Kafka commands for quiz generation, TTS, STT

**Why?**
- **Async Processing**: These operations take time (seconds to minutes)
- **Decoupling**: Services don't need to know about each other
- **Scalability**: Can handle high load with multiple workers
- **Resilience**: Events are persisted, can replay on failure

**Flow:**
1. User → Aggregator: `POST /api/quiz/generate`
2. Aggregator → Kafka: `quiz.requested` event
3. Aggregator → User: `202 Accepted`
4. Quiz Service → Consumes event, generates quiz
5. Quiz Service → Kafka: `quiz.generated` event
6. Notification Service → Consumes event, notifies user

---

**Status:** ✅ Production Ready
**Kafka Producer:** ✅ Initialized and Working

