"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.92.3
Created      : 2026-10-19
Modified     : 2026-10-19
Classification: Internal
"""

import asyncio
import httpx
import psycopg2

BASE_URL = "https://tattlythreads.smritisys.com"
DB_URL = "postgresql://postgres:postgres@localhost:2781/smritisys"

def check_local():
    print("=== LOCAL DATABASE attribute_definitions ===")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attribute_definitions';")
    cols = cur.fetchall()
    print("Columns:", [c[0] for c in cols])
    
    cur.execute("SELECT * FROM attribute_definitions;")
    rows = cur.fetchall()
    for r in rows:
        print(" ", r)
    conn.close()

async def check_remote():
    print("\n=== REMOTE API /api/v1/attributes/definitions ===")
    async with httpx.AsyncClient(timeout=30.0) as client:
        login_res = await client.post(f"{BASE_URL}/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = await client.get(f"{BASE_URL}/api/v1/attributes/definitions", headers=headers)
        if res.status_code == 200:
            for item in res.json():
                print(" ", item)
        else:
            print(" Remote error:", res.status_code, res.text)

if __name__ == "__main__":
    check_local()
    asyncio.run(check_remote())
