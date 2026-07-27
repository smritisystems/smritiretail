"""
  Project         : SMRITI Retail OS
  Organization    : SmritiSys
  Author          : Jawahar Ramkripal Mallah
  Email           : support@smritisys.com
  Version         : 3.32.0
  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT id, username, role, company_id, branch_id, email, mobile FROM users ORDER BY username LIMIT 20"
        ))
        rows = result.fetchall()
        for row in rows:
            print(row)
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
