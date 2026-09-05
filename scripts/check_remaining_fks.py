import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    eng = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    async with eng.connect() as conn:
        res = await conn.execute(text("""
            SELECT tc.table_name, kcu.column_name, tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'products'
        """))
        rows = res.fetchall()
        print(f"Remaining FKs on products: {len(rows)}")
        for r in rows:
            print(f"  * Table: {r[0]} | Column: {r[1]} | Constraint: {r[2]}")
    await eng.dispose()

if __name__ == "__main__":
    asyncio.run(check())
