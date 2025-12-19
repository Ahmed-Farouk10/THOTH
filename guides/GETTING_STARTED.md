# 🚀 Getting Started Guide

Welcome! This guide will help you understand what we've built and how to get started.

## 📋 What We've Built So Far

### ✅ Complete Foundation

1. **Architecture Documentation**
   - Complete system design (`ARCHITECTURE.md`)
   - Learning guide with explanations (`LEARNING_GUIDE.md`)
   - Event flow diagrams
   - Kafka topics specification

2. **Shared Package**
   - Reusable models, config, and logging
   - Type-safe event schemas
   - Centralized configuration

3. **User Service** (Fully Functional)
   - User registration and login
   - JWT token generation and verification
   - Database with migrations
   - Production-ready code structure

4. **Development Environment**
   - Docker Compose setup
   - Nginx API Gateway
   - Kafka cluster
   - PostgreSQL database

### 🚧 Placeholder (Next to Implement)

- **Aggregator Service** - Basic structure, needs full implementation

---

## 🏃 Quick Start

### Prerequisites

- Docker & Docker Compose installed
- Python 3.11+ (for local development)
- Git

### Step 1: Clone and Setup

```bash
# Navigate to project directory
cd cloud-learning-platform

# Make scripts executable (if on Linux/Mac)
chmod +x scripts/*.sh scripts/*.py
```

### Step 2: Start Services

```bash
# Option 1: Use the startup script (recommended)
./scripts/start-dev.sh

# Option 2: Manual start
docker-compose up -d
```

This will:
- Build all Docker images
- Start Kafka, Zookeeper, PostgreSQL
- Start User Service and Aggregator
- Run database migrations
- Create Kafka topics

### Step 3: Verify Services

```bash
# Check all services are running
docker-compose ps

# Check health endpoints
curl http://localhost/health          # API Gateway
curl http://localhost:8000/health     # User Service
curl http://localhost:8080/health     # Aggregator

# View logs
docker-compose logs -f user-service
```

### Step 4: Test User Service

```bash
# Register a new user
# PowerShell:
Invoke-RestMethod -Uri "http://localhost/api/auth/register" -Method Post -ContentType "application/json" -Body (@{
    username = "student1"
    email = "student1@example.com"
    password = "securepass123"
    full_name = "John Doe"
} | ConvertTo-Json)

# Or using curl.exe (if available):
# curl.exe -X POST http://localhost/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"student1\",\"email\":\"student1@example.com\",\"password\":\"securepass123\",\"full_name\":\"John Doe\"}"

# Expected response:
# {
#   "user_id": "uuid-here",
#   "username": "student1",
#   "email": "student1@example.com",
#   "message": "User created successfully"
# }

# Login
# PowerShell:
$loginResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method Post -ContentType "application/json" -Body (@{
    username = "student1"
    password = "securepass123"
} | ConvertTo-Json)

# Expected response:
# {
#   "access_token": "jwt-token-here",
#   "token_type": "bearer",
#   "user": { ... }
# }

# Save the token (PowerShell)
$TOKEN = $loginResponse.access_token

# Verify token (PowerShell)
Invoke-RestMethod -Uri "http://localhost/api/auth/verify?token=$TOKEN"

# Get user profile (PowerShell)
# Replace {user_id} with actual user ID
Invoke-RestMethod -Uri "http://localhost:8000/api/users/{user_id}"

# Alternative: Using curl.exe (if installed)
# curl.exe -X POST http://localhost/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"student1\",\"password\":\"securepass123\"}"
```

---

## 📁 Project Structure Explained

```
cloud-learning-platform/
│
├── 📚 Documentation
│   ├── ARCHITECTURE.md          # Complete system design
│   ├── LEARNING_GUIDE.md        # Step-by-step explanations
│   ├── PROGRESS.md              # What's done, what's next
│   └── GETTING_STARTED.md       # This file
│
├── 🔧 Shared Package
│   └── shared/platform_shared/  # Reusable code for all services
│       ├── models.py            # Event models, UserContext, etc.
│       ├── config.py            # Configuration management
│       └── logging.py           # Structured JSON logging
│
├── 👤 User Service (✅ Complete)
│   └── user-service/
│       ├── main.py              # FastAPI application
│       ├── models.py            # Database models
│       ├── repository.py        # Data access layer
│       ├── service.py           # Business logic
│       ├── alembic/             # Database migrations
│       └── Dockerfile
│
├── 🎯 Aggregator (🚧 Placeholder)
│   └── aggregator/
│       ├── main.py              # Basic structure
│       └── Dockerfile
│
├── 🐳 Docker Configuration
│   ├── docker-compose.yml       # All services
│   └── nginx/nginx.conf         # API Gateway config
│
└── 🛠️ Scripts
    ├── start-dev.sh             # Startup script
    └── create_topics.py         # Kafka topic creation
```

