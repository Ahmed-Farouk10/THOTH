# 🏗️ Cloud-Based Learning Platform - Complete Architecture Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Event Flow Diagrams](#event-flow-diagrams)
4. [Kafka Topics Specification](#kafka-topics-specification)
5. [Service Communication Patterns](#service-communication-patterns)
   - [5.1 Synchronous Communication (HTTP)](#51-synchronous-communication-http-)
   - [5.2 Asynchronous Communication (Kafka)](#52-asynchronous-communication-kafka-)
   - [5.3 Request-Reply Pattern](#53-request-reply-pattern-hybrid-async-command--sync-response)
   - [5.4 WebSocket Notifications](#54-websocket-notifications-real-time-push-)
6. [Storage Architecture](#storage-architecture)
7. [SOLID Principles Application](#solid-principles-application)
8. [Security Architecture](#security-architecture)
9. [Deployment Architecture](#deployment-architecture)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Browser    │  │   Mobile App │  │  API Client  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │ HTTPS/TLS 1.3    │                  │
          │ JWT Auth         │                  │
┌─────────▼──────────────────▼──────────────────────────────────────┐
│                    EDGE / INGRESS LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Application Load Balancer (ALB)                      │  │
│  │         - SSL Termination (ACM Certificate)                  │  │
│  │         - Health Checks                                      │  │
│  │         - AWS WAF Protection                                 │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                          │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │              API Gateway (Kong / Nginx)                      │  │
│  │              - Route: /api/* → Aggregator                   │  │
│  │              - JWT Validation                               │  │
│  │              - Rate Limiting                                │  │
│  │              - CORS Management                              │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────────────┐
│              KUBERNETES CLUSTER (Private Subnets)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    AGGREGATOR SERVICE (BFF)                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │   Pod 1      │  │   Pod 2      │  │   Pod 3      │     │ │
│  │  │  Port: 8080  │  │  Port: 8080  │  │  Port: 8080  │     │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │ │
│  │         │                 │                 │              │ │
│  │         └─────────────────┼─────────────────┘              │ │
│  │                           │                                │ │
│  │         ┌─────────────────▼─────────────────┐            │ │
│  │         │  ServiceAccount: aggregator-sa    │            │ │
│  │         │  IAM Role: aggregator-role         │            │ │
│  │         └─────────────────┬─────────────────┘            │ │
│  └─────────┼─────────────────┼───────────────────────────────┘ │
│            │                   │                                │
│            │ HTTP Sync         │ Kafka Producer                 │
│            │                   │                                │
│  ┌─────────▼──────────┐  ┌────▼─────────────────────────────┐ │
│  │  MICROSERVICES      │  │  KAFKA CLUSTER                   │ │
│  │                     │  │  ┌──────────┐  ┌──────────┐     │ │
│  │  ┌──────────────┐  │  │  │ Broker 1 │  │ Broker 2 │     │ │
│  │  │User Service  │  │  │  │ Broker 3 │  └──────────┘     │ │
│  │  └──────┬───────┘  │  │  └────┬─────┘                    │ │
│  │         │          │  │       │                           │ │
│  │  ┌──────▼───────┐  │  │  ┌────▼──────────────────────┐  │ │
│  │  │Document Svc  │  │  │  │  ZOOKEEPER ENSEMBLE        │  │ │
│  │  └──────┬───────┘  │  │  │  ┌────┐  ┌────┐  ┌────┐   │  │ │
│  │         │          │  │  │  │ ZK1│  │ ZK2│  │ ZK3│   │  │ │
│  │  ┌──────▼───────┐  │  │  │  └────┘  └────┘  └────┘   │  │ │
│  │  │Quiz Service  │  │  │  └───────────────────────────┘  │ │
│  │  └──────┬───────┘  │  │                                  │ │
│  │         │          │  │  ┌──────────────────────────┐   │ │
│  │  ┌──────▼───────┐  │  │  │  10 KAFKA TOPICS         │   │ │
│  │  │Chat Service  │  │  │  │  - document.uploaded     │   │ │
│  │  └──────┬───────┘  │  │  │  - document.processed    │   │ │
│  │         │          │  │  │  - notes.generated       │   │ │
│  │  ┌──────▼───────┐  │  │  │  - quiz.requested       │   │ │
│  │  │TTS Service   │  │  │  │  - quiz.generated       │   │ │
│  │  └──────┬───────┘  │  │  │  - audio.transcription.*│   │ │
│  │         │          │  │  │  - audio.generation.*    │   │ │
│  │  ┌──────▼───────┐  │  │  │  - chat.message        │   │ │
│  │  │STT Service   │  │  │  │  - user.created         │   │ │
│  │  └──────┬───────┘  │  │  └──────────────────────────┘   │ │
│  │         │          │  │                                  │ │
│  │  ┌──────▼───────┐  │  │                                  │ │
│  │  │Notification │  │  │                                  │ │
│  │  │Service      │  │  │                                  │ │
│  │  └─────────────┘  │  │                                  │ │
│  └───────────────────┼──┼──────────────────────────────────┘ │
│                      │  │                                    │
│                      │  │ Kafka Consumer                     │
│                      └──┼────────────────────────────────────┘
│                         │
└─────────────────────────┼──────────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────────┐
│                    STORAGE LAYER                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  S3 BUCKETS (Isolated per Service)                       │ │
│  │  ┌──────────────────┐  ┌──────────────────┐             │ │
│  │  │document-reader-  │  │quiz-service-     │             │ │
│  │  │storage-dev-*     │  │storage-dev-*     │             │ │
│  │  └──────────────────┘  └──────────────────┘             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐             │ │
│  │  │chat-service-     │  │tts-service-       │             │ │
│  │  │storage-dev-*     │  │storage-dev-*     │             │ │
│  │  └──────────────────┘  └──────────────────┘             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐             │ │
│  │  │stt-service-      │  │shared-assets-     │             │ │
│  │  │storage-dev-*     │  │dev-*              │             │ │
│  │  └──────────────────┘  └──────────────────┘             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  RDS DATABASES (Isolated per Service)                    │ │
│  │  ┌──────────────────┐  ┌──────────────────┐             │ │
│  │  │user-management- │  │chat-service-db   │             │ │
│  │  │db               │  │                  │             │ │
│  │  └──────────────────┘  └──────────────────┘             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐             │ │
│  │  │document-reader-   │  │quiz-service-db   │             │ │
│  │  │db                 │  │                  │             │ │
│  │  └──────────────────┘  └──────────────────┘             │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Layers

### 2.1 Client Layer
- **Frontend**: React SPA hosted on S3 + CloudFront
- **Mobile**: React Native (future)
- **API Clients**: External integrations

### 2.2 Edge Layer
- **ALB**: Internet-facing, SSL termination
- **API Gateway**: Kong/Nginx for routing and auth

### 2.3 Application Layer
- **Aggregator (BFF)**: Orchestrates microservices, handles client-specific logic
- **Microservices**: 7 services implementing business capabilities

### 2.4 Event Layer
- **Kafka Cluster**: 3 brokers, 3 Zookeeper nodes
- **Topics**: 10 topics for event-driven communication

### 2.5 Storage Layer
- **S3**: 6 isolated buckets per service
- **RDS**: 4 PostgreSQL databases per service
- **EBS**: Persistent volumes for Kafka/Zookeeper

---

## 3. Event Flow Diagrams

### 3.1 Document Upload → Quiz Generation Flow

```
User → ALB → API Gateway → Aggregator
                                    │
                                    ├─→ [HTTP] User Service (verify JWT)
                                    │
                                    ├─→ [S3 PUT] Upload document to S3
                                    │   Bucket: document-reader-storage-dev-*
                                    │
                                    └─→ [Kafka PRODUCE] document.uploaded
                                        Topic: document.uploaded
                                        Key: document_id
                                        │
                                        └─→ Document Service (Consumer)
                                            │
                                            ├─→ Process document (OCR, extraction)
                                            ├─→ Store metadata in document-reader-db
                                            ├─→ Generate notes (AI)
                                            │
                                            └─→ [Kafka PRODUCE] document.processed
                                                Topic: document.processed
                                                Key: document_id
                                                │
                                                ├─→ Quiz Service (Consumer)
                                                │   │
                                                │   ├─→ Store document reference
                                                │   └─→ Wait for quiz.requested
                                                │
                                                └─→ Chat Service (Consumer)
                                                    │
                                                    └─→ Store in knowledge base

User → Aggregator → [Kafka PRODUCE] quiz.requested
                    Topic: quiz.requested
                    Key: document_id
                    │
                    └─→ Quiz Service (Consumer)
                        │
                        ├─→ Fetch document content from Kafka event
                        ├─→ Generate quiz questions (AI)
                        ├─→ Store quiz in quiz-service-db
                        ├─→ Store quiz JSON in quiz-service-storage S3
                        │
                        └─→ [Kafka PRODUCE] quiz.generated
                            Topic: quiz.generated
                            Key: quiz_id
                            │
                            ├─→ Aggregator (Consumer - for response)
                            │
                            └─→ Notification Service (Consumer)
                                │
                                └─→ Send email via SES
```

### 3.2 Chat Message Flow

```
User → Aggregator → [Kafka PRODUCE] chat.message
                    Topic: chat.message
                    Key: conversation_id
                    │
                    └─→ Chat Service (Consumer)
                        │
                        ├─→ Load conversation context from chat-service-db
                        ├─→ Load document knowledge from consumed events
                        ├─→ Generate AI response (OpenAI/LangChain)
                        ├─→ Store message in chat-service-storage S3
                        ├─→ Update conversation in chat-service-db
                        │
                        └─→ [HTTP Response] Return to Aggregator
                            │
                            └─→ Return to User
```

### 3.3 Audio Processing Flow (TTS)

```
User → Aggregator → [Kafka PRODUCE] audio.generation.requested
                    Topic: audio.generation.requested
                    Key: request_id
                    │
                    └─→ TTS Service (Consumer)
                        │
                        ├─→ Generate audio from text (TTS engine)
                        ├─→ Store audio in tts-service-storage S3
                        ├─→ Store metadata (optional DB)
                        │
                        └─→ [Kafka PRODUCE] audio.generation.completed
                            Topic: audio.generation.completed
                            Key: audio_id
                            │
                            ├─→ Aggregator (Consumer)
                            │
                            └─→ Notification Service (Consumer)
```

---

## 4. Kafka Topics Specification

### 4.1 Topic Configuration Matrix

| Topic Name | Partitions | Replication Factor | Min ISR | Retention | Cleanup Policy | Partition Key | Producer | Consumers |
|------------|------------|-------------------|---------|-----------|----------------|---------------|----------|-----------|
| `document.uploaded` | 6 | 3 | 2 | 7 days | delete | `document_id` | Document Service | Document Service (internal workers) |
| `document.processed` | 6 | 3 | 2 | 30 days | delete | `document_id` | Document Service | Quiz Service, Chat Service, Notification Service |
| `notes.generated` | 4 | 3 | 2 | 30 days | compact | `document_id` | Document Service | Notification Service |
| `quiz.requested` | 4 | 3 | 2 | 7 days | delete | `document_id` | Aggregator, Chat Service | Quiz Service |
| `quiz.generated` | 6 | 3 | 2 | 30 days | delete | `quiz_id` | Quiz Service | Notification Service |
| `audio.transcription.requested` | 3 | 3 | 2 | 7 days | delete | `audio_id` | Aggregator | STT Service |
| `audio.transcription.completed` | 3 | 3 | 2 | 30 days | delete | `audio_id` | STT Service | Chat Service, Notification Service |
| `audio.generation.requested` | 3 | 3 | 2 | 7 days | delete | `request_id` | Aggregator, Chat Service | TTS Service |
| `audio.generation.completed` | 3 | 3 | 2 | 30 days | delete | `audio_id` | TTS Service | Notification Service |
| `chat.message` | 12 | 3 | 2 | 14 days | delete | `conversation_id` | Chat Service | Notification Service, Analytics |
| `user.created` | 3 | 3 | 2 | 30 days | delete | `user_id` | User Service | Notification Service |
| `platform.aggregator.replies` | 6 | 3 | 2 | 1 hour | delete | `correlation_id` | All Services | Aggregator |

### 4.2 Complete Producer-Consumer Matrix

#### Producers (Who Publishes to Which Topics)

| Service | Topics Produced | Trigger | Purpose |
|---------|----------------|---------|---------|
| **Document Service** | `document.uploaded` | User uploads document (via HTTP) | Notify internal workers to start OCR |
| **Document Service** | `document.processed` | Text extraction complete | Broadcast extracted text to Chat/Quiz services |
| **Document Service** | `notes.generated` | Summary AI generation complete | Notify user of new notes via Notification Service |
| **Aggregator** | `quiz.requested` | User clicks "Make Quiz" | Trigger quiz generation |
| **Aggregator** | `audio.generation.requested` | User clicks "Read Aloud" | Trigger TTS generation |
| **Aggregator** | `audio.transcription.requested` | User uploads audio | Trigger STT transcription |
| **Chat Service** | `quiz.requested` | User asks AI for quiz | Trigger quiz generation (alternative path) |
| **Chat Service** | `audio.generation.requested` | User asks AI to speak | Trigger TTS (alternative path) |
| **Chat Service** | `chat.message` | User sends message | Audit log & analytics |
| **Quiz Service** | `quiz.generated` | Quiz creation complete | Notify user & store result |
| **TTS Service** | `audio.generation.completed` | MP3 creation complete | Notify user & provide link |
| **STT Service** | `audio.transcription.completed` | Transcription complete | Notify user & Chat service |
| **User Service** | `user.created` | User registration | Trigger welcome notification |
| **All Services** | `platform.aggregator.replies` | Sync request finished | Return data to Aggregator (request-reply pattern) |

#### Consumers (Who Consumes from Which Topics)

| Service | Topics Consumed | Consumer Group | Purpose |
|---------|----------------|-----------------|---------|
| **Document Service** | `document.uploaded` | `document-service-group` | Process uploaded documents (internal workers) |
| **Quiz Service** | `document.processed` | `quiz-service-group` | Store document reference & generate quiz from source text |
| **Quiz Service** | `quiz.requested` | `quiz-service-group` | Generate quiz when requested |
| **Chat Service** | `document.processed` | `chat-service-group` | Add to knowledge base |
| **Chat Service** | `audio.transcription.completed` | `chat-service-group` | Use transcription in chat context |
| **TTS Service** | `audio.generation.requested` | `tts-service-group` | Generate audio from text |
| **STT Service** | `audio.transcription.requested` | `stt-service-group` | Transcribe audio to text |
| **Aggregator** | `platform.aggregator.replies` | `aggregator-replies-group` | Request-reply pattern (only for sync responses) |
| **Notification Service** | `quiz.generated` | `notification-service-group` | Send quiz ready notification via WebSocket/Email |
| **Notification Service** | `audio.generation.completed` | `notification-service-group` | Send audio ready notification via WebSocket/Email |
| **Notification Service** | `audio.transcription.completed` | `notification-service-group` | Send transcription ready notification |
| **Notification Service** | `document.processed` | `notification-service-group` | Send document ready notification |
| **Notification Service** | `notes.generated` | `notification-service-group` | Send notes ready notification |
| **Notification Service** | `chat.message` | `notification-service-group` | Send chat notification |
| **Notification Service** | `user.created` | `notification-service-group` | Send welcome email |
| **Analytics Service** | `chat.message` | `analytics-service-group` | Track chat analytics (future) |

### 4.3 Topic Flow Diagrams

#### Document Processing Flow
```
┌─────────────┐
│  Aggregator │
└──────┬──────┘
       │ [HTTP POST] /api/documents/upload
       │ (File stream to Document Service)
       ▼
┌──────────────────────┐
│ Document Service     │
│ - Receive file       │
│ - Upload to S3       │
│ - [PRODUCE]          │
└──────┬───────────────┘
       │ [PRODUCE]
       │ document.uploaded
       ▼
┌──────────────────────┐
│ document.uploaded    │ ← Topic
└──────┬───────────────┘
       │ [CONSUME] (internal workers)
       │ Consumer Group: document-service-group
       ▼
┌──────────────────────┐
│ Document Service     │
│ Workers              │
│ - Process document   │
│ - Extract text       │
│ - Generate notes     │
└──────┬───────────────┘
       │ [PRODUCE]
       ├─→ document.processed
       └─→ notes.generated
       ▼
┌──────────────────────┐  ┌──────────────────────┐
│ document.processed   │  │ notes.generated      │
└──────┬───────────────┘  └──────┬───────────────┘
       │                          │
       │ [CONSUME]                │ [CONSUME]
       │                          │
       ▼                          ▼
┌──────────────┐         ┌──────────────────────┐
│Quiz Service  │         │Notification Service  │
│Chat Service  │         │(WebSocket push)      │
│Notification  │         └──────────────────────┘
│Service       │
└──────────────┘
```

#### Quiz Generation Flow
```
┌─────────────┐
│  Aggregator │
└──────┬──────┘
       │ [PRODUCE]
       │ quiz.requested
       │ (with reply_to & correlation_id for sync)
       │ OR (without reply_to for async)
       ▼
┌──────────────────────┐
│ quiz.requested      │ ← Topic
└──────┬───────────────┘
       │ [CONSUME]
       │ Consumer Group: quiz-service-group
       ▼
┌──────────────────────┐
│ Quiz Service        │
│ - Fetch document    │
│   (from document.processed event) │
│ - Generate quiz     │
│ - Store in DB & S3  │
└──────┬──────────────┘
       │ [PRODUCE]
       │ quiz.generated
       │ (to reply_to topic if sync, or direct if async)
       ▼
┌──────────────────────┐
│ quiz.generated      │
└──────┬───────────────┘
       │
       ├─→ [CONSUME] Notification Service
       │   │
       │   └─→ [WebSocket] Frontend
       │       {"type": "quiz_ready", "quiz_id": "..."}
       │
       └─→ [PRODUCE] platform.aggregator.replies (if sync)
           │
           └─→ [CONSUME] Aggregator (request-reply pattern)
               │
               └─→ [HTTP Response] Return to User
                   
Note: For async flows, user receives WebSocket notification
      and then calls GET /api/quiz/{id} to fetch the quiz.
```

#### Notification Service Flow
```
┌──────────────────────┐
│ quiz.generated      │ ← Topic
│ audio.generation.   │
│   completed         │
│ chat.message        │
│ user.created        │
└──────┬───────────────┘
       │ [CONSUME]
       │ Consumer Group: notification-service-group
       ▼
┌──────────────────────┐
│ Notification Service│
│ - Consume events    │
│ - Send email (SES)  │
│ - Push WebSocket    │
└──────┬───────────────┘
       │
       ├─→ [Email] AWS SES
       │
       └─→ [WebSocket] Frontend
           ws://api-gateway/notifications
           {
             "type": "quiz_ready",
             "quiz_id": "quiz-123",
             "user_id": "user-456"
           }
```

### 4.2 Event Schema Examples

#### document.uploaded Event
```json
{
  "event_type": "document.uploaded.v1",
  "event_id": "evt-550e8400-e29b-41d4-a716-446655440000",
  "document_id": "doc-550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "s3_uri": "s3://document-reader-storage-dev-1763832262/documents/user-123/doc-xxx/file.pdf",
  "file_name": "lecture-notes.pdf",
  "file_size": 2048576,
  "content_type": "application/pdf",
  "timestamp": "2025-12-01T12:00:00Z",
  "trace_id": "trace-550e8400-e29b-41d4-a716-446655440000",
  "correlation_id": "corr-550e8400-e29b-41d4-a716-446655440000",
  "schema_version": "1.0.0"
}
```

#### document.processed Event
```json
{
  "event_type": "document.processed.v1",
  "event_id": "evt-660e8400-e29b-41d4-a716-446655440000",
  "document_id": "doc-550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "s3_uri": "s3://document-reader-storage-dev-1763832262/documents/user-123/doc-xxx/file.pdf",
  "pages": 12,
  "text_excerpt": "This document covers machine learning fundamentals...",
  "summary": "Introduction to ML concepts including supervised learning, neural networks...",
  "extracted_text_s3_uri": "s3://document-reader-storage-dev-1763832262/extracted/doc-xxx/text.txt",
  "processed_at": "2025-12-01T12:05:00Z",
  "timestamp": "2025-12-01T12:05:00Z",
  "trace_id": "trace-550e8400-e29b-41d4-a716-446655440000",
  "correlation_id": "corr-550e8400-e29b-41d4-a716-446655440000",
  "schema_version": "1.0.0"
}
```

#### quiz.requested Event
```json
{
  "event_type": "quiz.requested.v1",
  "event_id": "evt-770e8400-e29b-41d4-a716-446655440000",
  "request_id": "req-770e8400-e29b-41d4-a716-446655440000",
  "document_id": "doc-550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "difficulty": "medium",
  "question_count": 10,
  "question_types": ["multiple_choice", "true_false"],
  "reply_to": "platform.aggregator.replies",
  "correlation_id": "corr-770e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-01T12:10:00Z",
  "trace_id": "trace-550e8400-e29b-41d4-a716-446655440000",
  "schema_version": "1.0.0"
}
```

#### chat.message Event
```json
{
  "event_type": "chat.message.v1",
  "event_id": "evt-880e8400-e29b-41d4-a716-446655440000",
  "message_id": "msg-880e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "conv-990e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "text": "How do I solve question 3 from the quiz?",
  "message_type": "user",
  "timestamp": "2025-12-01T12:15:00Z",
  "trace_id": "trace-550e8400-e29b-41d4-a716-446655440000",
  "schema_version": "1.0.0"
}
```

---

## 5. Service Communication Patterns

### 5.1 Synchronous Communication (HTTP) 🔄

**When to use:** Immediate responses needed, request-response pattern

| From | To | Purpose | Protocol | Example |
|------|-----|---------|----------|---------|
| **Frontend** | **API Gateway** | All client requests | HTTPS | `POST /api/documents/upload` |
| **API Gateway** | **Aggregator** | Route API requests | HTTP | `POST /api/documents/upload` |
| **Aggregator** | **User Service** | JWT token verification | HTTP | `GET /api/auth/verify?token=...` |
| **Aggregator** | **Chat Service** | Get chat response (optional sync) | HTTP | `POST /api/chat/message` |
| **Aggregator** | **Quiz Service** | Get quiz status (optional sync) | HTTP | `GET /api/quiz/{id}/status` |
| **Notification Service** | **Frontend** | WebSocket push notifications | WebSocket | `ws://api-gateway/notifications` |

**Flow Example (Synchronous):**
```
User → API Gateway → Aggregator → [HTTP] User Service (verify JWT)
                                    ↓
                              Return user context
                                    ↓
                              Aggregator → Return to User
```

### 5.2 Asynchronous Communication (Kafka) 📨

**When to use:** Long-running operations, event-driven patterns, decoupling

| Pattern | Topic | Producer | Consumers | Purpose |
|---------|-------|----------|-----------|---------|
| **Command** | `quiz.requested` | Aggregator, Chat Service | Quiz Service | Request quiz generation |
| **Command** | `audio.generation.requested` | Aggregator, Chat Service | TTS Service | Request audio generation |
| **Command** | `audio.transcription.requested` | Aggregator | STT Service | Request transcription |
| **Event** | `document.uploaded` | Document Service | Document Service (internal) | Document uploaded to S3 |
| **Event** | `document.processed` | Document Service | Quiz Service, Chat Service, Notification Service | Document processing complete |
| **Event** | `notes.generated` | Document Service | Notification Service | Notes generated |
| **Event** | `quiz.generated` | Quiz Service | Notification Service | Quiz generation complete |
| **Event** | `audio.generation.completed` | TTS Service | Notification Service | Audio generation complete |
| **Event** | `audio.transcription.completed` | STT Service | Chat Service, Notification Service | Transcription complete |
| **Event** | `chat.message` | Chat Service | Notification Service, Analytics | Chat message sent |
| **Event** | `user.created` | User Service | Notification Service | New user registered |
| **Reply** | `platform.aggregator.replies` | All Services | Aggregator | Request-reply pattern (sync only) |

**Key Architectural Principle:**
- **Aggregator is stateless** - It does NOT consume domain events (quiz.generated, notes.generated, etc.)
- **Notification Service** consumes completion events and pushes via WebSocket
- **Users fetch results** via HTTP GET after receiving WebSocket notification

**Flow Example (Asynchronous):**
```
Aggregator → [Kafka PRODUCE] document.uploaded
                ↓
        Kafka Topic (document.uploaded)
                ↓
        Document Service [Kafka CONSUME]
                ↓
        Process document...
                ↓
        Document Service → [Kafka PRODUCE] document.processed
                ↓
        Kafka Topic (document.processed)
                ↓
        Quiz Service [Kafka CONSUME] ──┐
        Chat Service [Kafka CONSUME] ──┘
```

### 5.3 Request-Reply Pattern (Hybrid: Async Command + Sync Response)

**When to use:** Only for operations that need immediate response (< 10s)

**How it works:**
1. Aggregator publishes command event with `reply_to` topic and `correlation_id`
2. Service consumes event, processes, publishes result to `reply_to` topic
3. Aggregator consumes from `reply_to` topic, matches by `correlation_id`
4. Aggregator returns HTTP response to client

**Example (Sync - Quick Operations):**
```
User → Aggregator → [Kafka PRODUCE] quiz.requested
                    {
                      "reply_to": "platform.aggregator.replies",
                      "correlation_id": "corr-123"
                    }
                    ↓
            Quiz Service [CONSUME]
                    ↓
            Generate quiz (quick, < 5s)...
                    ↓
            Quiz Service → [Kafka PRODUCE] platform.aggregator.replies
                    {
                      "correlation_id": "corr-123",
                      "quiz_id": "quiz-456"
                    }
                    ↓
            Aggregator [CONSUME from reply_to]
                    ↓
            Match by correlation_id
                    ↓
            Return HTTP 200 to User
```

**Alternative (Async - Long Operations):**
```
User → Aggregator → [Kafka PRODUCE] quiz.requested
                    (NO reply_to - async mode)
                    ↓
            Quiz Service [CONSUME]
                    ↓
            Generate quiz (takes 30s)...
                    ↓
            Quiz Service → [Kafka PRODUCE] quiz.generated
                    ↓
            Notification Service [CONSUME]
                    ↓
            [WebSocket] Frontend
            {"type": "quiz_ready", "quiz_id": "quiz-456"}
                    ↓
            User clicks "View Quiz"
                    ↓
            Frontend → [HTTP GET] /api/quiz/quiz-456
                    ↓
            Aggregator → Quiz Service (HTTP)
                    ↓
            Return quiz data
```

**Note:** For long operations (> 10s), prefer async with WebSocket notifications.

### 5.4 WebSocket Notifications (Real-time Push) 🔔

**Notification Service → Frontend via WebSocket**

The Notification Service consumes events and pushes real-time notifications to connected clients:

| Event Consumed | Action | WebSocket Message |
|----------------|--------|-------------------|
| `quiz.generated` | Quiz ready | `{"type": "quiz_ready", "quiz_id": "...", "document_id": "..."}` |
| `audio.generation.completed` | Audio ready | `{"type": "audio_ready", "audio_id": "...", "s3_uri": "..."}` |
| `document.processed` | Document ready | `{"type": "document_ready", "document_id": "..."}` |
| `chat.message` | New chat response | `{"type": "chat_response", "conversation_id": "...", "message": "..."}` |

**Flow:**
```
Quiz Service → [Kafka PRODUCE] quiz.generated
                    ↓
        Notification Service [Kafka CONSUME]
                    ↓
        Notification Service → [WebSocket] Frontend
                    {
                      "type": "quiz_ready",
                      "quiz_id": "quiz-123",
                      "user_id": "user-456"
                    }
                    ↓
        Frontend receives real-time notification
```

### 5.5 Storage Communication
- **S3**: Direct AWS SDK calls from services (synchronous API calls)
- **RDS**: Direct database connections (synchronous queries, no cross-service access)

---

## 6. Storage Architecture

### 6.1 S3 Bucket Isolation

| Service | Bucket Name Pattern | Purpose | Lifecycle Policy |
|---------|-------------------|---------|------------------|
| Document Service | `document-reader-storage-{env}-*` | Store uploaded PDFs, extracted text, notes | 30d → Glacier, 90d → Delete |
| Quiz Service | `quiz-service-storage-{env}-*` | Store quiz templates, user responses | 30d → Glacier, 180d → Delete |
| Chat Service | `chat-service-storage-{env}-*` | Store conversation histories | 14d → Standard, 90d → Glacier |
| TTS Service | `tts-service-storage-{env}-*` | Store generated audio files | 7d → Standard, 30d → Delete |
| STT Service | `stt-service-storage-{env}-*` | Store uploaded audio, transcriptions | 7d → Standard, 30d → Delete |
| Shared Assets | `shared-assets-{env}-*` | Container images, static assets | No expiration |

### 6.2 Database Isolation

| Service | Database | Tables | Access Control |
|---------|----------|--------|----------------|
| User Service | `user-management-db` | users, user_sessions, roles | Security Group: Only User Service |
| Document Service | `document-reader-db` | documents, notes, processing_logs | Security Group: Only Document Service |
| Quiz Service | `quiz-service-db` | quizzes, questions, responses, scores | Security Group: Only Quiz Service |
| Chat Service | `chat-service-db` | conversations, messages, context | Security Group: Only Chat Service |

**CRITICAL RULE**: No service may access another service's database. Data sharing happens via Kafka events only.

---

## 7. SOLID Principles Application

### 7.1 Single Responsibility Principle (SRP)
**Each microservice has ONE business capability:**

- **User Service**: Authentication and user management ONLY
- **Document Service**: Document processing and note generation ONLY
- **Quiz Service**: Quiz generation and scoring ONLY
- **Chat Service**: Conversational AI ONLY
- **TTS/STT Services**: Audio processing ONLY
- **Notification Service**: Notifications ONLY

### 7.2 Open/Closed Principle (OCP)
**Services are open for extension, closed for modification:**

- **API Versioning**: `/api/v1/documents`, `/api/v2/documents`
- **Event Versioning**: `document.uploaded.v1`, `document.uploaded.v2`
- **Schema Evolution**: Backward-compatible event schemas
- **Interface Contracts**: Services expose stable interfaces

### 7.3 Liskov Substitution Principle (LSP)
**Service versions must be interchangeable:**

- Minor version updates maintain API compatibility
- Event schema versions maintain backward compatibility
- Service replacements (e.g., swap TTS provider) don't break consumers

### 7.4 Interface Segregation Principle (ISP)
**Clients shouldn't depend on interfaces they don't use:**

- **Aggregator**: Consumes fine-grained endpoints from each service
- **Microservices**: Expose minimal, focused APIs
- **Event Topics**: Small, specific event payloads (not monolithic)

### 7.5 Dependency Inversion Principle (DIP)
**Depend on abstractions, not concretions:**

- **Storage Adapter Interface**: `StorageAdapter` (S3, Local, Mock)
- **Event Publisher Interface**: `EventPublisher` (Kafka, RabbitMQ, Mock)
- **Database Interface**: Repository pattern with interfaces

---

## 8. Security Architecture

### 8.1 Network Security
- **Public Access**: Only ALB (port 443)
- **Private Subnets**: All microservices, databases, Kafka
- **Security Groups**: Least privilege per service tier
- **NACLs**: Subnet-level firewall rules

### 8.2 Authentication & Authorization
- **JWT Tokens**: Issued by User Service, validated by Aggregator
- **IAM Roles**: Service-to-AWS communication (IRSA for EKS)
- **Service-to-Service**: mTLS or API keys (future)

### 8.3 Data Security
- **Encryption at Rest**: S3 (SSE-S3/KMS), RDS, EBS
- **Encryption in Transit**: TLS 1.3 for all HTTP, TLS for Kafka
- **Secrets Management**: AWS Secrets Manager, not environment variables

---

## 9. Deployment Architecture

### 9.1 Kubernetes Namespace Structure
```
platform/
├── aggregator/
│   ├── Deployment (3 replicas)
│   ├── Service (ClusterIP)
│   ├── ServiceAccount (IRSA)
│   └── ConfigMap + Secret
├── user-service/
│   ├── Deployment (2 replicas)
│   ├── Service (ClusterIP)
│   ├── ServiceAccount (IRSA)
│   └── ConfigMap + Secret
├── document-service/
│   ├── Deployment (3 replicas)
│   ├── Service (ClusterIP)
│   ├── ServiceAccount (IRSA)
│   └── ConfigMap + Secret
├── kafka/
│   ├── StatefulSet (3 brokers)
│   ├── StatefulSet (3 Zookeeper)
│   └── Services (Headless)
└── monitoring/
    ├── Prometheus
    └── Grafana
```

### 9.2 Service Discovery
- **Internal**: Kubernetes DNS (`service.namespace.svc.cluster.local`)
- **External**: ALB DNS name
- **Kafka**: `kafka-0.kafka-headless.platform.svc.cluster.local:9092`

---

## 10. Monitoring & Observability

### 10.1 Metrics
- **Service Metrics**: Request rate, latency, error rate (Prometheus)
- **Kafka Metrics**: Consumer lag, throughput, partition size (Kafka Exporter)
- **Infrastructure**: CPU, memory, disk (Node Exporter)

### 10.2 Logging
- **Structured JSON Logs**: All services emit JSON logs
- **Centralized**: CloudWatch Logs or ELK Stack
- **Trace IDs**: Propagated across all services and events

### 10.3 Tracing
- **Distributed Tracing**: OpenTelemetry with trace_id
- **Correlation IDs**: Track requests across services and Kafka

---

## 11. Critical Design Decisions

### 11.1 Why Aggregator (BFF)?
- **Client-Specific Logic**: Aggregates data from multiple services
- **Reduces Client Complexity**: Single endpoint for complex operations
- **Security Boundary**: Centralized authentication/authorization
- **Protocol Translation**: HTTP → Kafka events

### 11.2 Why Kafka for Events?
- **Scalability**: Partition-based parallelism
- **Durability**: Persistent event log
- **Decoupling**: Services don't need to know about each other
- **Replay Capability**: Replay events for debugging/recovery

### 11.3 Why Storage Isolation?
- **Security**: No cross-service data access
- **Scalability**: Independent scaling per service
- **Compliance**: Data isolation for regulatory requirements
- **Failure Isolation**: One service's storage issue doesn't affect others

### 11.4 Why Request-Reply Pattern?
- **Synchronous Feel**: Client gets immediate response
- **Async Under the Hood**: Non-blocking Kafka-based
- **Timeout Handling**: Bounded wait (10s max)
- **Better Alternative**: 202 Accepted + WebSocket push (future)

---

## 12. Topic Creation Scripts

See `kafka/topics/` directory for automated topic creation scripts.

---

## 13. Next Steps

1. ✅ Architecture documentation (this file)
2. ⏳ Project structure setup
3. ⏳ Shared package implementation
4. ⏳ Service-by-service implementation
5. ⏳ Kubernetes manifests
6. ⏳ CI/CD pipeline
7. ⏳ Frontend application

---

**Last Updated**: 2025-12-01  
**Version**: 1.0.0  
**Status**: Architecture Complete, Implementation In Progress

