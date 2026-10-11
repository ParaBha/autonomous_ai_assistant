from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.services.rag import rag_service
from app.services.gemini_rotator import APIKeysExhaustedError
from pydantic import BaseModel
from typing import List, Optional, Any
import asyncio

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    chat_history: Optional[List[Any]] = []
    document_id: Optional[Any] = None

@router.post("/chat")
async def chat(request: ChatRequest):
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

    async def safe_stream():
        """
        Wrapper that ensures the stream ALWAYS terminates — either with real content
        or with a human-readable error message. Never hangs silently.
        """
        try:
            # 90-second hard deadline for the entire response
            async with asyncio.timeout(90):
                async for chunk in rag_service.stream_query(
                    request.message, history, request.document_id
                ):
                    yield chunk
        except asyncio.TimeoutError:
            yield "\n\n⚠️ Response timed out (90s). The AI model may be overloaded. Please try again."
        except APIKeysExhaustedError:
            yield "\n\n⚠️ All Gemini API keys are rate-limited (429). Please wait 30 seconds and try again."
        except Exception as e:
            print(f"[stream_chat] Unhandled stream error: {e}")
            yield f"\n\n⚠️ An error occurred: {str(e)}. Please try again."

    return StreamingResponse(
        safe_stream(),
        media_type="text/plain; charset=utf-8",
        headers={
            "X-Accel-Buffering": "no",    # Disable nginx/proxy buffering
            "Cache-Control": "no-cache",  # Prevent intermediate caching
            "Connection": "keep-alive",
        }
    )

