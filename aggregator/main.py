"""
Aggregator Service (BFF - Backend for Frontend)

This service orchestrates all microservices and provides a single entry point
for the frontend. It handles:
- JWT authentication
- Request orchestration
- Kafka event publishing (commands like quiz.requested)
- Response aggregation

Architecture Decision: HTTP Proxying for Document Upload
- Aggregator proxies file uploads to Document Service via HTTP
- This maintains strict storage isolation: only Document Service has write access to its S3 bucket
- Aggregator never directly accesses S3 buckets (security boundary)
"""

import os
import json
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from kafka import KafkaProducer

from platform_shared.config import ServiceSettings
from platform_shared.logging import setup_logging
from platform_shared.models import UserContext
from auth import get_user_context_local

# Initialize configuration and logging
settings = ServiceSettings(service_name="aggregator")
logger = setup_logging("aggregator", settings.log_level)

# Kafka Configuration - Support both env var names
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS") or os.getenv("KAFKA_BROKERS", "kafka:9092")

# Global Kafka Producer (initialized in lifespan)
kafka_producer: KafkaProducer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager for startup/shutdown.
    
    Handles:
    - Startup: Initialize Kafka Producer for sending commands
    - Shutdown: Close Kafka Producer gracefully
    """
    global kafka_producer
    
    # Startup: Initialize Kafka Producer with retry logic
    max_retries = 5
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            logger.info(
                f"Initializing Kafka Producer (attempt {attempt + 1}/{max_retries})",
                extra={"bootstrap_servers": KAFKA_BOOTSTRAP_SERVERS},
            )
            kafka_producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                acks='all',  # Wait for all replicas
                retries=3,
                request_timeout_ms=10000,  # Reduced timeout for faster failure
                api_version=(0, 10, 1),  # Explicit API version
            )
            # Test connection by getting metadata (with longer timeout)
            try:
                kafka_producer.list_topics(timeout=10)
            except Exception as test_error:
                logger.warning(f"Kafka metadata test failed: {test_error}, but producer created - continuing")
            logger.info("✅ Kafka Producer initialized successfully")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(
                    f"Kafka Producer initialization failed (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s...",
                    extra={"error": str(e)},
                )
                import asyncio
                await asyncio.sleep(retry_delay)
            else:
                logger.error(
                    "❌ Failed to initialize Kafka Producer after all retries",
                    extra={"error": str(e)},
                )
                # Don't raise - allow service to start even if Kafka is down
                # Producer will be None and endpoints will return 503
                kafka_producer = None
    
    yield  # Application runs here
    
    # Shutdown: Close Producer
    if kafka_producer:
        try:
            logger.info("Closing Kafka Producer...")
            kafka_producer.close(timeout=5)
            logger.info("✅ Kafka Producer closed")
        except Exception as e:
            logger.error(
                "Error closing Kafka Producer",
                extra={"error": str(e)},
            )


app = FastAPI(
    title="Platform Aggregator",
    version="1.0.0",
    description="Backend for Frontend - Orchestrates microservices",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,  # Use lifespan for startup/shutdown
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


DOCUMENT_SERVICE_URL = os.getenv("DOCUMENT_SERVICE_URL", "http://document-service:8000")
CHAT_SERVICE_URL = os.getenv("CHAT_SERVICE_URL", "http://chat-service:8005")
QUIZ_SERVICE_URL = os.getenv("QUIZ_SERVICE_URL", "http://quiz-service:8004")


def get_kafka_producer() -> KafkaProducer:
    """
    Get the global Kafka producer instance.
    
    Raises HTTPException if producer is not available.
    Use this in endpoints that need to publish Kafka events.
    
    Example:
        producer = get_kafka_producer()
        producer.send("quiz.requested", value=event_data, key=document_id)
    """
    if kafka_producer is None:
        logger.error("Kafka Producer not available")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kafka service unavailable",
        )
    return kafka_producer


@app.get("/health")
async def health():
    """Health check endpoint."""
    logger.debug("Health check requested")
    return {
        "status": "healthy",
        "service": "aggregator",
        "timestamp": "2025-12-01T00:00:00Z"
    }


@app.get("/api/test-auth")
async def test_auth(user: UserContext = Depends(get_user_context_local)):
    """
    Test endpoint to verify JWT authentication is working.
    
    This endpoint requires a valid JWT token in the Authorization header.
    Usage:
        GET /api/test-auth
        Headers: Authorization: Bearer <token>
    """
    logger.info("Test auth endpoint called", extra={
        "user_id": user.user_id,
        "username": user.username
    })
    
    return {
        "message": "Authentication successful",
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "roles": user.roles
        }
    }


async def _forward_service_request(
    request: Request,
    service_url: str,
    path: str,
    method: str = "GET",
) -> Response:
    """
    Helper to forward requests to a microservice while preserving headers/body.

    - Forwards Authorization header so services can re-verify JWT.
    - Streams response back with original status code and headers.
    """
    url = f"{service_url}{path}"

    # Extract headers and preserve Authorization
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["authorization"] = auth_header

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method.upper() == "GET" or method.upper() == "DELETE":
                resp = await client.request(method, url, headers=headers, params=dict(request.query_params))
            elif method.upper() == "POST":
                # For file upload endpoint we need multipart form-data
                if "multipart/form-data" in request.headers.get("content-type", ""):
                    form = await request.form()
                    files = {}
                    data = {}
                    for key, value in form.multi_items():
                        if hasattr(value, "filename"):
                            files[key] = (value.filename, value.file, value.content_type)
                        else:
                            data[key] = value
                    resp = await client.post(url, headers=headers, data=data, files=files)
                else:
                    body = await request.body()
                    resp = await client.request(
                        method,
                        url,
                        headers=headers,
                        content=body,
                        params=dict(request.query_params),
                    )
            else:
                raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Method not allowed")

    except httpx.RequestError as exc:
        logger.error("Document Service request failed", extra={"error": str(exc), "url": url})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document Service unavailable",
        )

    # Build FastAPI Response from httpx Response
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={k: v for k, v in resp.headers.items() if k.lower() not in {"content-encoding", "transfer-encoding"}},
        media_type=resp.headers.get("content-type"),
    )


# -------------------------
# Document API (Proxy Only)
# -------------------------

@app.post("/api/documents/upload")
async def proxy_upload_document(request: Request) -> Response:
    """
    Upload document via Aggregator.

    Aggregator:
    - Verifies JWT (via API Gateway/Nginx + Document Service)
    - Forwards multipart request to Document Service
    - Returns Document Service response as-is
    """
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, "/api/documents/upload", method="POST")


@app.get("/api/documents")
async def proxy_list_documents(request: Request) -> Response:
    """List current user's documents via Document Service."""
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, "/api/documents", method="GET")


