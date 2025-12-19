# 🔄 Communication Matrix - Quick Reference

This document provides a visual overview of all service communications: synchronous (HTTP), asynchronous (Kafka), and WebSocket.

---

## 📊 Communication Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMUNICATION TYPES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔄 SYNCHRONOUS (HTTP)                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Frontend → API Gateway → Aggregator                     │  │
│  │ Aggregator → User Service (JWT verification)           │  │
│  │ Aggregator → Services (optional sync calls)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📨 ASYNCHRONOUS (Kafka)                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Aggregator → Kafka Topics → Services                     │  │
│  │ Services → Kafka Topics → Other Services                 │  │
│  │ Services → Kafka Topics → Notification Service          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  🔔 WEBSOCKET (Real-time Push)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Notification Service → Frontend (WebSocket)             │  │
│  │ Push: quiz_ready, audio_ready, document_ready          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 SYNCHRONOUS COMMUNICATION (HTTP)

### Request-Response Flow

| From | To | Endpoint | Purpose | Response Time |
|------|-----|----------|---------|---------------|
| **Frontend** | **API Gateway** | `POST /api/*` | All API requests | < 100ms |
| **API Gateway** | **Aggregator** | `POST /api/*` | Route to aggregator | < 50ms |
| **Aggregator** | **User Service** | `GET /api/auth/verify` | JWT verification | < 200ms |
| **Aggregator** | **Chat Service** | `POST /api/chat/message` | Get chat response (optional) | < 5s |
| **Aggregator** | **Quiz Service** | `GET /api/quiz/{id}/status` | Get quiz status (optional) | < 500ms |

### Example Flow
```
User → [HTTPS] → API Gateway → [HTTP] → Aggregator
                                    ↓
                              [HTTP] User Service (verify JWT)
                                    ↓
                              Return user context
                                    ↓
                              Aggregator → Return to User
```

---

## 📨 ASYNCHRONOUS COMMUNICATION (Kafka)

### Complete Producer → Topic → Consumer Matrix

#### Topic: `document.uploaded`
```
PRODUCER: Document Service
    │
    │ (After receiving HTTP upload from Aggregator)
    │
    └─→ [Kafka Topic: document.uploaded]
            │
            └─→ CONSUMER: Document Service (internal workers)
                (Consumer Group: document-service-group)
```

#### Topic: `document.processed`
```
PRODUCER: Document Service
    │
    └─→ [Kafka Topic: document.processed]
            │
            ├─→ CONSUMER: Quiz Service
            │   (Consumer Group: quiz-service-group)
            │
            └─→ CONSUMER: Chat Service
                (Consumer Group: chat-service-group)
```

#### Topic: `notes.generated`
```
PRODUCER: Document Service
    │
    └─→ [Kafka Topic: notes.generated]
            │
            └─→ CONSUMER: Notification Service
                (Consumer Group: notification-service-group)
                (WebSocket push to user)
```

#### Topic: `quiz.requested`
```
PRODUCER: Aggregator
    │
    └─→ [Kafka Topic: quiz.requested]
            │
            │   (Includes: reply_to, correlation_id)
            │
            └─→ CONSUMER: Quiz Service
                (Consumer Group: quiz-service-group)
```

#### Topic: `quiz.generated`
```
PRODUCER: Quiz Service
    │
    └─→ [Kafka Topic: quiz.generated]
            │
            └─→ CONSUMER: Notification Service
                (Consumer Group: notification-service-group)
                (WebSocket push to user)
                
Note: Aggregator does NOT consume this (stateless BFF).
      User receives WebSocket notification, then calls
      GET /api/quiz/{id} to fetch the quiz.
```

#### Topic: `audio.generation.requested`
```
PRODUCER: Aggregator
    │
    └─→ [Kafka Topic: audio.generation.requested]
            │
            └─→ CONSUMER: TTS Service
                (Consumer Group: tts-service-group)
```

#### Topic: `audio.generation.completed`
```
PRODUCER: TTS Service
    │
    └─→ [Kafka Topic: audio.generation.completed]
            │
            └─→ CONSUMER: Notification Service
                (Consumer Group: notification-service-group)
                (WebSocket push to user)
                
Note: Aggregator does NOT consume this (stateless BFF).
      User receives WebSocket notification with audio URL.
```

