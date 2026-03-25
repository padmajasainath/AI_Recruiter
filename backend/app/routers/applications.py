"""
Applications router — public application submission + authenticated candidate management.
Triggers AI screening pipeline on submission.
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from datetime import datetime, timedelta
from app.services.firebase_auth import verify_firebase_token
from app.services.sharepoint_service import upload_resume_to_sharepoint, download_resume_from_sharepoint
from app.models.company import Company, CompanyMember
from app.models.job import Job
from app.schemas.job import JobResponse
from app.routers.jobs import _job_to_response
from app.models.candidate import Application
from app.models.interview import Interview
from app.schemas.application import (
    ApplicationResponse, ApplicationListResponse, ApplicationStatusUpdate
)
from app.services.screening_agent import screen_candidate
from app.services.email_agent import send_interview_link_email, send_rejection_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["applications"])


# ──────────────────────────────────────────────
# PUBLIC ENDPOINT — No auth required
# ──────────────────────────────────────────────

@router.get("/api/apply/{link_token}", response_model=JobResponse)
async def get_public_job_details(
    link_token: str,
    db: Session = Depends(get_db),
):
    """
    Public endpoint: Get job details using the shareable link token.
    """
    job = db.query(Job).filter(
        Job.application_link_token == link_token,
        Job.status.in_(["ACTIVE", "PAUSED"]),
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found or no longer accepting applications")
        
    return _job_to_response(job, db)

@router.post("/api/apply/{link_token}", response_model=ApplicationResponse, status_code=201)
async def submit_application(
    link_token: str,
    background_tasks: BackgroundTasks,
    candidate_name: str = Form(...),
    candidate_email: str = Form(...),
    candidate_phone: str = Form(None),
    candidate_linkedin: str = Form(None),
    cover_letter: str = Form(None),
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Public endpoint: Candidates submit their application via the shareable link.
    Triggers the AI screening pipeline in the background.
    """
    # Find the job by link token
    job = db.query(Job).filter(
        Job.application_link_token == link_token,
        Job.status == "ACTIVE",
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found or no longer accepting applications")

    # Validate resume file type
    allowed_types = (".pdf", ".docx")
    if not resume.filename.lower().endswith(allowed_types):
        raise HTTPException(status_code=400, detail=f"Resume must be one of: {', '.join(allowed_types)}")

    # Ensure Company exists to get the actual name for the SharePoint path
    company = db.query(Company).filter(Company.id == job.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Read resume bytes
    resume_bytes = await resume.read()

    # Upload resume to SharePoint
    resume_url = None
    try:
        resume_filename = f"{candidate_email}_{resume.filename}"
        resume_url = await upload_resume_to_sharepoint(
            company_name=company.name,
            job_title=job.title,
            filename=resume_filename,
            file_bytes=resume_bytes,
            company=company
        )
    except Exception as e:
        logger.warning(f"SharePoint Storage upload failed, continuing without: {e}")

    # Create the application record
    application = Application(
        job_id=job.id,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        candidate_linkedin=candidate_linkedin,
        cover_letter=cover_letter,
        resume_url=resume_url,
        resume_filename=resume.filename,
        status="APPLIED",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # Trigger AI screening in the background
    background_tasks.add_task(
        _run_screening_pipeline,
        application_id=application.id,
        job_id=job.id,
        resume_bytes=resume_bytes,
        resume_filename=resume.filename,
    )

    return ApplicationResponse.model_validate(application)


async def _run_screening_pipeline(
    application_id: str,
    job_id: str,
    resume_bytes: bytes,
    resume_filename: str,
):
    """Background task: Run AI screening and optionally send email."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        logger.info(f"Starting screening pipeline for application {application_id}")
        application = db.query(Application).filter(Application.id == application_id).first()
        job = db.query(Job).filter(Job.id == job_id).first()

        if not application or not job:
            logger.error(f"Screening failed: application {application_id} or job {job_id} not found")
            return

        # Run the screening agent
        result = await screen_candidate(application, job, resume_bytes, resume_filename, db)

        # If shortlisted, create AI interview and send link email
        if application.status == "SHORTLISTED":
            try:
                # 1. Create Interview record
                interview = Interview(
                    application_id=application.id,
                    status="PENDING",
                    token_expires_at=datetime.utcnow() + timedelta(hours=72)
                )
                db.add(interview)
                db.commit()
                db.refresh(interview)
                
                logger.info(f"Triggering interview link email for application {application.id} to {application.candidate_email}")
                await send_interview_link_email(application, job, interview.interview_token, db)
                logger.info(f"SUCCESS: AI Interview link email sent to {application.candidate_email}")
            except Exception as e:
                logger.error(f"Failed to create interview or send link email: {e}")
        
        # If rejected, send rejection email
        elif application.status == "REJECTED":
            try:
                await send_rejection_email(application, job, db)
                logger.info(f"Rejection email sent to {application.candidate_email}")
            except Exception as e:
                logger.error(f"Failed to send rejection email: {e}")

    except Exception as e:
        logger.error(f"Screening pipeline error: {e}")
    finally:
        db.close()


# ──────────────────────────────────────────────
# AUTHENTICATED ENDPOINTS — For company recruiters
# ──────────────────────────────────────────────

def _get_member(token: dict, db: Session) -> CompanyMember:
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not registered as a company member")
    return member


@router.get("/api/jobs/{job_id}/applications", response_model=ApplicationListResponse)
async def list_applications(
    job_id: str,
    status_filter: str = None,
    skip: int = 0,
    limit: int = 50,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """List all applications for a specific job (company scoped)."""
    member = _get_member(token, db)

    # Verify job belongs to company
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == member.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    query = db.query(Application).filter(Application.job_id == job_id)
    if status_filter:
        query = query.filter(Application.status == status_filter)

    total = query.count()
    applications = query.order_by(Application.created_at.desc()).offset(skip).limit(limit).all()

    return ApplicationListResponse(
        applications=[ApplicationResponse.model_validate(a) for a in applications],
        total=total,
    )


@router.get("/api/applications/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get detailed application info including AI analysis."""
    member = _get_member(token, db)

    application = db.query(Application).join(Job).filter(
        Application.id == app_id,
        Job.company_id == member.company_id,
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return ApplicationResponse.model_validate(application)


@router.patch("/api/applications/{app_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    app_id: str,
    data: ApplicationStatusUpdate,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Manually update an application's pipeline status."""
    member = _get_member(token, db)

    application = db.query(Application).join(Job).filter(
        Application.id == app_id,
        Job.company_id == member.company_id,
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = data.status.value
    db.commit()
    db.refresh(application)

    return ApplicationResponse.model_validate(application)


@router.get("/api/applications/{app_id}/resume")
async def get_application_resume(
    app_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Securely download a candidate's resume via backend proxy."""
    member = _get_member(token, db)

    application = db.query(Application).join(Job).filter(
        Application.id == app_id,
        Job.company_id == member.company_id,
    ).first()
    
    if not application or not application.resume_url:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Support older URLs 
    if application.resume_url.startswith("http"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(application.resume_url)

    # Proxy download from SharePoint
    return await download_resume_from_sharepoint(
        application.resume_url,
        original_filename=application.resume_filename or "resume.pdf",
        company=application.job.company
    )

