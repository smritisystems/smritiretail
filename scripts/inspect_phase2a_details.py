import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import json

async def inspect():
    eng = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    async with eng.connect() as conn:
        for tbl in ["sales_invoice_lines"]:
            print(f"\n==================== {tbl} COLUMNS ====================")
            cols = await conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{tbl}' ORDER BY ordinal_position"))
            for c in cols.fetchall():
                print(f"  {c[0]} ({c[1]})")
            print(f"\n==================== {tbl} ROWS ====================")
            rows = await conn.execute(text(f"SELECT * FROM {tbl}"))
            for r in rows.mappings():
                print(dict(r))
    await eng.dispose()

if __name__ == "__main__":
    asyncio.run(inspect())
