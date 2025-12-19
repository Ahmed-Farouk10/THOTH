"""
Shared Data Models

This module defines Pydantic models used across all services for:
- Event schemas (Kafka messages)
- API request/response models
- Database configurations
- User context

Why Pydantic?
- Automatic validation
- Type safety
- JSON serialization/deserialization
- IDE autocomplete support
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class EventType(str, Enum):
    """
    Enumeration of all event types in the system.
    
    Naming Convention: {domain}.{action}.v{version}
    - domain: The domain (document, quiz, audio, chat, user)
    - action: What happened (uploaded, processed, generated, etc.)
    - version: Schema version for evolution
    
    Why enums? Type safety and IDE autocomplete.
    """
    DOCUMENT_UPLOADED = "document.uploaded.v1"
    DOCUMENT_PROCESSED = "document.processed.v1"
    NOTES_GENERATED = "notes.generated.v1"
    QUIZ_REQUESTED = "quiz.requested.v1"
    QUIZ_GENERATED = "quiz.generated.v1"
    AUDIO_TRANSCRIPTION_REQUESTED = "audio.transcription.requested.v1"
    AUDIO_TRANSCRIPTION_COMPLETED = "audio.transcription.completed.v1"
    AUDIO_GENERATION_REQUESTED = "audio.generation.requested.v1"
    AUDIO_GENERATION_COMPLETED = "audio.generation.completed.v1"
    CHAT_MESSAGE = "chat.message.v1"
    USER_CREATED = "user.created.v1"


class BaseEvent(BaseModel):
    """
    Base class for all Kafka events.
    
    Every event MUST include:
    - event_type: What type of event this is
    - event_id: Unique identifier for this event instance
    - timestamp: When the event occurred
    - trace_id: For distributed tracing
    - correlation_id: For request-reply patterns
    - schema_version: For schema evolution
    
    This ensures all events are traceable and versioned.
    """
    event_type: EventType
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: Optional[str] = None
    schema_version: str = "1.0.0"
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserContext(BaseModel):
    """
    User context extracted from JWT token.
    
    Used by services to know:
    - Who is making the request
    - What permissions they have
    - Their identity information
    
    This is passed from Aggregator to microservices.
    """
    user_id: str
    username: str
    email: str
    roles: List[str] = Field(default_factory=lambda: ["student"])


class DatabaseConfig(BaseModel):
    """
    Database connection configuration.
    
    Used to build SQLAlchemy connection strings.
    """
    host: str
    port: int = 5432
    database: str
    username: str
    password: str
    
    @property
    def url(self) -> str:
        """
        Build PostgreSQL connection URL.
        
        Format: postgresql://user:password@host:port/database
        """
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"


# Event-specific models (extend BaseEvent)

class DocumentUploadedEvent(BaseEvent):
    """Event published when a document is uploaded to S3."""
    document_id: str
    user_id: str
    s3_uri: str
    file_name: str
    file_size: int
    content_type: str
    
    class Config:
        # Set default event_type
        json_schema_extra = {
            "example": {
                "event_type": "document.uploaded.v1",
                "document_id": "doc-123",
                "user_id": "user-456",
                "s3_uri": "s3://bucket/documents/doc-123/file.pdf",
                "file_name": "lecture.pdf",
                "file_size": 2048576,
                "content_type": "application/pdf"
            }
        }


class DocumentProcessedEvent(BaseEvent):
    """Event published when document processing is complete."""
    document_id: str
    user_id: str
    s3_uri: str
    pages: int
    text_excerpt: str
    summary: str
    extracted_text_s3_uri: Optional[str] = None
    processed_at: datetime


class QuizRequestedEvent(BaseEvent):
    """Event published when user requests quiz generation."""
    request_id: str
    document_id: str
    user_id: str
    difficulty: str = "medium"
    question_count: int = 10
    question_types: List[str] = Field(default_factory=lambda: ["multiple_choice"])
    reply_to: Optional[str] = None  # For request-reply pattern


class QuizGeneratedEvent(BaseEvent):
    """Event published when quiz generation is complete."""
    quiz_id: str
    request_id: str
    document_id: str
    user_id: str
    question_count: int
    quiz_s3_uri: str
    generated_at: datetime


class ChatMessageEvent(BaseEvent):
    """Event published for chat messages."""
    message_id: str
    conversation_id: str
    user_id: str
    text: str
    message_type: str = "user"  # user, assistant


class AudioGenerationRequestedEvent(BaseEvent):
    """Event published when TTS is requested."""
    request_id: str
    user_id: str
    text: str
    voice: str = "default"
    reply_to: Optional[str] = None


class AudioGenerationCompletedEvent(BaseEvent):
    """Event published when TTS generation is complete."""
    audio_id: str
    request_id: str
    user_id: str
    s3_uri: str
    duration_seconds: float
    generated_at: datetime

