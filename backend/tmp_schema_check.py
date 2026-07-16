import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"))
        for row in result.fetchall():
            print(row)
    await engine.dispose()

asyncio.run(main())
