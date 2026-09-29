from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import ResearchProject as ProjectModel, ChatMessage
from app.services.gemini_rotator import gemini_key_manager, APIKeysExhaustedError

router = APIRouter()

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = ""

@router.post("/")
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = ProjectModel(
        title=project.title,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.post("/{project_id}/plan")
async def generate_plan(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    prompt = f"""As a Research Planner, create a comprehensive, professional roadmap for the topic: {project.title}. 
The roadmap should be broken down into clear, logical phases.

Return ONLY a JSON object with the following structure:
{{
  "roadmap": [
    {{
      "title": "Phase Title",
      "description": "Short description of what happens in this phase",
      "duration": "Estimated time (e.g., Day 1-2, Week 1, etc.)"
    }}
  ]
}}
Do NOT include any other text before or after the JSON block.
"""
    try:
        response_text = gemini_key_manager.invoke_with_fallback(prompt)
        content = response_text.strip()
        if content.startswith("```"):
            lines = content.split('\n')
            if len(lines) > 2:
                content = '\n'.join(lines[1:-1])
            else:
                content = content.replace("```json", "").replace("```", "").strip()
        
        plan_data = json.loads(content)
    except APIKeysExhaustedError as exc:
        raise HTTPException(status_code=429, detail="All Gemini API keys exhausted.") from exc
    except Exception:
        plan_data = {"roadmap": [{"title": "Phase 1: Initial Overview", "description": f"Research overview of {project.title}", "duration": "Week 1"}]}

    project.plan = plan_data
    db.commit()
    return plan_data

@router.get("/")
async def list_projects(db: Session = Depends(get_db)):
    return db.query(ProjectModel).all()

@router.delete("/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.query(ChatMessage).filter(ChatMessage.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully", "id": project_id}


