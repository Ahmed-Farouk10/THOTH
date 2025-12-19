from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uuid
import logging
from datetime import datetime

from database import get_db, engine, Base
from models import Document
from services.s3_service import s3_service
from services.kafka_service import kafka_service
from schemas import DocumentResponse, UploadResponse
from platform_shared.security import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables (if they don't exist)
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
except Exception as e:
    logger.error(f"Error creating database tables: {e}")
    # Don't fail startup - tables might already exist

app = FastAPI(
    title="Document Service",
    description="Document processing service - uploads documents, extracts text, generates notes",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend
        "http://localhost:80",    # API Gateway
        "*"  # Allow all origins in development
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)


from fastapi import Request

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.post("/api/documents/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a document for processing.
    
    This endpoint only uploads to S3 and produces a Kafka event.
    Actual processing happens in the background worker.
    
    Requires JWT authentication - user_id is extracted from token.
    """
    try:
        # Extract user_id from JWT token
        user_id = user["user_id"]
        
        # 1. Validate file type
        allowed_types = ["application/pdf", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "text/plain"]
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: PDF, DOCX, TXT"
            )
        
        # 2. Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # 3. Generate S3 key
        document_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        s3_key = f"{user_id}/{document_id}/{timestamp}_{file.filename}"
        
        # 4. Upload to S3
        s3_url = s3_service.upload_file(
            file_content,
            s3_key,
            content_type=file.content_type
        )
        
        # 5. Save metadata to database (Status: UPLOADED)
        document = Document(
            id=document_id,
            user_id=user_id,
            filename=file.filename,
            original_filename=file.filename,
            s3_raw_url=s3_url,
            status="UPLOADED",
            file_size=file_size,
            file_type=file.content_type
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # FEATURE CHANGE: Multi-document upload
        # Documents are uploaded but NOT auto-processed
        # User must explicitly trigger processing via UI button
        # This allows:
        # - Uploading multiple documents at once
        # - Selecting which documents to process
        # - Using documents in chat immediately without processing
        
        # COMMENTED OUT: Auto-processing trigger
        # Uncomment to restore auto-processing behavior
        # # 6. Produce Kafka event for background processing
        # kafka_service.produce_document_uploaded(
        #     document_id=document_id,
        #     user_id=user_id,
        #     s3_url=s3_url,
        #     filename=file.filename,
        #     file_size=file_size,
        #     content_type=file.content_type,
        # )
        
        logger.info(f"Document uploaded: {document_id} for user {user_id} (status: UPLOADED, awaiting processing)")
        
        # Return user-friendly response (document_id kept internal)
        return UploadResponse(
            status="success",
            message="Document uploaded successfully. Click 'Process' to start analysis."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")

@app.get("/api/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get document status and metadata - only for document owner"""
    user_id = user["user_id"]
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify user owns this document
    if document.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return document

@app.get("/api/documents/{document_id}/notes")
def get_document_notes(
    document_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get generated notes for a document - only for document owner"""
    user_id = user["user_id"]
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify user owns this document
    if document.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not document.s3_notes_url:
        raise HTTPException(
            status_code=404,
            detail="Notes not yet generated. Document may still be processing."
        )
    
    # Generate presigned URL for accessing the notes
    s3_key = document.s3_notes_url.replace(f"s3://{s3_service.bucket_name}/", "")
    presigned_url = s3_service.generate_presigned_url(s3_key)
    
    return {
        "document_id": document_id,
        "notes_url": document.s3_notes_url,
        "presigned_url": presigned_url,
        "generated_at": document.processed_at
    }

@app.post("/api/documents/{document_id}/process")
def trigger_document_processing(
    document_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger processing for an uploaded document.
    
    This endpoint allows users to select which documents to process
    instead of auto-processing all uploads.
    """
    user_id = user["user_id"]
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify user owns this document
    if document.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if document is in correct state
    if document.status not in ["UPLOADED", "FAILED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Document cannot be processed. Current status: {document.status}"
        )
    
    try:
        # Produce Kafka event for background processing
        kafka_service.produce_document_uploaded(
            document_id=document_id,
            user_id=user_id,
            s3_url=document.s3_raw_url,
            filename=document.filename,
            file_size=document.file_size,
            content_type=document.file_type,
        )
        
        logger.info(f"Processing triggered for document {document_id}")
        
        return {
            "status": "processing_started",
            "document_id": document_id,
            "message": "Document processing has begun. You will be notified when complete."
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger processing: {e}")
        raise HTTPException(status_code=500, detail="Failed to start processing")

@app.post("/api/documents/{document_id}/regenerate-notes")
def regenerate_notes(
    document_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate notes for an already processed document - only for document owner"""
    user_id = user["user_id"]
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify user owns this document
    if document.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if document.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Document must be fully processed before regenerating notes"
        )
    
    if not document.s3_text_url:
        raise HTTPException(
            status_code=400,
            detail="Extracted text not available. Cannot regenerate notes."
        )
    
    try:
        # Reset notes for regeneration
        document.s3_notes_url = None
        db.commit()
        
        # Produce event to trigger regeneration in worker
        kafka_service.produce_regenerate_notes(
            document_id=document_id,
            user_id=document.user_id,
            s3_text_url=document.s3_text_url,
            filename=document.filename
        )
        
        logger.info(f"Triggered notes regeneration for document {document_id}")
        
        return {
            "status": "regeneration_started",
            "document_id": document_id,
            "message": "Notes regeneration in progress"
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger regeneration: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to trigger regeneration")

@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document and its associated files from S3 - only for document owner"""
    user_id = user["user_id"]
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify user owns this document
    if document.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Delete files from S3 (raw, text, and notes)
        if document.s3_raw_url:
            s3_key = document.s3_raw_url.replace(f"s3://{s3_service.bucket_name}/", "")
            s3_service.delete_file(s3_key)
        
        if document.s3_text_url:
            s3_key = document.s3_text_url.replace(f"s3://{s3_service.bucket_name}/", "")
            s3_service.delete_file(s3_key)
        
        if document.s3_notes_url:
            s3_key = document.s3_notes_url.replace(f"s3://{s3_service.bucket_name}/", "")
            s3_service.delete_file(s3_key)
        
        # Delete from database
        db.delete(document)
        db.commit()
        
        logger.info(f"Deleted document {document_id} and its files from S3")
        
        return {
            "status": "deleted",
            "document_id": document_id,
            "message": "Document and associated files deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete document")

@app.get("/api/documents")
def list_documents(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all documents for the authenticated user"""
    user_id = user["user_id"]
    documents = db.query(Document).filter(Document.user_id == user_id).all()
    # Convert SQLAlchemy models to Pydantic models for proper serialization
    document_list = [DocumentResponse.model_validate(doc) for doc in documents]
    return {"documents": document_list, "count": len(document_list)}

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "document-reader-api"}

@app.get("/")
def root():
    return {"message": "Document Reader API Service", "version": "1.0.0"}