import logging
import httpx
import msal
from typing import Tuple

logger = logging.getLogger(__name__)

async def validate_microsoft_integration(
    tenant_id: str,
    client_id: str,
    client_secret: str,
    sender_email: str,
    drive_id: str
) -> Tuple[bool, str]:
    """
    Validates Microsoft Graph credentials by attempting to acquire a token 
    and checking access to the specified user and drive.
    Returns (success, error_message).
    """
    try:
        # 1. Test Token Acquisition
        app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        
        if "access_token" not in result:
            error = result.get("error_description", "Authentication failed")
            return False, f"Auth Error: {error}"
        
        token = result["access_token"]
        
        async with httpx.AsyncClient() as client:
            # 2. Test User Access (Outlook)
            user_res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{sender_email}",
                headers={"Authorization": f"Bearer {token}"}
            )
            if user_res.status_code != 200:
                return False, f"Outlook Error: Could not access sender email {sender_email}. Ensure the app has 'Mail.Send' and 'User.Read.All' permissions."
            
            # 3. Test Drive Access (SharePoint)
            drive_res = await client.get(
                f"https://graph.microsoft.com/v1.0/drives/{drive_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            if drive_res.status_code != 200:
                return False, f"SharePoint Error: Could not access Drive ID. Ensure the app has 'Files.ReadWrite.All' permissions."

        return True, ""
    except Exception as e:
        logger.error(f"Integration validation failed: {e}")
        return False, f"Unexpected Error: {str(e)}"
