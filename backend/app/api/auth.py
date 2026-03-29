from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.db.database import get_db
from app.models.models import User

router = APIRouter()

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    profession: str = ""
    phone: str = ""

class SigninRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    name: str
    email: str
    profession: str
    phone: str
    avatar: str

    class Config:
        from_attributes = True

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

@router.post("/signup", response_model=UserResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user with email and password
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={request.email}"
    
    new_user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.name,
        profession=request.profession or "Researcher",
        phone=request.phone or "+1 (555) 000-0000",
        avatar_url=avatar_url
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(
        name=new_user.full_name,
        email=new_user.email,
        profession=new_user.profession,
        phone=new_user.phone,
        avatar=new_user.avatar_url
    )

@router.post("/signin", response_model=UserResponse)
async def signin(request: SigninRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return UserResponse(
        name=user.full_name,
        email=user.email,
        profession=user.profession,
        phone=user.phone,
        avatar=user.avatar_url
    )
