# 📚 Learning Guide - Step-by-Step Implementation

This guide explains **what** we're building, **why** we're building it this way, and **how** each piece fits together.

## 🎯 Learning Objectives

By the end of this project, you'll understand:

1. **Microservices Architecture**: How to design and implement independent services
2. **Event-Driven Architecture**: How services communicate asynchronously via Kafka
3. **SOLID Principles**: How to apply them in microservices context
4. **Cloud Infrastructure**: AWS services and how they work together
5. **Container Orchestration**: Kubernetes deployment patterns
6. **Production Best Practices**: Logging, monitoring, security, testing

---

## 📖 Step 1: Understanding the Shared Package

### What is it?
A Python package containing code shared across all microservices.

### Why do we need it?
- **DRY Principle**: Don't Repeat Yourself - define models once, use everywhere
- **Consistency**: All services use the same event schemas
- **Type Safety**: Pydantic models provide validation
- **Maintainability**: Change once, update everywhere

### What's inside?

#### `models.py` - Data Models
```python
# Every Kafka event extends BaseEvent
class DocumentUploadedEvent(BaseEvent):
    document_id: str
    s3_uri: str
    # ... more fields
```

**Why BaseEvent?**
- Ensures every event has `trace_id`, `correlation_id`, `timestamp`
- Makes distributed tracing possible
- Enables request-reply patterns

#### `config.py` - Configuration Management
```python
# Load from environment variables
settings = ServiceSettings(service_name="user-service")
database_url = settings.database.url
```

**Why Pydantic Settings?**
- Type-safe configuration
- Validation on startup (catch errors early)
- Environment variable support
- Default values

#### `logging.py` - Structured Logging
```python
logger = setup_logging("user-service", "INFO")
logger.info("User created", extra={"user_id": "123"})
# Output: {"timestamp": "...", "level": "INFO", "service": "user-service", ...}
```

**Why JSON Logs?**
- Machine-readable (CloudWatch, ELK can query)
- Consistent format
- Easy to filter and search
- Better than plain text for production

---

## 📖 Step 2: User Service - Authentication Foundation

### What does it do?
- User registration and login
- JWT token generation and validation
- User profile management

### Why is it first?
**Every other service needs authentication!** The User Service is the foundation.

### Architecture Pattern: Repository Pattern

```
Controller (FastAPI) → Service Layer → Repository → Database
     ↓                      ↓              ↓
  HTTP/JSON          Business Logic    SQL Queries
```

**Why this pattern?**
- **Separation of Concerns**: Each layer has one responsibility
- **Testability**: Mock the repository, test the service
- **Flexibility**: Swap database without changing business logic

### Key Components

#### 1. Database Models (SQLAlchemy)
```python
class UserModel(Base):
    __tablename__ = "users"
    user_id = Column(String(36), primary_key=True)
    username = Column(String(50), unique=True)
    email = Column(String(255), unique=True)
    hashed_password = Column(String(255))
```

**Why SQLAlchemy?**
- ORM (Object-Relational Mapping) - work with Python objects, not SQL
- Type safety
- Database-agnostic (PostgreSQL, MySQL, etc.)
- Migration support (Alembic)

#### 2. Repository Layer
```python
class UserRepository:
    def create(self, user_data: dict) -> UserModel:
        # Database operations here
        pass
```

**Why Repository?**
- Encapsulates database access
- Easy to mock for testing
- Single place for database queries

#### 3. Service Layer
```python
class UserService:
    def register_user(self, username: str, email: str, password: str):
        # Business logic here
        # - Validate input
        # - Hash password
        # - Create user via repository
        # - Publish user.created event
        pass
```

**Why Service Layer?**
- Contains business logic (not in controller or repository)
- Orchestrates multiple operations
- Can call other services or publish events

#### 4. Controller (FastAPI Routes)
```python
@app.post("/api/auth/register")
async def register(user: UserCreate):
    # Validate request
    # Call service layer
    # Return response
    pass
```

**Why FastAPI?**
- Modern Python web framework
- Automatic API documentation (Swagger)
- Type hints and validation
- Async support

### JWT Authentication Flow

```
1. User → POST /api/auth/login {username, password}
2. User Service → Verify password
3. User Service → Generate JWT token
4. User Service → Return token
5. Client → Store token
6. Client → Include token in Authorization header
7. Aggregator → Verify token with User Service
8. Aggregator → Extract user context
9. Aggregator → Forward request to microservice
```

**Why JWT?**
- Stateless (no server-side session storage)
- Scalable (any service can verify)
- Contains user info (no database lookup needed)
- Standard (widely supported)

