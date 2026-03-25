import asyncio
import httpx
from app.services.email_agent import _get_graph_token
from app.config import get_settings

settings = get_settings()

async def test_sp():
    try:
        token = _get_graph_token()
        print(f"Token acquired. Length: {len(token)}")
        
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            
            print("1. Testing site access...")
            res = await client.get(
                "https://graph.microsoft.com/v1.0/sites/cloudmetica7.sharepoint.com:/sites/CloudmeticaSharepoint",
                headers=headers
            )
            print("Site Response Code:", res.status_code)
            if res.status_code != 200:
                print("Error Details:", res.text)
                return
                
            site_id = res.json().get('id')
            print("Site ID:", site_id)
            
            print("2. Testing drives/document libraries access...")
            res2 = await client.get(
                f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives",
                headers=headers
            )
            print("Drives Response Code:", res2.status_code)
            if res2.status_code == 200:
                drives = res2.json().get('value', [])
                for d in drives:
                    print(f"Drive Name: {d.get('name')} | Drive ID: {d.get('id')}")
            else:
                print("Drives Error:", res2.text)
                
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    asyncio.run(test_sp())
