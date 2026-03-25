import sys
import os

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal, engine, Base
from app.models.company import Company, CompanyMember
from app.models.job import Job
from app.models.candidate import Application
from app.models.interview import Interview
from app.models.email_log import EmailLog
from sqlalchemy import text, create_mock_engine, create_engine

def cleanup_database():
    print("⚠️  WARNING: This will delete ALL data from the AI Recruiter database!")
    
    # Try to get URL from env first to bypass config loading issues
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        try:
            from app.config import get_settings
            db_url = get_settings().DATABASE_URL
        except Exception as e:
            print(f"Could not load settings: {e}")
            print("Please set DATABASE_URL environment variable.")
            return

    confirm = input("Are you sure? (y/N): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return

    engine = create_engine(db_url)
    try:
        connection = engine.connect()
        # We use truncate to be efficient, but handle dependencies by order or CASCADE
        # Tables with least dependencies first
        tables = [
            "email_logs",
            "interviews",
            "applications",
            "jobs",
            "company_members",
            "companies"
        ]

        print("Cleaning up tables...")
        # Disable foreign key checks for truncate (works for MySQL)
        connection.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        for table in tables:
            print(f" - Truncating {table}")
            connection.execute(text(f"TRUNCATE TABLE {table};"))
        connection.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        
        connection.commit()
        print("✅ Database cleanup complete.")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    cleanup_database()