---

## 📖 Step 3: Aggregator (BFF) - The Orchestrator

### What is BFF?
**Backend for Frontend** - A service that aggregates data from multiple microservices.

### Why do we need it?

**Without Aggregator:**
```
Frontend → User Service (get user info)
Frontend → Document Service (get documents)
Frontend → Quiz Service (get quizzes)
Frontend → Chat Service (get conversations)
```
**Problems:**
- Frontend makes many requests
- Frontend needs to know all service URLs
- No centralized authentication
- Hard to optimize (can't batch requests)

**With Aggregator:**
```
Frontend → Aggregator → Multiple Services
```
**Benefits:**
- Single endpoint for frontend
- Centralized authentication
- Can batch/optimize requests
- Can transform data for frontend

### Aggregator Responsibilities

1. **Authentication**: Verify JWT tokens
2. **Orchestration**: Call multiple services
3. **Event Publishing**: Convert HTTP requests to Kafka events
4. **Response Aggregation**: Combine responses from multiple services
5. **Error Handling**: Handle service failures gracefully

### Request Flow Example

```
User uploads document:
1. Frontend → POST /api/documents/upload (with JWT)
2. Aggregator → Verify JWT with User Service
3. Aggregator → Upload file to S3
4. Aggregator → Publish document.uploaded event to Kafka
5. Aggregator → Return 202 Accepted (async processing)
6. Document Service → Consumes event, processes document
7. Document Service → Publishes document.processed event
8. Aggregator → (Optional) Consumes event, notifies frontend via WebSocket
```

**Why async?**
- Document processing takes time (seconds to minutes)
- Don't block HTTP request
- Better user experience (show progress)

---

## 📖 Step 4: Kafka - Event-Driven Communication

### What is Kafka?
A distributed event streaming platform. Think of it as a message queue on steroids.

### Why Kafka?

**Traditional HTTP:**
```
Service A → HTTP → Service B
```
**Problems:**
- Tight coupling (Service A must know Service B exists)
- If Service B is down, request fails
- Hard to scale (one request = one response)

**Kafka Events:**
```
Service A → Publish Event → Kafka → Service B, C, D consume
```
**Benefits:**
- Loose coupling (services don't know about each other)
- Resilient (events stored, can replay)
- Scalable (multiple consumers)
- Event sourcing (audit trail)

### Kafka Concepts

#### Topics
A category/stream of events. Like a table in a database.

```
document.uploaded topic:
- Event 1: {document_id: "doc-1", ...}
- Event 2: {document_id: "doc-2", ...}
- Event 3: {document_id: "doc-3", ...}
```

#### Partitions
Topics are split into partitions for parallelism.

```
document.uploaded (6 partitions):
Partition 0: [doc-1, doc-7, doc-13, ...]
Partition 1: [doc-2, doc-8, doc-14, ...]
Partition 2: [doc-3, doc-9, doc-15, ...]
...
```

**Why partitions?**
- Parallel processing (6 consumers can process simultaneously)
- Scalability (add more partitions = more parallelism)
- Ordering (events in same partition are ordered)

#### Consumer Groups
Multiple instances of a service can consume from the same topic.

```
Quiz Service (3 instances):
- Instance 1: Consumes from Partition 0, 1
- Instance 2: Consumes from Partition 2, 3
- Instance 3: Consumes from Partition 4, 5
```

**Why consumer groups?**
- Load balancing (distribute work across instances)
- High availability (if one instance dies, others continue)

### Event Patterns

#### 1. Command Pattern
```
Aggregator → quiz.requested event → Quiz Service
```
**Use when:** You want a service to do something.

#### 2. Event Pattern
```
Document Service → document.processed event → Multiple consumers
```
**Use when:** Something happened, and others might care.

#### 3. Request-Reply Pattern
```
Aggregator → quiz.requested (with reply_to) → Quiz Service
Quiz Service → quiz.generated (to reply_to) → Aggregator
```
**Use when:** You need a response (but prefer async).

---

## 📖 Step 5: Document Service - Event Producer

### What does it do?
- Consumes `document.uploaded` events
- Processes documents (OCR, text extraction)
- Generates notes using AI
- Publishes `document.processed` and `notes.generated` events

### Event Flow

```
1. Aggregator publishes document.uploaded
2. Document Service consumes event
3. Document Service downloads file from S3
4. Document Service processes file (PyPDF2, python-docx)
5. Document Service generates notes (OpenAI API)
6. Document Service stores notes in S3
7. Document Service saves metadata to database
8. Document Service publishes document.processed event
9. Document Service publishes notes.generated event
```

### Why separate events?
- `document.processed`: "Document is ready"
- `notes.generated`: "Notes are ready"

Different services care about different events:
- Quiz Service cares about `document.processed` (to generate quiz)
- Chat Service cares about `notes.generated` (to use in knowledge base)

---

## 📖 Step 6: Quiz Service - Event Consumer

### What does it do?
- Consumes `document.processed` and `notes.generated` events
- Consumes `quiz.requested` events
- Generates quiz questions using AI
- Stores quiz in database and S3
- Publishes `quiz.generated` event

### Why consume multiple events?
- `document.processed`: Knows document is ready
- `notes.generated`: Has notes to generate questions from
- `quiz.requested`: User wants a quiz

### Storage Strategy

**Database (RDS):**
- Quiz metadata (id, document_id, user_id, created_at)
- Questions (id, quiz_id, question_text, type)
- Answers (id, question_id, text, is_correct)

**S3:**
- Full quiz JSON (for easy retrieval)
- User responses (for analytics)

**Why both?**
- Database: Fast queries, relationships
- S3: Large files, versioning, archival

---

## 📖 Step 7: SOLID Principles in Practice

### Single Responsibility Principle (SRP)

**Each service has ONE job:**

- User Service: Authentication ONLY
- Document Service: Document processing ONLY
- Quiz Service: Quiz generation ONLY

**Why?**
- Easy to understand
- Easy to test
- Easy to scale independently
- Easy to replace

### Open/Closed Principle (OCP)

**Open for extension, closed for modification:**

```python
# Version 1 API
@app.post("/api/v1/documents/upload")
async def upload_v1(...):
    pass

# Version 2 API (new, doesn't break v1)
@app.post("/api/v2/documents/upload")
async def upload_v2(...):
    pass
```

**Why?**
- Don't break existing clients
- Gradual migration
- Backward compatibility

### Liskov Substitution Principle (LSP)

**Service versions must be interchangeable:**

- v1 and v2 of a service should work the same way
- Event schema v1 and v2 should be compatible

### Interface Segregation Principle (ISP)

**Don't force clients to depend on what they don't use:**

```python
# Bad: One big endpoint
@app.get("/api/user/all-data")
# Returns: user info, documents, quizzes, chats (too much!)

# Good: Small, focused endpoints
@app.get("/api/user/profile")
@app.get("/api/user/documents")
@app.get("/api/user/quizzes")
```

### Dependency Inversion Principle (DIP)

**Depend on abstractions, not concretions:**

```python
# Bad: Direct dependency on S3
class DocumentService:
    def __init__(self):
        self.s3 = boto3.client('s3')  # Concrete

# Good: Depend on interface
class StorageAdapter(ABC):
    @abstractmethod
    def upload(self, key: str, file: bytes):
        pass

class S3StorageAdapter(StorageAdapter):
    def upload(self, key: str, file: bytes):
        # S3 implementation
        pass

class DocumentService:
    def __init__(self, storage: StorageAdapter):  # Abstract
        self.storage = storage
```

**Why?**
- Easy to test (mock the interface)
- Easy to swap (S3 → Local → Azure Blob)
- Flexible

---

## 📖 Step 8: Storage Isolation

### Why isolate storage?

**Without isolation:**
```
All services → One database → Security risk, scaling issues
```

**With isolation:**
```
User Service → user-management-db
Document Service → document-reader-db
Quiz Service → quiz-service-db
```

**Benefits:**
- Security: Services can't access each other's data
- Scaling: Scale databases independently
- Failure isolation: One DB failure doesn't affect others
- Compliance: Data isolation for regulations

### How do services share data?

**Via Kafka events, not direct database access!**

```
Document Service processes document
→ Publishes document.processed event (includes extracted text)
→ Quiz Service consumes event
→ Quiz Service stores what it needs in its own database
```

**Why?**
- Maintains isolation
- Services stay decoupled
- Event sourcing (audit trail)

---

## 🎓 Next Steps

1. ✅ Understand shared package
2. ✅ Understand User Service
3. ✅ Understand Aggregator
4. ✅ Understand Kafka
5. ⏳ Implement User Service
6. ⏳ Implement Aggregator
7. ⏳ Implement Document Service
8. ⏳ Implement Quiz Service
9. ⏳ Implement remaining services
10. ⏳ Deploy to Kubernetes
11. ⏳ Set up monitoring
12. ⏳ Build frontend

---

**Remember:** Understanding **why** is more important than **what**. Always ask:
- Why this design?
- Why this technology?
- Why this pattern?
- What problem does it solve?

