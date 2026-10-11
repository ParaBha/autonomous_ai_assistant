from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.services.rag import rag_service
from app.services.gemini_rotator import APIKeysExhaustedError
from pydantic import BaseModel
from typing import List, Optional, Any
import asyncio

router = APIRouter()

class ChatRequest(BaseModel):
    message: Optional[str] = ""
    chat_history: Optional[List[Any]] = None
    document_id: Optional[Any] = None

    class Config:
        extra = "ignore"

def _parse_chat_history(raw_history: Optional[List[Any]]) -> List[tuple]:
    """Safely convert any chat_history format into List[tuple(role, content)] without throwing."""
    if not raw_history:
        return []
    history = []
    for item in raw_history:
        try:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                history.append((str(item[0]), str(item[1])))
            elif isinstance(item, dict) and "role" in item and "content" in item:
                history.append((str(item["role"]), str(item["content"])))
        except Exception:
            continue
    return history

@router.post("/chat")
async def chat(request: ChatRequest):
    msg = (request.message or "").strip() or "Hello"
    print(f"Received chat request: {msg}")
    history = _parse_chat_history(request.chat_history)
    try:
        return rag_service.query(msg, history, request.document_id)
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
    msg = (request.message or "").strip() or "Hello"
    history = _parse_chat_history(request.chat_history)

    async def safe_stream():
        """
        Wrapper that ensures the stream ALWAYS terminates — either with real content
        or with a human-readable error message. Never hangs silently.
        """
        try:
            # 120-second hard deadline for the entire response (gemini-2.0-flash is fast)
            async with asyncio.timeout(120):
                async for chunk in rag_service.stream_query(
                    msg, history, request.document_id
                ):
                    yield chunk
        except asyncio.TimeoutError:
            yield "\n\n⚠️ Response timed out (120s). The server may be under load. Please try again."
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

