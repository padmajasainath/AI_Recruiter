from __future__ import annotations
"""
Pydantic schemas for Application operations.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any
from datetime import datetime
from enum import Enum
from app.schemas.common import JobSummary
from app.schemas.interview import InterviewResponse


class ApplicationStatus(str, Enum):
    APPLIED = "APPLIED"
    SCREENING = "SCREENING"
    SHORTLISTED = "SHORTLISTED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED"
    HIRED = "HIRED"
    REJECTED = "REJECTED"


class ApplicationCreate(BaseModel):
    """Schema for public application submission."""
    candidate_name: str = Field(..., min_length=1, max_length=255)
    candidate_email: EmailStr
    candidate_phone: Optional[str] = None
    candidate_linkedin: Optional[str] = None
    cover_letter: Optional[str] = None




class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    candidate_name: str
    candidate_email: str
    candidate_phone: Optional[str]
    candidate_linkedin: Optional[str]
    cover_letter: Optional[str]
    resume_url: Optional[str]
    resume_filename: Optional[str]
    resume_parsed_data: Optional[dict]
    ai_score: Optional[float]
    ai_reasoning: Optional[str]
    ai_skills_match: Optional[dict]
    ai_experience_match: Optional[dict]
    job: Optional[JobSummary] = None
    interviews: list[InterviewResponse] = []
    status: str
    screened_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    applications: list[ApplicationResponse]
    total: int


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ScreeningResult(BaseModel):
    """Result from AI screening agent."""
    score: float = Field(..., ge=0, le=100)
    reasoning: str
    skills_match: dict  # {"matched": [...], "missing": [...], "extra": [...]}
    experience_match: dict  # {"required_min": 5, "candidate": 7, "match": True}
    parsed_resume: dict  # Full parsed resume data
