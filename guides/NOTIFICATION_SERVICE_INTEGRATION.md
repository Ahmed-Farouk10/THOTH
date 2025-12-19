# 🔔 Notification Service - Document Service Integration Guide

## ✅ **COMPLETE & WORKING**

The Notification Service is **fully integrated** with the Document Service and ready to consume events.

---

## 🎯 What Was Done

### 1. **Enhanced Notification Service** (`notification-service/main.py`)

✅ **Robust Kafka Consumer:**
- Retry logic with exponential backoff (5 retries, 5s delay)
- Proper error handling for Kafka connection failures
- Detailed logging with emojis for easy debugging
- Extracts `document_id`, `user_id`, `event_type` from events

✅ **Event Processing:**
- Processes `document.processed` events from document-worker
- Processes `notes.generated` events from document-worker
- Stores full event payload in `notification_logs` table
- Commits Kafka offsets only after successful DB write

✅ **HTTP API Endpoints:**
- `GET /health` - Health check with topic list
- `GET /api/notifications` - Query notifications (filter by user_id, topic, event_type)
- `GET /api/notifications/{id}` - Get specific notification
- `GET /api/notifications/stats` - Statistics (counts by topic/event_type)

### 2. **Database Schema** (`notification-service/models.py`)

```sql
notification_logs:
- id (UUID)
- topic (e.g., "document.processed")
- event_type (e.g., "document.processed.v1")
- user_id
- raw_event (full JSON payload)
- created_at
```

### 3. **Docker Integration** (`docker-compose.yml`)

✅ **Proper Startup Order:**
- `notification-db` starts first (health check)
- `kafka` must be ready
- `document-worker` must be ready (can produce events)
- `notification-service` starts last

✅ **Health Checks:**
- Database health check
- Service health check endpoint

### 4. **Test Scripts**

✅ **Bash:** `scripts/test-notification-integration.sh`
✅ **PowerShell:** `scripts/test-notification-integration.ps1`

Both scripts verify:
- Notification service health
- Event consumption
- Query endpoints work

---

## 🚀 How to Test End-to-End

### Step 1: Start All Services

```bash
docker-compose up -d
```

**Wait for services to be healthy:**
```bash
docker-compose ps
```

### Step 2: Verify Notification Service is Running

```bash
# Health check
curl http://localhost:8003/health

# Should return:
# {
#   "status": "healthy",
#   "service": "notification-service",
#   "topics_subscribed": [...],
#   "consumer_group": "notification-service-group"
# }
```

### Step 3: Upload a Document (Triggers Events)

```bash
# 1. Register/Login to get JWT token
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123"
  }'

# 2. Login
TOKEN=$(curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }' | jq -r '.access_token')

# 3. Upload document
curl -X POST http://localhost/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf"
```

### Step 4: Wait for Processing

Document-worker will:
1. Consume `document.uploaded` event
2. Process document (extract text, generate notes)
3. Produce `document.processed` event ✅
4. Produce `notes.generated` event ✅

### Step 5: Check Notifications

```bash
# See all notifications
curl http://localhost:8003/api/notifications

# Filter by topic
curl http://localhost:8003/api/notifications?topic=document.processed
curl http://localhost:8003/api/notifications?topic=notes.generated

# Get stats
curl http://localhost:8003/api/notifications/stats

# Filter by user
curl http://localhost:8003/api/notifications?user_id=USER_ID
```

**Expected Results:**
- ✅ `document.processed` event logged
- ✅ `notes.generated` event logged
- ✅ Both have same `document_id` and `user_id`
- ✅ Full event payload stored in `raw_event` field

---

## 📊 Event Flow Diagram

```
Document Upload Flow:
┌─────────────┐
│  Aggregator │
└──────┬──────┘
       │ POST /api/documents/upload
       ▼
┌──────────────────┐
│ Document Service │
│   (API)          │
└──────┬───────────┘
       │ 1. Upload to S3
       │ 2. Save metadata to DB
       │ 3. Produce: document.uploaded
       ▼
┌──────────────────┐
│ Kafka Topic:     │
│ document.uploaded│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Document Worker  │
└──────┬───────────┘
       │ 1. Process document
       │ 2. Extract text
       │ 3. Generate notes
       │ 4. Produce: document.processed ✅
       │ 5. Produce: notes.generated ✅
       ▼
┌──────────────────┐
│ Kafka Topics:    │
│ - document.      │
│   processed      │
│ - notes.generated│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Notification     │
│ Service          │
└──────────────────┘
       │
       ├─→ Consumes events ✅
       ├─→ Logs to database ✅
       └─→ Ready for WebSocket/SES (Phase 3)
```

---

## 🔍 Troubleshooting

### Not Receiving Events?

1. **Check Kafka topics exist:**
   ```bash
   docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
   ```
   Should see: `document.processed`, `notes.generated`

2. **Check consumer group:**
   ```bash
   docker-compose exec kafka kafka-consumer-groups \
     --bootstrap-server localhost:9092 \
     --group notification-service-group \
     --describe
   ```

3. **Check notification service logs:**
   ```bash
   docker-compose logs -f notification-service
   ```
   Look for:
   - ✅ "Starting Kafka consumer"
   - ✅ "Notification event received"
   - ✅ "Notification logged successfully"

4. **Check document-worker logs:**
   ```bash
   docker-compose logs -f document-worker
   ```
   Look for:
   - ✅ "Produced events for document {id}"
   - ✅ "Produced document.processed event"
   - ✅ "Produced notes.generated event"

### Database Connection Issues?

```bash
# Check database is healthy
docker-compose ps notification-db

# Check connection string
docker-compose exec notification-service env | grep DATABASE_URL
```

### Consumer Not Starting?

```bash
# Check Kafka is accessible
docker-compose exec notification-service ping kafka

# Check Kafka port
docker-compose exec notification-service nc -zv kafka 9092
```

---

## 📈 Monitoring

### View Notification Stats

```bash
curl http://localhost:8003/api/notifications/stats
```

**Response:**
```json
{
  "total_notifications": 10,
  "by_topic": {
    "document.processed": 5,
    "notes.generated": 5
  },
  "by_event_type": {
    "document.processed.v1": 5,
    "notes.generated.v1": 5
  }
}
```

### Query Recent Notifications

```bash
curl http://localhost:8003/api/notifications?limit=10
```

---

## ✅ Verification Checklist

- [x] Notification service starts successfully
- [x] Kafka consumer connects to topics
- [x] Database tables created
- [x] Document-worker produces `document.processed` events
- [x] Document-worker produces `notes.generated` events
- [x] Notification service consumes events
- [x] Events stored in `notification_logs` table
- [x] HTTP endpoints return data
- [x] Health check works
- [x] Stats endpoint works

---

## 🎯 Next Steps (Phase 3)

1. **WebSocket Server:**
   - Push notifications to frontend in real-time
   - Filter by `user_id` for user-specific notifications

2. **Email Notifications:**
   - Integrate AWS SES
   - Send emails for important events (quiz ready, document processed)

3. **Notification Preferences:**
   - User preferences for notification types
   - Opt-in/opt-out per event type

---

**Status:** ✅ **FULLY FUNCTIONAL & TESTED**

The Notification Service is production-ready for Phase 2 and can be extended with WebSocket/SES in Phase 3.

