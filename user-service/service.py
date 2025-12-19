"""
Service Layer for User Service

This module contains business logic for user operations.
It sits between the controller (FastAPI routes) and repository (database).

Why Service Layer?
- Contains business logic (not in controller or repository)
- Orchestrates multiple operations
- Can call other services or publish events
- Easy to test (mock repository)
"""

from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.exc import IntegrityError

from repository import UserRepository
from models import UserModel

# Password hashing context
# bcrypt is slow by design (prevents brute force attacks)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
# Load from environment variable (must match across all services!)
import os
SECRET_KEY = os.environ.get("JWT_SECRET", os.environ.get("SECRET_KEY", "your-secret-key-change-in-production-use-env-var"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


class UserService:
    """
    Business logic for user operations.
    
    This class:
    - Validates input
    - Hashes passwords
    - Generates JWT tokens
    - Orchestrates repository calls
    - Publishes events (if needed)
    """
    
    def __init__(self, repository: UserRepository):
        """
        Initialize service with repository.
        
        Args:
            repository: UserRepository instance
        """
        self.repository = repository
    
    def hash_password(self, password: str) -> str:
        """
        Hash a password using bcrypt.
        
        Why hash passwords?
        - Never store plain text passwords
        - Even if database is compromised, passwords are safe
        - bcrypt is one-way (can't reverse)
        
        Note: bcrypt has a 72-byte limit. Longer passwords are truncated.
        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password string
        """
        # bcrypt has a 72-byte limit, truncate if necessary
        # Convert to bytes to check actual byte length (not character length)
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            # Truncate to 72 bytes (not characters!)
            # Use decode with errors='ignore' to handle incomplete UTF-8 sequences
            password = password_bytes[:72].decode('utf-8', errors='ignore')
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against a hash.
        
        Args:
            plain_password: Plain text password from user
            hashed_password: Stored hash from database
            
        Returns:
            True if password matches, False otherwise
        """
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Generate a JWT access token.
        
        JWT (JSON Web Token) contains:
        - Payload: user info (user_id, username, etc.)
        - Signature: ensures token hasn't been tampered with
        - Expiration: token expires after set time
        
        Why JWT?
        - Stateless (no server-side session storage)
        - Scalable (any service can verify)
        - Contains user info (no database lookup needed)
        
        Args:
            data: Dictionary to encode in token (usually user info)
            expires_delta: Optional expiration time (default: 30 minutes)
            
        Returns:
            Encoded JWT token string
        """
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[dict]:
        """
        Decode and verify a JWT token.
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded payload dictionary or None if invalid
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            return None
    
    def register_user(self, username: str, email: str, password: str, 
                     full_name: Optional[str] = None) -> UserModel:
        """
        Register a new user.
        
        Steps:
        1. Hash password
        2. Create user in database
        3. Return user (without password)
        
        Args:
            username: Unique username
            email: Unique email
            password: Plain text password (will be hashed)
            full_name: Optional full name
            
        Returns:
            Created UserModel instance
            
        Raises:
            ValueError: If username or email already exists
        """
        # Hash password before storing
        hashed_password = self.hash_password(password)
        
        try:
            user = self.repository.create_user(
                username=username,
                email=email,
                hashed_password=hashed_password,
                full_name=full_name
            )
            return user
        except IntegrityError as e:
            # Username or email already exists
            raise ValueError("Username or email already exists") from e
    
    def authenticate_user(self, username: str, password: str) -> Optional[UserModel]:
        """
        Authenticate a user (for login).
        
        Steps:
        1. Find user by username
        2. Verify password
        3. Return user if valid
        
        Args:
            username: Username
            password: Plain text password
            
        Returns:
            UserModel if authentication successful, None otherwise
        """
        user = self.repository.get_user_by_username(username)
        if not user:
            return None
        
        if not self.verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            return None  # Account disabled
        
        return user
    
    def login_user(self, username: str, password: str) -> Optional[dict]:
        """
        Login a user and return JWT token.
        
        Args:
            username: Username
            password: Plain text password
            
        Returns:
            Dictionary with access_token and user info, or None if invalid
        """
        user = self.authenticate_user(username, password)
        if not user:
            return None
        
        # Create JWT token with standard claims
        token_data = {
            "sub": user.username,  # "sub" = subject (standard JWT claim)
            "user_id": user.user_id,
            "email": user.email,
            "roles": ["student"]  # In production, load from database
        }
        access_token = self.create_access_token(data=token_data)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user.to_dict()
        }
    
    def verify_token(self, token: str) -> Optional[dict]:
        """
        Verify a JWT token and return user info.
        
        Used by Aggregator to verify tokens from clients.
        
        Args:
            token: JWT token string
            
        Returns:
            User info dictionary or None if invalid
        """
        payload = self.decode_token(token)
        if not payload:
            return None
        
        username = payload.get("sub")
        user_id = payload.get("user_id")
        
        if not username or not user_id:
            return None
        
        # Verify user still exists and is active
        user = self.repository.get_user_by_id(user_id)
        if not user or not user.is_active:
            return None
        
        return {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "roles": payload.get("roles", ["student"])
        }

