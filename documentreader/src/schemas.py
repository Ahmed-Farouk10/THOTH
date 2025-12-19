from pydantic import BaseModel

class DocumentCreate(BaseModel):
    s3_url: str

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    user_id: str

class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    original_filename: str
    status: str
    s3_raw_url: str
    s3_text_url: Optional[str] = None
    s3_notes_url: Optional[str] = None
    file_size: int
    file_type: Optional[str] = None
    text_length: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    status: str
    message: str
    document_id: Optional[str] = None  # Backend only - not returned to frontend
    s3_url: Optional[str] = None  # Backend only - not returned to frontend