import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

"""
Database configuration for Document Reader Service.

Reads DATABASE_URL from environment (set in docker-compose). Provides:
- engine: SQLAlchemy engine
- SessionLocal: session factory
- Base: declarative base for models
- get_db: FastAPI dependency yielding a DB session
"""

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/document_reader_db",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
