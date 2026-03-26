"""
Auth router — company registration and login via Firebase.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.firebase_auth import verify_firebase_token
from app.models.company import Company, CompanyMember
from app.schemas.company import CompanyCreate, CompanyResponse, MemberResponse, AuthResponse
from app.services.integration_validator import validate_microsoft_integration

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register_company(
    data: CompanyCreate,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Register a new company and assign the current user as OWNER."""
    firebase_uid = token["uid"]
    firebase_email = token.get("email", data.email)

    # Check if user already belongs to a company
    existing = db.query(CompanyMember).filter(CompanyMember.firebase_uid == firebase_uid).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already belongs to a company")

    # Check if company email is taken
    existing_company = db.query(Company).filter(Company.email == data.email).first()
    if existing_company:
        raise HTTPException(status_code=400, detail="A company with this email already exists")

    # Perform live validation of integrations
    success, error_msg = await validate_microsoft_integration(
        tenant_id=data.outlook_tenant_id,
        client_id=data.outlook_client_id,
        client_secret=data.outlook_client_secret,
        sender_email=data.outlook_sender_email,
        drive_id=data.sharepoint_drive_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Microsoft Integration Failure: {error_msg}"
        )

    # Create company
    company = Company(
        name=data.name,
        email=data.email,
        website=data.website,
        industry=data.industry,
        description=data.description,
        # Save integration details
        outlook_tenant_id=data.outlook_tenant_id,
        outlook_client_id=data.outlook_client_id,
        outlook_client_secret=data.outlook_client_secret,
        outlook_sender_email=data.outlook_sender_email,
        sharepoint_tenant_id=data.sharepoint_tenant_id,
        sharepoint_client_id=data.sharepoint_client_id,
        sharepoint_client_secret=data.sharepoint_client_secret,
        sharepoint_drive_id=data.sharepoint_drive_id,
    )
    db.add(company)
    db.flush()

    # Create owner member
    member = CompanyMember(
        company_id=company.id,
        firebase_uid=firebase_uid,
        email=firebase_email,
        display_name=data.admin_name or token.get("name"),
        role="OWNER",
    )
    db.add(member)
    db.commit()
    db.refresh(company)
    db.refresh(member)

    return AuthResponse(
        user=MemberResponse.model_validate(member),
        company=CompanyResponse.model_validate(company),
    )


@router.get("/me", response_model=AuthResponse)
async def get_current_user(
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get the current authenticated user and their company."""
    firebase_uid = token["uid"]

    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == firebase_uid).first()
    if not member:
        raise HTTPException(status_code=404, detail="User not found. Please register your company first.")

    company = db.query(Company).filter(Company.id == member.company_id).first()

    return AuthResponse(
        user=MemberResponse.model_validate(member),
        company=CompanyResponse.model_validate(company),
    )
