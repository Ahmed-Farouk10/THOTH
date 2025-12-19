"""
Platform Shared Package

This package contains shared models, utilities, and configurations used across
all microservices. This ensures consistency and reduces code duplication.

Key Components:
- Models: Pydantic models for events, requests, responses
- Config: Centralized configuration management
- Logging: Structured JSON logging
- Database: Database connection utilities
- Kafka: Kafka producer/consumer utilities
"""

from .models import (
    BaseEvent,
    EventType,
    UserContext,
    DatabaseConfig,
)
from .config import (
    DatabaseSettings,
    KafkaSettings,
    AWSSettings,
    ServiceSettings,
)
from .logging import setup_logging
from .security import (
    get_current_user,
    verify_token,
    SECRET_KEY,
    ALGORITHM,
)

__version__ = "0.1.0"
__all__ = [
    "BaseEvent",
    "EventType",
    "UserContext",
    "DatabaseConfig",
    "DatabaseSettings",
    "KafkaSettings",
    "AWSSettings",
    "ServiceSettings",
    "setup_logging",
    "get_current_user",
    "verify_token",
    "SECRET_KEY",
    "ALGORITHM",
]

