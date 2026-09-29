import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Autonomous AI Research Assistant"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "") # Supabase connection string

    
    GEMINI_PRIMARY_KEY: str = os.getenv("GEMINI_PRIMARY_KEY") or os.getenv("GEMINI_API_KEY", "")
    GEMINI_SECONDARY_KEY: str = os.getenv("GEMINI_SECONDARY_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_API_KEYS_RAW: str = os.getenv("GEMINI_API_KEYS", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_COOLDOWN_SECONDS: int = 60
    
    # Upload Settings
    UPLOAD_DIR: str = "uploads"
    ALLOWED_EXTENSIONS: set = {"pdf", "docx", "txt", "png", "jpg", "jpeg", "pptx", "csv"}

    def get_primary_key(self) -> str:
        return self.GEMINI_PRIMARY_KEY.strip()

    def get_secondary_key(self) -> str:
        return self.GEMINI_SECONDARY_KEY.strip()
    
    class Config:
        case_sensitive = True

settings = Settings()
