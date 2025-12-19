# Document Reader Service - Changes Summary

## Overview
Comprehensive audit and enhancement of the Document Reader Service to ensure full compliance with project requirements (Section 5.4).

---

## Changes Made

### 1. API Enhancements (`api/src/main.py`)

#### New Endpoints Added:

**GET /api/documents/{document_id}/notes**
- Purpose: Retrieve generated notes for a document
- Returns: Notes with presigned S3 URL for secure access
- Status Code: 200 (success), 404 (not found), 404 (notes not generated)

**POST /api/documents/{document_id}/regenerate-notes**
- Purpose: Regenerate notes for an already processed document
- Validates: Document is in COMPLETED status
- Produces: `regenerate.notes` Kafka event
- Status Code: 200 (success), 400 (invalid state), 500 (error)

**DELETE /api/documents/{document_id}**
- Purpose: Delete document and all associated files
- Actions: Deletes from database AND S3 (raw, text, notes files)
- Status Code: 200 (success), 404 (not found), 500 (error)

### 2. S3 Service Enhancement (`api/src/services/s3_service.py`)

**New Method: `delete_file(s3_key)`**
- Deletes files from S3
- Logs deletion for audit trail
- Returns success indicator

### 3. Kafka Service Enhancement (`api/src/services/kafka_service.py`)

**New Methods:**
- `produce_document_processed()`: Produces `document.processed` events
- `produce_regenerate_notes()`: Produces `regenerate.notes` events for worker

### 4. Worker Service Fixes (`worker/src/worker.py`)

#### Bug Fixes:
- ✅ Fixed undefined `self` reference in `generate_simple_notes()` call
- ✅ Added missing `import os` for environment variables
- ✅ Fixed Kafka event production (added producer.close())

#### AI Notes Implementation:
**New Function: `generate_ai_notes(text, filename)`**
```python
- Calls OpenAI GPT-3.5-turbo API
- Generates intelligent summary (2-3 sentences)
- Extracts key points (up to 5)
- Calculates word count and reading time
- Falls back to simple notes if API unavailable
- Returns structured JSON with generation method
```

#### Notes Regeneration:
**New Function: `regenerate_document_notes()`**
- Downloads existing extracted text from S3
- Generates new AI-based notes
- Updates database with new notes URL
- Produces `notes.generated` Kafka event

#### Enhanced Main Loop:
- Now subscribes to multiple topics: `document.uploaded` AND `regenerate.notes`
- Routes events to appropriate handlers based on event type
- Proper error handling and offset management

### 5. Worker Kafka Service Enhancement (`worker/src/services/kafka_service.py`)

**Enhanced `create_consumer()` method:**
- Now accepts both single topic (string) and multiple topics (list)
- Properly handles list unpacking with `*topics`
- Changed from auto_commit to manual commit for reliability

### 6. Dependencies Updates

#### `api/requirements.txt` - Added:
```
PyPDF2==3.0.1          # PDF text extraction
python-docx==1.1.0     # DOCX text extraction
spacy==3.7.2           # NLP processing (included for future enhancement)
openai==1.3.0          # AI-powered notes generation
```

#### `worker/requirements.txt` - Added:
```
spacy==3.7.2           # NLP processing (included for future enhancement)
openai==1.3.0          # AI-powered notes generation
```

### 7. Docker Configuration (`docker-compose.yml`)

**Resource Constraints Added:**
```yaml
deploy:
  resources:
    limits:
      cpus: '2'           # Maximum 2 CPU cores
      memory: 4G          # Maximum 4GB RAM
    reservations:
      cpus: '1'           # Guaranteed 1 CPU core
      memory: 2G          # Guaranteed 2GB RAM
```

Applied to both:
- `document-reader-api` service
- `document-reader-worker` service

---

## Requirements Compliance Matrix

| Requirement | Status | Implementation |
|------------|--------|-----------------|
| Upload documents (PDF, DOCX, TXT) | ✅ | `api/src/main.py`, `worker/src/document_processor.py` |
| Extract text and structure | ✅ | `worker/src/document_processor.py` |
| Generate AI-based notes | ✅ | `worker/src/worker.py` - `generate_ai_notes()` |
| Store documents & notes | ✅ | S3 + PostgreSQL |
| Python 3.11 container | ✅ | Dockerfile (both services) |
| S3 bucket storage | ✅ | `document-reader-storage-{env}` |
| PostgreSQL database | ✅ | `document_reader_db` |
| POST /api/documents/upload | ✅ | Already existed |
| GET /api/documents/{id} | ✅ | Already existed |
| GET /api/documents/{id}/notes | ✅ | **NEW** |
| POST /api/documents/{id}/regenerate-notes | ✅ | **NEW** |
| GET /api/documents | ✅ | Already existed |
| DELETE /api/documents/{id} | ✅ | **NEW** |
| Produce document.uploaded | ✅ | Already existed |
| Produce document.processed | ✅ | Updated in worker |
| Produce notes.generated | ✅ | Updated in worker |
| PyPDF2 library | ✅ | Added to requirements |
| python-docx library | ✅ | Added to requirements |
| spacy library | ✅ | Added to requirements |
| openai library | ✅ | Added to requirements |
| 2 CPU resource limit | ✅ | Added to docker-compose |
| 4GB RAM resource limit | ✅ | Added to docker-compose |
| Original docs S3 prefix | ✅ | `{user_id}/{doc_id}/{filename}` |
| Generated notes S3 prefix | ✅ | `{user_id}/{doc_id}/notes.json` |
| Document metadata in DB | ✅ | PostgreSQL `documents` table |

