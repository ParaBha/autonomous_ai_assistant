from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.rag import rag_service
from app.services.gemini_rotator import APIKeysExhaustedError
from pydantic import BaseModel
from typing import List, Optional, Any

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    chat_history: Optional[List[Any]] = []
    document_id: Optional[Any] = None

@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    print(f"Received chat request: {request.message}")
    history = [tuple(h) for h in (request.chat_history or [])]
    try:
        return rag_service.query(request.message, history, request.document_id)
    except APIKeysExhaustedError as exc:
        raise HTTPException(
            status_code=429,
            detail="All Gemini API keys exhausted (429 / ResourceExhausted). Primary key is in a 60-second cooldown."
        ) from exc
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return {"answer": f"Backend Error: {str(e)}", "sources": []}

@router.post("/stream_chat")
async def stream_chat(request: ChatRequest):
    history = [tuple(h) for h in (request.chat_history or [])]
    try:
        return StreamingResponse(
            rag_service.stream_query(request.message, history, request.document_id),
            media_type="text/plain; charset=utf-8",
            headers={
                "X-Accel-Buffering": "no",    # Disable nginx/proxy buffering
                "Cache-Control": "no-cache",  # Prevent intermediate caching
                "Connection": "keep-alive",   # Keep TCP alive for streaming
            }
        )
    except APIKeysExhaustedError as exc:
        raise HTTPException(
            status_code=429,
            detail="All Gemini API keys exhausted (429 / ResourceExhausted). Primary key is in a 60-second cooldown."
        ) from exc
