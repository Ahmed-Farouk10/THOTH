# 🚀 Service Runner & Tester - Complete Guide

## Overview

This guide provides terminal-based solutions to run and test all services without PowerShell scripts. The quiz-service Dockerfile has been optimized for faster builds.

## What's New

### ✅ Optimized Quiz Service Dockerfile

The quiz-service Dockerfile now uses:
- **BuildKit cache mounts** for faster pip installs
- **Layer optimization** for better caching
- **Faster rebuilds** when only code changes

**To enable faster builds:**
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### ✅ Comprehensive Test Scripts

Two new bash scripts:
1. **`scripts/run-and-test-all.sh`** - Full automation (start + test)
2. **`scripts/test-all-services.sh`** - Test only (services must be running)

## Quick Start

### Option 1: Automated (Recommended)

```bash
# Make executable (Linux/Mac/WSL)
chmod +x scripts/run-and-test-all.sh

# Run everything
./scripts/run-and-test-all.sh
```

This single command will:
- ✅ Check prerequisites
- ✅ Stop existing containers
- ✅ Build all services (with BuildKit)
- ✅ Start all services
- ✅ Wait for health checks
- ✅ Run migrations
- ✅ Create Kafka topics
- ✅ Test all endpoints
- ✅ Display service URLs

### Option 2: Manual Commands

```bash
# 1. Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 2. Start all services
docker-compose up -d --build

# 3. Wait for services (check status)
docker-compose ps

# 4. Test health endpoints
curl http://localhost:8000/health   # User Service
curl http://localhost:8080/health   # Aggregator
curl http://localhost:8002/health   # Document Service
curl http://localhost:8003/health   # Notification Service
curl http://localhost:8004/health   # Quiz Service
```

## Service Endpoints

| Service | Health Endpoint | API Endpoint |
|---------|----------------|--------------|
| User Service | http://localhost:8000/health | http://localhost:8000 |
| Aggregator | http://localhost:8080/health | http://localhost:8080 |
| Document Service | http://localhost:8002/health | http://localhost:8002 |
| Notification Service | http://localhost:8003/health | http://localhost:8003 |
| Quiz Service | http://localhost:8004/health | http://localhost:8004 |
| API Gateway | http://localhost/health | http://localhost |

## Testing Individual Services

### User Service

```bash
# Health check
curl http://localhost:8000/health

# Register user
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"pass123","full_name":"Test User"}'

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"pass123"}'
```

### Quiz Service

```bash
# Health check
curl http://localhost:8004/health

# Get quiz (requires quiz_id)
curl http://localhost:8004/api/quizzes/{quiz_id}
```

### Document Service

```bash
# Health check
curl http://localhost:8002/health

# List documents
curl http://localhost:8002/api/documents

# Upload document
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@test.pdf" \
  -F "user_id=test_user"
```

### Notification Service

```bash
# Health check
curl http://localhost:8003/health

# Get notifications
curl http://localhost:8003/api/notifications
```

## Useful Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f quiz-service
docker-compose logs -f user-service
docker-compose logs -f document-service
```

### Check Service Status

```bash
# All services
docker-compose ps

# Specific service
docker-compose ps quiz-service
```

### Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart quiz-service
```

### Stop Services

```bash
# Stop and remove containers
docker-compose down

# Stop but keep containers
docker-compose stop
```

### Rebuild Specific Service

```bash
# Rebuild quiz-service only
docker-compose build quiz-service

# Rebuild and restart
docker-compose up -d --build quiz-service
```

## Performance Optimization

### BuildKit Cache Mounts

The quiz-service Dockerfile uses BuildKit cache mounts to speed up pip installs:

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout=300 --retries=5 -r requirements.txt -c constraints.txt
```

**Benefits:**
- ✅ Faster pip installs (cached packages)
- ✅ Faster rebuilds when only code changes
- ✅ Reduced network usage

**Enable BuildKit:**
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### Layer Caching Strategy

The Dockerfile is optimized with layer ordering:
1. **System deps** (rarely change)
2. **Requirements** (change less often)
3. **Shared library** (change occasionally)
4. **Application code** (changes most often)

This ensures maximum cache hits.

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs [service-name]

# Check if port is in use
# Linux/Mac:
lsof -i :8000
# Windows:
netstat -ano | findstr 8000
```

### Quiz Service Build Slow

1. **Enable BuildKit:**
   ```bash
   export DOCKER_BUILDKIT=1
   export COMPOSE_DOCKER_CLI_BUILD=1
   ```

2. **Check Docker version** (BuildKit requires Docker 18.09+):
   ```bash
   docker --version
   ```

3. **Rebuild with no cache** (if needed):
   ```bash
   docker-compose build --no-cache quiz-service
   ```

### Database Connection Issues

```bash
# Check database is ready
docker-compose exec user-db pg_isready -U platformadmin
docker-compose exec quiz-db pg_isready -U postgres

# Check database logs
docker-compose logs user-db
docker-compose logs quiz-db
```

### Kafka Topics Not Created

```bash
# List existing topics
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Create topics
docker-compose exec aggregator python /app/scripts/create_topics.py

# Or manually
docker-compose exec kafka kafka-topics --create --if-not-exists \
    --bootstrap-server localhost:9092 \
    --topic document.uploaded \
    --partitions 6 \
    --replication-factor 1
```

### Health Checks Failing

```bash
# Check service is running
docker-compose ps

# Check logs for errors
docker-compose logs [service-name]

# Test endpoint directly
curl -v http://localhost:8004/health
```

## Windows Users

### Git Bash / WSL (Recommended)

Use the bash scripts directly:
```bash
./scripts/run-and-test-all.sh
```

### PowerShell (Alternative)

Use docker-compose commands directly:
```powershell
# Start services
docker-compose up -d --build

# Check status
docker-compose ps

# Test health (if curl.exe available)
curl.exe http://localhost:8000/health

# Or use PowerShell
Invoke-WebRequest -Uri http://localhost:8000/health
```

## Script Details

### `run-and-test-all.sh`

**Features:**
- Prerequisite checking
- Automatic service startup
- Health check waiting
- Migration running
- Kafka topic creation
- Endpoint testing
- Colored output
- Error handling

**Exit Codes:**
- `0` - All services healthy
- `1` - Some services failed

### `test-all-services.sh`

**Features:**
- Simple health check testing
- Works on already-running services
- Quick status overview

**Usage:**
```bash
# Services must be running first
docker-compose up -d

# Then test
./scripts/test-all-services.sh
```

## Next Steps

- Read `QUICK_START.md` for quick reference
- Check `guides/GETTING_STARTED.md` for detailed setup
- See `guides/ARCHITECTURE.md` for system design
- Review `guides/docreader/LOCAL_TESTING.md` for document service testing

## Summary

✅ **Quiz Service Dockerfile optimized** - Faster builds with BuildKit cache mounts  
✅ **Comprehensive test scripts** - Automated testing without PowerShell  
✅ **Cross-platform support** - Works on Linux, Mac, Windows (Git Bash/WSL)  
✅ **Easy to use** - Single command to run and test everything  

**Quick Command:**
```bash
./scripts/run-and-test-all.sh
```

That's it! 🚀

