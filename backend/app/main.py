"""
AI Recruiter — FastAPI Application Entry Point
"""
import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.services.firebase_auth import init_firebase

# Import all models so Base.metadata knows about them
from app.models import Company, CompanyMember, Job, Application, Interview, EmailLog

# Import routers
from app.routers import (
    auth_router,
    jobs_router,
    applications_router,
    interviews_router,
    email_webhook_router,
    dashboard_router,
    companies_router,
    interview_live_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("🚀 Starting AI Recruiter API...")
    
    # Create tables (in dev; use Alembic in production)
    Base.metadata.create_all(bind=engine)
    
    # Lightweight auto-migration for existing tables (added for production parity)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Fix interviews table
            res = conn.execute(text("SHOW COLUMNS FROM interviews"))
            cols = [row[0] for row in res.fetchall()]
            missing_interviews = {
                "booking_link": "TEXT NULL",
                "recording_url": "TEXT NULL",
                "recording_web_url": "TEXT NULL",
                "recording_status": "VARCHAR(20) NULL DEFAULT 'PENDING'",
                "ai_summary": "TEXT NULL",
                "ai_strengths": "JSON NULL",
                "ai_weaknesses": "JSON NULL",
                "ai_improvements": "JSON NULL",
                "interview_topics": "JSON NULL",
                "interview_duration_minutes": "INT NULL",
                "questions_asked": "INT NULL DEFAULT 0",
                "transcript": "JSON NULL",
                "started_at": "DATETIME NULL"
            }
            for col, ctype in missing_interviews.items():
                if col not in cols:
                    logger.info(f"🛠 Adding missing column {col} to interviews")
                    conn.execute(text(f"ALTER TABLE interviews ADD COLUMN {col} {ctype}"))
            
            # Fix jobs table
            res = conn.execute(text("SHOW COLUMNS FROM jobs"))
            cols = [row[0] for row in res.fetchall()]
            if "job_id" not in cols:
                conn.execute(text("ALTER TABLE jobs ADD COLUMN job_id VARCHAR(20) NULL"))
            
            job_updates = {
                "interview_duration_mins": "INT NOT NULL DEFAULT 30",
                "interview_link_expiry_hours": "INT NOT NULL DEFAULT 72",
                "ai_interview_prompt": "TEXT NULL"
            }
            for col, ctype in job_updates.items():
                if col not in cols:
                    logger.info(f"🛠 Adding missing column {col} to jobs")
                    conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col} {ctype}"))
            
            conn.commit()
        logger.info("✅ Database schema verified/updated")
    except Exception as e:
        logger.warning(f"⚠️ Auto-migration failed: {e}")

    # Initialize Firebase
    try:
        init_firebase()
        logger.info("✅ Firebase initialized")
    except Exception as e:
        logger.warning(f"⚠️ Firebase init warning: {e}")

    yield

    # Shutdown
    logger.info("👋 Shutting down AI Recruiter API")


app = FastAPI(
    title="AI Recruiter API",
    description="Agentic AI-led recruitment tracker and screening portal",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.exceptions import RequestValidationError, HTTPException
from pydantic import ValidationError

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception caught: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP error {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(interviews_router)
app.include_router(email_webhook_router)
app.include_router(dashboard_router)
app.include_router(companies_router)
app.include_router(interview_live_router, prefix="/api/interview", tags=["live-interview"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AI Recruiter API"}


@app.get("/")
async def root():
    return {
        "service": "AI Recruiter API",
        "version": "1.0.0",
        "docs": "/docs",
    }
