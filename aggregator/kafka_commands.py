"""
Kafka Command Publishing Utilities for Aggregator

This module provides helper functions to publish command events to Kafka.
Commands are requests for services to perform actions (e.g., generate quiz).

All commands follow the architecture pattern:
- Aggregator publishes command events
- Services consume and process commands
- Services publish completion events
- Notification Service consumes completion events
"""

import uuid
from datetime import datetime
from typing import Optional

from platform_shared.models import EventType

# Import logger from main module to avoid duplicate setup
import logging
logger = logging.getLogger("aggregator")


def publish_quiz_requested(
    producer,
    document_id: str,
    user_id: str,
    difficulty: str = "medium",
    question_count: int = 10,
    question_types: Optional[list] = None,
    reply_to: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> None:
    """
    Publish quiz.requested command event.
    
    This command tells Quiz Service to generate a quiz from a document.
    
    Args:
        producer: KafkaProducer instance
        document_id: ID of the document to generate quiz from
        user_id: ID of the user requesting the quiz
        difficulty: Quiz difficulty level
        question_count: Number of questions to generate
        question_types: List of question types (e.g., ["multiple_choice", "true_false"])
        reply_to: Optional topic for request-reply pattern (e.g., "platform.aggregator.replies")
        correlation_id: Optional correlation ID for request-reply pattern
    
    Example:
        from aggregator.main import get_kafka_producer
        producer = get_kafka_producer()
        publish_quiz_requested(
            producer=producer,
            document_id="doc-123",
            user_id="user-456",
            difficulty="hard",
            question_count=15
        )
    """
    if question_types is None:
        question_types = ["multiple_choice"]
    
    if correlation_id is None:
        correlation_id = f"corr-{uuid.uuid4()}"
    
    event = {
        "event_type": EventType.QUIZ_REQUESTED.value,
        "event_id": f"evt-{uuid.uuid4()}",
        "request_id": f"req-{uuid.uuid4()}",
        "document_id": document_id,
        "user_id": user_id,
        "difficulty": difficulty,
        "question_count": question_count,
        "question_types": question_types,
        "timestamp": datetime.utcnow().isoformat(),
        "trace_id": f"trace-{uuid.uuid4()}",
        "correlation_id": correlation_id,
        "schema_version": "1.0.0",
    }
    
    # Add reply_to if provided (for request-reply pattern)
    if reply_to:
        event["reply_to"] = reply_to
    
    try:
        producer.send("quiz.requested", value=event, key=document_id)
        producer.flush()
        logger.info(
            "Published quiz.requested event",
            extra={
                "document_id": document_id,
                "user_id": user_id,
                "correlation_id": correlation_id,
            },
        )
    except Exception as e:
        logger.error(
            "Failed to publish quiz.requested event",
            extra={"error": str(e), "document_id": document_id},
        )
        raise


def publish_audio_generation_requested(
    producer,
    user_id: str,
    text: str,
    voice: str = "default",
    reply_to: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> str:
    """
    Publish audio.generation.requested command event.
    
    This command tells TTS Service to generate audio from text.
    
    Args:
        producer: KafkaProducer instance
        user_id: ID of the user requesting audio
        text: Text to convert to speech
        voice: Voice to use (default: "default")
        reply_to: Optional topic for request-reply pattern
        correlation_id: Optional correlation ID for request-reply pattern
    
    Returns:
        request_id: The generated request ID
    """
    request_id = f"req-{uuid.uuid4()}"
    
    if correlation_id is None:
        correlation_id = f"corr-{uuid.uuid4()}"
    
    event = {
        "event_type": EventType.AUDIO_GENERATION_REQUESTED.value,
        "event_id": f"evt-{uuid.uuid4()}",
        "request_id": request_id,
        "user_id": user_id,
        "text": text,
        "voice": voice,
        "timestamp": datetime.utcnow().isoformat(),
        "trace_id": f"trace-{uuid.uuid4()}",
        "correlation_id": correlation_id,
        "schema_version": "1.0.0",
    }
    
    if reply_to:
        event["reply_to"] = reply_to
    
    try:
        producer.send("audio.generation.requested", value=event, key=request_id)
        producer.flush()
        logger.info(
            "Published audio.generation.requested event",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "correlation_id": correlation_id,
            },
        )
        return request_id
    except Exception as e:
        logger.error(
            "Failed to publish audio.generation.requested event",
            extra={"error": str(e), "user_id": user_id},
        )
        raise


def publish_audio_transcription_requested(
    producer,
    user_id: str,
    audio_id: str,
    s3_uri: str,
    reply_to: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> str:
    """
    Publish audio.transcription.requested command event.
    
    This command tells STT Service to transcribe audio to text.
    
    Args:
        producer: KafkaProducer instance
        user_id: ID of the user requesting transcription
        audio_id: ID of the audio file
        s3_uri: S3 URI of the audio file
        reply_to: Optional topic for request-reply pattern
        correlation_id: Optional correlation ID for request-reply pattern
    
    Returns:
        request_id: The generated request ID
    """
    request_id = f"req-{uuid.uuid4()}"
    
    if correlation_id is None:
        correlation_id = f"corr-{uuid.uuid4()}"
    
    event = {
        "event_type": EventType.AUDIO_TRANSCRIPTION_REQUESTED.value,
        "event_id": f"evt-{uuid.uuid4()}",
        "request_id": request_id,
        "audio_id": audio_id,
        "user_id": user_id,
        "s3_uri": s3_uri,
        "timestamp": datetime.utcnow().isoformat(),
        "trace_id": f"trace-{uuid.uuid4()}",
        "correlation_id": correlation_id,
        "schema_version": "1.0.0",
    }
    
    if reply_to:
        event["reply_to"] = reply_to
    
    try:
        producer.send("audio.transcription.requested", value=event, key=audio_id)
        producer.flush()
        logger.info(
            "Published audio.transcription.requested event",
            extra={
                "request_id": request_id,
                "audio_id": audio_id,
                "user_id": user_id,
            },
        )
        return request_id
    except Exception as e:
        logger.error(
            "Failed to publish audio.transcription.requested event",
            extra={"error": str(e), "audio_id": audio_id},
        )
        raise

