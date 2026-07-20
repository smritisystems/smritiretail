"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_flags_endpoint():
    """Verifies GET /api/v1/health/flags contract endpoints dictionary."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health/flags")
        assert res.status_code == 200
        data = res.json()
        assert "flags" in data
        assert "USE_FASTAPI_SALES" in data["flags"]
        assert "USE_FASTAPI_PURCHASE" in data["flags"]
        assert "USE_FASTAPI_POS" in data["flags"]


@pytest.mark.asyncio
async def test_strangler_fig_cutover_endpoint():
    """Verifies GET /api/v1/health/cutover response schema and migration completion percentage."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health/cutover")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["system_of_record"] == "FastAPI + Postgres"
        assert data["express_status"] == "FEATURE_FREEZE"
        assert data["migration_progress_percent"] == 100.0
        assert data["domains"]["SALES"] == "STRANGLER_FIG_MIGRATED"
        assert data["domains"]["PURCHASE"] == "STRANGLER_FIG_MIGRATED"
        assert data["domains"]["POS"] == "STRANGLER_FIG_MIGRATED"
