import json
import logging
import time
import os
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

import spacy
import httpx

import sys
import os

# Add src directory to path for imports when running as script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.kafka_service import kafka_service
from services.s3_service import s3_service
from document_processor import document_processor
from database import SessionLocal
from models import Document

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Google Generative AI (Gemini) config - all values come from environment
GOOGLE_API_BASE = os.getenv(
    "GOOGLE_API_BASE",
    "https://generativelanguage.googleapis.com/v1beta",
)
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "models/gemini-1.5-flash")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")  # MUST be set in environment, never in code


def load_spacy_model():
    """
    Lazy-load spaCy language model.

    We use a small English model for:
    - Sentence segmentation
    - Entity detection (to highlight key concepts)
    """
    model_name = os.getenv("SPACY_MODEL", "en_core_web_sm")
    try:
        return spacy.load(model_name)
    except Exception as e:
        logger.warning(f"Failed to load spaCy model '{model_name}': {e}. Falling back to basic tokenizer.")
        return None


_SPACY_NLP = None

def update_document_status(db: Session, document_id: str, status: str, error_message: str = None):
    """Update document status in database"""
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = status
            if error_message:
                document.error_message = error_message
            if status == "COMPLETED":
                document.processed_at = datetime.utcnow()
            db.commit()
            logger.info(f"Updated document {document_id} status to {status}")
    except Exception as e:
        logger.error(f"Error updating document status: {e}")
        db.rollback()

def process_document(document_id: str, user_id: str, s3_url: str, filename: str, file_size: int):
    """Process a document: extract text and generate notes"""
    db = SessionLocal()
    
    try:
        logger.info(f"Starting processing for document {document_id}")
        
        # 1. Update status to PROCESSING
        update_document_status(db, document_id, "PROCESSING")
        
        # 2. Download file from S3 to temp location
        temp_file_path = s3_service.download_to_temp_file(s3_url)
        logger.info(f"Downloaded file to {temp_file_path}")
        
        # 3. Determine file type
        file_type = None
        if filename.lower().endswith('.pdf'):
            file_type = 'application/pdf'
        elif filename.lower().endswith('.docx'):
            file_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif filename.lower().endswith('.txt'):
            file_type = 'text/plain'
        else:
            raise ValueError(f"Unsupported file extension: {filename}")
        
        # 4. Extract text
        extracted_text, metadata = document_processor.process_file(temp_file_path, file_type)
        text_length = len(extracted_text)
        logger.info(f"Extracted {text_length} characters from {filename}")
        
        # 5. Upload extracted text to S3
        text_s3_key = f"{user_id}/{document_id}/extracted.txt"
        text_s3_url = s3_service.upload_file(
            extracted_text.encode('utf-8'),
            text_s3_key,
            content_type='text/plain'
        )
        
        # 6. Generate AI-based notes
        notes_content = generate_ai_notes(extracted_text, filename)
        notes_s3_key = f"{user_id}/{document_id}/notes.json"
        notes_s3_url = s3_service.upload_file(
            json.dumps(notes_content, indent=2).encode('utf-8'),
            notes_s3_key,
            content_type='application/json'
        )
        
        # 7. Update database with results
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.s3_text_url = text_s3_url
            document.s3_notes_url = notes_s3_url
            document.status = "COMPLETED"
            document.text_length = text_length
            document.processed_at = datetime.utcnow()
            db.commit()
        
        # 8. Clean up temp file
        import os
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        
        logger.info(f"Successfully processed document {document_id}")
        
        # 9. Produce Kafka events aligned with ARCHITECTURE.md
        producer = kafka_service.create_producer()

        if producer is None:
            logger.warning("Kafka producer not available, events will not be sent")
        else:
            try:
                base_trace_id = f"trace-{uuid.uuid4()}"
                base_correlation_id = f"corr-{document_id}"

                # document.processed.v1 event
                processed_event = {
                    "event_type": "document.processed.v1",
                    "event_id": f"evt-{uuid.uuid4()}",
                    "document_id": document_id,
                    "user_id": user_id,
                    "s3_uri": text_s3_url,
                    "text_s3_url": text_s3_url,
                    "text_length": text_length,
                    "processed_at": datetime.utcnow().isoformat(),
                    "timestamp": datetime.utcnow().isoformat(),
                    "trace_id": base_trace_id,
                    "correlation_id": base_correlation_id,
                    "schema_version": "1.0.0",
                    "service": "document-reader-worker",
                }
                producer.send("document.processed", value=processed_event, key=document_id)

                # notes.generated.v1 event
                notes_event = {
                    "event_type": "notes.generated.v1",
                    "event_id": f"evt-{uuid.uuid4()}",
                    "document_id": document_id,
                    "user_id": user_id,
                    "notes_s3_url": notes_s3_url,
                    "timestamp": datetime.utcnow().isoformat(),
                    "trace_id": base_trace_id,
                    "correlation_id": base_correlation_id,
                    "schema_version": "1.0.0",
                    "service": "document-reader-worker",
                }
                producer.send("notes.generated", value=notes_event, key=document_id)

                # Flush with timeout to ensure messages are sent
                producer.flush(timeout=5)
                logger.info(f"Produced events for document {document_id}")
            except Exception as e:
                logger.error(f"Failed to produce Kafka events: {e}")
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")
        update_document_status(db, document_id, "FAILED", str(e))
        
        # Re-raise to trigger retry
        raise
        
    finally:
        db.close()

def generate_simple_notes(text: str, filename: str) -> dict:
    """Generate simple notes from text"""
    sentences = [s.strip() for s in text.split('.') if s.strip()]
    
    summary = '. '.join(sentences[:3]) + '.' if len(sentences) >= 3 else text[:500]
    
    key_points = []
    for i, sentence in enumerate(sentences[:5]):
        words = sentence.split()[:7]
        key_points.append(' '.join(words) + '...')
    
    word_count = len(text.split())
    reading_time = max(1, word_count // 200)  # 200 words per minute

    return {
        "summary": summary,
        "key_points": key_points,
        "word_count": word_count,
        "reading_time_minutes": reading_time,
        "generated_at": datetime.utcnow().isoformat(),
        "source_file": filename,
    }


def _analyze_with_spacy(text: str) -> dict:
    """
    Analyze text with spaCy to provide structure for better AI notes.

    Returns:
    - sentences: first N sentences
    - key_terms: unique named entities (ORG, PERSON, GPE, etc.)
    - topics: frequent nouns/noun chunks
    """
    global _SPACY_NLP

    if not text.strip():
        return {"sentences": [], "key_terms": [], "topics": []}

    if _SPACY_NLP is None:
        _SPACY_NLP = load_spacy_model()

    if _SPACY_NLP is None:
        # spaCy not available, return basic structure
        sentences = [s.strip() for s in text.split(".") if s.strip()]
        return {
            "sentences": sentences[:20],
            "key_terms": [],
            "topics": [],
        }

    doc = _SPACY_NLP(text)

    sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]

    key_terms = sorted({ent.text for ent in doc.ents if ent.label_ in {"ORG", "PERSON", "GPE", "PRODUCT", "EVENT"}})

    noun_chunks = [chunk.text.strip() for chunk in doc.noun_chunks if chunk.text.strip()]
    # Simple frequency-based topic selection
    from collections import Counter

    topics = [phrase for phrase, _ in Counter(noun_chunks).most_common(15)]

    return {
        "sentences": sentences[:40],
        "key_terms": key_terms[:40],
        "topics": topics,
    }