#### Topic: `audio.transcription.requested`
```
PRODUCER: Aggregator
    │
    └─→ [Kafka Topic: audio.transcription.requested]
            │
            └─→ CONSUMER: STT Service
                (Consumer Group: stt-service-group)
```

#### Topic: `audio.transcription.completed`
```
PRODUCER: STT Service
    │
    └─→ [Kafka Topic: audio.transcription.completed]
            │
            ├─→ CONSUMER: Chat Service
            │   (Consumer Group: chat-service-group)
            │   (Use transcription in chat context)
            │
            └─→ CONSUMER: Notification Service
                (Consumer Group: notification-service-group)
                (WebSocket push to user)
                
Note: Aggregator does NOT consume this (stateless BFF).
```

#### Topic: `chat.message`
```
PRODUCER: Chat Service
    │
    │ (After processing chat message via HTTP)
    │
    └─→ [Kafka Topic: chat.message]
            │
            ├─→ CONSUMER: Notification Service
            │   (Consumer Group: notification-service-group)
            │
            └─→ CONSUMER: Analytics Service (future)
                (Consumer Group: analytics-service-group)
                
Note: Aggregator does NOT produce this. Chat Service
      handles the message and produces the event.
```

#### Topic: `user.created`
```
PRODUCER: User Service
    │
    └─→ [Kafka Topic: user.created]
            │
            └─→ CONSUMER: Notification Service
                (Consumer Group: notification-service-group)
                (Send welcome email)
```

#### Topic: `platform.aggregator.replies`
```
PRODUCERS: All Services (Quiz, TTS, STT, Document, etc.)
    │
    └─→ [Kafka Topic: platform.aggregator.replies]
            │
            │   (Contains: correlation_id for matching)
            │
            └─→ CONSUMER: Aggregator
                (Consumer Group: aggregator-replies-group)
                (Request-reply pattern)
```

---

## 🔔 WEBSOCKET NOTIFICATIONS

### Notification Service → Frontend

**Connection:** `ws://api-gateway/notifications?token={jwt_token}`

**Events Consumed by Notification Service:**
- `quiz.generated` → Push: `{"type": "quiz_ready", "quiz_id": "...", "document_id": "..."}`
- `audio.generation.completed` → Push: `{"type": "audio_ready", "audio_id": "...", "s3_uri": "..."}`
- `document.processed` → Push: `{"type": "document_ready", "document_id": "...", "notes_available": true}`
- `chat.message` → Push: `{"type": "chat_response", "conversation_id": "...", "message": "..."}`
- `user.created` → Push: `{"type": "welcome", "user_id": "..."}`

**Flow:**
```
Service → [Kafka PRODUCE] Event
            ↓
    Notification Service [Kafka CONSUME]
            ↓
    Notification Service → [WebSocket] Frontend
            {
              "type": "quiz_ready",
              "quiz_id": "quiz-123",
              "user_id": "user-456",
              "timestamp": "2025-12-01T12:00:00Z"
            }
            ↓
    Frontend receives real-time notification
    (Updates UI, shows toast, etc.)
```

---

## 🔀 Complete Service Communication Map

### Aggregator Service

**Synchronous (HTTP):**
- → User Service: JWT verification
- ← User Service: User context

**Asynchronous (Kafka Producer):**
- → `quiz.requested` (command)
- → `audio.generation.requested` (command)
- → `audio.transcription.requested` (command)

**Asynchronous (Kafka Consumer):**
- ← `platform.aggregator.replies` (request-reply pattern only)

**Note:** Aggregator does NOT produce domain events like `document.uploaded` or `chat.message`.
      It delegates to services via HTTP, and services produce events.
      Aggregator does NOT consume domain events (stateless BFF).

### Document Service

**Synchronous (HTTP):**
- ← Aggregator: `POST /api/documents/upload` (receives file)

**Asynchronous (Kafka Consumer):**
- ← `document.uploaded` (internal workers consume)

**Asynchronous (Kafka Producer):**
- → `document.uploaded` (after receiving HTTP upload)
- → `document.processed`
- → `notes.generated`

**Storage:**
- → S3: `document-reader-storage-{env}-*`
- → RDS: `document-reader-db`

