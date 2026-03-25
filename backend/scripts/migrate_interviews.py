import sqlalchemy
from sqlalchemy import create_engine, text
import sys
import os

# Add parent dir to path to import app.config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import get_settings

def migrate():
    settings = get_settings()
    # Use the internal Docker URL if running from within another container, 
    # but since this script runs on the host (where the agent is), 
    # and localhost:3307 is mapped, it should work.
    engine = create_engine(settings.DATABASE_URL)
    
    columns_to_add = [
        ("interview_token", "VARCHAR(64) UNIQUE"),
        ("token_expires_at", "DATETIME"),
        ("interview_type", "VARCHAR(20) DEFAULT 'AI_VOICE'"),
        ("time_limit_minutes", "INT DEFAULT 30"),
        ("started_at", "DATETIME"),
        ("transcript", "JSON"),
        ("questions_asked", "INT DEFAULT 0"),
        ("ai_summary", "TEXT"),
        ("ai_strengths", "JSON"),
        ("ai_weaknesses", "JSON"),
        ("ai_improvements", "JSON")
    ]
    
    with engine.connect() as conn:
        # Check existing columns
        result = conn.execute(text("DESCRIBE interviews"))
        existing_cols = [row[0] for row in result]
        
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                print(f"Adding column {col_name}...")
                conn.execute(text(f"ALTER TABLE interviews ADD COLUMN {col_name} {col_type}"))
            else:
                print(f"Column {col_name} already exists.")
        
        # Add index for interview_token if not exists
        # (Already handled by UNIQUE if added via ALTER TABLE above, but good to be sure)
        
        conn.commit()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
