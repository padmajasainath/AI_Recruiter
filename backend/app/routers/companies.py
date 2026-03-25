"""
Company management router — settings, integrations, and profile updates.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.firebase_auth import verify_firebase_token
from app.models.company import Company, CompanyMember
from app.schemas.company import CompanyUpdate, CompanyResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companies", tags=["companies"])


def _get_company(token: dict, db: Session) -> Company:
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not registered as a company member")
    
    company = db.query(Company).filter(Company.id == member.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return company


@router.get("/me", response_model=CompanyResponse)
async def get_my_company(
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get the current user's company settings and integrations."""
    return _get_company(token, db)


@router.patch("/me", response_model=CompanyResponse)
async def update_my_company(
    data: CompanyUpdate,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Update company profile and integration settings."""
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not registered as a company member")
    
    # Only OWNER and ADMIN can update settings
    if member.role not in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only owners and admins can update company settings")

    company = db.query(Company).filter(Company.id == member.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)

    db.commit()
    db.refresh(company)
    
    logger.info(f"Company {company.name} updated settings")
    return company
