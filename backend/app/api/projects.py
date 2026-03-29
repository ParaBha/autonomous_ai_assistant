from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import ResearchProject as ProjectModel
from app.agents.research_agents import research_agents
from pydantic import BaseModel
from typing import List, Optional

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
    
    state = {"task": project.title, "plan": {}, "analysis": [], "insights": [], "gaps": [], "study_material": {}}
    updated_state = await research_agents.planner_agent(state)
    
    project.plan = updated_state["plan"]
    db.commit()
    return updated_state["plan"]

@router.get("/")
async def list_projects(db: Session = Depends(get_db)):
    return db.query(ProjectModel).all()
