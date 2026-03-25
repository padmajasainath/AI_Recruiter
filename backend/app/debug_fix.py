
import sys
import os
import logging
import asyncio

# Add /app to path
sys.path.append("/app")

from app.database import SessionLocal
from app.routers.interviews import list_interviews
from unittest.mock import MagicMock

# Set up logging to stdout
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug")

async def debug():
    db = SessionLocal()
    # Mock token
    mock_token = {"uid": "16UmEAu1LlTkIWzdm4lgNFDEhVI2"}
    
    try:
        print("Calling list_interviews...")
        # Note: Added skip, limit, status, token, db
        result = await list_interviews(skip=0, limit=100, status=None, token=mock_token, db=db)
        print(f"SUCCESS! Found {len(result.interviews)} interviews.")
    except Exception as e:
        print(f"FAILURE: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(debug())
