"""
Interview model — tracks AI interviews via datagenius integration.
"""
import uuid
import secrets
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)

    # Token-based access (unique URL per candidate)
    interview_token = Column(String(64), unique=True, index=True, default=lambda: secrets.token_urlsafe(32))
    token_expires_at = Column(DateTime, nullable=False)  # 72h from creation

    # Scheduling (legacy)
    scheduled_at = Column(DateTime, nullable=True)
    candidate_availability = Column(JSON, nullable=True)  # List of available slots
    booking_link = Column(Text, nullable=True)  # Link for candidate to book

    # Status
    # Note: We'll map PENDING to LINK_SENT and add IN_PROGRESS, COMPLETED
    status = Column(
        SQLEnum("PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="interview_status"),
        nullable=False, default="PENDING"
    )

    # Interview config
    interview_type = Column(String(20), default="AI_VOICE")
    time_limit_minutes = Column(Integer, default=30)

    # Session tracking
    started_at = Column(DateTime, nullable=True)
    transcript = Column(JSON, nullable=True)  # [{speaker, text, timestamp}]
    questions_asked = Column(Integer, default=0)

    # Results / AI Analysis
    interview_score = Column(Float, nullable=True)
    interview_feedback = Column(Text, nullable=True)
    interview_topics = Column(JSON, nullable=True)  # Topics covered
    interview_duration_minutes = Column(Integer, nullable=True)

    # Recording & Persistence
    recording_url = Column(Text, nullable=True)  # SharePoint ID or Firebase URL
    recording_web_url = Column(Text, nullable=True) # Direct SharePoint link for recruiters
    recording_status = Column(
        SQLEnum("PENDING", "UPLOADED", "PROCESSED", "FAILED", name="recording_status"),
        nullable=True, default="PENDING"
    )

    # Detailed AI analysis
    ai_summary = Column(Text, nullable=True)
    ai_strengths = Column(JSON, nullable=True)   # ["strength1", ...]
    ai_weaknesses = Column(JSON, nullable=True)   # ["weakness1", ...]
    ai_improvements = Column(JSON, nullable=True) # ["tip1", ...]

    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="interviews")
