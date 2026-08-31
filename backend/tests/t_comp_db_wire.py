"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from app.db.session import (
    get_company_async_engine,
    get_company_sessionmaker,
    resolve_company_database_name,
    get_session_by_db_name,
    get_db,
    _company_engines
)
from app.api.deps import TenantContext, get_company_db


@pytest.mark.asyncio
async def test_resolve_company_database_name():
    """Verify company database resolution logic for canonical tenants."""
    assert await resolve_company_database_name("COMP-001") == "smriti001"
    assert await resolve_company_database_name("001") == "smriti001"
    assert await resolve_company_database_name("COMP-002") == "smriti002"
    assert await resolve_company_database_name("COMP-003") == "smriti003"
    with pytest.raises(HTTPException) as exc_info:
        await resolve_company_database_name(None)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_engine_pool_caching():
    """Verify AsyncEngine instances are cached per target database and reused."""
    eng1 = get_company_async_engine("smriti001")
    eng2 = get_company_async_engine("smriti001")
    assert eng1 is eng2, "Expected identical cached AsyncEngine instance for smriti001"
    assert "smriti001" in _company_engines


@pytest.mark.asyncio
async def test_get_company_db_session_execution():
    """Verify get_company_db yields working session connected to smriti001 via TenantContext."""
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")
    async for session in get_company_db(tenant_ctx=tenant_ctx):
        res = await session.execute(text("SELECT current_database();"))
        db_name = res.scalar()
        assert db_name == "smriti001", f"Expected connected database to be smriti001, got {db_name}"


@pytest.mark.asyncio
async def test_get_session_by_db_name():
    """Verify low-level get_session_by_db_name connects directly to requested database."""
    async for session in get_session_by_db_name("smriti001"):
        res = await session.execute(text("SELECT current_database();"))
        db_name = res.scalar()
        assert db_name == "smriti001", f"Expected smriti001, got {db_name}"


@pytest.mark.asyncio
async def test_get_control_db_session_execution():
    """Verify get_db yields working session connected to smritisys (Control Plane)."""
    async for session in get_db():
        res = await session.execute(text("SELECT current_database();"))
        db_name = res.scalar()
        assert db_name == "smritisys", f"Expected connected database to be smritisys, got {db_name}"
