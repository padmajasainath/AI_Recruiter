import asyncio
import httpx
import logging
from typing import Optional
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.services.email_agent import _get_graph_token
from app.models.company import Company
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

async def upload_resume_to_sharepoint(
    company_name: str, 
    job_title: str, 
    filename: str, 
    file_bytes: bytes,
    company: Optional[Company] = None
) -> str:
    """
    Uploads a resume to the SharePoint "Internships_2025" folder and returns a sharing link.
    """
    # Use company-specific credentials or global fallback
    tenant_id = (company.sharepoint_tenant_id if company else None) or settings.OUTLOOK_TENANT_ID
    client_id = (company.sharepoint_client_id if company else None) or settings.OUTLOOK_CLIENT_ID
    client_secret = (company.sharepoint_client_secret if company else None) or settings.OUTLOOK_CLIENT_SECRET
    drive_id = (company.sharepoint_drive_id if company else None) or settings.SHAREPOINT_DRIVE_ID

    if not all([tenant_id, client_id, client_secret, drive_id]):
        logger.warning(f"SharePoint integration not configured for company {company.name if company else 'unknown'}")
        raise Exception("SharePoint integration not configured for this company")

    token = _get_graph_token(tenant_id, client_id, client_secret)
    
    # Sanitize folder names for URL
    safe_company = "".join(c for c in company_name if c.isalnum() or c in " _-")
    safe_job = "".join(c for c in job_title if c.isalnum() or c in " _-")
    safe_file = "".join(c for c in filename if c.isalnum() or c in " _-.")

    # SharePoint URL path relative to the root of the "Documents" library
    # The user requested: /Internships_2025/Cloudmetica Careers AI Agent/{company}/{job_title}/{filename}
    sharepoint_path = f"/Internships_2025/Cloudmetica Careers AI Agent/{safe_company}/{safe_job}/{safe_file}"
    
    upload_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:{sharepoint_path}:/content"

    async with httpx.AsyncClient() as client:
        # 1. Upload the file
        logger.info(f"Uploading resume to SharePoint: {sharepoint_path}")
        upload_resp = await client.put(
            upload_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/pdf"
            },
            content=file_bytes,
            timeout=30.0
        )
        
        if upload_resp.status_code not in (200, 201):
            logger.error(f"Failed to upload to SharePoint. Code: {upload_resp.status_code}, Response: {upload_resp.text}")
            raise HTTPException(status_code=500, detail="Failed to upload resume document")

        item_id = upload_resp.json().get("id")
        return item_id


async def upload_interview_file_to_sharepoint(
    company_name: str, 
    job_title: str, 
    candidate_email: str,
    filename: str, 
    file_bytes: bytes,
    content_type: str = "video/webm",
    company: Optional[Company] = None
) -> str:
    """
    Uploads an interview artifact (recording/transcript) to SharePoint.
    Organized by Company/Job, with candidate-specific prefixes.
    """
    tenant_id = (company.sharepoint_tenant_id if company else None) or settings.OUTLOOK_TENANT_ID
    client_id = (company.sharepoint_client_id if company else None) or settings.OUTLOOK_CLIENT_ID
    client_secret = (company.sharepoint_client_secret if company else None) or settings.OUTLOOK_CLIENT_SECRET
    drive_id = (company.sharepoint_drive_id if company else None) or settings.SHAREPOINT_DRIVE_ID

    if not all([tenant_id, client_id, client_secret, drive_id]):
        raise Exception("SharePoint integration not configured")

    token = _get_graph_token(tenant_id, client_id, client_secret)
    
    safe_company = "".join(c for c in company_name if c.isalnum() or c in " _-")
    safe_job = "".join(c for c in job_title if c.isalnum() or c in " _-")
    safe_email = candidate_email.replace("@", "_").replace(".", "_")
    safe_file = "".join(c for c in filename if c.isalnum() or c in " _-.")

    # Standardized SharePoint path
    sharepoint_path = f"/Internships_2025/Cloudmetica Careers AI Agent/{safe_company}/{safe_job}/{safe_email}_{safe_file}"
    upload_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:{sharepoint_path}:/content"

    async with httpx.AsyncClient() as client:
        logger.info(f"Uploading interview file to SharePoint: {sharepoint_path}")
        try:
            upload_resp = await client.put(
                upload_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": content_type
                },
                content=file_bytes,
                timeout=120.0 # Recording files can be large
            )
            upload_resp.raise_for_status() # Raise an exception for 4xx/5xx responses
        except httpx.HTTPStatusError as e:
            logger.error(f"SharePoint upload failed: {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to upload interview artifact: {e.response.text}")
        except Exception as e:
            logger.error(f"Error uploading to SharePoint: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to upload interview artifact: {str(e)}")

        resp_json = upload_resp.json()
        return resp_json.get("id"), resp_json.get("webUrl")

async def download_resume_from_sharepoint(
    item_id: str, 
    original_filename: str = "resume.pdf",
    company: Optional[Company] = None
) -> StreamingResponse:
    """
    Downloads a resume from SharePoint and streams it to the client.
    """
    # Use company-specific credentials or global fallback
    tenant_id = (company.sharepoint_tenant_id if company else None) or settings.OUTLOOK_TENANT_ID
    client_id = (company.sharepoint_client_id if company else None) or settings.OUTLOOK_CLIENT_ID
    client_secret = (company.sharepoint_client_secret if company else None) or settings.OUTLOOK_CLIENT_SECRET
    drive_id = (company.sharepoint_drive_id if company else None) or settings.SHAREPOINT_DRIVE_ID

    if not all([tenant_id, client_id, client_secret, drive_id]):
        raise Exception("SharePoint integration not configured for this company")

    token = _get_graph_token(tenant_id, client_id, client_secret)
    download_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/content"

    # We use httpx.AsyncClient to stream the response from Microsoft Graph
    # follow_redirects=True is required because /content endpoint returns a 302 Found redirect
    client = httpx.AsyncClient()
    req = client.build_request("GET", download_url, headers={"Authorization": f"Bearer {token}"})
    resp = await client.send(req, stream=True)

    # Manually follow redirect if needed to avoid httpx stream redirect issues
    if resp.status_code in (301, 302, 303, 307, 308):
        redirect_url = resp.headers.get("Location")
        await resp.aclose()
        if not redirect_url:
            raise HTTPException(status_code=500, detail="SharePoint redirect missing Location header")
        
        # Request the pre-authenticated download URL (no Authorization header needed/allowed)
        req2 = client.build_request("GET", redirect_url)
        resp = await client.send(req2, stream=True)

    if resp.status_code != 200:
        await resp.aread()
        await client.aclose()
        logger.error(f"Failed to fetch content from SharePoint. Status: {resp.status_code}, Resp: {resp.text}")
        raise HTTPException(status_code=404, detail="File not found in SharePoint")

    # Extract the true content type if available, fallback to octet-stream
    content_type = resp.headers.get("Content-Type", "application/octet-stream")

    async def _stream_generator():
        try:
            async for chunk in resp.aiter_bytes():
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(_stream_generator(), media_type=content_type, headers={
        "Content-Disposition": f"inline; filename=\"{original_filename}\""
    })
