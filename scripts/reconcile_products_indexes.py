import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    eng = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    async with eng.connect() as conn:
        res = await conn.execute(text("""
            SELECT i.relname, pg_get_indexdef(i.oid), ix.indisunique
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            WHERE t.relname = 'products'
            ORDER BY i.relname;
        """))
        rows = res.fetchall()
        print(f"Total Physical Indexes on 'products': {len(rows)}")
        for idx, (name, defn, is_unq) in enumerate(rows, 1):
            print(f"  {idx}. {name:<30} | Unique: {is_unq:<5} | {defn}")
    await eng.dispose()

if __name__ == "__main__":
    asyncio.run(check())
