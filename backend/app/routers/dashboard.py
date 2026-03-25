"""
Dashboard router — aggregated stats for the company dashboard.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.services.firebase_auth import verify_firebase_token
from app.models.company import CompanyMember
from app.models.job import Job
from app.models.candidate import Application
from app.schemas.company import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get aggregated dashboard statistics for the company."""
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        return DashboardStats()

    company_id = member.company_id

    # Job stats
    total_jobs = db.query(func.count(Job.id)).filter(Job.company_id == company_id).scalar()
    active_jobs = db.query(func.count(Job.id)).filter(
        Job.company_id == company_id, Job.status == "ACTIVE"
    ).scalar()

    # Application stats (across all company jobs)
    company_job_ids = db.query(Job.id).filter(Job.company_id == company_id).subquery()

    total_apps = db.query(func.count(Application.id)).filter(
        Application.job_id.in_(company_job_ids)
    ).scalar()

    def _count_by_status(*statuses):
        return db.query(func.count(Application.id)).filter(
            Application.job_id.in_(company_job_ids),
            Application.status.in_(statuses),
        ).scalar()

    return DashboardStats(
        total_jobs=total_jobs or 0,
        active_jobs=active_jobs or 0,
        total_applications=total_apps or 0,
        pending_screening=_count_by_status("APPLIED", "SCREENING"),
        shortlisted=_count_by_status("SHORTLISTED"),
        interviews_scheduled=_count_by_status("INTERVIEW_SCHEDULED"),
        interviews_completed=_count_by_status("INTERVIEW_COMPLETED"),
        hired=_count_by_status("HIRED"),
    )
