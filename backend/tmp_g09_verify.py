import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    db = 'smritisys_g09'
    try:
        conn = await __import__('asyncpg').connect('postgresql://postgres:postgres@localhost:5432/postgres')
        await conn.execute(f'DROP DATABASE IF EXISTS {db}')
        await conn.execute(f'CREATE DATABASE {db}')
        await conn.close()
        print('DB_READY')
    except Exception as e:
        print('DB_SETUP_ERR', type(e).__name__, e)
        raise

    url = f'postgresql+asyncpg://postgres:postgres@localhost:5432/{db}'
    eng = create_async_engine(url)
    try:
        async with eng.begin() as conn:
            await conn.execute(text('SELECT 1'))
        print('ENGINE_OK')
        async with eng.connect() as conn:
            res = await conn.execute(text("SELECT version_num, length(version_num) AS len FROM alembic_version"))
            rows = res.all()
            print('VERSION_ROWS', rows)
    finally:
        await eng.dispose()

asyncio.run(main())
