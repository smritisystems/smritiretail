"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control Database Session & Connection Governance Engine
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings


def get_control_database_url() -> str:
    """
    Resolves the canonical Control Database connection URL.
    Consumes CONTROL_DATABASE_URL environment variable if set;
    falls back to DATABASE_URL for unified development environments.
    """
    if settings.CONTROL_DATABASE_URL and settings.CONTROL_DATABASE_URL.strip():
        return settings.CONTROL_DATABASE_URL.strip()
    return settings.DATABASE_URL


# Dedicated AsyncEngine for Control DB (Decoupled from Company DB pools)
control_engine = create_async_engine(
    get_control_database_url(),
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=600,
)

# Dedicated AsyncSession sessionmaker for Control DB
control_async_session_maker = async_sessionmaker(
    bind=control_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_control_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Dependency yielding an AsyncSession connected to the Control Database.
    Ensures strict lifecycle cleanup and session isolation.
    """
    async with control_async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
