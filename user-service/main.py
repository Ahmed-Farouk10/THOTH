"""
User Service - FastAPI Application

This is the entry point for the User Service.
It sets up FastAPI routes, database connection, and dependency injection.

Architecture:
- FastAPI Routes (this file) → Service Layer → Repository → Database
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from platform_shared.config import ServiceSettings, DatabaseSettings
from platform_shared.logging import setup_logging

from models import Base
from repository import UserRepository
from service import UserService

# Initialize configuration and logging
import os
settings = ServiceSettings(service_name="user-service")
logger = setup_logging("user-service", settings.log_level)

# Database setup - use DATABASE_URL from environment (set in docker-compose.yml)
database_url = os.getenv("DATABASE_URL")
if not database_url:
    # Fallback: construct from individual env vars if DATABASE_URL not set
    try:
        db_settings = DatabaseSettings()
        database_url = db_settings.url
    except Exception as e:
        logger.error(f"Failed to initialize database settings: {e}")
        raise

engine = create_engine(database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables (in production, use Alembic migrations)
Base.metadata.create_all(bind=engine)

# FastAPI app
app = FastAPI(
    title="User Service",
    version="1.0.0",
    description="User authentication and management service",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware (allow frontend to call API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency: Get database session
def get_db() -> Session:
    """
    Dependency that provides a database session.
    
    FastAPI will call this for each request and close the session after.
    This ensures proper connection management.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Dependency: Get user service
def get_user_service(db: Session = Depends(get_db)) -> UserService:
    """
    Dependency that provides UserService instance.
    
    This is dependency injection - FastAPI creates the service for us.
    Makes testing easier (can override this dependency).
    """
    repository = UserRepository(db)
    return UserService(repository)


# Request/Response Models
class UserCreate(BaseModel):
    """Request model for user registration."""
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    """Request model for user login."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Response model for login."""
    access_token: str
    token_type: str
    user: dict


# Routes
@app.get("/health")
async def health():
    """
    Health check endpoint.
    
    Used by:
    - Kubernetes liveness/readiness probes
    - Load balancer health checks
    - Monitoring systems
    """
    logger.debug("Health check requested")
    return {
        "status": "healthy",
        "service": "user-service",
        "timestamp": "2025-12-01T00:00:00Z"
    }


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    """
    Register a new user.
    
    Steps:
    1. Validate input (automatic via Pydantic)
    2. Hash password (with bcrypt 72-byte limit handling)
    3. Create user in database
    4. Return user info (without password)
    
    In production, also:
    - Send verification email
    - Publish user.created event to Kafka
    - Rate limit to prevent abuse
    """
    logger.info("User registration requested", extra={
        "username": user_data.username,
        "email": user_data.email
    })
    
    # Truncate password to 72 bytes before hashing (bcrypt limitation)
    password = user_data.password
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        logger.warning("Password exceeds 72 bytes, truncating", extra={
            "original_length": len(password_bytes)
        })
        password = password_bytes[:72].decode('utf-8', errors='ignore')
    
    try:
        user = user_service.register_user(
            username=user_data.username,
            email=user_data.email,
            password=password,  # Use truncated password
            full_name=user_data.full_name
        )
        
        logger.info("User registered successfully", extra={
            "user_id": user.user_id,
            "username": user.username
        })
        
        # TODO: Publish user.created event to Kafka
        # TODO: Send verification email
        
        return {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "message": "User created successfully"
        }
    
    except ValueError as e:
        logger.warning("User registration failed", extra={
            "error": str(e),
            "username": user_data.username
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    user_service: UserService = Depends(get_user_service)
):
    """
    Login user and return JWT token.
    
    Steps:
    1. Authenticate user (verify username/password)
    2. Generate JWT token
    3. Return token and user info
    
    Security notes:
    - Never return password
    - Token expires after 30 minutes
    - Use HTTPS in production
    """
    logger.info("Login attempt", extra={"username": login_data.username})
    
    result = user_service.login_user(
        username=login_data.username,
        password=login_data.password
    )
    
    if not result:
        logger.warning("Login failed", extra={"username": login_data.username})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info("Login successful", extra={
        "user_id": result["user"]["user_id"],
        "username": login_data.username
    })
    
    return TokenResponse(**result)


@app.get("/api/auth/verify")
async def verify_token(
    token: str,
    user_service: UserService = Depends(get_user_service)
):
    """
    Verify a JWT token.
    
    Used by Aggregator to verify tokens from clients.
    
    Args:
        token: JWT token string (from Authorization header)
        
    Returns:
        User info if token is valid
    """
    logger.debug("Token verification requested")
    
    user_info = user_service.verify_token(token)
    
    if not user_info:
        logger.warning("Token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug("Token verified successfully", extra={
        "user_id": user_info["user_id"]
    })
    
    return user_info


@app.get("/api/users/{user_id}")
async def get_user(
    user_id: str,
    user_service: UserService = Depends(get_user_service)
):
    """
    Get user profile by ID.
    
    In production, add:
    - Authorization (users can only see their own profile)
    - Rate limiting
    """
    repository = user_service.repository
    user = repository.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user.to_dict()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_config=None  # Use our structured logging
    )

