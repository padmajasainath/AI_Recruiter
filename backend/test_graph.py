import asyncio
import httpx
from app.services.sharepoint_service import _get_graph_token, SHAREPOINT_DRIVE_ID
from app.database import SessionLocal
from app.models.candidate import Application

async def main():
    db = SessionLocal()
    # Find the most recent application that might be a docx
    app = db.query(Application).order_by(Application.created_at.desc()).first()
    print("App resume_url (item_id):", app.resume_url)
    
    token = _get_graph_token()
    download_url = f"https://graph.microsoft.com/v1.0/drives/{SHAREPOINT_DRIVE_ID}/items/{app.resume_url}/content"
    print("Download URL:", download_url)

    # Do it manually without following redirects
    async with httpx.AsyncClient(follow_redirects=False) as client:
        req = client.build_request("GET", download_url, headers={"Authorization": f"Bearer {token}"})
        resp = await client.send(req)
        print("Status 1:", resp.status_code)
        print("Headers 1:", resp.headers)
        if resp.status_code == 302:
            real_url = resp.headers['Location']
            print("Redirecting to:", real_url)
            # Now fetch the real URL WITHOUT Authorization header
            resp2 = await client.get(real_url)
            print("Status 2:", resp2.status_code)
            print("Headers 2:", resp2.headers)
            print("Content start:", resp2.content[:200])
        else:
            print("Response:", resp.text[:200])

if __name__ == "__main__":
    asyncio.run(main())
