"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Session Factory & Connection Engine for Secondary Master Database (smriti_master_hub).
"""

import logging
from typing import AsyncGenerator
from urllib.parse import urlparse
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

logger = logging.getLogger(__name__)

def _resolve_master_hub_db_url() -> str:
    """
    Resolves the connection URL for smriti_master_hub database.
    If MASTER_HUB_DATABASE_URL is set in config, use it directly.
    Otherwise, derive it using the host/port/credentials from DATABASE_URL.
    """
    if getattr(settings, "MASTER_HUB_DATABASE_URL", None):
        return settings.MASTER_HUB_DATABASE_URL

    base_url = settings.DATABASE_URL
    parsed = urlparse(base_url)
    user = parsed.username or "postgres"
    password = parsed.password or "postgres"
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432

    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/smriti_master_hub"


_master_hub_url = _resolve_master_hub_db_url()

master_hub_engine: AsyncEngine = create_async_engine(
    _master_hub_url,
    echo=False,
    future=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=600,
)

master_hub_async_session_maker = async_sessionmaker(
    master_hub_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_master_hub_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async session connected to smriti_master_hub.
    """
    async with master_hub_async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
