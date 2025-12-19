# 🚀 Quick Start Guide - Run and Test All Services

This guide shows you how to run and test all services using terminal commands (no PowerShell scripts required).

## Prerequisites

- Docker and Docker Compose installed
- `curl` or `wget` installed (for testing)
- Bash shell (Linux, Mac, or Git Bash/WSL on Windows)

## Option 1: Automated Script (Recommended)

### Linux/Mac/Git Bash/WSL

```bash
# Make script executable (Linux/Mac/WSL)
chmod +x scripts/run-and-test-all.sh

# Run the script
./scripts/run-and-test-all.sh
```

This script will:
1. ✅ Check prerequisites
2. ✅ Stop existing containers
3. ✅ Build and start all services (with BuildKit for faster builds)
4. ✅ Wait for all services to be healthy
5. ✅ Run database migrations
6. ✅ Create Kafka topics
7. ✅ Test all service endpoints
8. ✅ Display service URLs and useful commands

### Windows PowerShell (Alternative)

If you don't have Git Bash or WSL, you can run commands manually:

```powershell
# Start services
docker-compose up -d --build

# Wait for services (check status)
docker-compose ps

# Test health endpoints
curl http://localhost:8000/health  # User Service
curl http://localhost:8080/health   # Aggregator
curl http://localhost:8002/health   # Document Service
curl http://localhost:8003/health  # Notification Service
curl http://localhost:8004/health  # Quiz Service
```

## Option 2: Manual Step-by-Step

### 1. Start All Services

```bash
# Enable BuildKit for faster builds (especially quiz-service)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build and start
docker-compose up -d --build
```

### 2. Wait for Services to Be Ready

```bash
# Check service status
docker-compose ps

# Wait for Kafka
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Wait for databases
docker-compose exec user-db pg_isready -U platformadmin
docker-compose exec document-db pg_isready -U postgres
docker-compose exec notification-db pg_isready -U postgres
docker-compose exec quiz-db pg_isready -U postgres
```

### 3. Run Migrations

```bash
docker-compose exec user-service alembic upgrade head
```

### 4. Create Kafka Topics

```bash
# Option 1: Use Python script
docker-compose exec aggregator python /app/scripts/create_topics.py

# Option 2: Manual creation
docker-compose exec kafka kafka-topics --create --if-not-exists \
    --bootstrap-server localhost:9092 \
    --topic document.uploaded \
    --partitions 6 \
    --replication-factor 1
```

### 5. Test All Services

```bash
# Run test script
chmod +x scripts/test-all-services.sh
./scripts/test-all-services.sh

# Or test manually:
curl http://localhost:8000/health   # User Service
curl http://localhost:8080/health   # Aggregator
curl http://localhost:8002/health   # Document Service
curl http://localhost:8003/health   # Notification Service
curl http://localhost:8004/health   # Quiz Service
```

## Service URLs

| Service | URL | Health Check |
|---------|-----|--------------|
| API Gateway | http://localhost | http://localhost/health |
| User Service | http://localhost:8000 | http://localhost:8000/health |
| Aggregator | http://localhost:8080 | http://localhost:8080/health |
| Document Service | http://localhost:8002 | http://localhost:8002/health |
| Notification Service | http://localhost:8003 | http://localhost:8003/health |
| Quiz Service | http://localhost:8004 | http://localhost:8004/health |

## Quick Test Commands

### Test User Registration

```bash
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123",
    "full_name": "Test User"
  }'
```

### Test User Login

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }'
```

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f user-service
docker-compose logs -f quiz-service
docker-compose logs -f document-service
```

### Stop All Services

```bash
docker-compose down
```

### Restart a Specific Service

```bash
docker-compose restart quiz-service
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs [service-name]

# Check if ports are in use
netstat -an | grep 8000  # Linux/Mac
netstat -ano | findstr 8000  # Windows
```

### Quiz Service Build Taking Too Long

The quiz-service Dockerfile has been optimized with BuildKit cache mounts. Make sure BuildKit is enabled:

```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker-compose build quiz-service
```

### Database Connection Issues

```bash
# Check database is ready
docker-compose exec user-db pg_isready -U platformadmin

# Check database logs
docker-compose logs user-db
```

### Kafka Topics Not Created

```bash
# List existing topics
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Create topics manually
docker-compose exec aggregator python /app/scripts/create_topics.py
```

## Performance Tips

1. **First Build**: The first build will take longer as it downloads base images and dependencies. Subsequent builds will be faster due to Docker layer caching.

2. **BuildKit**: Always enable BuildKit for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   export COMPOSE_DOCKER_CLI_BUILD=1
   ```

3. **Selective Building**: Build only what you need:
   ```bash
   docker-compose build quiz-service  # Build only quiz-service
   docker-compose up -d quiz-service   # Start only quiz-service
   ```

4. **Cache**: Docker will cache layers, so unchanged services won't rebuild.

## Next Steps

- Read `guides/GETTING_STARTED.md` for detailed documentation
- Check `guides/ARCHITECTURE.md` for system architecture
- See `guides/docreader/LOCAL_TESTING.md` for document service testing

