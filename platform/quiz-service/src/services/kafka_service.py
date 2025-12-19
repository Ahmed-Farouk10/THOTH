import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any

from kafka import KafkaConsumer, KafkaProducer

logger = logging.getLogger(__name__)


class KafkaService:
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        self.producer = None

    def _get_producer(self):
        if not self.producer:
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
            )
            logger.info(f"Kafka producer initialized for {self.bootstrap_servers}")
        return self.producer

    def create_consumer(self, topics: Any, group_id: str):
        if isinstance(topics, str):
            topics = [topics]
        return KafkaConsumer(
            *topics,  # Unpack topics list
            bootstrap_servers=self.bootstrap_servers,
            group_id=group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
            # Don't set consumer_timeout_ms - use poll() with timeout instead
        )

    def create_producer(self):
        return self._get_producer()

    def produce_quiz_generated(self, quiz_id: str, document_id: str, user_id: str, quiz_title: str):
        event = {
            "event_type": "quiz.generated.v1",
            "event_id": f"evt-{uuid.uuid4()}",
            "quiz_id": quiz_id,
            "document_id": document_id,
            "user_id": user_id,
            "title": quiz_title,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "quiz-service",
        }
        self._get_producer().send("quiz.generated", value=event, key=quiz_id)
        self._get_producer().flush()
        logger.info(f"Produced quiz.generated event for quiz {quiz_id}")

    def produce_quiz_requested(self, document_id: str, user_id: str, difficulty: str = "Medium"):
        event = {
            "event_type": "quiz.requested.v1",
            "event_id": f"evt-{uuid.uuid4()}",
            "document_id": document_id,
            "user_id": user_id,
            "difficulty": difficulty,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "quiz-service-api",
        }
        self._get_producer().send("quiz.requested", value=event, key=document_id)
        self._get_producer().flush()
        logger.info(f"Produced quiz.requested event for document {document_id}")

    def close(self):
        if self.producer:
            try:
                self.producer.close()
                logger.info("Kafka producer closed")
            finally:
                self.producer = None


kafka_service = KafkaService()

