from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.ingestion import ingestion_service
from app.services.rag import rag_service
from app.models.models import Document as DocumentModel
import os
import shutil
from app.core.config import settings

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not os.path.exists(settings.UPLOAD_DIR):
        os.makedirs(settings.UPLOAD_DIR)
        
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        text = ingestion_service.process_file(file_path)
        
        db_doc = DocumentModel(
            filename=file.filename,
            file_path=file_path,
            file_type=file.filename.split(".")[-1],
            extracted_text=text
        )
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # Ingest into RAG
        rag_service.process_and_store(text, str(db_doc.id), {"filename": file.filename})
        
        return {"id": db_doc.id, "filename": db_doc.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
async def list_documents(db: Session = Depends(get_db)):
    return db.query(DocumentModel).all()

@router.delete("/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Remove file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully"}

@router.get("/insights")
async def get_insights(db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).all()
    if not docs:
        return {"summary": "No documents uploaded yet.", "key_findings": []}
    
    # In a real app, we'd use the Insight Generator agent on the combined text
    # For now, we return a summary based on the document count and types
    return {
        "summary": f"Analyzing {len(docs)} documents. Core themes include research methodology, technical implementation, and future accessibility.",
        "key_findings": [
            "Smart fitness integration is a key trend in 2026.",
            "Accessibility in research tools improves collaboration efficiency.",
            "AI-driven analysis reduces research time by up to 40%."
        ]
    }

@router.get("/visualizations")
async def get_visualizations(db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).all()
    
    # Calculate type distribution
    type_counts = {}
    for doc in docs:
        type_counts[doc.file_type] = type_counts.get(doc.file_type, 0) + 1
    
    topic_distribution = [
        {"name": k.upper(), "value": v} for k, v in type_counts.items()
    ]
    
    # Static research progress for demo
    research_progress = [
        {"name": "Jan", "progress": 20},
        {"name": "Feb", "progress": 45},
        {"name": "Mar", "progress": 78},
    ]
    
    return {
        "topic_distribution": topic_distribution,
        "research_progress": research_progress
    }
