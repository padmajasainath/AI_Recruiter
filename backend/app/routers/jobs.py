"""
Jobs router — CRUD for job postings with shareable application links.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.services.firebase_auth import verify_firebase_token
from app.models.company import CompanyMember
from app.models.job import Job
from app.models.candidate import Application
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobListResponse, GeneratePromptRequest
from app.services.job_ai_service import generate_default_interview_prompt

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _get_member(token: dict, db: Session) -> CompanyMember:
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not registered as a company member")
    return member



@router.post("/generate-prompt", response_model=dict)
async def generate_prompt(
    data: GeneratePromptRequest,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """
    Endpoint for recruiters to generate a default AI prompt
    based on the job title and description.
    """
    _get_member(token, db) # Ensure they are a member
    prompt = await generate_default_interview_prompt(data.title, data.description)
    return {"prompt": prompt}


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    data: JobCreate,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Create a new job posting."""
    member = _get_member(token, db)

    job = Job(
        company_id=member.company_id,
        title=data.title,
        description=data.description,
        skills_required=data.skills_required,
        years_of_experience_min=data.years_of_experience_min,
        years_of_experience_max=data.years_of_experience_max,
        expected_salary_min=data.expected_salary_min,
        expected_salary_max=data.expected_salary_max,
        salary_currency=data.salary_currency,
        location=data.location,
        location_type=data.location_type.value,
        department=data.department,
        screening_threshold=data.screening_threshold,
        job_id=data.job_id,
        interview_duration_mins=data.interview_duration_mins,
        interview_link_expiry_hours=data.interview_link_expiry_hours,
        ai_interview_prompt=data.ai_interview_prompt,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return _job_to_response(job, db)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status_filter: str = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """List all job postings for the current company."""
    member = _get_member(token, db)

    query = db.query(Job).filter(Job.company_id == member.company_id)
    if status_filter:
        query = query.filter(Job.status == status_filter)

    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()

    return JobListResponse(
        jobs=[_job_to_response(j, db) for j in jobs],
        total=total,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get a specific job posting."""
    member = _get_member(token, db)
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == member.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job, db)


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    data: JobUpdate,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Update a job posting."""
    member = _get_member(token, db)
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == member.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = data.model_dump(exclude_unset=True)
    
    # Track if interview_duration_mins is being updated to sync existing interviews
    duration_updated = "interview_duration_mins" in update_data
    new_duration = update_data.get("interview_duration_mins")

    for key, value in update_data.items():
        if key == "location_type" and value:
            value = value.value
        setattr(job, key, value)

    # Sync pending interviews if duration changed
    if duration_updated and new_duration is not None:
        from app.models.interview import Interview
        # Fetch application IDs first for reliability
        app_ids = [r[0] for r in db.query(Application.id).filter(Application.job_id == job.id).all()]
        if app_ids:
            db.query(Interview).filter(
                Interview.application_id.in_(app_ids),
                Interview.status == "PENDING"
            ).update({"time_limit_minutes": new_duration}, synchronize_session=False)

    db.commit()
    db.refresh(job)
    return _job_to_response(job, db)


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Delete a job posting."""
    member = _get_member(token, db)
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == member.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    db.delete(job)
    db.commit()


@router.get("/{job_id}/link")
async def get_application_link(
    job_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get the shareable application link for a job."""
    member = _get_member(token, db)
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == member.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get frontend URL from settings
    from app.config import get_settings
    frontend_url = get_settings().FRONTEND_URL

    return {
        "token": job.application_link_token,
        "apply_url": f"{frontend_url}/apply/{job.application_link_token}",
    }


def _job_to_response(job: Job, db: Session) -> JobResponse:
    """Convert a Job model to JobResponse with application count."""
    app_count = db.query(func.count(Application.id)).filter(Application.job_id == job.id).scalar()
    return JobResponse(
        id=job.id,
        job_id=job.job_id or "N/A",
        company_id=job.company_id,
        title=job.title,
        description=job.description,
        skills_required=job.skills_required or [],
        years_of_experience_min=job.years_of_experience_min,
        years_of_experience_max=job.years_of_experience_max,
        expected_salary_min=job.expected_salary_min,
        expected_salary_max=job.expected_salary_max,
        salary_currency=job.salary_currency,
        location=job.location,
        location_type=job.location_type,
        department=job.department,
        screening_threshold=job.screening_threshold,
        interview_duration_mins=job.interview_duration_mins,
        interview_link_expiry_hours=job.interview_link_expiry_hours,
        ai_interview_prompt=job.ai_interview_prompt,
        application_link_token=job.application_link_token,
        status=job.status,
        application_count=app_count,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )
