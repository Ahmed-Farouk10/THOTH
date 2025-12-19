from typing import List, Optional
from pydantic import BaseModel, Field


class QuizQuestionGenerated(BaseModel):
    question_text: str = Field(description="The text of the question")
    options: List[str] = Field(description="List of 4 possible answers", min_items=4, max_items=4)
    correct_answer_index: int = Field(description="Index of the correct answer (0-3)")
    explanation: str = Field(description="Explanation of why the answer is correct")


class QuizGenerated(BaseModel):
    title: str = Field(description="A catchy title for the quiz based on the content")
    difficulty: str = Field(description="Difficulty level: Easy, Medium, or Hard")
    questions: List[QuizQuestionGenerated] = Field(description="List of generated questions")


class QuestionDTO(BaseModel):
    id: str
    question_text: str
    options: List[str]


class QuizDTO(BaseModel):
    id: str
    title: str
    document_id: Optional[str] = None  # Optional for custom topic quizzes
    questions: List[QuestionDTO]
    created_at: str


# New schemas for quiz submission and feedback
class QuizAnswerSubmit(BaseModel):
    question_id: str
    selected_answer_index: int
    add_to_notes: bool = False  # User choice to add wrong answer to notes


class QuizAnswerFeedback(BaseModel):
    is_correct: bool
    correct_answer_index: int
    selected_answer: str
    correct_answer: str
    explanation: str  # Comprehensive explanation with guidance
    guidance: Optional[str] = None  # Additional guidance extracted from explanation
    added_to_notes: bool = False  # Whether it was added to notes
