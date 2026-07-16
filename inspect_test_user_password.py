import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

sys.path.insert(0, os.getcwd())
from backend.app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(text(
            "SELECT username, role, hashed_password, is_active, is_deleted FROM users WHERE username = 'test_user'"
        ))
        row = res.fetchone()
        print(row)
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