def call_google_model(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> str:
    """
    Call GROQ API (OpenAI-compatible) for text generation.
    
    Using GROQ instead of Google Gemini for:
    - Higher rate limits (1K RPM, 300K TPM vs 5 RPM)
    - Faster inference (~280 tokens/sec)
    - Better availability
    
    Returns the text content, or raises an Exception on failure.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    
    # Use llama-3.3-70b-versatile for high-quality generation
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
        "top_p": 0.95
    }
    
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    
    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("No choices returned from GROQ model")
    
    message = choices[0].get("message", {})
    content = message.get("content", "")
    return content.strip()


def generate_ai_notes(text: str, filename: str) -> dict:
    """
    Generate comprehensive, professional AI-based notes using Google Generative AI (Gemini) + spaCy.
    
    Produces:
    - Long, detailed summary (800-1500 words) covering all major topics
    - Professional key points (10-15 points) with actionable insights
    - Structured format suitable for enterprise learning platforms
    
    Falls back to simple notes if API call fails.
    """
    try:
        # CRITICAL FIX: Groq API has ~6K token limit (roughly 24K chars)
        # Truncate to safe limit to avoid 413 Payload Too Large
        MAX_CHARS_FOR_GROQ = 20000  # Safe limit for Groq API
        
        # Increase max chars for better context (up to 15,000 chars for comprehensive analysis)
        max_chars = int(os.getenv("NOTES_MAX_CHARS", "15000"))
        text_truncated = text[:max_chars] if len(text) > max_chars else text

        spacy_analysis = _analyze_with_spacy(text_truncated)

        # Additional safety: Ensure the FULL prompt doesn't exceed Groq limits
        # Calculate approximate prompt size
        base_prompt_size = 2000  # System prompt + structure
        analysis_overhead = len(str(spacy_analysis))
        available_for_text = MAX_CHARS_FOR_GROQ - base_prompt_size - analysis_overhead
        
        # Further truncate if needed
        if len(text_truncated) > available_for_text:
            text_truncated = text_truncated[:available_for_text]
            logger.warning(f"Text truncated to {available_for_text} chars to fit Groq API limits")

        # 1) Comprehensive Summary (Long, detailed, professional)
        system_summary = (
            "You are an expert AI assistant for an enterprise learning platform. "
            "Your task is to create comprehensive, professional summaries that help busy professionals "
            "quickly understand complex documents.\n\n"
            "Requirements:\n"
            "- Write in ENGLISH ONLY\n"
            "- Create a detailed summary of 800-1500 words\n"
            "- Cover ALL major topics, concepts, and themes from the document\n"
            "- Use clear structure with headings and subheadings where appropriate\n"
            "- Maintain professional, academic tone suitable for enterprise use\n"
            "- Include context, relationships between concepts, and implications\n"
            "- Avoid generic statements; be specific and substantive\n"
            "- Organize information logically (introduction, main content, conclusions)\n"
            "- Highlight important data, statistics, or key findings if present"
        )

        user_summary = (
            f"Document filename: {filename}\n\n"
            f"Document length: {len(text)} characters\n\n"
            f"Key terms identified (from NLP analysis): {', '.join(spacy_analysis.get('key_terms', [])[:20])}\n\n"
            f"Main topics identified: {', '.join(spacy_analysis.get('topics', [])[:15])}\n\n"
            "Full document text:\n"
            "=" * 80 + "\n"
            f"{text_truncated}\n"
            "=" * 80 + "\n\n"
            "Based on the complete document text above, create a comprehensive, professional summary. "
            "The summary should:\n"
            "1. Start with a brief overview (2-3 sentences) of what the document is about\n"
            "2. Cover all major sections, topics, and themes in detail\n"
            "3. Explain relationships between concepts\n"
            "4. Include important details, examples, or data points\n"
            "5. Conclude with key takeaways or implications\n"
            "6. Use clear headings (## Heading) to organize sections\n"
            "7. Aim for 800-1500 words total\n\n"
            "Write the comprehensive summary now:"
        )

        summary = call_google_model(system_summary, user_summary, max_tokens=2048)

        # 2) Professional Key Points (Comprehensive, actionable)
        system_points = (
            "You are an expert AI assistant for an enterprise learning platform. "
            "Your task is to extract comprehensive, professional key points from documents.\n\n"
            "Requirements:\n"
            "- Write in ENGLISH ONLY\n"
            "- Extract 12-18 key points (not just 5-7)\n"
            "- Each point should be substantive (2-3 sentences, not just one line)\n"
            "- Points should be actionable, specific, and professional\n"
            "- Cover all major topics, concepts, and important details\n"
            "- Use clear, professional language\n"
            "- Format as numbered list (1., 2., 3., etc.)\n"
            "- Each point should provide value and insight, not just restate obvious facts"
        )

        user_points = (
            f"Document filename: {filename}\n\n"
            "Comprehensive summary of the document:\n"
            f"{summary}\n\n"
            f"Key terms from document: {', '.join(spacy_analysis.get('key_terms', [])[:25])}\n\n"
            f"Main topics: {', '.join(spacy_analysis.get('topics', [])[:20])}\n\n"
            "Based on the comprehensive summary and document analysis above, extract 12-18 detailed key points. "
            "Each key point should:\n"
            "1. Be 2-3 sentences long (not just one line)\n"
            "2. Be specific and actionable\n"
            "3. Cover different aspects of the document\n"
            "4. Provide professional insights\n"
            "5. Be numbered (1., 2., 3., etc.)\n\n"
            "Write the comprehensive key points now:"
        )

        keypoints_text = call_google_model(system_points, user_points, max_tokens=1536)
        
        # Parse key points - handle both numbered and bullet formats
        key_points = []
        for line in keypoints_text.splitlines():
            line = line.strip()
            if not line:
                continue
            # Remove numbering/bullets and clean up
            line = line.lstrip('0123456789.-) ')
            if line and len(line) > 10:  # Only include substantial points
                key_points.append(line)
        
        # Ensure we have at least 10 points, up to 18
        if len(key_points) < 10:
            logger.warning(f"Only {len(key_points)} key points extracted, expected 10-18")
        key_points = key_points[:18]  # Cap at 18 points

        word_count = len(text.split())
        reading_time = max(1, word_count // 200)

        return {
            "summary": summary,
            "key_points": key_points,
            "word_count": word_count,
            "reading_time_minutes": reading_time,
            "generated_at": datetime.utcnow().isoformat(),
            "source_file": filename,
            "generation_method": "Google Gemini + spaCy (Enhanced)",
            "summary_length": len(summary),
            "key_points_count": len(key_points),
        }

    except Exception as e:
        logger.warning(f"Failed to generate AI notes with Google model: {e}. Using simple notes instead.")
        return generate_simple_notes(text, filename)

def regenerate_document_notes(document_id: str, user_id: str, s3_text_url: str, filename: str):
    """Regenerate notes for a document from existing extracted text"""
    db = SessionLocal()
    producer = None
    
    try:
        producer = kafka_service.create_producer()
        logger.info(f"Starting notes regeneration for document {document_id}")
        
        # Download extracted text from S3
        text_content = s3_service.download_file(s3_text_url)
        extracted_text = text_content.decode('utf-8')
        logger.info(f"Downloaded extracted text for document {document_id}")
        
        # Generate AI-based notes
        notes_content = generate_ai_notes(extracted_text, filename)
        notes_s3_key = f"{user_id}/{document_id}/notes.json"
        notes_s3_url = s3_service.upload_file(
            json.dumps(notes_content, indent=2).encode('utf-8'),
            notes_s3_key,
            content_type='application/json'
        )
        
        # Update database
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.s3_notes_url = notes_s3_url
            document.updated_at = datetime.utcnow()
            db.commit()
        
        # Produce notes.generated.v1 event
        if producer is None:
            logger.warning("Kafka producer not available, event will not be sent")
        else:
            try:
                base_trace_id = f"trace-{uuid.uuid4()}"
                base_correlation_id = f"corr-{document_id}"

                notes_event = {
                    "event_type": "notes.generated.v1",
                    "event_id": f"evt-{uuid.uuid4()}",
                    "document_id": document_id,
                    "user_id": user_id,
                    "notes_s3_url": notes_s3_url,
                    "timestamp": datetime.utcnow().isoformat(),
                    "trace_id": base_trace_id,
                    "correlation_id": base_correlation_id,
                    "schema_version": "1.0.0",
                    "service": "document-reader-worker",
                }
                producer.send("notes.generated", value=notes_event, key=document_id)
                producer.flush()
                logger.info(f"Produced notes.generated event for document {document_id}")
            except Exception as e:
                logger.error(f"Failed to produce notes.generated event: {e}")
        
        logger.info(f"Successfully regenerated notes for document {document_id}")
        
    except Exception as e:
        logger.error(f"Error regenerating notes for document {document_id}: {e}")
        raise
        
    finally:
        db.close()
        if producer:
            producer.close()

def main():
    """Main worker loop"""
    logger.info("Starting Document Reader Worker...")
    
    # Create Kafka consumer for both topics
    # Consumer group: document-service-group (matches architecture)
    consumer = kafka_service.create_consumer(
        ['document.uploaded', 'regenerate.notes'],
        'document-service-group'
    )
    
    logger.info("Worker started. Listening for document.uploaded and regenerate.notes events...")
    
    try:
        # Use poll() pattern instead of iterator to avoid timeout issues
        while True:
            try:
                # Poll for messages (timeout 1 second)
                message_pack = consumer.poll(timeout_ms=1000, max_records=1)
                
                if not message_pack:
                    # No messages, continue polling
                    continue
                
                # Process messages from all partitions
                for topic_partition, messages in message_pack.items():
                    for message in messages:
                        try:
                            data = message.value
                            event_type = data.get("event_type")
                            logger.info(f"Received event: {event_type} for document {data.get('document_id')}")

                            # Normalize event type to support both bare and versioned forms
                            # e.g. "document.uploaded" and "document.uploaded.v1"
                            normalized_type = event_type.split(".v")[0] if isinstance(event_type, str) else None

                            if normalized_type == "document.uploaded":
                                # Process the document
                                filename = data.get("filename") or data.get("file_name")
                                file_size = data.get("file_size")
                                process_document(
                                    document_id=data['document_id'],
                                    user_id=data['user_id'],
                                    s3_url=data['s3_url'],
                                    filename=filename,
                                    file_size=file_size
                                )
                            
                            elif normalized_type == "regenerate.notes":
                                # Regenerate notes from existing text
                                regenerate_document_notes(
                                    document_id=data['document_id'],
                                    user_id=data['user_id'],
                                    s3_text_url=data['s3_text_url'],
                                    filename=data['filename']
                                )
                            
                            # Commit offset
                            consumer.commit()
                            
                        except Exception as e:
                            logger.error(f"Failed to process message: {e}")
                            # Don't commit offset on failure (will retry)
                                        
            except StopIteration:
                # Consumer timeout - no messages, continue polling
                continue
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}")
                import time
                time.sleep(1)  # Brief pause before retrying
                continue
                
    except KeyboardInterrupt:
        logger.info("Worker shutting down...")
    except Exception as e:
        logger.error(f"Worker error: {e}")
    finally:
        consumer.close()
        logger.info("Worker stopped")

if __name__ == "__main__":
    main()