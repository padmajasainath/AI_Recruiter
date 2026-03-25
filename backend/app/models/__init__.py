"""
Models package — import all models for Alembic auto-detection.
"""
from app.models.company import Company, CompanyMember
from app.models.job import Job
from app.models.candidate import Application
from app.models.interview import Interview
from app.models.email_log import EmailLog

__all__ = [
    "Company",
    "CompanyMember",
    "Job",
    "Application",
    "Interview",
    "EmailLog",
]
