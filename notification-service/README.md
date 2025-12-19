# Notification Service

Event consumer service that receives completion events from other services (Document Service, Quiz Service, etc.) and logs them for audit and future notification delivery.

## Architecture Alignment

✅ **Matches ARCHITECTURE.md and COMMUNICATION_MATRIX.md**

- **Single Responsibility**: Only consumes events and logs notifications
- **Storage Isolation**: Own PostgreSQL database (`notification_db`)
- **Event-Driven**: Pure Kafka consumer, no HTTP calls to other services
- **Consumer Group**: `notification-service-group`

## Events Consumed

| Topic | Producer | Purpose |
|-------|----------|---------|
| `document.processed` | Document Worker | Document processing complete |
| `notes.generated` | Document Worker | Notes generated from document |
| `quiz.generated` | Quiz Service | Quiz generation complete |
| `audio.generation.completed` | TTS Service | Audio generation complete |
| `audio.transcription.completed` | STT Service | Transcription complete |
| `chat.message` | Chat Service | Chat message sent |
| `user.created` | User Service | New user registered |

## API Endpoints

### Health Check
```
GET /health
```

### Query Notifications
```
GET /api/notifications?user_id={user_id}&topic={topic}&limit=50
```

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `topic` (optional): Filter by topic (e.g., `document.processed`)
- `event_type` (optional): Filter by event type
- `limit` (default: 50): Max results
- `offset` (default: 0): Pagination offset

### Get Notification by ID
```
GET /api/notifications/{notification_id}
```

### Statistics
```
GET /api/notifications/stats
```

Returns counts by topic and event_type.

## Testing Document Service Integration

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Upload a document** (via Aggregator):
   ```bash
   curl -X POST http://localhost/api/documents/upload \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "file=@test.pdf"
   ```

3. **Wait for processing** (document-worker processes the document)

4. **Check notifications:**
   ```bash
   # See all notifications
   curl http://localhost:8003/api/notifications

   # Filter by topic
   curl http://localhost:8003/api/notifications?topic=document.processed

   # Filter by user
   curl http://localhost:8003/api/notifications?user_id=USER_ID

   # Get stats
   curl http://localhost:8003/api/notifications/stats
   ```

5. **Expected Results:**
   - You should see `document.processed` event logged
   - You should see `notes.generated` event logged
   - Both should have the same `document_id` and `user_id`

## Database Schema

```sql
CREATE TABLE notification_logs (
    id VARCHAR(36) PRIMARY KEY,
    topic VARCHAR(100) NOT NULL,
    event_type VARCHAR(100),
    user_id VARCHAR(64),
    raw_event TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_topic ON notification_logs(topic);
CREATE INDEX idx_notification_logs_event_type ON notification_logs(event_type);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `KAFKA_BOOTSTRAP_SERVERS`: Kafka broker address (default: `kafka:9092`)
- `SERVICE_NAME`: Service name (default: `notification-service`)
- `LOG_LEVEL`: Logging level (default: `INFO`)

## Future Enhancements (Phase 3)

- **WebSocket Server**: Push notifications to frontend in real-time
- **Email Notifications**: Send emails via AWS SES
- **Notification Preferences**: User preferences for notification types
- **Rate Limiting**: Prevent notification spam

## Troubleshooting

### Not receiving events?

1. **Check Kafka topics exist:**
   ```bash
   docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
   ```

2. **Check consumer group:**
   ```bash
   docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --group notification-service-group --describe
   ```

3. **Check service logs:**
   ```bash
   docker-compose logs -f notification-service
   ```

4. **Verify document-worker is producing events:**
   ```bash
   docker-compose logs -f document-worker | grep "Produced events"
   ```

### Database connection issues?

- Ensure `notification-db` is healthy: `docker-compose ps notification-db`
- Check `DATABASE_URL` environment variable
- Verify database credentials in `docker-compose.yml`

