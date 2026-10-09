from sqlalchemy import create_engine

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Configure database engine with appropriate connection args
db_url = settings.DATABASE_URL.strip() if settings.DATABASE_URL else ""
if not db_url:
    db_url = "sqlite:///./research_assistant.db"

if "sqlite" in db_url:
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
    )
else:
    # Supabase/PostgreSQL requires SSL
    engine = create_engine(
        db_url,
        connect_args={"sslmode": "require"} if "supabase" in db_url else {}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
