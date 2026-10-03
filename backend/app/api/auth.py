from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.db.database import get_db
from app.models.models import User, Document as DocumentModel, ResearchProject as ProjectModel, ChatMessage
from app.core.config import settings
from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
import asyncio
import re

router = APIRouter()

# Password hashing — rounds=10 keeps latency ~110ms (default 12 = ~430ms)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)

# ── JWT Helpers ────────────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        return int(user_id) if user_id else None
    except JWTError:
        return None

def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> int:
    """Extract and validate user ID from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id

def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
) -> User:
    """Return the authenticated User object from Bearer token."""
    user_id = get_current_user_id(authorization)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    profession: str = ""
    phone: str = ""
    institution: str = ""
    field_of_study: str = ""

class SigninRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    profession: str
    phone: str
    avatar: str
    institution: str = ""
    field_of_study: str = ""
    research_interests: list = []
    access_token: str = ""

    class Config:
        from_attributes = True

class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    profession: str | None = None
    phone: str | None = None
    avatar: str | None = None
    institution: str | None = None
    field_of_study: str | None = None
    research_interests: list[str] | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# ── Password Utilities ─────────────────────────────────────────────────────────

async def hash_password(password: str) -> str:
    """Hash a password using bcrypt in a thread pool so the async event loop is never blocked."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, pwd_context.hash, password)

async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash in a thread pool so the async event loop is never blocked."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, pwd_context.verify, plain_password, hashed_password)

def _user_to_response(user: User, token: str = "") -> UserResponse:
    """Convert a User ORM object to a UserResponse dict."""
    return UserResponse(
        id=user.id,
        name=user.full_name or "",
        email=user.email,
        profession=user.profession or "",
        phone=user.phone or "",
        avatar=user.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.email}",
        institution=user.institution or "",
        field_of_study=user.field_of_study or "",
        research_interests=user.research_interests or [],
        access_token=token,
    )

