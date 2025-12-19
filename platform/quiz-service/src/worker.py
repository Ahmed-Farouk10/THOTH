import json
import logging
import os
import sys
import time
from datetime import datetime
from traceback import format_exc

from database import SessionLocal, engine, ensure_tables
from models import Quiz, Question, Base
from services.ai_service import ai_service
from services.kafka_service import kafka_service
from services.s3_service import s3_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def wait_for_kafka(max_retries=30, delay=2):
    """Wait for Kafka to be available."""
    bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    logger.info(f"Waiting for Kafka at {bootstrap_servers}...")
    
    from kafka import KafkaConsumer
    from kafka.errors import KafkaError
    
    for attempt in range(max_retries):
        try:
            # Try to create a consumer to test connection
            # Use a dummy topic that might not exist - we just want to test connectivity
            test_consumer = KafkaConsumer(
                bootstrap_servers=bootstrap_servers,
                consumer_timeout_ms=1000,
                group_id="test-connection-group",
            )
            # Just creating the consumer tests the connection
            # Close it immediately
            test_consumer.close()
            logger.info("Kafka is ready!")
            return True
        except (KafkaError, Exception) as e:
            if attempt < max_retries - 1:
                logger.warning(f"Kafka not ready (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(delay)
            else:
                logger.error(f"Kafka failed to become ready after {max_retries} attempts: {e}")
                return False
    return False


def check_dependencies():
    """Check if all required dependencies are available."""
    issues = []
    
    # Check database
    try:
        ensure_tables()
        logger.info("Database connection OK")
    except Exception as e:
        issues.append(f"Database: {e}")
    
    # Check HuggingFace API key
    if not os.getenv("HUGGINGFACE_API_KEY"):
        issues.append("HUGGINGFACE_API_KEY not set - quiz generation will fail")
        logger.warning("HUGGINGFACE_API_KEY not set")
    else:
        logger.info("HUGGINGFACE_API_KEY is set")
    
    # Check S3 config
    s3_bucket = os.getenv("S3_BUCKET_NAME", "document-reader-storage-dev")
    logger.info(f"S3 bucket: {s3_bucket}")
    
    if issues:
        logger.warning(f"Dependency issues found: {issues}")
    else:
        logger.info("All dependencies OK")
    
    return len(issues) == 0


def process_quiz_generation(document_id: str, user_id: str, s3_text_url: str, difficulty: str = "Medium"):
    """Process quiz generation from document text."""
    db = SessionLocal()
    try:
        logger.info(f"Starting quiz generation - document_id={document_id}, user_id={user_id}, difficulty={difficulty}")

        # Download text from S3
        logger.info(f"Downloading text from S3: {s3_text_url}")
        text_bytes = s3_service.download_file(s3_text_url)
        text_content = text_bytes.decode("utf-8")
        logger.info(f"Downloaded text length: {len(text_content)} characters")

        # Generate quiz using AI
        logger.info("Generating quiz with AI service...")
        generated_quiz = ai_service.generate_quiz(text_content, difficulty=difficulty)
        logger.info(f"Generated quiz with {len(generated_quiz.questions)} questions")

        # Save to database
        new_quiz = Quiz(
            document_id=document_id,
            user_id=user_id,
            title=generated_quiz.title,
            difficulty=generated_quiz.difficulty,
        )
        db.add(new_quiz)
        db.flush()

        for q in generated_quiz.questions:
            db_question = Question(
                quiz_id=new_quiz.id,
                question_text=q.question_text,
                options=q.options,
                correct_answer_index=q.correct_answer_index,
                explanation=q.explanation,
            )
            db.add(db_question)

        db.commit()
        logger.info(f"Quiz saved to database: {new_quiz.id}")

        # Upload quiz JSON to S3
        quiz_payload = json.dumps(generated_quiz.model_dump(), indent=2).encode("utf-8")
        quiz_s3_key = f"{user_id}/{document_id}/quiz_{new_quiz.id}.json"
        s3_service.upload_file(quiz_payload, quiz_s3_key, content_type="application/json")
        logger.info(f"Quiz uploaded to S3: {quiz_s3_key}")

        # Publish quiz.generated event
        kafka_service.produce_quiz_generated(
            quiz_id=new_quiz.id,
            document_id=document_id,
            user_id=user_id,
            quiz_title=new_quiz.title or "Quiz",
        )
        logger.info(f"Published quiz.generated event for quiz {new_quiz.id}")

        return new_quiz.id
    except Exception as e:
        logger.error(f"Error generating quiz: {e}\n{format_exc()}")
        db.rollback()
        raise
    finally:
        db.close()


def consume_loop():
    """Main consumer loop for Kafka events."""
    if not wait_for_kafka():
        logger.error("Failed to connect to Kafka. Exiting.")
        sys.exit(1)
    
    if not check_dependencies():
        logger.warning("Some dependencies have issues, but continuing...")
    
    max_retries = 5
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            logger.info("Creating Kafka consumer...")
            consumer = kafka_service.create_consumer(
                topics=["document.processed", "quiz.requested"],
                group_id="quiz-service-group",
            )
            logger.info("Quiz Worker listening for events on topics: document.processed, quiz.requested")
            logger.info(f"Consumer group: quiz-service-group")
            
            # Start consuming messages with timeout handling
            while True:
                try:
                    # Poll for messages (timeout is handled by consumer_timeout_ms)
                    message_pack = consumer.poll(timeout_ms=1000, max_records=1)
                    
                    if not message_pack:
                        # No messages received, continue polling
                        continue
                    
                    # Process messages from all partitions
                    for topic_partition, messages in message_pack.items():
                        for message in messages:
                            try:
                                logger.info(f"Received message from topic: {message.topic}, partition: {message.partition}, offset: {message.offset}")
                                data = message.value
                                
                                if not isinstance(data, dict):
                                    logger.error(f"Invalid message format: {type(data)}")
                                    continue
                                
                                event_type = data.get("event_type", "")
                                logger.info(f"Processing event: {event_type}")
                                logger.debug(f"Event data: {json.dumps(data, indent=2)}")
                                
                                # Normalize event type (handle .v1 suffix)
                                normalized_type = event_type.split(".v")[0] if ".v" in event_type else event_type
                                
                                if normalized_type == "document.processed":
                                    logger.info("Processing document.processed event")
                                    s3_url = data.get("text_s3_url") or data.get("s3_uri") or data.get("s3_url")
                                    if not s3_url:
                                        logger.error(f"No S3 URL found in event data: {data.keys()}")
                                        continue
                                    
                                    process_quiz_generation(
                                        document_id=data["document_id"],
                                        user_id=data["user_id"],
                                        s3_text_url=s3_url,
                                        difficulty=data.get("difficulty", "Medium"),
                                    )
                                    consumer.commit()
                                    logger.info("Successfully processed document.processed event")
                                    
                                elif normalized_type == "quiz.requested":
                                    logger.info("Processing quiz.requested event")
                                    document_id = data.get("document_id")
                                    user_id = data.get("user_id")
                                    
                                    if not document_id or not user_id:
                                        logger.error(f"Missing required fields in quiz.requested event: document_id={document_id}, user_id={user_id}")
                                        continue
                                    
                                    # quiz.requested might not have text_s3_url, so we construct it
                                    # The extracted text is stored at: {user_id}/{document_id}/extracted.txt
                                    s3_url = data.get("text_s3_url") or data.get("s3_uri") or data.get("s3_url")
                                    
                                    if not s3_url:
                                        # Construct S3 URL from document_id and user_id
                                        # This matches the pattern used by document-worker: {user_id}/{document_id}/extracted.txt
                                        bucket_name = os.getenv("S3_BUCKET_NAME", "document-reader-storage-dev")
                                        s3_url = f"s3://{bucket_name}/{user_id}/{document_id}/extracted.txt"
                                        logger.info(f"Constructed S3 URL from document_id: {s3_url}")
                                    
                                    process_quiz_generation(
                                        document_id=document_id,
                                        user_id=user_id,
                                        s3_text_url=s3_url,
                                        difficulty=data.get("difficulty", "Medium"),
                                    )
                                    consumer.commit()
                                    logger.info("Successfully processed quiz.requested event")
                                else:
                                    logger.warning(f"Unknown event type: {event_type}, skipping")
                                    
                            except Exception as e:
                                logger.error(f"Error processing message: {e}\n{format_exc()}")
                                # Don't commit on error, so message can be retried
                                continue
                                
                except StopIteration:
                    # Consumer timeout - no messages, continue polling
                    continue
                except Exception as e:
                    logger.error(f"Error in consumer loop: {e}\n{format_exc()}")
                    time.sleep(1)  # Brief pause before retrying
                    continue
                    
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
            break
        except Exception as e:
            logger.error(f"Consumer error (attempt {attempt + 1}/{max_retries}): {e}\n{format_exc()}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error("Max retries reached, exiting")
                sys.exit(1)


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Quiz Worker Starting")
    logger.info("=" * 60)
    consume_loop()

