"""
Pydantic schemas for Job operations.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class LocationType(str, Enum):
    REMOTE = "REMOTE"
    HYBRID = "HYBRID"
    ONSITE = "ONSITE"


class JobStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"


class JobCreate(BaseModel):
    job_id: str = Field(..., min_length=1, max_length=255, description="Unique job identifier, e.g., JOB-101")
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)
    skills_required: list[str] = Field(default_factory=list)
    years_of_experience_min: int = Field(default=0, ge=0)
    years_of_experience_max: Optional[int] = None
    expected_salary_min: Optional[int] = None
    expected_salary_max: Optional[int] = None
    salary_currency: Optional[str] = "USD"
    location: Optional[str] = None
    location_type: LocationType = LocationType.REMOTE
    department: Optional[str] = None
    screening_threshold: int = Field(default=70, ge=0, le=100)
    interview_duration_mins: int = Field(default=30, ge=5, le=90)
    interview_link_expiry_hours: int = Field(default=72, ge=1, le=168)
    ai_interview_prompt: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skills_required: Optional[list[str]] = None
    years_of_experience_min: Optional[int] = None
    years_of_experience_max: Optional[int] = None
    expected_salary_min: Optional[int] = None
    expected_salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[LocationType] = None
    department: Optional[str] = None
    screening_threshold: Optional[int] = None
    interview_duration_mins: Optional[int] = None
    interview_link_expiry_hours: Optional[int] = None
    ai_interview_prompt: Optional[str] = None
    status: Optional[JobStatus] = None


class JobResponse(BaseModel):
    id: str
    job_id: str
    company_id: str
    title: str
    description: str
    skills_required: list[str]
    years_of_experience_min: int
    years_of_experience_max: Optional[int]
    expected_salary_min: Optional[int]
    expected_salary_max: Optional[int]
    salary_currency: Optional[str]
    location: Optional[str]
    location_type: str
    department: Optional[str]
    screening_threshold: int
    interview_duration_mins: int
    interview_link_expiry_hours: int
    ai_interview_prompt: Optional[str]
    application_link_token: str
    status: str
    application_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int


class GeneratePromptRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10)
