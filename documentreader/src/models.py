from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.sql import func
import uuid
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    
    # S3 URLs - Only store references, NOT content
    s3_raw_url = Column(String, nullable=False)    # s3://bucket/user_id/doc_id/filename.pdf
    s3_text_url = Column(String)                   # s3://bucket/user_id/doc_id/extracted.txt
    s3_notes_url = Column(String)                  # s3://bucket/user_id/doc_id/notes.json
    
    # Status
    status = Column(String, default="UPLOADED")    # UPLOADED → PROCESSING → COMPLETED → FAILED
    error_message = Column(String)
    
    # Metadata
    file_size = Column(Integer, nullable=False)
    file_type = Column(String)  # pdf, docx, txt
    text_length = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True))