# ── Auth Routes ────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=UserResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user. Collects full profile at sign-up time.
    Returns the user object plus a JWT access token.
    """
    clean_email = request.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={clean_email}"
    hashed_pw = await hash_password(request.password)

    new_user = User(
        email=clean_email,
        hashed_password=hashed_pw,
        full_name=request.name.strip() if request.name else "",
        profession=request.profession.strip() if request.profession else "",
        phone=request.phone.strip() if request.phone else "",
        avatar_url=avatar_url,
        institution=request.institution.strip() if request.institution else "",
        field_of_study=request.field_of_study.strip() if request.field_of_study else "",
        research_interests=[]
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user.id)
    return _user_to_response(new_user, token)


@router.post("/signin", response_model=UserResponse)
async def signin(request: SigninRequest, db: Session = Depends(get_db)):
    """
    Authenticate user. Returns profile fetched by user ID plus a JWT access token.
    """
    clean_email = request.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not await verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return _user_to_response(user, token)


@router.get("/profile/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Return the authenticated user's profile. Requires Bearer token.
    """
    return _user_to_response(current_user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update profile for the currently authenticated user.
    Uses JWT token — a user can only update their own profile.
    """
    if request.name is not None:
        current_user.full_name = request.name
    if request.profession is not None:
        current_user.profession = request.profession
    if request.phone is not None:
        current_user.phone = request.phone
    if request.avatar is not None:
        current_user.avatar_url = request.avatar
    if request.institution is not None:
        current_user.institution = request.institution
    if request.field_of_study is not None:
        current_user.field_of_study = request.field_of_study
    if request.research_interests is not None:
        current_user.research_interests = request.research_interests

    db.commit()
    db.refresh(current_user)

    # Re-issue the same-user token (id unchanged)
    token = create_access_token(current_user.id)
    return _user_to_response(current_user, token)


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password for the currently authenticated user.
    Verifies the current password before updating.
    """
    if not await verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    current_user.hashed_password = await hash_password(request.new_password)
    db.commit()

    return {"message": "Password changed successfully"}


@router.get("/profile/stats")
async def get_profile_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return per-user research statistics, recent activity, and saved reports.
    Uses JWT token to identify the current user (not a raw email param).
    """
    user = current_user

    # Fetch all user's projects and documents
    projects = db.query(ProjectModel).filter(ProjectModel.user_id == user.id).order_by(ProjectModel.created_at.desc()).all()
    documents = db.query(DocumentModel).filter(DocumentModel.user_id == user.id).order_by(DocumentModel.upload_date.desc()).all()

    # If no user_id filtering is available (legacy data without user_id), fall back to global
    if not projects and not documents:
        projects = db.query(ProjectModel).order_by(ProjectModel.created_at.desc()).all()
        documents = db.query(DocumentModel).order_by(DocumentModel.upload_date.desc()).all()

    # Fetch chat messages linked to user's projects
    project_ids = [p.id for p in projects]
    messages = []
    if project_ids:
        messages = db.query(ChatMessage).filter(
            ChatMessage.project_id.in_(project_ids),
            ChatMessage.role == "user"
        ).order_by(ChatMessage.timestamp.desc()).all()
    else:
        messages = db.query(ChatMessage).filter(ChatMessage.role == "user").order_by(ChatMessage.timestamp.desc()).all()

    # ── Statistics ─────────────────────────────────────────────────────────────
    research_sessions = len(projects)
    documents_retrieved = len(documents)
    reports_generated = len([p for p in projects if p.plan])

    sources_analyzed = sum(
        max(len(doc.extracted_text or "") // 800, 1)
        for doc in documents
    ) if documents else 0
    if sources_analyzed == 0 and messages:
        sources_analyzed = len(messages)

    # ── Recent Activity ────────────────────────────────────────────────────────
    activity = []

    for proj in projects[:10]:
        has_plan = bool(proj.plan)
        ts = proj.created_at.isoformat() if proj.created_at else datetime.utcnow().isoformat()
        activity.append({
            "type": "research_completed" if has_plan else "session_started",
            "icon": "check" if has_plan else "play",
            "title": proj.title,
            "description": "Research report generated" if has_plan else "New research session started",
            "timestamp": ts,
        })
        if has_plan:
            activity.append({
                "type": "report_saved",
                "icon": "save",
                "title": proj.title,
                "description": "Roadmap report saved",
                "timestamp": ts,
            })

    for doc in documents[:5]:
        ts = doc.upload_date.isoformat() if doc.upload_date else datetime.utcnow().isoformat()
        activity.append({
            "type": "document_uploaded",
            "icon": "upload",
            "title": doc.filename,
            "description": f"{doc.file_type.upper()} document indexed for research",
            "timestamp": ts,
        })

    for msg in messages[:5]:
        ts = msg.timestamp.isoformat() if msg.timestamp else datetime.utcnow().isoformat()
        activity.append({
            "type": "query",
            "icon": "search",
            "title": (msg.content[:60] + "…") if len(msg.content) > 60 else msg.content,
            "description": "Research query submitted",
            "timestamp": ts,
        })

    activity.sort(key=lambda x: x["timestamp"], reverse=True)
    activity = activity[:10]

    # ── Saved Reports ──────────────────────────────────────────────────────────
    saved_reports = []
    for proj in projects:
        if proj.plan:
            plan_roadmap = proj.plan.get("roadmap", []) if isinstance(proj.plan, dict) else []
            phases_count = len(plan_roadmap) if isinstance(plan_roadmap, list) else 0
            source_count = documents_retrieved + phases_count

            saved_reports.append({
                "id": proj.id,
                "title": proj.title,
                "source_count": source_count,
                "created_at": proj.created_at.isoformat() if proj.created_at else None,
                "status": "Completed",
                "phases": phases_count,
                "description": proj.description or "",
            })

    return {
        "stats": {
            "research_sessions": research_sessions,
            "sources_analyzed": sources_analyzed,
            "documents_retrieved": documents_retrieved,
            "reports_generated": reports_generated,
        },
        "recent_activity": activity,
        "saved_reports": saved_reports,
    }
