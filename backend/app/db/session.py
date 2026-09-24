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

* Version    : 3.25.0
* Created    : 2026-07-11
* Modified   : 2026-08-20
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Classification: Internal
"""

import os
import re
import time
import asyncio
import psycopg2
from typing import Dict, Optional, AsyncGenerator, Tuple
from urllib.parse import urlparse
from fastapi import Request, Header, HTTPException, status
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncEngine
from sqlalchemy import text
from ..core.config import settings

import sys
import os
from sqlalchemy.pool import NullPool

def _is_testing() -> bool:
    return "pytest" in sys.modules or os.getenv("TESTING") == "1"

# ---------------------------------------------------------------------------
# Control Plane Engine & Session Factory (smritisys)
# ---------------------------------------------------------------------------
_ctrl_engine_kwargs = {"echo": False, "pool_pre_ping": True}
if _is_testing():
    _ctrl_engine_kwargs["poolclass"] = NullPool
else:
    _ctrl_engine_kwargs.update({"pool_size": 10, "max_overflow": 20, "pool_recycle": 1800})

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    **_ctrl_engine_kwargs
)

async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# ---------------------------------------------------------------------------
# Dynamic Multi-Company Engine & Session Pool Cache
# ---------------------------------------------------------------------------
_company_engines: Dict[str, AsyncEngine] = {}
_company_sessionmakers: Dict[str, async_sessionmaker] = {}
_verified_company_databases = {"smritisys"}

# Seed default control plane engine into pool
_company_engines["smritisys"] = engine
_company_sessionmakers["smritisys"] = async_session


def _blocking_pg_registry_check(ctrl_url: str, db_clean: str) -> bool:
    """
    Pure synchronous helper — performs a single psycopg2 query to verify
    that db_clean is registered as READY in the smritisys control plane.
    Must be called via ThreadPoolExecutor when inside an async context.
    """
    try:
        conn = psycopg2.connect(ctrl_url, connect_timeout=3)
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM company_database_registries WHERE LOWER(database_name) = %s AND status = 'READY';",
            (db_clean,)
        )
        row = cur.fetchone()
        conn.close()
        if row:
            _verified_company_databases.add(db_clean)
            return True
    except Exception as exc:
        print(f"[SDIC Registry] Notice: Registry verification check for '{db_clean}' via '{ctrl_url}': {exc}")
    return False


def _verify_database_is_registered(db_clean: str) -> bool:
    """
    Authoritative registry check in smritisys.
    Ensures an engine is created ONLY for registered databases in READY status.

    Fast path: in-memory set (zero I/O cost on cache hit).
    Slow path: delegates the blocking psycopg2 call to a ThreadPoolExecutor
               so the asyncio event loop is never starved during first-resolution
               of a new company database.
    """
    if db_clean in _verified_company_databases:
        return True

    parsed_url = urlparse(settings.DATABASE_URL)
    user = parsed_url.username or os.getenv("POSTGRES_USER")
    password = parsed_url.password or os.getenv("POSTGRES_PASSWORD")
    db_host = parsed_url.hostname or os.getenv("POSTGRES_HOST") or "localhost"
    db_port = parsed_url.port or 5432

    if not user or not password:
        raise ValueError(
            "POSTGRES_USER and POSTGRES_PASSWORD must be configured explicitly for the current environment."
        )

    ctrl_url = f"postgresql://{user}:{password}@{db_host}:{db_port}/smritisys"

    import concurrent.futures

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Inside an async context — submit to thread pool to avoid blocking the loop.
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(_blocking_pg_registry_check, ctrl_url, db_clean)
                return future.result(timeout=5)
        else:
            # Sync context (startup, CLI, testing) — call directly.
            return _blocking_pg_registry_check(ctrl_url, db_clean)
    except Exception:
        return False


def validate_company_database_name(database_name: str) -> bool:
    """Return True only for registered company database name shapes."""
    if not database_name:
        return False
    clean_name = str(database_name).strip().lower()
    if clean_name == "smritisys":
        return False
    return bool(re.fullmatch(r"smriti(?!000$|sys$)[a-z0-9]{3,12}", clean_name))


def get_company_async_engine(database_name: str, host: str = "localhost", port: int = 5432) -> AsyncEngine:
    """
    Retrieves or creates a cached AsyncEngine for a specific company database.
    Prevents connection pool proliferation and resource exhaustion.
    Rejects arbitrary or unregistered database names by validating against smritisys registry.
    """
    db_clean = str(database_name).strip().lower()
    if not db_clean:
        raise ValueError("Database name is required.")

    if db_clean in _company_engines:
        return _company_engines[db_clean]

    if db_clean != "smritisys":
        pattern = r"^smriti(?!000)(?!sys)[a-z0-9]{3}$"
        if not re.match(pattern, db_clean):
            raise ValueError(f"Invalid or unauthorized company database name: '{database_name}'")
        if not _verify_database_is_registered(db_clean):
            raise ValueError(f"Database '{database_name}' is not registered or not in READY status in Control Plane.")

    parsed_url = urlparse(settings.DATABASE_URL)
    user = parsed_url.username
    password = parsed_url.password
    db_host = parsed_url.hostname or host or "localhost"
    db_port = parsed_url.port or port or 5432

    if not user or not password:
        raise ValueError(
            "DATABASE_URL must include explicit database credentials for company routing in this environment."
        )

    # Authoritative postgresql+asyncpg driver string
    company_db_url = f"postgresql+asyncpg://{user}:{password}@{db_host}:{db_port}/{db_clean}"

    _comp_engine_kwargs = {"echo": False, "pool_pre_ping": True}
    if _is_testing():
        _comp_engine_kwargs["poolclass"] = NullPool
    else:
        _comp_engine_kwargs.update({"pool_size": 5, "max_overflow": 10, "pool_recycle": 1800})

    company_eng = create_async_engine(
        company_db_url,
        **_comp_engine_kwargs
    )

    _company_engines[db_clean] = company_eng
    _company_sessionmakers[db_clean] = async_sessionmaker(
        bind=company_eng,
        class_=AsyncSession,
        expire_on_commit=False
    )
    return company_eng


def get_company_sessionmaker(database_name: str) -> async_sessionmaker:
    """
    Retrieves the async sessionmaker factory for a target company database.
    """
    db_clean = str(database_name).strip().lower()
    if db_clean not in _company_sessionmakers:
        get_company_async_engine(db_clean)
    return _company_sessionmakers[db_clean]


_company_database_name_cache: Dict[str, Tuple[str, float]] = {}
ROUTING_CACHE_TTL_SECONDS: int = 300  # 5-minute deterministic TTL


def invalidate_company_database_cache(company_id_or_code: Optional[str] = None) -> int:
    """
    Explicitly invalidates the tenant routing cache.
    If company_id_or_code is provided, clears that tenant only.
    Otherwise, flushes the entire routing cache. Returns count of invalidated keys.
    """
    global _company_database_name_cache
    if company_id_or_code:
        cid = str(company_id_or_code).strip()
        removed = 0
        if cid in _company_database_name_cache:
            del _company_database_name_cache[cid]
            removed += 1
        comp_code = f"COMP-{cid}" if len(cid) == 3 and cid.isalnum() else cid
        if comp_code in _company_database_name_cache:
            del _company_database_name_cache[comp_code]
            removed += 1
        return removed
    else:
        count = len(_company_database_name_cache)
        _company_database_name_cache.clear()
        return count


async def resolve_company_database_name(company_id_or_code: Optional[str]) -> str:
    """
    Resolves the target company database name from company_id, company_code, or defaults.
    Queries company_database_registries in smritisys for authoritative routing with deterministic TTL caching.
    Fails closed if the company context is missing, unverified, unregistered, or not in READY status.
    """
    if not company_id_or_code or not str(company_id_or_code).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company context is required for database resolution."
        )

    candidate = str(company_id_or_code).strip()
    now = time.time()

    # Fast in-memory cache hit with TTL expiration check
    if candidate in _company_database_name_cache:
        db_name, cached_at = _company_database_name_cache[candidate]
        if (now - cached_at) < ROUTING_CACHE_TTL_SECONDS:
            return db_name

    # Query authoritative registry in smritisys
    async with async_session() as ctrl_session:
        stmt = text("""
            SELECT database_name, status
            FROM company_database_registries
            WHERE company_id = :cid OR database_id = :cid OR company_id = :comp_code
            LIMIT 1;
        """)
        res = await ctrl_session.execute(stmt, {
            "cid": candidate,
            "comp_code": f"COMP-{candidate}" if len(candidate) == 3 and candidate.isalnum() else candidate
        })
        row = res.fetchone()
        if row:
            db_name, db_status = row
            if db_status != "READY":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Company Database for '{candidate}' is in status '{db_status}'. Access denied."
                )
            clean_db = str(db_name).strip().lower()
            if not validate_company_database_name(clean_db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid database name '{clean_db}' resolved. Violates official naming standard."
                )
            _company_database_name_cache[candidate] = (clean_db, now)
            return clean_db

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Company Database registry entry for '{candidate}' not found. Access denied."
    )


# ---------------------------------------------------------------------------
# FastAPI Dependency: get_db (Control Plane Session — smritisys)
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides an AsyncSession to the SMRITI Control Plane database (smritisys).
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Low-Level Session Generator by Database Name
# ---------------------------------------------------------------------------
async def get_session_by_db_name(database_name: str) -> AsyncGenerator[AsyncSession, None]:
    """
    Low-level async session generator for a specified database name.
    """
    session_factory = get_company_sessionmaker(database_name)
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def verify_db_connectivity() -> bool:
    """
    Verifies connectivity to the primary SMRITI Control Plane database.
    """
    try:
        async with async_session() as session:
            res = await session.execute(text("SELECT 1"))
            return res.scalar() == 1
    except Exception as e:
        print(f"[SDIC Database] Connectivity check failed: {e}")
        return False


async def verify_tenant_connectivity(database_name: str = "smriti001") -> bool:
    """
    Verifies connectivity to a target tenant operational database (defaults to smriti001).
    Distinguishes control plane health from operational tenant data readiness.
    """
    try:
        session_factory = get_company_sessionmaker(database_name)
        async with session_factory() as session:
            res = await session.execute(text("SELECT 1"))
            return res.scalar() == 1
    except Exception as e:
        print(f"[SDIC Tenant Database] Connectivity check failed for '{database_name}': {e}")
        return False
