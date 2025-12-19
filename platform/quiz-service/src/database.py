import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@quiz-db:5432/quiz_db",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_tables():
    """Ensure database tables exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created")
    except OperationalError as e:
        logger.error(f"Database connection error: {e}")
        raise

