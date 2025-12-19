# Scripts Directory

This directory contains utility scripts for running and testing the platform.

## Available Scripts

### `run-and-test-all.sh` ⭐ **Recommended**

Comprehensive script that:
- Starts all services
- Waits for them to be healthy
- Runs migrations
- Creates Kafka topics
- Tests all endpoints
- Provides service information

**Usage:**
```bash
chmod +x scripts/run-and-test-all.sh
./scripts/run-and-test-all.sh
```

**Requirements:**
- Docker and Docker Compose
- curl or wget
- Bash shell (Linux, Mac, Git Bash, or WSL on Windows)

### `test-all-services.sh`

Simple script to test all services after they're running.

**Usage:**
```bash
chmod +x scripts/test-all-services.sh
./scripts/test-all-services.sh
```

**Note:** Services must already be running. Use `run-and-test-all.sh` to start them first.

### `create_topics.py`

Python script to create all required Kafka topics.

**Usage:**
```bash
# From host
python scripts/create_topics.py

# From container
docker-compose exec aggregator python /app/scripts/create_topics.py
```

### `start-dev.sh`

Original development startup script (Linux/Mac).

**Usage:**
```bash
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

## Windows Users

If you're on Windows without Git Bash or WSL:

1. Use `docker-compose` commands directly:
   ```powershell
   docker-compose up -d --build
   docker-compose ps
   ```

2. Test services with `curl.exe` (if available) or PowerShell:
   ```powershell
   Invoke-WebRequest -Uri http://localhost:8000/health
   ```

3. See `QUICK_START.md` in the project root for detailed instructions.

## Tips

- **Faster Builds**: Enable BuildKit for faster Docker builds:
  ```bash
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1
  ```

- **Selective Testing**: Test individual services:
  ```bash
  curl http://localhost:8000/health  # User Service
  curl http://localhost:8004/health  # Quiz Service
  ```

- **View Logs**: 
  ```bash
  docker-compose logs -f [service-name]
  ```

