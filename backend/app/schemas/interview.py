"""
Pydantic schemas for Interview operations.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
from datetime import datetime
import json
from enum import Enum
from app.schemas.common import JobSummary


class InterviewStatus(str, Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class InterviewCreate(BaseModel):
    application_id: str
    interview_type: str = "AI_VOICE"
    time_limit_minutes: int = 30


class ApplicationSummary(BaseModel):
    """Lightweight application info embedded in interview responses."""
    id: str
    candidate_name: str
    candidate_email: str
    job: Optional[JobSummary] = None

    class Config:
        from_attributes = True


class InterviewResponse(BaseModel):
    id: str
    application_id: str
    interview_token: Optional[str]
    token_expires_at: Optional[datetime]
    status: str
    interview_type: str
    time_limit_minutes: int
    started_at: Optional[datetime]
    transcript: Optional[list]
    questions_asked: int
    interview_score: Optional[float]
    interview_feedback: Optional[str]
    interview_topics: Optional[list]
    interview_duration_minutes: Optional[int]
    ai_summary: Optional[str]
    ai_strengths: Optional[list]
    ai_weaknesses: Optional[list]
    ai_improvements: Optional[list]
    completed_at: Optional[datetime]
    application: Optional[ApplicationSummary] = None
    recording_url: Optional[str] = None
    recording_web_url: Optional[str] = None
    recording_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('transcript', 'interview_topics', 'ai_strengths', 'ai_weaknesses', 'ai_improvements', mode='before')
    @classmethod
    def parse_json_string(cls, v: Any) -> list:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        if v is None:
            return []
        return v

    class Config:
        from_attributes = True


class InterviewPublicResponse(BaseModel):
    """Public info for the interview welcome screen (no auth required)."""
    id: str
    status: str
    interview_type: str
    time_limit_minutes: int
    token_expires_at: datetime
    job_title: str
    company_name: str
    candidate_name: str


class InterviewListResponse(BaseModel):
    interviews: list[InterviewResponse]
    total: int


