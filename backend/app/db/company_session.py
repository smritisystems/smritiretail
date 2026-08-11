"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Company Database Dynamic Connection & Session Resolver Engine
"""

import asyncio
from typing import AsyncGenerator, Dict, Optional
from urllib.parse import urlparse

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.control_session import control_async_session_maker
from app.models.control.company_registry import DatabaseRegistryStatus
from app.services.control_database_registry import ControlDatabaseRegistryService


class CompanyDatabasePoolManager:
    """
    LRU Engine Pool Manager for Physically Isolated Company Databases.
    Manages bounded AsyncEngine connection pools per active company database,
    preventing connection exhaustion across 10,000+ companies.
    """

    def __init__(self, max_cached_engines: int = 500):
        self._engines: Dict[str, AsyncEngine] = {}
        self._sessionmakers: Dict[str, async_sessionmaker[AsyncSession]] = {}
        self._max_cached_engines = max_cached_engines
        self._lock = asyncio.Lock()

    def _build_connection_url(self, db_host: str, db_port: int, db_name: str, db_user: str, db_pass: Optional[str] = None) -> str:
        """
        Constructs the internal server-side connection string for a Company DB.
        Credentials remain strictly server-side.
        """
        base_url = settings.DATABASE_URL
        parsed = urlparse(base_url)
        
        # Use credentials from base URL if password is not provided in metadata
        user = db_user or parsed.username or "postgres"
        password = db_pass or parsed.password or "postgres"
        host = db_host if db_host and db_host != "localhost" else (parsed.hostname or "localhost")
        port = db_port or parsed.port or 5432
        
        return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"

    async def get_sessionmaker(
        self,
        company_code: str,
        db_host: str,
        db_port: int,
        db_name: str,
        db_user: str,
        db_pass: Optional[str] = None,
    ) -> async_sessionmaker[AsyncSession]:
        """
        Retrieves or creates a bounded async_sessionmaker for the specified company database.
        """
        clean_code = company_code.strip().upper()
        
        if clean_code in self._sessionmakers:
            return self._sessionmakers[clean_code]

        async with self._lock:
            if clean_code in self._sessionmakers:
                return self._sessionmakers[clean_code]

            # Enforce LRU eviction if engine threshold reached
            if len(self._engines) >= self._max_cached_engines:
                oldest_code = next(iter(self._engines))
                oldest_engine = self._engines.pop(oldest_code, None)
                self._sessionmakers.pop(oldest_code, None)
                if oldest_engine:
                    await oldest_engine.dispose()

            target_url = self._build_connection_url(db_host, db_port, db_name, db_user, db_pass)
            
            engine = create_async_engine(
                target_url,
                echo=False,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                pool_recycle=600,
            )
            
            session_factory = async_sessionmaker(
                bind=engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
            )
            
            self._engines[clean_code] = engine
            self._sessionmakers[clean_code] = session_factory
            return session_factory

    async def dispose_all(self):
        """Disposes all active company database engines."""
        async with self._lock:
            for engine in self._engines.values():
                await engine.dispose()
            self._engines.clear()
            self._sessionmakers.clear()

    @classmethod
    async def close_all_pools(cls):
        """Class method helper for disposing singleton pool manager engines."""
        await company_db_pool_manager.dispose_all()

    @staticmethod
    async def get_company_session_by_code(
        company_code: str,
        user_id: Optional[str] = None,
        control_db: Optional[AsyncSession] = None,
    ) -> AsyncSession:
        return await get_company_session_by_code(company_code, user_id, control_db)


# Global Singleton Pool Manager
company_db_pool_manager = CompanyDatabasePoolManager()


async def get_company_session_by_code(
    company_code: str,
    user_id: Optional[str] = None,
    control_db: Optional[AsyncSession] = None,
) -> AsyncSession:
    """
    Server-side Company DB Session Resolver.
    
    Resolution Chain:
    1. Verify user assignment in Control DB (if user_id supplied).
    2. Lookup ControlCompanyDatabase entry in Control DB.
    3. Verify DB status is ACTIVE.
    4. Fetch/create sessionmaker from company_db_pool_manager.
    5. Returns AsyncSession connected to target Company DB.
    """
    clean_code = company_code.strip().upper()

    async def _resolve(c_db: AsyncSession) -> AsyncSession:
        # 1. Authorization Verification (if user_id is provided)
        if user_id:
            has_access = await ControlDatabaseRegistryService.verify_user_company_access(
                c_db, user_id, clean_code
            )
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: User '{user_id}' is not authorized for company '{clean_code}'."
                )

        # 2. Database Metadata Lookup
        db_registry = await ControlDatabaseRegistryService.get_company_database(c_db, clean_code)
        if not db_registry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No database connection registered for company code '{clean_code}'."
            )

        # 3. Database Health & Status Guard
        if db_registry.status in (DatabaseRegistryStatus.SUSPENDED.value, DatabaseRegistryStatus.ARCHIVED.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Company database '{clean_code}' is currently {db_registry.status}."
            )
        elif db_registry.status == DatabaseRegistryStatus.DRIFTED.value:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Company database '{clean_code}' is locked due to schema drift."
            )

        # 4. Resolve Engine & Sessionmaker
        session_factory = await company_db_pool_manager.get_sessionmaker(
            company_code=clean_code,
            db_host=db_registry.db_host,
            db_port=db_registry.db_port,
            db_name=db_registry.db_name,
            db_user=db_registry.db_user,
        )

        return session_factory()

    if control_db:
        return await _resolve(control_db)
    else:
        async with control_async_session_maker() as c_db:
            return await _resolve(c_db)