@app.get("/api/documents/{document_id}")
async def proxy_get_document(document_id: str, request: Request) -> Response:
    """Get single document metadata via Document Service."""
    path = f"/api/documents/{document_id}"
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, path, method="GET")


@app.get("/api/documents/{document_id}/notes")
async def proxy_get_document_notes(document_id: str, request: Request) -> Response:
    """Get generated notes for a document via Document Service."""
    path = f"/api/documents/{document_id}/notes"
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, path, method="GET")


@app.post("/api/documents/{document_id}/regenerate-notes")
async def proxy_regenerate_notes(document_id: str, request: Request) -> Response:
    """Trigger notes regeneration via Document Service."""
    path = f"/api/documents/{document_id}/regenerate-notes"
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, path, method="POST")


@app.post("/api/documents/{document_id}/process")
async def proxy_process_document(document_id: str, request: Request) -> Response:
    """Manually trigger document processing via Document Service."""
    path = f"/api/documents/{document_id}/process"
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, path, method="POST")


@app.delete("/api/documents/{document_id}")
async def proxy_delete_document(document_id: str, request: Request) -> Response:
    """Delete a document via Document Service."""
    path = f"/api/documents/{document_id}"
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, path, method="DELETE")


# -------------------------
# Chat API (HTTP Proxy)
# -------------------------

@app.post("/api/chat/message")
async def proxy_chat_message(request: Request) -> Response:
    """
    Send chat message via Aggregator.
    
    Aggregator:
    - Verifies JWT (via API Gateway/Nginx)
    - Forwards request to Chat Service
    - Returns Chat Service response (includes conversation history)
    """
    return await _forward_service_request(request, CHAT_SERVICE_URL, "/api/chat/message", method="POST")


# -------------------------
# TTS API (Kafka Commands)
# -------------------------

@app.post("/api/tts/synthesize")
async def proxy_tts_synthesize(request: Request) -> Response:
    """
    Proxy TTS synthesize request directly to TTS service.
    Returns audio file directly.
    """
    TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", "http://tts-service:8006")
    try:
        # Get request body
        body = await request.body()
        
        # Forward to TTS service with same headers
        headers = dict(request.headers)
        headers.pop('host', None)  # Remove host header
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/tts/synthesize",
                content=body,
                headers=headers,
            )
            
            # Return the audio response directly
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
    except Exception as e:
        logger.error(f"TTS proxy error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TTS service error: {str(e)}",
        )


# -------------------------
# STT API (Kafka Commands)
# -------------------------

@app.post("/api/stt/transcribe")
async def proxy_stt_transcribe(request: Request) -> Response:
    """
    Proxy STT transcribe request directly to STT service.
    Handles multipart file upload.
    """
    STT_SERVICE_URL = os.getenv("STT_SERVICE_URL", "http://stt-service:8007")
    try:
        # Get the form data (multipart)
        form = await request.form()
        
        # Prepare files and data for forwarding
        files = {}
        data = {}
        
        for key, value in form.items():
            if hasattr(value, 'read'):  # It's a file
                files[key] = (value.filename, await value.read(), value.content_type)
            else:
                data[key] = value
        
        # Forward to STT service
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{STT_SERVICE_URL}/api/stt/transcribe",
                files=files,
                data=data,
            )
            
            # Return the JSON response
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
    except Exception as e:
        logger.error(f"STT proxy error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"STT service error: {str(e)}",
        )


