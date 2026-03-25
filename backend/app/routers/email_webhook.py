"""
Email & communications router — inbound polling, email threads, manual replies, and settings.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.firebase_auth import verify_firebase_token
from app.models.company import Company, CompanyMember
from app.models.candidate import Application
from app.models.job import Job
from app.models.email_log import EmailLog
from app.services.email_agent import handle_inbound_email, poll_inbox, send_manual_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["email"])


def _get_member(token: dict, db: Session) -> CompanyMember:
    member = db.query(CompanyMember).filter(CompanyMember.firebase_uid == token["uid"]).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not registered as a company member")
    return member


# ──────────────────────────────────────────────
# Email Thread for an Application
# ──────────────────────────────────────────────

@router.get("/api/applications/{app_id}/emails")
async def get_application_emails(
    app_id: str,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Get the full email conversation thread for an application."""
    member = _get_member(token, db)

    # Verify application belongs to company
    application = db.query(Application).join(Job).filter(
        Application.id == app_id,
        Job.company_id == member.company_id,
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    emails = db.query(EmailLog).filter(
        EmailLog.application_id == app_id
    ).order_by(EmailLog.sent_at.asc()).all()

    return {
        "application_id": app_id,
        "candidate_name": application.candidate_name,
        "candidate_email": application.candidate_email,
        "emails": [
            {
                "id": e.id,
                "direction": e.direction,
                "subject": e.subject,
                "body": e.body,
                "from_email": e.from_email,
                "to_email": e.to_email,
                "ai_generated": e.ai_generated,
                "message_id": e.message_id,
                "conversation_id": e.conversation_id,
                "sent_at": e.sent_at.isoformat() if e.sent_at else None,
            }
            for e in emails
        ],
        "total": len(emails),
    }


# ──────────────────────────────────────────────
# Manual Email Send
# ──────────────────────────────────────────────

class ManualEmailRequest(BaseModel):
    subject: Optional[str] = None
    body_html: str
    parent_message_id: Optional[str] = None


@router.post("/api/applications/{app_id}/emails/send")
async def send_application_email(
    app_id: str,
    data: ManualEmailRequest,
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Send a manually composed email to the candidate."""
    member = _get_member(token, db)

    # Verify application belongs to company
    application = db.query(Application).join(Job).filter(
        Application.id == app_id,
        Job.company_id == member.company_id,
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    result = await send_manual_email(
        application_id=app_id,
        subject=data.subject,
        body_html=data.body_html,
        db=db,
        parent_message_id=data.parent_message_id
    )
    return result


# ──────────────────────────────────────────────
# Poll Inbox
# ──────────────────────────────────────────────

@router.post("/api/email/poll")
async def poll_email_inbox(
    token: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
):
    """Poll the Outlook inbox for new candidate replies and process them."""
    _get_member(token, db)  # Auth check
    results = await poll_inbox(db)
    return {"status": "ok", "processed": results, "count": len(results)}


# ──────────────────────────────────────────────
# Inbound Webhook (Legacy/External)
# ──────────────────────────────────────────────

@router.post("/api/webhooks/email/inbound")
async def inbound_email_webhook(
    request_data: dict,
    db: Session = Depends(get_db),
):
    """Webhook for inbound email processing (if using external email service)."""
    from_email = request_data.get("from") or request_data.get("sender", "")
    subject = request_data.get("subject", "")
    body_text = request_data.get("text") or request_data.get("body", "")

    if not from_email:
        return {"status": "ignored", "reason": "missing sender"}

    result = await handle_inbound_email(
        from_email=from_email,
        subject=subject,
        body_text=body_text,
        db=db,
    )
    return {"status": "processed" if result else "no_match"}
