import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from platform_shared.config import DatabaseSettings
try:
    from .models import Base
except ImportError:
    from models import Base


def _get_database_url() -> str:
    """
    Resolve DATABASE_URL from env or shared DatabaseSettings.

    This mirrors the pattern used in user-service so the service
    works both locally (docker-compose) and later on AWS.
    """
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    settings = DatabaseSettings()
    return settings.url


DATABASE_URL = _get_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a DB session per request.

    Even though the Notification Service mostly runs background
    consumers, this keeps the interface consistent and allows
    us to add HTTP endpoints later that read from the audit log.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


