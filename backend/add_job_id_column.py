from sqlalchemy import create_engine, text
import sys

try:
    engine = create_engine('mysql+pymysql://recruiter:recruiter123@localhost:3307/ai_recruiter')
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE jobs ADD COLUMN job_id VARCHAR(20) UNIQUE AFTER company_id;'))
        conn.commit()
    print("Column job_id added successfully.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
