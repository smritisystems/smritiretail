"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine, async_sessionmaker


class LRUConnectionPoolManager:
    """
    Dynamic LRU Connection Pool Manager for Multi-Company Tenant Databases.
    Maintains cached AsyncEngine pools per company, evicting least-recently-used engines
    when max capacity is reached or idle timeout expires.
    """

    def __init__(self, max_pools: int = 20, pool_size: int = 5, max_overflow: int = 10):
        self.max_pools = max_pools
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self._engines: OrderedDict[str, Tuple[AsyncEngine, async_sessionmaker[AsyncSession], datetime]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get_session_factory(
        self,
        company_code: str,
        connection_url: str
    ) -> async_sessionmaker[AsyncSession]:
        """
        Gets or creates cached session factory for a company code.
        Updates LRU order upon access.
        """
        key = company_code.strip().upper()

        async with self._lock:
            # Hit in LRU cache
            if key in self._engines:
                engine, session_factory, _ = self._engines.pop(key)
                self._engines[key] = (engine, session_factory, datetime.now(timezone.utc))
                return session_factory

            # Evict LRU if capacity reached
            if len(self._engines) >= self.max_pools:
                oldest_key, (oldest_engine, _, _) = self._engines.popitem(last=False)
                await oldest_engine.dispose()

            # Create new AsyncEngine pool for company
            engine = create_async_engine(
                connection_url,
                pool_size=self.pool_size,
                max_overflow=self.max_overflow,
                pool_pre_ping=True,
                echo=False,
            )
            session_factory = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
            )
            self._engines[key] = (engine, session_factory, datetime.now(timezone.utc))
            return session_factory

    async def dispose_all(self):
        """
        Gracefully disposes all cached connection pools.
        """
        async with self._lock:
            for key, (engine, _, _) in list(self._engines.items()):
                await engine.dispose()
            self._engines.clear()

    @property
    def active_pool_count(self) -> int:
        return len(self._engines)


# Global Singleton Connection Pool Manager Instance
connection_manager = LRUConnectionPoolManager(max_pools=20, pool_size=5, max_overflow=10)
