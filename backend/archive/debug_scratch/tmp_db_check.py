import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    print('DATABASE_URL=', settings.DATABASE_URL)
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'"))
        tables = [row[0] for row in result.fetchall()]
        print('tables:', tables)
        if 'users' in tables:
            result = await conn.execute(text('SELECT count(*) FROM users'))
            print('users count:', result.scalar())
        else:
            print('users table missing')
    await engine.dispose()

asyncio.run(main())
