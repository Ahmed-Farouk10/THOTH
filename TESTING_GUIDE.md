# Per-Service Testing Guide

This guide provides instructions on how to start, test, and stop each service individually.

Since I cannot run `docker` commands directly, you can follow these instructions to test each service.

## General Workflow

For each service, you will:

1.  **Start the service** and its dependencies using `docker-compose up -d <service-name>`.
2.  **Check the service's health**. This is usually done by checking a `/health` endpoint.
3.  **Stop the service** and its dependencies using `docker-compose down`.

---

## 1. `user-service`

### 1.1. Start `user-service`

This will start the `user-service` and its dependencies (`user-db`, `kafka`, `zookeeper`).

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d user-service
```

### 1.2. Test `user-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8000/health
```

You should see a response like: `{"status":"healthy"}`

### 1.3. Stop `user-service`

This will stop the `user-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 9. `localstack`

### 9.1. Start `localstack`

This will start the `localstack` service.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d localstack
```

### 9.2. Test `localstack`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:4566/_localstack/health
```

You should see a response indicating the service is running.

### 9.3. Stop `localstack`

This will stop the `localstack` service.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 10. Worker Services

The following services are workers that process background tasks. They do not have a healthcheck endpoint. The best way to test them is to check their logs to see if they are running and processing tasks.

### 10.1. `document-worker`

#### 10.1.1. Start `document-worker`

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d document-worker
```

#### 10.1.2. Test `document-worker`

Check the logs to see the worker's output.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml logs -f document-worker
```

#### 10.1.3. Stop `document-worker`

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

### 10.2. `quiz-worker`

#### 10.2.1. Start `quiz-worker`

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d quiz-worker
```

#### 10.2.2. Test `quiz-worker`

Check the logs to see the worker's output.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml logs -f quiz-worker
```

#### 10.2.3. Stop `quiz-worker`

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

### 10.3. `chat-worker`

#### 10.3.1. Start `chat-worker`

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d chat-worker
```

#### 10.3.2. Test `chat-worker`

Check the logs to see the worker's output.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml logs -f chat-worker
```

#### 10.3.3. Stop `chat-worker`

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```


---

## 2. `aggregator`

### 2.1. Start `aggregator`

This will start the `aggregator` and its dependencies (`user-service`, `kafka`, `zookeeper`, `user-db`).

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d aggregator
```

### 2.2. Test `aggregator`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8080/health
```

You should see a response like: `{"status":"healthy"}`

### 2.3. Stop `aggregator`

This will stop the `aggregator` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```
---

## 3. `document-service`

### 3.1. Start `document-service`

This will start the `document-service` and its dependencies (`document-db`, `kafka`, `zookeeper`).

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d document-service
```

### 3.2. Test `document-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8002/health
```

You should see a response like: `{"status":"healthy"}`

### 3.3. Stop `document-service`

This will stop the `document-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 4. `notification-service`

### 4.1. Start `notification-service`

This will start the `notification-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d notification-service
```

### 4.2. Test `notification-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8003/health
```

You should see a response like: `{"status":"healthy"}`

### 4.3. Stop `notification-service`

This will stop the `notification-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 5. `quiz-service`

### 5.1. Start `quiz-service`

This will start the `quiz-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d quiz-service
```

### 5.2. Test `quiz-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8004/health
```

You should see a response like: `{"status":"healthy"}`

### 5.3. Stop `quiz-service`

This will stop the `quiz-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 6. `chat-service`

### 6.1. Start `chat-service`

This will start the `chat-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d chat-service
```

### 6.2. Test `chat-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8005/health
```

You should see a response like: `{"status":"healthy"}`

### 6.3. Stop `chat-service`

This will stop the `chat-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 7. `tts-service`

### 7.1. Start `tts-service`

This will start the `tts-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d tts-service
```

### 7.2. Test `tts-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8006/health
```

You should see a response like: `{"status":"healthy"}`

### 7.3. Stop `tts-service`

This will stop the `tts-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```

---

## 8. `stt-service`

### 8.1. Start `stt-service`

This will start the `stt-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml up -d stt-service
```

### 8.2. Test `stt-service`

Wait for a few moments for the service to start, then check its health endpoint:

```powershell
curl http://localhost:8007/health
```

You should see a response like: `{"status":"healthy"}`

### 8.3. Stop `stt-service`

This will stop the `stt-service` and its dependencies.

```powershell
docker compose -f e:\cloud5\cloud\docker-compose.yml down
```
