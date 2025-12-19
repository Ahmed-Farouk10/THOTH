import logging
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db, ensure_tables
from models import Quiz, Question
from schemas import QuestionDTO, QuizDTO, QuizAnswerSubmit, QuizAnswerFeedback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from services.kafka_service import kafka_service

# Create tables on startup (simplified for dev)
try:
    ensure_tables()
except Exception as e:
    logger.error(f"Failed to create tables: {e}")

app = FastAPI(title="Quiz Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



from fastapi import Request

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.get("/api/quizzes/{quiz_id}", response_model=QuizDTO)
def get_quiz(quiz_id: str, db: Session = Depends(get_db)):
    """Get a quiz by ID."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions_dto = [
        QuestionDTO(
            id=q.id,
            question_text=q.question_text,
            options=q.options,
        )
        for q in quiz.questions
    ]

    return QuizDTO(
        id=quiz.id,
        title=quiz.title,
        document_id=quiz.document_id,
        questions=questions_dto,
        created_at=quiz.created_at.isoformat() if quiz.created_at else "",
    )


@app.get("/api/quizzes", response_model=List[QuizDTO])
def list_quizzes(
    user_id: str = Query(..., description="User ID to filter quizzes"),
    document_id: str = Query(None, description="Optional document ID filter"),
    db: Session = Depends(get_db),
):
    """List quizzes for a user, optionally filtered by document."""
    query = db.query(Quiz).filter(Quiz.user_id == user_id)
    
    if document_id:
        query = query.filter(Quiz.document_id == document_id)
    
    quizzes = query.order_by(Quiz.created_at.desc()).all()
    
    return [
        QuizDTO(
            id=quiz.id,
            title=quiz.title,
            document_id=quiz.document_id,
            questions=[
                QuestionDTO(
                    id=q.id,
                    question_text=q.question_text,
                    options=q.options,
                )
                for q in quiz.questions
            ],
            created_at=quiz.created_at.isoformat() if quiz.created_at else "",
        )
        for quiz in quizzes
    ]


@app.post("/api/quizzes/{quiz_id}/submit", response_model=QuizAnswerFeedback)
def submit_quiz_answer(
    quiz_id: str,
    answer: QuizAnswerSubmit,
    user_id: str = Query(..., description="User ID for authorization"),
    db: Session = Depends(get_db)
):
    """
    Submit an answer for a quiz question.
    
    Returns comprehensive feedback on the answer, including:
    - Whether the answer is correct
    - The correct answer
    - Detailed explanation of why the answer is right/wrong
    - Guidance for understanding the concept
    - Option to add wrong answers to notes
    """
    # Get the question
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify the question belongs to the quiz
    if question.quiz_id != quiz_id:
        raise HTTPException(status_code=400, detail="Question does not belong to this quiz")
    
    # Check if answer is correct
    is_correct = answer.selected_answer_index == question.correct_answer_index
    
    selected_answer = question.options[answer.selected_answer_index]
    correct_answer = question.options[question.correct_answer_index]
    
    # If wrong answer and user wants to add to notes
    added_to_notes = False
    if not is_correct and answer.add_to_notes:
        try:
            # Get quiz to find document_id
            quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
            if quiz:
                # Call document service to append to notes
                note_entry = f"\n\n❌ Quiz Mistake - {question.question_text}\n"
                note_entry += f"Your Answer: {selected_answer}\n"
                note_entry += f"Correct Answer: {correct_answer}\n"
                note_entry += f"📝 {question.explanation}\n"
                
                # TODO: Implement actual API call to document service to append to notes
                # For now, just log it
                logger.info(f"Would add to notes for document {quiz.document_id}: {note_entry}")
                added_to_notes = True
        except Exception as e:
            logger.error(f"Error adding to notes: {e}")
            # Don't fail the request if notes addition fails
    
    return QuizAnswerFeedback(
        is_correct=is_correct,
        correct_answer_index=question.correct_answer_index,
        selected_answer=selected_answer,
        correct_answer=correct_answer,
        explanation=question.explanation,
        added_to_notes=added_to_notes
    )


@app.post("/api/quizzes/generate-from-document")
def generate_quiz_from_document(
    document_id: str,
    difficulty: str = "Medium",
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Generate a quiz from a document context.
    
    This triggers an async process via Kafka (quiz.requested).
    """
    try:
        # Validate difficulty
        if difficulty not in ["Easy", "Medium", "Hard", "easy", "medium", "hard"]:
            difficulty = "Medium"
            
        # Normalize difficulty
        difficulty = difficulty.capitalize()
        
        # Produce Kafka event
        kafka_service.produce_quiz_requested(
            document_id=document_id,
            user_id=user_id,
            difficulty=difficulty
        )
        
        return {
            "status": "processing",
            "message": "Quiz generation started. You will be notified when ready.",
            "document_id": document_id,
            "difficulty": difficulty
        }
    except Exception as e:
        logger.error(f"Failed to request quiz generation: {e}")
        raise HTTPException(status_code=500, detail="Failed to start generation")


@app.post("/api/quizzes/generate-from-topic")
def generate_quiz_from_topic(
    topic: str,
    difficulty: str = "medium",
    question_count: int = 5,
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Generate a quiz from a custom topic using AI.
    
    Args:
        topic: The topic to generate quiz about
        difficulty: Quiz difficulty (easy, medium, hard)
        question_count: Number of questions to generate
        user_id: User ID for ownership
    """
    import uuid
    from services.ai_service import ai_service
    
    try:
        logger.info(f"Generating quiz from topic: {topic}")
        
        # Create a prompt for the AI based on the topic
        prompt_text = f"Generate educational content about: {topic}"
        
        # Generate quiz using AI service - it returns a Pydantic model
        quiz_pydantic = ai_service.generate_quiz(
            text_content=prompt_text,
            difficulty=difficulty.capitalize()  # Easy, Medium, Hard
        )
        
        # Save to database
        quiz_id = str(uuid.uuid4())
        quiz = Quiz(
            id=quiz_id,
            document_id=None,  # No document for custom topics
            user_id=user_id,
            title=quiz_pydantic.title,
            difficulty=difficulty,
        )
        db.add(quiz)
        
        # Add questions from Pydantic model
        for q_data in quiz_pydantic.questions:
            question = Question(
                id=str(uuid.uuid4()),
                quiz_id=quiz_id,
                question_text=q_data.question_text,
                options=q_data.options,
                correct_answer_index=q_data.correct_answer_index,
                explanation=q_data.explanation,
            )
            db.add(question)
        
        db.commit()
        logger.info(f"Quiz saved to database: {quiz_id}")
        
        # Return quiz data
        questions_dto = [
            QuestionDTO(
                id=q.id,
                question_text=q.question_text,
                options=q.options,
            )
            for q in quiz.questions
        ]
        
        return QuizDTO(
            id=quiz.id,
            title=quiz.title,
            document_id=quiz.document_id,
            questions=questions_dto,
            created_at=quiz.created_at.isoformat() if quiz.created_at else "",
        )
        
    except Exception as e:
        logger.error(f"Failed to generate quiz from topic: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")





@app.delete("/api/quizzes/{quiz_id}")
def delete_quiz(
    quiz_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
    db: Session = Depends(get_db)
):
    """Delete a quiz."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    # Verify ownership
    if quiz.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this quiz")
        
    db.delete(quiz)
    db.commit()
    
    logger.info(f"Deleted quiz {quiz_id} for user {user_id}")
    return {"status": "deleted", "quiz_id": quiz_id}


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "quiz-service"}


