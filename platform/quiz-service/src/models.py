import uuid
from sqlalchemy import Column, String, ForeignKey, Integer, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), nullable=True, index=True)  # Nullable for custom topic quizzes
    user_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255))
    difficulty = Column(String(20))  # easy, medium, hard
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    quiz_id = Column(String(36), ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(String, nullable=False)
    question_type = Column(String(20), default="multiple_choice")
    options = Column(JSON, nullable=False)  # List of options
    correct_answer_index = Column(Integer, nullable=False)
    explanation = Column(String, nullable=True)

    quiz = relationship("Quiz", back_populates="questions")

