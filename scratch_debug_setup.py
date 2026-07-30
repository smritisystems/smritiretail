import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import async_session as AsyncSessionLocal


from app.models.system import SystemConfig
from sqlalchemy import select, delete

async def debug_setup():
    async with AsyncSessionLocal() as db_session:
        # Clean setup state
        await db_session.execute(delete(SystemConfig).where(SystemConfig.key.in_(["setup_completed", "setup_state"])))
        await db_session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            setup_payload = {
                "businessInfo": {
                    "name": "Smriti Retail India Pvt Ltd",
                    "tradeName": "Smriti Hypermarket",
                    "businessType": "retail",
                    "gstin": "09AAACS1234A1ZP",
                    "pan": "AAACS1234A",
                    "state": "Uttar Pradesh",
                    "financialYear": "2026-2027",
                    "booksStartDate": "2026-04-01"
                },
                "orgStructure": {
                    "layout": "single",
                    "stores": [
                        {
                            "name": "Gorakhpur Main Branch",
                            "code": "GKP-01",
                            "type": "Company Owned",
                            "address": "Civil Lines",
                            "city": "Gorakhpur",
                            "state": "Uttar Pradesh",
                            "pinCode": "273001",
                            "contactPerson": "Branch Manager",
                            "mobile": "9876543210",
                            "email": "gkp@smritisys.com"
                        }
                    ]
                },
                "operations": {"modules": {"pos": True}},
                "accounting": {"gstType": "regular", "createLedgers": True, "roundOffMode": "auto"},
                "inventory": {"valuation": "FIFO", "negativeStock": "block", "baseUOM": "Pcs"},
                "pos": {"printerWidth": "80mm", "paymentModes": {"Cash": True}},
                "users": {"staff": []}
            }

            res1 = await client.post("/api/v1/company/setup", json=setup_payload)
            print("CALL 1 STATUS:", res1.status_code, res1.text[:200])

            configs = (await db_session.execute(select(SystemConfig))).scalars().all()
            print("CONFIGS IN DB:", {c.key: c.value for c in configs})

            res2 = await client.post("/api/v1/company/setup", json=setup_payload)
            print("CALL 2 STATUS:", res2.status_code, res2.text)

if __name__ == "__main__":
    asyncio.run(debug_setup())
