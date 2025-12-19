#!/usr/bin/env python3
"""
Kafka Topic Creation Script

This script creates all required Kafka topics for the platform.
Run this after starting Kafka.

Usage:
    python scripts/create_topics.py
"""

from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError
import os

# Kafka broker address
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092").split(",")

def create_topics():
    """
    Create all Kafka topics with proper configuration.
    
    Topics are defined according to ARCHITECTURE.md specifications.
    """
    admin_client = KafkaAdminClient(
        bootstrap_servers=KAFKA_BROKERS,
        client_id='topic_creator'
    )
    
    # Topic definitions
    # Format: (name, partitions, replication_factor, config)
    topics = [
        # Document events
        ("document.uploaded", 6, 1, {
            "retention.ms": str(7 * 24 * 60 * 60 * 1000),  # 7 days
            "cleanup.policy": "delete"
        }),
        ("document.processed", 6, 1, {
            "retention.ms": str(30 * 24 * 60 * 60 * 1000),  # 30 days
            "cleanup.policy": "delete"
        }),
        ("notes.generated", 4, 1, {
            "retention.ms": str(30 * 24 * 60 * 60 * 1000),  # 30 days
            "cleanup.policy": "compact"  # Keep latest per key
        }),
        
        # Quiz events
        ("quiz.requested", 4, 1, {
            "retention.ms": str(7 * 24 * 60 * 60 * 1000),  # 7 days
            "cleanup.policy": "delete"
        }),
        ("quiz.generated", 6, 1, {
            "retention.ms": str(30 * 24 * 60 * 60 * 1000),  # 30 days
            "cleanup.policy": "delete"
        }),
        
        # Audio events
        ("audio.transcription.requested", 3, 1, {
            "retention.ms": str(7 * 24 * 60 * 60 * 1000),  # 7 days
            "cleanup.policy": "delete"
        }),
        ("audio.transcription.completed", 3, 1, {
            "retention.ms": str(30 * 24 * 60 * 60 * 1000),  # 30 days
            "cleanup.policy": "delete"
        }),
        ("audio.generation.requested", 3, 1, {
            "retention.ms": str(7 * 24 * 60 * 60 * 1000),  # 7 days
            "cleanup.policy": "delete"
        }),
        ("audio.generation.completed", 3, 1, {
            "retention.ms": str(30 * 24 * 60 * 60 * 1000),  # 30 days
            "cleanup.policy": "delete"
        }),
        
        # Chat events
        ("chat.message", 12, 1, {
            "retention.ms": str(14 * 24 * 60 * 60 * 1000),  # 14 days
            "cleanup.policy": "delete"
        }),
        
        # User events
        ("user.created", 3, 1, {
            "retention.ms": str(30 * 24 * 60 * 60 * 1000),  # 30 days
            "cleanup.policy": "delete"
        }),
        
        # Aggregator reply topic (for request-reply pattern)
        ("platform.aggregator.replies", 6, 1, {
            "retention.ms": str(1 * 60 * 60 * 1000),  # 1 hour (short-lived)
            "cleanup.policy": "delete"
        }),
    ]
    
    # Create NewTopic objects
    topic_list = []
    for name, partitions, replication_factor, config in topics:
        topic_list.append(
            NewTopic(
                name=name,
                num_partitions=partitions,
                replication_factor=replication_factor,
                topic_configs=config
            )
        )
    
    # Create topics
    try:
        admin_client.create_topics(new_topics=topic_list, validate_only=False)
        print(f"✅ Successfully created {len(topic_list)} topics:")
        for topic in topic_list:
            print(f"   - {topic.name} ({topic.num_partitions} partitions, RF={topic.replication_factor})")
    except TopicAlreadyExistsError as e:
        print(f"⚠️  Some topics already exist: {e}")
        print("   This is okay if you're re-running the script.")
    except Exception as e:
        print(f"❌ Error creating topics: {e}")
        raise
    finally:
        admin_client.close()


if __name__ == "__main__":
    print("🚀 Creating Kafka topics...")
    print(f"   Kafka brokers: {KAFKA_BROKERS}")
    create_topics()
    print("✅ Done!")

