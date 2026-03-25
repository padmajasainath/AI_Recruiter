from app.database import SessionLocal
from app.models.interview import Interview
from datetime import timedelta, datetime

db = SessionLocal()
try:
    # Find completed interviews with missing start time
    ivs = db.query(Interview).filter(
        Interview.status == 'COMPLETED',
        (Interview.started_at == None) | (Interview.interview_duration_minutes == None)
    ).all()
    
    count = 0
    for iv in ivs:
        if iv.completed_at:
            # If started_at is missing, set it to 10 mins before completed_at
            if not iv.started_at:
                iv.started_at = iv.completed_at - timedelta(minutes=10)
            
            # Calculate duration
            delta = iv.completed_at - iv.started_at
            iv.interview_duration_minutes = max(1, int(delta.total_seconds() / 60))
            count += 1
            
    db.commit()
    print(f"Successfully backfilled {count} interviews.")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
