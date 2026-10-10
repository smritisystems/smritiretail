import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import engine
from sqlalchemy import text

async def alter():
    async with engine.connect() as conn:
        await conn.execute(text("ALTER TABLE IF EXISTS purchase_bills ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE IF EXISTS purchase_bills ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE IF EXISTS purchase_bills ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100);"))
        await conn.commit()
        print('Altered purchase_bills successfully!')

if __name__ == "__main__":
    asyncio.run(alter())