### Quiz Service

**Asynchronous (Kafka Consumer):**
- ← `document.processed` (from Document Service - uses source text)
- ← `quiz.requested` (from Aggregator or Chat Service)

**Asynchronous (Kafka Producer):**
- → `quiz.generated`
- → `platform.aggregator.replies` (request-reply, if sync mode)

**Note:** Quiz Service uses `document.processed` (source text), NOT `notes.generated` (summary).
      This ensures quiz questions have full detail from the document.

**Storage:**
- → S3: `quiz-service-storage-{env}-*`
- → RDS: `quiz-service-db`

### Chat Service

**Synchronous (HTTP):**
- ← Aggregator: `POST /api/chat/message` (receives chat request)

**Asynchronous (Kafka Consumer):**
- ← `document.processed` (from Document Service - for knowledge base)
- ← `audio.transcription.completed` (from STT Service - use in chat context)

**Asynchronous (Kafka Producer):**
- → `chat.message` (after processing chat)
- → `quiz.requested` (if user asks for quiz)
- → `audio.generation.requested` (if user asks for TTS)

**Storage:**
- → S3: `chat-service-storage-{env}-*`
- → RDS: `chat-service-db`

### TTS Service

**Asynchronous (Kafka Consumer):**
- ← `audio.generation.requested` (from Aggregator)

**Asynchronous (Kafka Producer):**
- → `audio.generation.completed`
- → `platform.aggregator.replies` (request-reply)

**Storage:**
- → S3: `tts-service-storage-{env}-*`

### STT Service

**Asynchronous (Kafka Consumer):**
- ← `audio.transcription.requested` (from Aggregator)

**Asynchronous (Kafka Producer):**
- → `audio.transcription.completed`
- → `platform.aggregator.replies` (request-reply)

**Storage:**
- → S3: `stt-service-storage-{env}-*`

### Notification Service

**Asynchronous (Kafka Consumer):**
- ← `quiz.generated` (from Quiz Service)
- ← `audio.generation.completed` (from TTS Service)
- ← `audio.transcription.completed` (from STT Service)
- ← `document.processed` (from Document Service)
- ← `notes.generated` (from Document Service)
- ← `chat.message` (from Chat Service)
- ← `user.created` (from User Service)

**WebSocket (Producer):**
- → Frontend: Real-time push notifications
  - `{"type": "quiz_ready", "quiz_id": "..."}`
  - `{"type": "audio_ready", "audio_id": "..."}`
  - `{"type": "document_ready", "document_id": "..."}`
  - `{"type": "notes_ready", "document_id": "..."}`

**External:**
- → AWS SES: Send emails

**Storage:**
- → RDS: `notification-db` (audit logs)

**Key Role:** Notification Service is the ONLY consumer of completion events.
            It pushes notifications via WebSocket, and users fetch data via HTTP GET.

### User Service

**Synchronous (HTTP):**
- ← Aggregator: JWT verification requests

**Asynchronous (Kafka Producer):**
- → `user.created`

**Storage:**
- → RDS: `user-management-db`

---

## 🎯 Decision Matrix: When to Use What?

| Scenario | Use | Why |
|----------|-----|-----|
| JWT verification | **HTTP (Sync)** | Immediate response needed |
| Document upload | **Kafka (Async)** | Long processing time |
| Quiz generation | **Kafka (Async)** | AI processing takes time |
| Get quiz status | **HTTP (Sync)** | Quick lookup |
| Chat message | **Kafka (Async)** | AI processing, decoupling |
| Quiz ready notification | **WebSocket** | Real-time push to user |
| User registration | **Kafka (Async)** | Welcome email can be async |

---

## 📝 Quick Reference

**Synchronous (HTTP):**
- ✅ Immediate responses
- ✅ Request-response pattern
- ✅ JWT verification
- ✅ Status checks

**Asynchronous (Kafka):**
- ✅ Long-running operations
- ✅ Event-driven patterns
- ✅ Service decoupling
- ✅ Scalability

**WebSocket:**
- ✅ Real-time notifications
- ✅ Push updates to frontend
- ✅ Better UX than polling

---

**Last Updated:** 2025-12-01  
**Version:** 1.0.0

