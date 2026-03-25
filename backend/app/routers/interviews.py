"""
Interviews router — manage AI interviews and datagenius integration.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
import logging

logger = logging.getLogger(__name__)

from sqlalchemy.orm import Session, joinedload, contains_eager

from app.database import get_db
from app.services.firebase_auth import verify_firebase_token
from app.models.company import CompanyMember
from app.models.job import Job
from app.models.candidate import Application
from app.models.interview import Interview
from app.schemas.interview import (
    InterviewCreate, InterviewResponse, InterviewListResponse,
    InterviewPublicResponse
)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


def _get_member(token: dict, db: Session) -> CompanyMember:
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not registered as a company member")
    return member


@router.post("", response_model=InterviewResponse, status_code=201)
async def create_interview(
    data: InterviewCreate,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Create a manual interview for an application."""
    member = _get_member(token, db)

    # Verify application belongs to the company
    application = db.query(Application).join(Job).filter(
        Application.id == data.application_id,
        Job.company_id == member.company_id,
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    interview = Interview(
        application_id=data.application_id,
        interview_type=data.interview_type,
        time_limit_minutes=data.time_limit_minutes,
        token_expires_at=datetime.utcnow() + timedelta(hours=72),
        status="PENDING",
    )
    db.add(interview)

    # Update application status
    application.status = "INTERVIEW_SCHEDULED"

    db.commit()
    db.refresh(interview)
    return InterviewResponse.model_validate(interview)


@router.get("", response_model=InterviewListResponse)
async def list_interviews(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    member = _get_member(token, db)
    logger.info(f"Listing interviews for company: {member.company_id}")
    try:
        # Join with Application and Job to filter by company_id and use contains_eager to load
        query = db.query(Interview).join(Interview.application).join(Application.job).filter(
            Job.company_id == member.company_id
        ).options(
            contains_eager(Interview.application).contains_eager(Application.job)
        )

        if status:
            query = query.filter(Interview.status == status)

        total = query.count()
        logger.info(f"Found {total} interviews")
        
        interviews = query.order_by(Interview.created_at.desc()).offset(skip).limit(limit).all()
        logger.info(f"Retrieved {len(interviews)} interviews from DB")

        result = [InterviewResponse.model_validate(i) for i in interviews]
        logger.info(f"Validated {len(result)} interviews against schema")

        return InterviewListResponse(
            interviews=result,
            total=total,
        )
    except Exception as e:
        logger.error(f"Error in list_interviews: {str(e)}", exc_info=True)
        raise e


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get detailed interview info."""
    member = _get_member(token, db)

    interview = db.query(Interview).join(Application).join(Job).filter(
        Interview.id == interview_id,
        Job.company_id == member.company_id,
    ).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    return InterviewResponse.model_validate(interview)


# ──────────────────────────────────────────────
# WEBHOOK — datagenius sends results here
# ──────────────────────────────────────────────

