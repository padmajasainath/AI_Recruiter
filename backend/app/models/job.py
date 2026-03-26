"""
Job posting model.
"""
import uuid
import secrets
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(255), unique=True, index=True, nullable=True) # Will make non-nullable after backfill

    # Job details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)  # Full JD
    skills_required = Column(JSON, nullable=False, default=list)  # ["Python", "SQL", ...]
    years_of_experience_min = Column(Integer, nullable=False, default=0)
    years_of_experience_max = Column(Integer, nullable=True)
    expected_salary_min = Column(Integer, nullable=True)
    expected_salary_max = Column(Integer, nullable=True)
    salary_currency = Column(String(10), nullable=True, default="USD")
    location = Column(String(255), nullable=True)
    location_type = Column(
        SQLEnum("REMOTE", "HYBRID", "ONSITE", name="location_type"),
        nullable=False, default="REMOTE"
    )
    department = Column(String(100), nullable=True)

    # AI Screening & Interview Settings
    screening_threshold = Column(Integer, nullable=False, default=70)  # 0-100 score threshold
    interview_duration_mins = Column(Integer, nullable=False, default=30)
    interview_link_expiry_hours = Column(Integer, nullable=False, default=72)
    ai_interview_prompt = Column(Text, nullable=True) # Custom instructions for the AI interviewer

    # Application link
    application_link_token = Column(
        String(64), nullable=False, unique=True, index=True,
        default=lambda: secrets.token_urlsafe(16)
    )

    # Status
    status = Column(
        SQLEnum("ACTIVE", "PAUSED", "CLOSED", name="job_status"),
        nullable=False, default="ACTIVE"
    )

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")
