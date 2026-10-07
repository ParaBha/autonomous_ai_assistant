from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

from app.api.documents import router as doc_router
from app.api.chat import router as chat_router
from app.api.projects import router as project_router
from app.api.oauth import router as oauth_router
from app.api.auth import router as auth_router
from app.db.database import engine, Base

Base.metadata.create_all(bind=engine)

# Deployment Version: 1.0.2 (Error diagnostics & Gemini 3.8-flash sync)
app = FastAPI(title="Autonomous AI Research Assistant")

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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
