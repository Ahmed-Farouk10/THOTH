# syntax=docker/dockerfile:1.4
# STAGE 1: Builder
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies to /install location
COPY ./documentreader/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Install shared library
COPY ./shared /shared
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --prefix=/install /shared

# Download spaCy model during build
RUN python -m spacy download en_core_web_sm 2>&1 || echo "Note: spaCy model will be downloaded at runtime if needed"

# STAGE 2: Runtime (Final Image)
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

# Copy installed python packages from builder
COPY --from=builder /install /usr/local

# Install runtime-only system deps (for PDF processing and OCR)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    qpdf \
    libmagic1 \
    libgl1 \
    libglib2.0-0 \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Copy app code
COPY ./documentreader/src ./src

# Copy shared library (for imports)
COPY ./shared /shared

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
