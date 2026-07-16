import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), '..')))
from backend.app.core.config import settings
from backend.app.core.security import hash_password

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with async_session() as session:
        hashed = hash_password('password123')
        await session.execute(text(
            "UPDATE users SET hashed_password = :hashed WHERE username = 'test_user'"
        ), {'hashed': hashed})
        await session.commit()
        print('Updated test_user password to password123')
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
