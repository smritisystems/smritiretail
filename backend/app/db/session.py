"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 1.0.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from ..core.config import settings

# Create Async SQLAlchemy Engine with connection pool parameters
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800
)

# Create Async Session factory
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Async Generator dependency to provide DB sessions to routes
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
            
async def verify_db_connectivity() -> bool:
    try:
        from sqlalchemy import text
        async with async_session() as session:
            res = await session.execute(text("SELECT 1"))
            return res.scalar() == 1
    except Exception as e:
        print(f"[SDIC Database] Connectivity check failed: {e}")
        return False
