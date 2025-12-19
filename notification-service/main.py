"""
Notification Service - Event Consumer & Audit Logger

This service consumes completion / notification-related Kafka events
from document service and other services, logs them, and stores audit records
in its own PostgreSQL database.

Key Features:
- Consumes: document.processed, notes.generated, quiz.generated, etc.
- Stores audit logs with full event payload
- Provides HTTP endpoints to query notifications
- Ready for WebSocket/SES integration (Phase 3)
"""

import json
import os
import threading
import time
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from kafka import KafkaConsumer
from kafka.errors import KafkaError
from sqlalchemy.orm import Session
from sqlalchemy import desc
import asyncio
from platform_shared.config import ServiceSettings
from platform_shared.logging import setup_logging


try:
    # Try relative imports first (when run as module)
    from .database import engine, SessionLocal, get_db
    from .models import Base, NotificationLog
except ImportError:
    # Fall back to absolute imports (when run directly)
    from database import engine, SessionLocal, get_db
    from models import Base, NotificationLog


settings = ServiceSettings(service_name="notification-service")
logger = setup_logging("notification-service", settings.log_level)

app = FastAPI(
    title="Notification Service",
    version="1.0.0",
    description="Consumes events and logs notifications - Document Service integration ready",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
NOTIFICATION_TOPICS: List[str] = [
    "quiz.generated",
    "audio.generation.completed",
    "audio.transcription.completed",
    "document.processed",  # ✅ From document-worker
    "notes.generated",     # ✅ From document-worker
    "chat.message",
    "user.created",
]
CONSUMER_GROUP_ID = "notification-service-group"

# Consumer retry configuration
MAX_RETRIES = 5
RETRY_DELAY_SECONDS = 5


# WebSocket Connection Manager
class ConnectionManager:
    """Manages WebSocket connections for real-time notifications."""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.lock = threading.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and store a new WebSocket connection for a user."""
        await websocket.accept()
        with self.lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user: {user_id}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection."""
        with self.lock:
            if user_id in self.active_connections:
                try:
                    self.active_connections[user_id].remove(websocket)
                    if not self.active_connections[user_id]:
                        del self.active_connections[user_id]
                except ValueError:
                    pass
        logger.info(f"WebSocket disconnected for user: {user_id}")
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all WebSocket connections for a specific user."""
        connections_to_remove = []
        
        with self.lock:
            connections = self.active_connections.get(user_id, []).copy()
        
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send WebSocket message: {e}")
                connections_to_remove.append(connection)
        
        # Clean up dead connections
        if connections_to_remove:
            with self.lock:
                for conn in connections_to_remove:
                    try:
                        self.active_connections[user_id].remove(conn)
                    except (ValueError, KeyError):
                        pass


manager = ConnectionManager()


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "notification-service",
        "topics_subscribed": NOTIFICATION_TOPICS,
        "consumer_group": CONSUMER_GROUP_ID,
    }


@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for real-time notifications."""
    user_id = None
    try:
        from platform_shared.security import verify_token
        user_data = verify_token(token)
        
        if not user_data:
            await websocket.close(code=1008)
            return
        
        user_id = user_data.get("user_id")
        
        if not user_id:
            await websocket.close(code=1008)
            return
        
        await manager.connect(websocket, user_id)
        logger.info(f"✅ WebSocket connected: {user_id}")
        
        while True:
            try:
                await websocket.receive_text()
                await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close(code=1008)
        except Exception:
            # Connection might be already closed or in a state where close() fails
            pass
    finally:
        if user_id:
            manager.disconnect(websocket, user_id)


def _extract_event_details(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract key details from event payload for better logging.
    
    Handles both document.processed and notes.generated events from document-worker.
    """
    return {
        "document_id": payload.get("document_id"),
        "user_id": payload.get("user_id"),
        "event_type": payload.get("event_type"),
        "trace_id": payload.get("trace_id"),
        "correlation_id": payload.get("correlation_id"),
    }


def _get_notification_message(event_type: str, payload: Dict[str, Any]) -> str:
    """Generate user-friendly notification message based on event type."""
    if event_type == "document.processed":
        return "Your document has been processed successfully!"
    elif event_type == "notes.generated":
        return "AI notes have been generated for your document!"
    elif event_type == "quiz.generated":
        return "Your quiz is ready!"
    elif event_type == "audio.generation.completed":
        return "Audio generation completed!"
    elif event_type == "audio.transcription.completed":
        return "Audio transcription completed!"
    elif event_type == "chat.message":
        return "New chat message received!"
    elif event_type == "user.created":
        return "Welcome! Your account has been created."
    else:
        return f"New notification: {event_type}"


def _process_notification_event(topic: str, payload: Dict[str, Any]) -> bool:
    """
    Process a single notification event: log and persist to database.
    
    Returns True if successful, False otherwise.
    """
    event_details = _extract_event_details(payload)
    document_id = event_details.get("document_id")
    user_id = event_details.get("user_id")
    event_type = event_details.get("event_type")

    logger.info(
        "📨 Notification event received",
        extra={
            "topic": topic,
            "event_type": event_type,
            "document_id": document_id,
            "user_id": user_id,
            "trace_id": event_details.get("trace_id"),
        },
    )

    # Persist audit log
    db = None
    try:
        db = SessionLocal()
        log_entry = NotificationLog(
            topic=topic,
            event_type=event_type,
            user_id=user_id,
            raw_event=json.dumps(payload, indent=2),
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

        logger.info(            "Notification logged successfully",
            extra={
                "notification_id": log_entry.id,
                "topic": topic,
                "event_type": event_type,
                "document_id": document_id,
            },
        )
        
        # Broadcast notification via WebSocket to connected users
        if user_id:
            notification_message = {
                "id": log_entry.id,
                "topic": topic,
                "event_type": event_type,
                "message": _get_notification_message(event_type, payload),
                "created_at": log_entry.created_at.isoformat() if log_entry.created_at else None,
                "data": payload,
            }
            
            # Use asyncio to send WebSocket message from sync context
            try:
                loop = asyncio.new_event_loop()
                loop.run_until_complete(manager.send_to_user(user_id, notification_message))
                loop.close()
            except Exception as ws_err:
                logger.error(f"Failed to broadcast WebSocket notification: {ws_err}")
        
        return True

    except Exception as db_exc:
        logger.error(
            "❌ Failed to persist notification log",
            extra={
                "error": str(db_exc),
                "topic": topic,
                "event_type": event_type,
            },
        )
        if db:
            db.rollback()
        return False
    finally:
        if db:
            try:
                db.close()
            except Exception:
                pass


def _consume_loop():
    """
    Background Kafka consumer loop with retry logic.

    Runs in its own daemon thread so it doesn't block the FastAPI server.
    Retries connection on failure with exponential backoff.
    """
    retry_count = 0
    consumer = None

    while retry_count < MAX_RETRIES:
        try:
            logger.info(
                "🔄 Starting Kafka consumer",
                extra={
                    "topics": NOTIFICATION_TOPICS,
                    "bootstrap_servers": KAFKA_BOOTSTRAP_SERVERS,
                    "consumer_group": CONSUMER_GROUP_ID,
                    "attempt": retry_count + 1,
                },
            )

            consumer = KafkaConsumer(
                *NOTIFICATION_TOPICS,
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                group_id=CONSUMER_GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=False,
                value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                consumer_timeout_ms=1000,  # Poll timeout
            )

            logger.info("✅ Kafka consumer created successfully")
            retry_count = 0  # Reset retry count on success

            # Main consumption loop
            for message in consumer:
                try:
                    topic = message.topic
                    payload = message.value or {}

                    # Process the event
                    success = _process_notification_event(topic, payload)

                    # Commit offset only after successful processing
                    if success:
                        consumer.commit()
                    else:
                        logger.warning(
                            "⚠️ Skipping offset commit due to processing failure",
                            extra={"topic": topic},
                        )

                except json.JSONDecodeError as json_err:
                    logger.error(
                        "❌ Failed to decode message JSON",
                        extra={"error": str(json_err), "topic": message.topic},
                    )
                    # Still commit to avoid reprocessing bad messages
                    consumer.commit()

                except Exception as msg_err:
                    logger.error(
                        "❌ Error processing message",
                        extra={"error": str(msg_err), "topic": message.topic},
                    )
                    # Don't commit on error - will retry

        except KafkaError as kafka_err:
            retry_count += 1
            logger.error(
                "❌ Kafka error in consumer loop",
                extra={
                    "error": str(kafka_err),
                    "retry_count": retry_count,
                    "max_retries": MAX_RETRIES,
                },
            )

            if retry_count < MAX_RETRIES:
                wait_time = RETRY_DELAY_SECONDS * retry_count
                logger.info(
                    f"⏳ Retrying in {wait_time} seconds...",
                    extra={"retry_count": retry_count},
                )
                time.sleep(wait_time)
            else:
                logger.critical(
                    "❌ Max retries reached. Consumer loop stopped.",
                    extra={"max_retries": MAX_RETRIES},
                )
                break

        except Exception as loop_exc:
            logger.error(
                "❌ Unexpected error in consumer loop",
                extra={"error": str(loop_exc)},
            )
            retry_count += 1
            if retry_count < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
            else:
                break

        finally:
            if consumer:
                try:
                    consumer.close()
                except Exception:
                    pass

    logger.error("❌ Consumer loop terminated permanently")


# HTTP Endpoints for Testing & Querying Notifications


@app.get("/api/notifications")
async def list_notifications(
    user_id: Optional[str] = Query(None, description="Filter by user_id"),
    topic: Optional[str] = Query(None, description="Filter by topic (e.g., document.processed)"),
    event_type: Optional[str] = Query(None, description="Filter by event_type"),
    limit: int = Query(50, ge=1, le=100, description="Max number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
):
    """
    Query notification logs.

    Useful for:
    - Testing that events are being consumed
    - Debugging event flows
    - Verifying document.processed and notes.generated events are received
    """
    query = db.query(NotificationLog)

    if user_id:
        query = query.filter(NotificationLog.user_id == user_id)
    if topic:
        query = query.filter(NotificationLog.topic == topic)
    if event_type:
        query = query.filter(NotificationLog.event_type == event_type)

    total = query.count()
    notifications = (
        query.order_by(desc(NotificationLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "notifications": [
            {
                "id": n.id,
                "topic": n.topic,
                "event_type": n.event_type,
                "user_id": n.user_id,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "event": json.loads(n.raw_event) if n.raw_event else None,
            }
            for n in notifications
        ],
    }


@app.get("/api/notifications/stats")
async def notification_stats(db: Session = Depends(get_db)):
    """Get statistics about notifications received."""
    total = db.query(NotificationLog).count()

    # Count by topic
    from sqlalchemy import func
    topic_counts = (
        db.query(NotificationLog.topic, func.count(NotificationLog.id).label("count"))
        .group_by(NotificationLog.topic)
        .all()
    )

    # Count by event_type
    event_type_counts = (
        db.query(NotificationLog.event_type, func.count(NotificationLog.id).label("count"))
        .filter(NotificationLog.event_type.isnot(None))
        .group_by(NotificationLog.event_type)
        .all()
    )

    return {
        "total_notifications": total,
        "by_topic": {topic: count for topic, count in topic_counts},
        "by_event_type": {event_type: count for event_type, count in event_type_counts},
    }


@app.on_event("startup")
def on_startup():
    """
    Initialize database tables and start background consumer.

    This ensures:
    1. Database tables exist
    2. Kafka consumer starts in background thread
    3. Service is ready to receive document.processed and notes.generated events
    """
    # Ensure tables exist
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Notification Service startup: database tables ready")
    except Exception as db_err:
        logger.error(
            "❌ Failed to create database tables",
            extra={"error": str(db_err)},
        )
        raise

    # Start background Kafka consumer
    thread = threading.Thread(target=_consume_loop, daemon=True, name="kafka-consumer")
    thread.start()
    logger.info("✅ Notification Service startup: Kafka consumer thread started")
    logger.info(
        "📡 Listening for events on topics",
        extra={"topics": NOTIFICATION_TOPICS},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003, log_config=None)


