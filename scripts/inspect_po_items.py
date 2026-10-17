import asyncio
import sys
sys.path.insert(0, 'backend')
from app.db.session import engine
from sqlalchemy import text

async def f():
    async with engine.connect() as c:
        res = await c.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'purchase_order_items' 
            ORDER BY ordinal_position
        """))
        for r in res.fetchall():
            print(f"{r[0]}: {r[1]}")

if __name__ == '__main__':
    asyncio.run(f())
