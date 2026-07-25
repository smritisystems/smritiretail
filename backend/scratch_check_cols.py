import asyncio
import sqlalchemy as sa
from app.db.session import engine

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(sa.text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sales_invoice_items'"))
        print("invoice_items:", res.fetchall())
        res2 = await conn.execute(sa.text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sales_return_items'"))
        print("return_items:", res2.fetchall())
        res3 = await conn.execute(sa.text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sales_returns'"))
        print("returns:", res3.fetchall())

if __name__ == "__main__":
    asyncio.run(check())
