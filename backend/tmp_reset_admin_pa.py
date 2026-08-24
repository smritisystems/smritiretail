import asyncio
import hashlib
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from backend.app.core.config import settings


def hash_legacy(password: str) -> str:
    salt = os.urandom(16).hex()
    iterations = 25000
    dk = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), iterations, dklen=64)
    return f"pbkdf2$sha512${iterations}${salt}${dk.hex()}"

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSession() as session:
        result = await session.execute(text("SELECT id, username, status FROM users WHERE username = 'admin' LIMIT 1"))
        row = result.first()
        print('before:', row)
        hashed = hash_legacy('nothing')
        await session.execute(text("UPDATE users SET hashed_password = :h, status = 'Active' WHERE username = 'admin'"), {'h': hashed})
        await session.commit()
        result2 = await session.execute(text("SELECT id, username, status, hashed_password FROM users WHERE username = 'admin' LIMIT 1"))
        row2 = result2.first()
        print('after:', row2[0], row2[1], row2[2])
        print('hash prefix:', row2.hashed_password[:50])
    await engine.dispose()

asyncio.run(main())
