# Notification Service Dockerfile
# Multi-stage build for smaller image size

# STAGE 1: Builder
# Builder stage - Skip system packages, use prebuilt wheels
FROM python:3.11-slim as builder

WORKDIR /app

# Most packages have prebuilt wheels, no need for gcc
# Copy shared library first
COPY ./shared /shared
RUN pip install --default-timeout=100 --retries=10 --no-cache-dir /shared

# Copy requirements and install Python dependencies  
COPY notification-service/requirements.txt .
RUN pip install --default-timeout=100 --retries=10 --no-cache-dir -r requirements.txt

# STAGE 2: Runtime (Final Image)
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Copy installed python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY ./shared /shared
COPY ./notification-service /app

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check using Python (no curl needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8003/health', timeout=5)"

EXPOSE 8003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]


