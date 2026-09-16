import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from backend.app.core.config import settings
from passlib.hash import pbkdf2_sha512

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSession() as session:
        result = await session.execute(text("SELECT id, username, status FROM users WHERE username = 'admin' LIMIT 1"))
        row = result.first()
        print('before:', row)
        hashed = pbkdf2_sha512.hash('nothing')
        await session.execute(text("UPDATE users SET hashed_password = :h, status = 'Active' WHERE username = 'admin'"), {'h': hashed})
        await session.commit()
        result2 = await session.execute(text("SELECT id, username, status FROM users WHERE username = 'admin' LIMIT 1"))
        print('after:', result2.first())
    await engine.dispose()

asyncio.run(main())
