import sys
import os

print("Testing imports...")
try:
    from fastapi import FastAPI, UploadFile, File, HTTPException
    print("FastAPI imported")
    from fastapi.middleware.cors import CORSMiddleware
    print("CORS imported")
    import uvicorn
    print("uvicorn imported")
    from dotenv import load_dotenv
    print("dotenv imported")
    
    load_dotenv()
    print(".env loaded")

    print("Importing ingestion_service...")
    from app.services.ingestion import ingestion_service
    print("ingestion_service imported")
    
    print("Importing rag_service...")
    from app.services.rag import rag_service
    print("rag_service imported")

    from app.api.documents import router as doc_router
    print("documents imported")
    from app.api.chat import router as chat_router
    print("chat imported")
    from app.api.projects import router as project_router
    print("projects imported")
    from app.api.oauth import router as oauth_router
    print("oauth imported")
    from app.api.auth import router as auth_router
    print("auth imported")
    from app.db.database import engine, Base
    print("db imported")
    
    print("All imports successful!")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
