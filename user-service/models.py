"""
Database Models for User Service

This module defines SQLAlchemy models for the database.
SQLAlchemy is an ORM (Object-Relational Mapping) that lets us work with
Python objects instead of writing raw SQL.

Why SQLAlchemy?
- Type safety
- Database-agnostic (PostgreSQL, MySQL, etc.)
- Migration support (Alembic)
- Relationship management
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import uuid

Base = declarative_base()


def generate_uuid():
    """Generate UUID string for primary keys."""
    return str(uuid.uuid4())


class UserModel(Base):
    """
    User table model.
    
    Stores user account information including:
    - Authentication credentials (hashed password)
    - Profile information
    - Account status (active, superuser)
    
    Why separate user_id and username?
    - user_id: Internal identifier (UUID, never changes)
    - username: User-facing identifier (can change)
    """
    __tablename__ = "users"
    
    # Primary key: UUID string (not auto-increment integer)
    # Why UUID? Globally unique, no collisions, can generate offline
    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    
    # Username: unique, indexed for fast lookups
    username = Column(String(50), unique=True, index=True, nullable=False)
    
    # Email: unique, indexed for fast lookups
    email = Column(String(255), unique=True, index=True, nullable=False)
    
    # Password: hashed using bcrypt (never store plain text!)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile fields
    full_name = Column(String(100), nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    # Timestamps (automatically set by database)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    def to_dict(self) -> dict:
        """Convert model to dictionary (exclude sensitive data)."""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserSessionModel(Base):
    """
    User session table (optional, for session management).
    
    Stores active JWT tokens for:
    - Token revocation
    - Session tracking
    - Security auditing
    
    Note: JWT tokens are stateless, but storing them allows:
    - Revoking tokens (logout)
    - Tracking active sessions
    - Security monitoring
    """
    __tablename__ = "user_sessions"
    
    session_id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    
    # Store JWT token (for revocation)
    jwt_token = Column(Text, nullable=False)
    
    # Token expiration
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Index for fast lookups by user_id
    __table_args__ = (
        Index('ix_user_sessions_user_id', 'user_id'),
    )

