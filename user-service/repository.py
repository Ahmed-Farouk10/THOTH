"""
Repository Layer for User Service

This module implements the Repository Pattern, which:
- Encapsulates database access
- Provides a clean interface for data operations
- Makes testing easier (can mock repository)
- Separates business logic from data access

Why Repository Pattern?
- Single Responsibility: Repository only handles data access
- Testability: Mock repository to test service layer
- Flexibility: Swap database without changing business logic
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from models import UserModel, UserSessionModel


class UserRepository:
    """
    Repository for user data operations.
    
    All database queries go through this class.
    Service layer calls repository methods, not direct SQL.
    """
    
    def __init__(self, db: Session):
        """
        Initialize repository with database session.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
    
    def create_user(self, username: str, email: str, hashed_password: str, 
                   full_name: Optional[str] = None) -> UserModel:
        """
        Create a new user.
        
        Args:
            username: Unique username
            email: Unique email
            hashed_password: Bcrypt-hashed password
            full_name: Optional full name
            
        Returns:
            Created UserModel instance
            
        Raises:
            IntegrityError: If username or email already exists
        """
        user = UserModel(
            username=username,
            email=email,
            hashed_password=hashed_password,
            full_name=full_name
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def get_user_by_id(self, user_id: str) -> Optional[UserModel]:
        """Get user by user_id."""
        return self.db.query(UserModel).filter(UserModel.user_id == user_id).first()
    
    def get_user_by_username(self, username: str) -> Optional[UserModel]:
        """Get user by username (for login)."""
        return self.db.query(UserModel).filter(UserModel.username == username).first()
    
    def get_user_by_email(self, email: str) -> Optional[UserModel]:
        """Get user by email."""
        return self.db.query(UserModel).filter(UserModel.email == email).first()
    
    def update_user(self, user_id: str, **kwargs) -> Optional[UserModel]:
        """
        Update user fields.
        
        Args:
            user_id: User ID to update
            **kwargs: Fields to update (username, email, full_name, etc.)
            
        Returns:
            Updated UserModel or None if not found
        """
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def create_session(self, user_id: str, jwt_token: str, expires_at) -> UserSessionModel:
        """Create a user session (for token tracking)."""
        session = UserSessionModel(
            user_id=user_id,
            jwt_token=jwt_token,
            expires_at=expires_at
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session (for logout)."""
        session = self.db.query(UserSessionModel).filter(
            UserSessionModel.session_id == session_id
        ).first()
        if session:
            self.db.delete(session)
            self.db.commit()
            return True
        return False

