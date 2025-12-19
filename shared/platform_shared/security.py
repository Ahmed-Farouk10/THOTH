"""
Shared Security Module for JWT Authentication

This module provides JWT token verification that can be used across all services.
All services use the same SECRET_KEY to verify tokens issued by the User Service.

Why shared?
- Consistent authentication across all services
- Single source of truth for JWT verification
- Reusable dependency for FastAPI routes
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import os
from typing import Dict, Optional

# JWT Configuration
# MUST match the User Service secret key!
# In production, use AWS Secrets Manager or environment variables
SECRET_KEY = os.environ.get("JWT_SECRET", os.environ.get("SECRET_KEY", "your-secret-key-change-in-production-use-env-var"))
ALGORITHM = "HS256"

# HTTP Bearer token scheme
# This automatically extracts the token from "Authorization: Bearer <token>" header
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, str]:
    """
    FastAPI dependency to verify JWT token and extract user info.
    
    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            user_id = user['user_id']
            # ... use user info ...
    
    This function:
    1. Extracts token from Authorization header
    2. Verifies token signature and expiration
    3. Returns user info (user_id, username)
    
    If token is invalid, raises HTTP 401 Unauthorized.
    
    Args:
        credentials: HTTPAuthorizationCredentials from HTTPBearer dependency
        
    Returns:
        Dictionary with user_id and username
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    
    try:
        # Decode and verify the token
        # This will raise JWTError if:
        # - Token signature is invalid
        # - Token is expired
        # - Token format is wrong
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Extract user information
        user_id: Optional[str] = payload.get("user_id")
        username: Optional[str] = payload.get("sub")  # "sub" = subject (standard JWT claim)
        
        if user_id is None or username is None:
            raise credentials_exception
        
        return {
            "user_id": user_id,
            "username": username,
            "email": payload.get("email"),
            "roles": payload.get("roles", ["student"])
        }
        
    except JWTError:
        raise credentials_exception


def verify_token(token: str) -> Optional[Dict[str, str]]:
    """
    Verify a JWT token without FastAPI dependency.
    
    Useful for:
    - Background tasks
    - WebSocket connections
    - Custom authentication flows
    
    Args:
        token: JWT token string
        
    Returns:
        User info dictionary if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        username = payload.get("sub")
        
        if user_id is None or username is None:
            return None
        
        return {
            "user_id": user_id,
            "username": username,
            "email": payload.get("email"),
            "roles": payload.get("roles", ["student"])
        }
    except JWTError:
        return None

