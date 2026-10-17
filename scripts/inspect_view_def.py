import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    eng = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001')
    async with eng.connect() as conn:
        res = await conn.execute(text("""
            SELECT table_type 
            FROM information_schema.tables 
            WHERE table_name = 'report_flat_inventory_sales';
        """))
        ttype = res.scalar()
        print(f"Table Type: {ttype}")
        
        if ttype == 'VIEW':
            vdef = (await conn.execute(text("SELECT pg_get_viewdef('report_flat_inventory_sales'::regclass, true)"))).scalar()
            print("View Definition:\n", vdef)
    await eng.dispose()

if __name__ == '__main__':
    asyncio.run(check())
