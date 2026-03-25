import uuid
import secrets
import sys
import os
from datetime import datetime, timedelta

# Add parent dir to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Interview, Application, Job, Company

def create_mock_interview():
    db = SessionLocal()
    try:
        # Find any application
        app = db.query(Application).first()
        if not app:
            print("No application found. Please apply to a job first.")
            return

        # Create Interview
        token = secrets.token_urlsafe(32)
        interview = Interview(
            application_id=app.id,
            interview_token=token,
            token_expires_at=datetime.utcnow() + timedelta(hours=72),
            status="LINK_SENT",
            interview_type="AI_VOICE"
        )
        db.add(interview)
        db.commit()
        db.refresh(interview)
        from app.config import get_settings
        frontend_url = get_settings().FRONTEND_URL
        print(f"MOCK_INTERVIEW_TOKEN={token}")
        print(f"MOCK_INTERVIEW_URL={frontend_url}/interview/{token}")
    finally:
        db.close()

if __name__ == "__main__":
    create_mock_interview()
