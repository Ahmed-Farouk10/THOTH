import json
import logging
import os
from services.kafka_service import kafka_service
from services.s3_service import s3_service
from services.ai_service import ai_service
from database import SessionLocal, init_vector_db, Base, engine
from models import DocumentEmbedding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Intelligent text splitter
from langchain_text_splitters import RecursiveCharacterTextSplitter
# 1000 chars is a good balance for retrieval chunks
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)


def ingest_document(document_id: str, extracted_text: str):
    """
    Ingest document text for RAG (Retrieval-Augmented Generation).
    
    CRITICAL: Receives extracted_text from Kafka event (NOT from S3).
    This enforces storage isolation - chat service doesn't access document reader's S3 bucket.
    """
    db = SessionLocal()
    try:
        text_length = len(extracted_text)
        logger.info(f"🧠 Vectorizing document {document_id} ({text_length} chars)...")

        # Split Text into Chunks
        chunks = text_splitter.split_text(extracted_text)
        logger.info(f"Split into {len(chunks)} chunks. Generating embeddings...")
        
        # Generate Embeddings & Save
        count = 0
        for chunk in chunks:
            try:
                vector = ai_service.get_embedding(chunk)
                
                doc_vector = DocumentEmbedding(
                    document_id=document_id,
                    content=chunk,
                    embedding=vector
                )
                db.add(doc_vector)
                count += 1
                
                # Batch commit every 50 chunks
                if count % 50 == 0:
                    db.commit()
            except Exception as e:
                logger.error(f"Error embedding chunk: {count}: {e}")
        
        db.commit()
        logger.info(f"✅ Document {document_id} fully ingested ({count} vectors)")
        
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        db.rollback()
    finally:
        db.close()


def consume_loop():
    # Ensure tables and vector extension exist
    init_vector_db()
    Base.metadata.create_all(bind=engine)
    
    consumer = kafka_service.create_consumer(
        topics=['document.processed'],
        group_id='chat-ingestion-group'
    )
    
    logger.info("🎧 Chat Worker listening for document.processed...")
    
    for message in consumer:
        try:
            data = message.value
            event_type = data.get("event_type", "")
            
            if "document.processed" in event_type:
                # CRITICAL: Get extracted text from Kafka event (NOT from S3)
                # This enforces storage isolation - we don't access document reader's S3 bucket
                extracted_text = data.get("extracted_text")
                
                if not extracted_text:
                    logger.warning(
                        f"Missing 'extracted_text' in document.processed event. "
                        f"Available keys: {list(data.keys())}"
                    )
                    continue
                
                logger.info(f"Received {len(extracted_text)} chars via Kafka for vectorization")
                ingest_document(data['document_id'], extracted_text)  # ← From Kafka, not S3
                consumer.commit()
                    
        except Exception as e:
            logger.error(f"Error processing message: {e}")


if __name__ == "__main__":
    consume_loop()

