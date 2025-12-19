from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid


Base = declarative_base()


def generate_uuid() -> str:
    """Generate UUID string for primary keys."""
    return str(uuid.uuid4())


class NotificationLog(Base):
    """
    Simple audit log for notifications.

    Stores the raw event payload so we can inspect what the Notification
    Service has seen without coupling to specific event schemas.
    """

    __tablename__ = "notification_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)

    # Kafka topic this came from (e.g. quiz.generated)
    topic = Column(String(100), nullable=False, index=True)

    # Optional high-level type (e.g. quiz.generated.v1)
    event_type = Column(String(100), nullable=True, index=True)

    # Optional user_id if present in payload
    user_id = Column(String(64), nullable=True, index=True)

    # Raw JSON payload for maximum flexibility
    raw_event = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


