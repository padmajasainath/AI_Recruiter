"""
Application (candidate) model.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Candidate details
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=False, index=True)
    candidate_phone = Column(String(50), nullable=True)
    candidate_linkedin = Column(String(500), nullable=True)
    cover_letter = Column(Text, nullable=True)

    # Resume
    resume_url = Column(Text, nullable=True)  # Firebase Storage URL
    resume_filename = Column(String(255), nullable=True)
    resume_parsed_data = Column(JSON, nullable=True)  # Structured extraction from AI

    # AI Screening results
    ai_score = Column(Float, nullable=True)  # 0-100
    ai_reasoning = Column(Text, nullable=True)  # Detailed AI analysis
    ai_skills_match = Column(JSON, nullable=True)  # {"matched": [...], "missing": [...]}
    ai_experience_match = Column(JSON, nullable=True)  # {"required": 5, "candidate": 7, "match": true}

    # Pipeline status
    status = Column(
        SQLEnum(
            "APPLIED", "SCREENING", "SHORTLISTED",
            "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED",
            "HIRED", "REJECTED",
            name="application_status"
        ),
        nullable=False, default="APPLIED"
    )

    screened_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    job = relationship("Job", back_populates="applications")
    interviews = relationship("Interview", back_populates="application", cascade="all, delete-orphan")
    email_logs = relationship("EmailLog", back_populates="application", cascade="all, delete-orphan")