# -------------------------
# Document API (HTTP Proxy)
# -------------------------

@app.get("/api/documents")
async def proxy_list_documents(request: Request) -> Response:
    """List documents for current user via Document Service."""
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, "/api/documents", method="GET")


@app.post("/api/documents/upload")
async def proxy_upload_document(request: Request) -> Response:
    """Upload document via Document Service."""
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, "/api/documents/upload", method="POST")


@app.delete("/api/documents/{document_id}")
async def proxy_delete_document(document_id: str, request: Request) -> Response:
    """Delete document via Document Service."""
    path = f"/api/documents/{document_id}"
    return await _forward_service_request(request, DOCUMENT_SERVICE_URL, path, method="DELETE")


# -------------------------
# Quiz API (HTTP Proxy + Kafka Commands)
# -------------------------

@app.get("/api/quizzes")
async def proxy_list_quizzes(request: Request) -> Response:
    """List quizzes for current user via Quiz Service."""
    return await _forward_service_request(request, QUIZ_SERVICE_URL, "/api/quizzes", method="GET")


@app.get("/api/quizzes/{quiz_id}")
async def proxy_get_quiz(quiz_id: str, request: Request) -> Response:
    """Get single quiz via Quiz Service."""
    path = f"/api/quizzes/{quiz_id}"
    return await _forward_service_request(request, QUIZ_SERVICE_URL, path, method="GET")


@app.post("/api/quizzes/{quiz_id}/submit")
async def proxy_submit_quiz_answer(quiz_id: str, request: Request) -> Response:
    """Submit quiz answer via Quiz Service."""
    path = f"/api/quizzes/{quiz_id}/submit"
    return await _forward_service_request(request, QUIZ_SERVICE_URL, path, method="POST")


@app.delete("/api/quizzes/{quiz_id}")
async def proxy_delete_quiz(quiz_id: str, request: Request) -> Response:
    """Delete quiz via Quiz Service."""
    path = f"/api/quizzes/{quiz_id}"
    return await _forward_service_request(request, QUIZ_SERVICE_URL, path, method="DELETE")


@app.post("/api/quizzes/generate-from-topic")
async def proxy_generate_quiz_from_topic(request: Request) -> Response:
    """Generate quiz from custom topic via Quiz Service."""
    return await _forward_service_request(request, QUIZ_SERVICE_URL, "/api/quizzes/generate-from-topic", method="POST")


@app.post("/api/quizzes/generate-from-document")
async def proxy_generate_quiz_from_document(request: Request) -> Response:
    """Generate quiz from document via Quiz Service."""
    return await _forward_service_request(request, QUIZ_SERVICE_URL, "/api/quizzes/generate-from-document", method="POST")


@app.post("/api/quiz/generate")
async def request_quiz_generation(
    document_id: str,
    difficulty: str = "medium",
    question_count: int = 10,
    user: UserContext = Depends(get_user_context_local),
):
    """
    Request quiz generation from a document.
    
    This endpoint publishes a quiz.requested command event to Kafka.
    The Quiz Service will consume this event and generate the quiz.
    
    Architecture:
    - Aggregator publishes quiz.requested command
    - Quiz Service consumes command and generates quiz
    - Quiz Service publishes quiz.generated event
    - Notification Service consumes quiz.generated and notifies user
    
    For now, returns 202 Accepted (async processing).
    User will receive WebSocket notification when quiz is ready.
    
    Args:
        document_id: ID of the document to generate quiz from
        difficulty: Quiz difficulty (easy, medium, hard)
        question_count: Number of questions to generate
        user: User context from JWT token (automatic)
    
    Returns:
        202 Accepted with status message
    """
    from kafka_commands import publish_quiz_requested
    
    try:
        producer = get_kafka_producer()
        publish_quiz_requested(
            producer=producer,
            document_id=document_id,
            user_id=user.user_id,
            difficulty=difficulty,
            question_count=question_count,
        )
        
        logger.info(
            "Quiz generation requested",
            extra={
                "document_id": document_id,
                "user_id": user.user_id,
                "difficulty": difficulty,
                "question_count": question_count,
            },
        )
        
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "status": "accepted",
                "message": "Quiz generation started. You will be notified when ready.",
                "document_id": document_id,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to request quiz generation",
            extra={"error": str(e), "document_id": document_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request quiz generation",
        )


# -------------------------
# Chat Proxy API
# -------------------------

@app.get("/api/chat/conversations")
async def proxy_list_conversations(request: Request) -> Response:
    """List chat conversations."""
    return await _forward_service_request(request, CHAT_SERVICE_URL, "/api/chat/conversations", method="GET")

@app.get("/api/chat/messages/{conversation_id}")
async def proxy_get_messages(conversation_id: str, request: Request) -> Response:
    """Get messages for a conversation."""
    path = f"/api/chat/messages/{conversation_id}"
    return await _forward_service_request(request, CHAT_SERVICE_URL, path, method="GET")

@app.post("/api/chat/message")
async def proxy_chat_message(request: Request) -> Response:
    """Send chat message."""
    return await _forward_service_request(request, CHAT_SERVICE_URL, "/api/chat/message", method="POST")

