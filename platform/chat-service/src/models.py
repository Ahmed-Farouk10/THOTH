from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"))
    role = Column(String(20))  # "user" or "ai"
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    conversation = relationship("Conversation", back_populates="messages")


class DocumentEmbedding(Base):
    """Stores vector embeddings for RAG."""
    __tablename__ = "document_embeddings"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), nullable=False, index=True)
    
    # The actual text chunk used for context
    content = Column(Text, nullable=False)
    
    # 768 dimensions for models/text-embedding-004
    embedding = Column(Vector(768))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

