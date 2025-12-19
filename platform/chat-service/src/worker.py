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


def ingest_document(document_id: str, s3_url: str):
    db = SessionLocal()
    try:
        logger.info(f"🧠 Vectorizing document {document_id}...")
        
        # 1. Download Text
        try:
            content_bytes = s3_service.download_file(s3_url)
            full_text = content_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to download from S3: {e}")
            return

        # 2. Split Text into Chunks
        chunks = text_splitter.split_text(full_text)
        logger.info(f"Split into {len(chunks)} chunks. Generating embeddings...")
        
        # 3. Generate Embeddings & Save
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
                # Handle different URL keys from different producers
                s3_url = data.get("text_s3_url") or data.get("s3_uri") or data.get("s3_url")
                
                if s3_url:
                    ingest_document(data['document_id'], s3_url)
                    consumer.commit()
                else:
                    logger.warning(f"No S3 URL in event: {data}")
                    
        except Exception as e:
            logger.error(f"Error processing message: {e}")


if __name__ == "__main__":
    consume_loop()

