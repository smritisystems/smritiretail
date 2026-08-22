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
import psycopg2
from typing import Dict, Optional, AsyncGenerator
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


def _verify_database_is_registered(db_clean: str) -> bool:
    """
    Authoritative registry check in smritisys.
    Ensures an engine is created ONLY for registered databases in READY status.
    """
    if db_clean in _verified_company_databases:
        return True

    parsed_url = urlparse(settings.DATABASE_URL)
    user = os.getenv("POSTGRES_USER") or parsed_url.username or "postgres"
    password = os.getenv("POSTGRES_PASSWORD") or parsed_url.password or "postgres"
    db_host = os.getenv("POSTGRES_HOST") or parsed_url.hostname or "localhost"
    db_port = int(os.getenv("POSTGRES_PORT") or parsed_url.port or 5432)
    ctrl_url = f"postgresql://{user}:{password}@{db_host}:{db_port}/smritisys"

    try:
        conn = psycopg2.connect(ctrl_url)
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
    except Exception:
        pass
    return False


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
    user = parsed_url.username or "postgres"
    password = parsed_url.password or "postgres"
    db_host = parsed_url.hostname or host or "localhost"
    db_port = parsed_url.port or port or 5432

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


async def resolve_company_database_name(company_id_or_code: Optional[str]) -> str:
    """
    Resolves the target company database name from company_id, company_code, or defaults.
    Queries company_database_registries in smritisys for authoritative routing.
    Fails closed if the company context is missing, unverified, unregistered, or not in READY status.
    """
    if not company_id_or_code or not str(company_id_or_code).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company context is required for database resolution."
        )

    candidate = str(company_id_or_code).strip()

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
            pattern = r"^smriti(?!000)(?!sys)[a-z0-9]{3}$"
            if not re.match(pattern, clean_db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid database name '{clean_db}' resolved. Violates official naming standard."
                )
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
