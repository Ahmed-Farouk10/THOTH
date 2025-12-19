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
            *topics,
            bootstrap_servers=self.bootstrap_servers,
            group_id=group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )

    def create_producer(self):
        return self._get_producer()

    def produce_chat_message(self, conversation_id: str, user_id: str, message: str):
        """Produce chat.message event to Kafka."""
        event = {
            "event_type": "chat.message.v1",
            "event_id": f"evt-{uuid.uuid4()}",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "message": message[:200] + "..." if len(message) > 200 else message,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "chat-service"
        }
        self._get_producer().send("chat.message", value=event, key=conversation_id)
        self._get_producer().flush()
        logger.info(f"Produced chat.message event for conversation {conversation_id}")

    def close(self):
        if self.producer:
            try:
                self.producer.close()
                logger.info("Kafka producer closed")
            finally:
                self.producer = None


kafka_service = KafkaService()

