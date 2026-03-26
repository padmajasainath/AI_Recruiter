"""
Pydantic schemas for Company and Auth operations.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    website: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    admin_name: Optional[str] = None
    
    # Mandatory Outlook Integration
    outlook_tenant_id: str = Field(..., min_length=1)
    outlook_client_id: str = Field(..., min_length=1)
    outlook_client_secret: str = Field(..., min_length=1)
    outlook_sender_email: str = Field(..., min_length=1)

    # Mandatory SharePoint Integration
    sharepoint_tenant_id: str = Field(..., min_length=1)
    sharepoint_client_id: str = Field(..., min_length=1)
    sharepoint_client_secret: str = Field(..., min_length=1)
    sharepoint_drive_id: str = Field(..., min_length=1)


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    auto_reply_enabled: Optional[bool] = None
    
    # Outlook Integration
    outlook_tenant_id: Optional[str] = None
    outlook_client_id: Optional[str] = None
    outlook_client_secret: Optional[str] = None
    outlook_sender_email: Optional[str] = None

    # SharePoint Integration
    sharepoint_tenant_id: Optional[str] = None
    sharepoint_client_id: Optional[str] = None
    sharepoint_client_secret: Optional[str] = None
    sharepoint_drive_id: Optional[str] = None


class CompanyResponse(BaseModel):
    id: str
    name: str
    email: str
    website: Optional[str]
    industry: Optional[str]
    logo_url: Optional[str]
    description: Optional[str]
    auto_reply_enabled: bool
    
    # Integration Metadata (Exclude secrets in responses)
    outlook_tenant_id: Optional[str]
    outlook_client_id: Optional[str]
    outlook_sender_email: Optional[str]
    sharepoint_tenant_id: Optional[str]
    sharepoint_client_id: Optional[str]
    sharepoint_drive_id: Optional[str]
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    id: str
    company_id: str
    firebase_uid: str
    email: str
    display_name: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    user: MemberResponse
    company: CompanyResponse


class DashboardStats(BaseModel):
    total_jobs: int = 0
    active_jobs: int = 0
    total_applications: int = 0
    pending_screening: int = 0
    shortlisted: int = 0
    interviews_scheduled: int = 0
    interviews_completed: int = 0
    hired: int = 0