---

## 🎓 Understanding the Architecture

### Request Flow Example

```
1. User → POST /api/auth/login
   ↓
2. Nginx API Gateway → Routes to User Service
   ↓
3. User Service → Validates credentials
   ↓
4. User Service → Generates JWT token
   ↓
5. User Service → Returns token to user
```

### Service Communication

**Synchronous (HTTP):**
- Aggregator → User Service (JWT verification)
- Frontend → Aggregator (all requests)

**Asynchronous (Kafka):**
- Services publish events to Kafka
- Other services consume events
- Example: Document Service publishes `document.processed`, Quiz Service consumes it

### Storage Isolation

Each service has its own:
- **Database** (PostgreSQL RDS instance)
- **S3 Bucket** (for files)

Services share data via **Kafka events**, not direct database access.

---

## 🔍 Exploring the Code

### User Service - Repository Pattern

```python
# user-service/repository.py
class UserRepository:
    """Data access layer - only database operations"""
    def create_user(self, ...):
        # SQLAlchemy operations
        pass
```

**Why?** Separates data access from business logic.

### User Service - Service Layer

```python
# user-service/service.py
class UserService:
    """Business logic layer"""
    def register_user(self, ...):
        # 1. Hash password
        # 2. Call repository
        # 3. Return result
        pass
```

**Why?** Contains business logic, orchestrates operations.

### User Service - Controller

```python
# user-service/main.py
@app.post("/api/auth/register")
async def register(...):
    # 1. Validate request
    # 2. Call service
    # 3. Return response
    pass
```

**Why?** Handles HTTP, delegates to service layer.

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# Check logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d
```

### Database connection errors

```bash
# Check database is ready
docker-compose exec user-db pg_isready -U platformadmin

# Check migrations ran
docker-compose exec user-service alembic current
```

### Kafka topics not created

```bash
# List topics
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Create manually
docker-compose exec kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic document.uploaded \
  --partitions 6 \
  --replication-factor 1
```

---

## 📚 Next Steps

1. **Read the Documentation**
   - `ARCHITECTURE.md` - Understand the system design
   - `LEARNING_GUIDE.md` - Learn the concepts

2. **Explore the Code**
   - Start with `user-service/main.py`
   - Follow the flow: Route → Service → Repository → Database

3. **Implement Aggregator**
   - See `PROGRESS.md` for next steps
   - Add JWT verification
   - Add Kafka producer
   - Implement document upload endpoint

4. **Build More Services**
   - Document Service (processes documents)
   - Quiz Service (generates quizzes)
   - Chat Service (conversational AI)

---

## 🎯 Learning Objectives

By working through this project, you'll learn:

1. **Microservices Architecture**
   - How to design independent services
   - Service communication patterns
   - Event-driven architecture

2. **SOLID Principles**
   - Single Responsibility (each service has one job)
   - Dependency Inversion (depend on interfaces)
   - Interface Segregation (small, focused APIs)

3. **Production Best Practices**
   - Structured logging
   - Health checks
   - Database migrations
   - Container orchestration

4. **AWS Services**
   - EC2, RDS, S3
   - IAM roles
   - VPC networking

---

## 💡 Tips

1. **Read the comments** - Code has detailed explanations
2. **Follow the flow** - Start with a request, trace it through the system
3. **Experiment** - Modify code, see what happens
4. **Ask questions** - Understanding "why" is more important than "what"

---

## 🆘 Need Help?

1. Check `ARCHITECTURE.md` for system design
2. Check `LEARNING_GUIDE.md` for explanations
3. Check `PROGRESS.md` for what's next
4. Review code comments for implementation details

---

**Happy Learning! 🚀**

