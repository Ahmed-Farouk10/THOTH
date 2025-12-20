from kafka import KafkaConsumer, KafkaProducer
import json
import os
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class KafkaService:
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        self.producer = None

    def _get_producer(self):
        """Lazy load producer with 10MB message support"""
        if not self.producer:
            try:
                self.producer = KafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                    key_serializer=lambda k: k.encode('utf-8') if k else None,
                    acks='all',
                    retries=3,
                    # CRITICAL: Support 10MB messages for large document text payloads
                    max_request_size=10485760,  # 10 MB
                    buffer_memory=33554432,  # 32 MB buffer
                )
                logger.info(
                    f"Kafka producer initialized for {self.bootstrap_servers} "
                    f"(max_request_size=10MB)"
                )
            except Exception as e:
                logger.error(f"Failed to create Kafka producer: {e}")
                raise
        return self.producer
    
    def create_consumer(self, topics: any, group_id: str):
        """Create and return a Kafka consumer for workers (supports 10MB messages)"""
        try:
            if isinstance(topics, str):
                topics = [topics]
            
            return KafkaConsumer(
                *topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id=group_id,
                auto_offset_reset='earliest',
                enable_auto_commit=False,
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                consumer_timeout_ms=1000,  # Poll every 1 second (for poll() pattern)
                # CRITICAL: Support receiving 10MB messages (for document text)
                max_partition_fetch_bytes=10485760,  # 10 MB
                fetch_max_bytes=52428800,  # 50 MB total
            )
        except Exception as e:
            logger.error(f"Failed to create Kafka consumer: {e}")
            raise
    
    def create_producer(self):
        """Return raw producer for manual use (used by worker)"""
        return self._get_producer()

    def produce_document_uploaded(self, document_id: str, user_id: str, s3_url: str, filename: str, file_size: int, content_type: str):
        """Produces the document.uploaded event"""
        try:
            event = {
                "event_type": "document.uploaded.v1",
                "event_id": f"evt-{uuid.uuid4()}",
                "document_id": document_id,
                "user_id": user_id,
                "s3_url": s3_url,
                "s3_uri": s3_url,  # Also include s3_uri for compatibility
                "filename": filename,
                "file_name": filename,  # Also include file_name for compatibility
                "file_size": file_size,
                "content_type": content_type,
                "timestamp": datetime.utcnow().isoformat(),
                "trace_id": f"trace-{uuid.uuid4()}",
                "correlation_id": f"corr-{uuid.uuid4()}",
                "schema_version": "1.0.0",
                "service": "document-service-api"
            }
            
            # Key by document_id to ensure order
            self._get_producer().send("document.uploaded", value=event, key=document_id)
            self._get_producer().flush()
            logger.info(f"Produced document.uploaded event for {document_id}")
            
        except Exception as e:
            logger.error(f"Failed to produce document.uploaded event: {e}")
            # We raise here because if the event fails, the upload flow is broken
            raise

    def produce_regenerate_notes(self, document_id: str, user_id: str, s3_text_url: str, filename: str):
        """Produces the regenerate.notes event"""
        try:
            event = {
                "event_type": "regenerate.notes.v1",
                "event_id": f"evt-{uuid.uuid4()}",
                "document_id": document_id,
                "user_id": user_id,
                "s3_text_url": s3_text_url,
                "filename": filename,
                "timestamp": datetime.utcnow().isoformat(),
                "trace_id": f"trace-{uuid.uuid4()}",
                "correlation_id": f"corr-{uuid.uuid4()}",
                "schema_version": "1.0.0",
                "service": "document-service-api"
            }
            
            self._get_producer().send("regenerate.notes", value=event, key=document_id)
            self._get_producer().flush()
            logger.info(f"Produced regenerate.notes event for {document_id}")
            
        except Exception as e:
            logger.error(f"Failed to produce regenerate.notes event: {e}")
            raise

    def close(self):
        """Close the Kafka producer"""
        if self.producer:
            try:
                self.producer.close()
                self.producer = None
                logger.info("Kafka producer closed")
            except Exception as e:
                logger.error(f"Error closing Kafka producer: {e}")


kafka_service = KafkaService()