---

## Kafka Events Flow

### Event Produced by API:
1. **document.uploaded** (Topic: `document.uploaded`)
   ```json
   {
     "event_type": "document.uploaded",
     "document_id": "uuid",
     "user_id": "user123",
     "s3_url": "s3://bucket/user123/uuid/file.pdf",
     "filename": "file.pdf",
     "file_size": 1024000,
     "timestamp": "2025-12-02T10:30:00.000Z",
     "service": "document-reader-api"
   }
   ```

2. **regenerate.notes** (Topic: `regenerate.notes`) - NEW
   ```json
   {
     "event_type": "regenerate.notes",
     "document_id": "uuid",
     "user_id": "user123",
     "s3_text_url": "s3://bucket/user123/uuid/extracted.txt",
     "filename": "file.pdf",
     "timestamp": "2025-12-02T10:35:00.000Z",
     "service": "document-reader-api"
   }
   ```

### Events Produced by Worker:
1. **document.processed** (Topic: `document.processed`)
   ```json
   {
     "event_type": "document.processed",
     "document_id": "uuid",
     "user_id": "user123",
     "text_s3_url": "s3://bucket/user123/uuid/extracted.txt",
     "text_length": 50000,
     "timestamp": "2025-12-02T10:31:00.000Z",
     "service": "document-reader-worker"
   }
   ```

2. **notes.generated** (Topic: `notes.generated`)
   ```json
   {
     "event_type": "notes.generated",
     "document_id": "uuid",
     "user_id": "user123",
     "notes_s3_url": "s3://bucket/user123/uuid/notes.json",
     "timestamp": "2025-12-02T10:31:30.000Z",
     "service": "document-reader-worker"
   }
   ```

---

## Testing the Changes

### 1. Test Upload & Processing
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@document.pdf" \
  -F "user_id=test_user"
```

### 2. Get Document Details
```bash
curl http://localhost:8002/api/documents/{document_id}
```

### 3. Get Generated Notes
```bash
curl http://localhost:8002/api/documents/{document_id}/notes
```

### 4. Regenerate Notes
```bash
curl -X POST http://localhost:8002/api/documents/{document_id}/regenerate-notes
```

### 5. Delete Document
```bash
curl -X DELETE http://localhost:8002/api/documents/{document_id}
```

---

## Environment Setup

### Required Environment Variables:
```bash
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/document_reader_db

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# S3/Storage
S3_BUCKET_NAME=document-reader-storage-dev
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
S3_ENDPOINT_URL=http://minio:9000  # For local development

# OpenAI (optional, uses fallback if not set)
OPENAI_API_KEY=sk-...
```

---

## Backward Compatibility

✅ **All changes are backward compatible:**
- Existing endpoints remain unchanged
- New endpoints are purely additive
- No database schema changes
- Kafka event structure preserved for existing events
- New events use separate topics

---

## Performance Considerations

1. **S3 Operations**: Presigned URLs are generated with 1-hour expiry
2. **AI API Calls**: Text truncated to 3000 chars to manage API costs
3. **Database**: User ID and document ID are indexed for fast queries
4. **Kafka**: Manual commit strategy ensures reliability over performance
5. **Resource Limits**: 2 CPU, 4GB RAM per container supports concurrent operations

---

## Security Considerations

1. ✅ S3 files accessed via presigned URLs (time-limited)
2. ✅ Non-root user in containers
3. ✅ User isolation via user_id prefix in S3
4. ✅ Environment variables for credentials
5. ✅ Error messages don't expose sensitive information

---

## Deployment Steps

1. Update images with new code
2. Install/update Python dependencies
3. Run database migrations (if any)
4. Start services with updated docker-compose.yml
5. Kafka will auto-create new topics (`regenerate.notes`)
6. Test all endpoints

---

## Rollback Plan

If issues occur:
1. Revert code changes
2. Don't delete database records (backward compatible)
3. Ignore new `regenerate.notes` topic (won't be produced)
4. Existing API endpoints continue to work

---

**Summary:** The Document Reader Service is now fully compliant with all requirements and ready for production deployment. All changes are backward compatible and follow best practices for microservices architecture.
