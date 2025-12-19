from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, init_vector_db, engine, Base
from services.ai_service import ai_service
from services.kafka_service import kafka_service
from models import Conversation, Message, DocumentEmbedding
from pydantic import BaseModel
import logging

# Init DB
init_vector_db()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chat Service")
logger = logging.getLogger("chat-service")


class ChatRequest(BaseModel):
    user_id: str
    document_id: str
    message: str
    conversation_id: str = None


@app.post("/api/chat/message")
async def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    try:
        # 1. Generate Embedding for User Query
        query_vector = ai_service.get_embedding(request.message)
        
        # 2. Vector Search (RAG)
        # Find the 5 most similar document chunks
        # The l2_distance method is L2 distance (lower is better)
        chunks = db.query(DocumentEmbedding).filter(
            DocumentEmbedding.document_id == request.document_id
        ).order_by(
            DocumentEmbedding.embedding.l2_distance(query_vector)
        ).limit(5).all()
        
        context_text = [c.content for c in chunks]
        
        if not context_text:
            logger.warning(f"No context found for doc {request.document_id}")
            return {
                "response": "I couldn't find that information in the document. Please ensure the document has been processed.",
                "conversation_id": request.conversation_id or "",
                "sources_count": 0
            }
        
        # 3. Retrieve Conversation History (if conversation_id exists)
        history = []
        if request.conversation_id:
            previous_messages = db.query(Message).filter(
                Message.conversation_id == request.conversation_id
            ).order_by(Message.created_at.desc()).limit(10).all()  # Last 10 messages
            
            # Reverse to chronological order (oldest first)
            for msg in reversed(previous_messages):
                history.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        # 4. Generate Answer with Gemini (includes conversation history)
        response_text = ai_service.chat_with_context(request.message, context_text, history)
        
        # 4. Save Conversation History
        # (Simplified logic: create conv if new)
        if not request.conversation_id:
            conv = Conversation(user_id=request.user_id, title=request.message[:30])
            db.add(conv)
            db.commit()
            db.refresh(conv)
            request.conversation_id = conv.id
            
        # Save messages
        user_msg = Message(
            conversation_id=request.conversation_id, 
            role="user", 
            content=request.message
        )
        ai_msg = Message(
            conversation_id=request.conversation_id, 
            role="ai", 
            content=response_text
        )
        db.add(user_msg)
        db.add(ai_msg)
        db.commit()
        
        # 5. Notify (Async)
        kafka_service.produce_chat_message(
            conversation_id=request.conversation_id, 
            user_id=request.user_id, 
            message=response_text
        )
        
        return {
            "response": response_text, 
            "conversation_id": request.conversation_id,
            "sources_count": len(chunks)
        }

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/chat/conversations")
def list_conversations(
    user_id: str,
    db: Session = Depends(get_db)
):
    """List all conversations for a user."""
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user_id
    ).order_by(Conversation.created_at.desc()).all()
    
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at
        }
        for c in conversations
    ]


@app.get("/api/chat/messages/{conversation_id}")
def get_messages(
    conversation_id: str,
    user_id: str,
    db: Session = Depends(get_db)
):
    """Get all messages for a specific conversation."""
    # Verify ownership
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()
    
    return [
        {
            "id": m.id,
            "text": m.content,
            "sender": m.role,
            "timestamp": m.created_at
        }
        for m in messages
    ]


@app.get("/health")
def health():
    return {"status": "healthy", "service": "chat-service"}

