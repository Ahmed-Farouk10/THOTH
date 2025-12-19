"""
Authentication Module for Aggregator

This module handles JWT token verification for the Aggregator service.
The Aggregator can either:
1. Verify tokens locally using shared security module (faster)
2. Verify tokens via User Service HTTP call (more centralized)

For now, we use local verification for performance.
"""

from fastapi import Depends, HTTPException, status
from platform_shared.security import get_current_user, verify_token
from platform_shared.models import UserContext
from typing import Optional
import httpx
import os

# Option 1: Local verification (faster, recommended)
# Uses shared security module to verify token locally
def get_user_context_local(
    user: dict = Depends(get_current_user)
) -> UserContext:
    """
    FastAPI dependency that returns UserContext from locally verified JWT.
    
    This is faster than HTTP calls to User Service.
    Use this when you trust the JWT signature.
    
    Usage:
        @app.post("/api/documents/upload")
        async def upload(user: UserContext = Depends(get_user_context_local)):
            user_id = user.user_id
    """
    return UserContext(
        user_id=user["user_id"],
        username=user["username"],
        email=user.get("email", ""),
        roles=user.get("roles", ["student"])
    )


# Option 2: Remote verification (more centralized, slower)
# Calls User Service to verify token
async def get_user_context_remote(
    token: str = Depends(get_current_user)
) -> UserContext:
    """
    FastAPI dependency that verifies token via User Service HTTP call.
    
    This is slower but more centralized (User Service is source of truth).
    Use this if you want to check if user is still active in database.
    
    Usage:
        @app.post("/api/documents/upload")
        async def upload(user: UserContext = Depends(get_user_context_remote)):
            user_id = user.user_id
    """
    user_service_url = os.getenv("USER_SERVICE_URL", "http://user-service:8000")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{user_service_url}/api/auth/verify",
                params={"token": token},
                timeout=5.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token"
                )
            
            user_data = response.json()
            return UserContext(
                user_id=user_data["user_id"],
                username=user_data["username"],
                email=user_data.get("email", ""),
                roles=user_data.get("roles", ["student"])
            )
            
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="User service unavailable"
            )

