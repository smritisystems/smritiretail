import asyncio
import httpx
from app.main import app

async def test():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = res.json()["access_token"]
        res2 = await client.get("/api/v1/auth/tenants", headers={"Authorization": f"Bearer {token}"})
        print("IN-PROCESS SYSADMIN /api/v1/auth/tenants:")
        import json
        print(json.dumps(res2.json(), indent=2))

        # Test non-SYSADMIN user: usr_cashier
        res_c = await client.post("/api/v1/auth/login", json={"username": "usr_cashier", "password": "Cashier@123"})
        if res_c.status_code == 200:
            token_c = res_c.json()["access_token"]
            res_c2 = await client.get("/api/v1/auth/tenants", headers={"Authorization": f"Bearer {token_c}"})
            print("\nIN-PROCESS CASHIER /api/v1/auth/tenants:")
            print(json.dumps(res_c2.json(), indent=2))

if __name__ == "__main__":
    asyncio.run(test())
