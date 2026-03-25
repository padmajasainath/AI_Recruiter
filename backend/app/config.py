import os
import json
import logging
from functools import lru_cache
from typing import List, Optional, Dict, Any
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


def load_secrets_from_secret_manager(project_id: str, secret_name: str = "ai-recruiter-config") -> dict:
    """
    Load secrets from Google Cloud Secret Manager.
    Returns empty dict if not available (local dev).
    """
    try:
        from google.cloud import secretmanager
        
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        secrets = json.loads(response.payload.data.decode("UTF-8"))
        logger.info(f"Loaded secrets from Secret Manager: {secret_name}")
        return secrets
    except Exception as e:
        logger.warning(f"Could not load secrets from Secret Manager: {e}")
        return {}


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # App
    APP_NAME: str = "AI Recruiter"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "mysql+pymysql://recruiter:recruiter123@localhost:3306/ai_recruiter"

    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "firebase-credentials.json"
    FIREBASE_STORAGE_BUCKET: str = ""

    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Email - Microsoft Graph API (Outlook)
    OUTLOOK_CLIENT_ID: str = ""
    OUTLOOK_CLIENT_SECRET: str = ""
    OUTLOOK_TENANT_ID: str = ""
    OUTLOOK_SENDER_EMAIL: str = "reply@cloudmetica.com"
    
    # SharePoint
    SHAREPOINT_DRIVE_ID: str = "b!e8QbVkP7z0a5vROPEf23-oBwe5kuCMlGs2_shpEMJCbb1kFJcpaNTp98bW1jboBm"
    SHAREPOINT_CLIENT_ID: str = ""
    SHAREPOINT_CLIENT_SECRET: str = ""
    SHAREPOINT_TENANT_ID: str = ""


    # Frontend URL for shareable links
    FRONTEND_URL: str = "http://localhost:3000"
    FIREBASE_CREDENTIALS: Dict[str, Any] = {}

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Screening defaults
    DEFAULT_SCREENING_THRESHOLD: int = 70

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    In production, loads secrets from Secret Manager.
    """
    # Check if running in production (via environment variable)
    env = os.getenv("ENVIRONMENT", "development")
    
    if env == "production":
        # Get GCP project ID (set by Cloud Run or default)
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "cloudmetica-apps")
        
        # Load secrets from Secret Manager
        secrets = load_secrets_from_secret_manager(project_id)
        
        if secrets:
            # Create settings with secrets overlaid
            return Settings(
                ENVIRONMENT="production",
                DEBUG=False,
                DATABASE_URL=secrets.get("DATABASE_URL", ""),
                SECRET_KEY=secrets.get("SECRET_KEY", ""),
                GEMINI_API_KEY=secrets.get("GEMINI_API_KEY", ""),
                CORS_ORIGINS=secrets.get("CORS_ORIGINS", ""),
                FRONTEND_URL=secrets.get("FRONTEND_URL", "https://ai-recruiter-frontend-167160983469.us-west1.run.app"),
                FIREBASE_CREDENTIALS=secrets.get("FIREBASE_CREDENTIALS", {}),
                FIREBASE_STORAGE_BUCKET=secrets.get("FIREBASE_STORAGE_BUCKET", ""),
                OUTLOOK_CLIENT_ID=secrets.get("OUTLOOK_CLIENT_ID", ""),
                OUTLOOK_CLIENT_SECRET=secrets.get("OUTLOOK_CLIENT_SECRET", ""),
                OUTLOOK_TENANT_ID=secrets.get("OUTLOOK_TENANT_ID", ""),
                OUTLOOK_SENDER_EMAIL=secrets.get("OUTLOOK_SENDER_EMAIL", "reply@cloudmetica.com"),
                SHAREPOINT_DRIVE_ID=secrets.get("SHAREPOINT_DRIVE_ID", ""),
                SHAREPOINT_CLIENT_ID=secrets.get("SHAREPOINT_CLIENT_ID", ""),
                SHAREPOINT_CLIENT_SECRET=secrets.get("SHAREPOINT_CLIENT_SECRET", ""),
                SHAREPOINT_TENANT_ID=secrets.get("SHAREPOINT_TENANT_ID", ""),
            )
        else:
            logger.warning("Production mode but could not load secrets, using defaults")
    
    # Development mode - use .env file
    return Settings()
