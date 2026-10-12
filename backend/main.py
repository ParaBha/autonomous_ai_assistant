from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

from app.api.documents import router as doc_router
from app.api.chat import router as chat_router
from app.api.projects import router as project_router
from app.api.oauth import router as oauth_router
from app.api.auth import router as auth_router
from app.db.database import engine, Base

try:
    Base.metadata.create_all(bind=engine)
except Exception as _db_init_err:
    print(f"[STARTUP WARNING] Could not create DB tables: {_db_init_err}")



async def _self_ping_loop():
    """
    Pings the public /health endpoint every 10 minutes to prevent
    Render free-tier from spinning down the container.
    localhost:8000 is NOT reachable inside Render containers — must use public URL.
    """
    import httpx
    SELF_URL = os.getenv("RENDER_EXTERNAL_URL", "https://autonomous-ai-assistant.onrender.com")
    health_url = f"{SELF_URL.rstrip('/')}/health"
    await asyncio.sleep(60)  # Give server time to fully start before first ping
    while True:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(health_url)
            print(f"[KEEPALIVE] Self-ping OK → {r.status_code}")
        except Exception as e:
            print(f"[KEEPALIVE] Ping failed: {e}")
        await asyncio.sleep(600)  # Ping every 10 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start keep-alive background task
    task = asyncio.create_task(_self_ping_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# Deployment Version: 1.0.4 (Keep-alive self-ping + skip ChromaDB for plain chat)
app = FastAPI(title="Autonomous AI Research Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Production Vercel frontends
        "https://autonomous-ai-assistant-blond.vercel.app",
        "https://autonomous-ai-assistant.vercel.app",
        # Vercel preview deployments (any branch)
        "https://autonomous-ai-assistant-parabhas-projects.vercel.app",
        "https://autonomous-ai-assistant-git-main-parabhas-projects.vercel.app",
        # Render backend (for health checks / self-ping)
        "https://autonomous-ai-assistant.onrender.com",
        # Local development
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(doc_router, prefix="/api/v1/docs", tags=["documents"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(project_router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(oauth_router, prefix="/api/v1/auth", tags=["oauth"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["authentication"])


@app.get("/")
async def root():
    return {"message": "Welcome to the Autonomous AI Research Assistant API"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
