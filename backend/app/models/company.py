"""
Company and CompanyMember models.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    website = Column(String(500), nullable=True)
    industry = Column(String(100), nullable=True)
    logo_url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    auto_reply_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Microsoft Graph / Outlook Integration
    outlook_tenant_id = Column(String(255), nullable=True)
    outlook_client_id = Column(String(255), nullable=True)
    outlook_client_secret = Column(String(500), nullable=True)
    outlook_sender_email = Column(String(255), nullable=True)

    # Microsoft Graph / SharePoint Integration
    sharepoint_tenant_id = Column(String(255), nullable=True)
    sharepoint_client_id = Column(String(255), nullable=True)
    sharepoint_client_secret = Column(String(500), nullable=True)
    sharepoint_drive_id = Column(String(500), nullable=True)

    # Relationships
    members = relationship("CompanyMember", back_populates="company", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="company", cascade="all, delete-orphan")


class CompanyMember(Base):
    __tablename__ = "company_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    firebase_uid = Column(String(128), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    role = Column(SQLEnum("OWNER", "ADMIN", "RECRUITER", name="member_role"), nullable=False, default="RECRUITER")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="members")
