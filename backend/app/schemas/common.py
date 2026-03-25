from pydantic import BaseModel
from typing import Optional

class JobSummary(BaseModel):
    """Lightweight job info embedded in application/interview responses."""
    id: str
    job_id: Optional[str] = None
    title: str

    class Config:
        from_attributes = True
