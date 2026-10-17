import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND (
                table_name LIKE '%purchase%' 
                OR table_name LIKE '%bill%' 
                OR table_name LIKE '%receipt%' 
                OR table_name LIKE '%grn%'
                OR table_name LIKE '%invoice%'
              )
            ORDER BY table_name;
        """))
        print('Tables found:', [r[0] for r in res.fetchall()])

if __name__ == "__main__":
    asyncio.run(check())
