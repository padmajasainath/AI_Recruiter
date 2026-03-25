"""
Firebase Authentication service — verifies Firebase ID tokens.
"""
import firebase_admin
import logging
from firebase_admin import credentials, auth, storage
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
security = HTTPBearer()

# Initialize Firebase Admin SDK
_firebase_app = None


def init_firebase():
    global _firebase_app
    if _firebase_app is None:
        try:
            # Prefer bundled credentials from Secret Manager if available
            if settings.FIREBASE_CREDENTIALS:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
            else:
                # Fallback to local file path
                import os
                cred_path = settings.FIREBASE_CREDENTIALS_PATH
                if not os.path.isabs(cred_path):
                    cred_path = os.path.join(os.getcwd(), cred_path)
                cred = credentials.Certificate(cred_path)
                
            _firebase_app = firebase_admin.initialize_app(cred, {
                "storageBucket": settings.FIREBASE_STORAGE_BUCKET
            })
        except ValueError:
            # App already initialized
            try:
                _firebase_app = firebase_admin.get_app()
            except ValueError as e:
                # Firebase app truly doesn't exist, re-raise
                raise e
        except Exception as e:
            # Log but don't crash - Firebase might not be needed for all operations
            import logging
            logging.warning(f"Firebase initialization warning: {e}")
            _firebase_app = None
    return _firebase_app


def get_storage_bucket():
    """Get Firebase Storage bucket."""
    init_firebase()
    return storage.bucket()


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency that verifies a Firebase ID token from the Authorization header.
    Returns the decoded token payload containing uid, email, etc.
    """
    init_firebase()
    token = credentials.credentials

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.ExpiredIdTokenError:
        logger.error(f"AUTH_ERROR: Token has expired for {token[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except auth.InvalidIdTokenError as e:
        logger.error(f"AUTH_ERROR: Invalid ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except Exception as e:
        logger.error(f"AUTH_ERROR: Unexpected error during token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )
