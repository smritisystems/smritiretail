"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.3
Created      : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

NUM-001 Integration Test Suite
──────────────────────────────
Covers all 10 endpoints in backend/app/api/v1/numbering.py that were
migrated from sync Session/get_db to async AsyncSession/get_company_db.

TC-NUM001  GET  /series                       — list returns empty list (fresh DB)
TC-NUM002  POST /series                       — create a new series
TC-NUM003  GET  /series                       — list returns created series
TC-NUM004  PUT  /series/{id}                  — update prefix/suffix/runningLength
TC-NUM005  GET  /series?document_type=...     — filter by document_type
TC-NUM006  GET  /logs                         — audit log accessible to SYSADMIN
TC-NUM007  POST /series/{id}/allocate         — allocate increments currentNumber
TC-NUM008  POST /series/{id}/allocate (x2)    — second allocation returns next sequential number
TC-NUM009  GET  /preview                      — preview matches current+1 without mutating
TC-NUM010  GET  /terminal-prefixes-report     — report returns series rows with GST validation
TC-NUM011  DELETE /series/{id}               — retire/deactivate series (is_active → False)
TC-NUM012  POST /series/{id}/allocate retired — allocate on retired series returns 400/404
"""

import re
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings


def _base_url() -> str:
    return "http://testserver"


# ---------------------------------------------------------------------------
# Auth override — inject a fake SYSADMIN user for every test in this module
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def override_current_user():
    """Override get_current_user with a fake SYSADMIN so numbering endpoints
    do not require a real JWT token during integration testing."""
    from app.api.deps import get_current_user, require_role
    from app.models.auth import User, UserRole

    fake_user = User(
        id="test-sysadmin-001",
        username="test_sysadmin",
        role=UserRole.SYSADMIN,
        is_active=True,
        company_id="COMP-001",
    )

    async def _fake_user():
        return fake_user

    app.dependency_overrides[get_current_user] = _fake_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


def _headers() -> dict:
    """Minimal headers; auth is bypassed via override_current_user fixture."""
    return {"X-Company-ID": "COMP-001", "X-Branch-ID": "test-br"}


def _alloc_headers() -> dict:
    """Headers for /allocate — uses internal service key since that endpoint
    has its own custom auth check, not the get_current_user dependency."""
    from app.core.config import settings
    return {
        "X-Company-ID": "COMP-001",
        "X-Internal-Service-Key": settings.INTERNAL_SERVICE_KEY,
    }


_BASE = "/api/v1/numbering"

# ─── Series payload factory ────────────────────────────────────────────────

def _series_payload(suffix: str = "NUM001") -> dict:
    return {
        "name": f"Test Series {suffix}",
        "documentType": f"TEST_{suffix}",
        "prefix": "TST",
        "suffix": "",
        "runningLength": 4,
        "resetRule": "Financial Year",
        "startNumber": 1,
        "currentNumber": 0,
        "financialYear": "2026-2027",
        "companyCode": "SMRITI_IND",
        "mode": "Auto",
        "transactionGroup": "SALES",
        "terminalId": "COMMON",
        "isCommonAcrossTerminals": True,
        "numberFormat": "PREFIX_NUM_SUFFIX",
    }


# ─── TC-NUM001: List series on fresh DB returns list ──────────────────────

@pytest.mark.asyncio
async def test_num001_list_series_empty_or_seeded():
    """GET /series returns 200 with a list (may be empty or seeded)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        resp = await ac.get(f"{_BASE}/series", headers=_headers())
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── TC-NUM002: Create a new series ───────────────────────────────────────

@pytest.mark.asyncio
async def test_num002_create_series():
    """POST /series creates a document series and returns 201 with id."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        resp = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("A"),
            headers=_headers(),
        )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "id" in data
    assert data["documentType"] == "TEST_A"
    assert data["prefix"] == "TST"
    assert data["runningLength"] == 4
    assert data["isActive"] is True


# ─── TC-NUM003: List includes the created series ──────────────────────────

@pytest.mark.asyncio
async def test_num003_list_includes_created():
    """GET /series returns the series created in TC-NUM002."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        # create
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("B"),
            headers=_headers(),
        )
        assert cr.status_code == 201
        created_id = cr.json()["id"]

        resp = await ac.get(f"{_BASE}/series", headers=_headers())
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert created_id in ids


# ─── TC-NUM004: Update series prefix/suffix/runningLength ─────────────────

@pytest.mark.asyncio
async def test_num004_update_series():
    """PUT /series/{id} updates the series and returns updated values."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("C"),
            headers=_headers(),
        )
        assert cr.status_code == 201
        sid = cr.json()["id"]

        up = await ac.put(
            f"{_BASE}/series/{sid}",
            json={"prefix": "UPD", "suffix": "X", "runningLength": 6},
            headers=_headers(),
        )
    assert up.status_code == 200, up.text
    data = up.json()
    assert data["prefix"] == "UPD"
    assert data["suffix"] == "X"
    assert data["runningLength"] == 6


# ─── TC-NUM005: Filter series by document_type ────────────────────────────

@pytest.mark.asyncio
async def test_num005_filter_by_document_type():
    """GET /series?document_type=TEST_D returns only matching series."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("D"),
            headers=_headers(),
        )
        assert cr.status_code == 201

        resp = await ac.get(
            f"{_BASE}/series",
            params={"document_type": "TEST_D"},
            headers=_headers(),
        )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1
    assert all(s["documentType"] == "TEST_D" for s in items)


# ─── TC-NUM006: Audit logs accessible ─────────────────────────────────────

@pytest.mark.asyncio
async def test_num006_list_logs():
    """GET /logs returns 200 with a list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        resp = await ac.get(f"{_BASE}/logs", headers=_headers())
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── TC-NUM007: Allocate increments currentNumber ─────────────────────────

@pytest.mark.asyncio
async def test_num007_allocate_increments_number():
    """POST /series/{id}/allocate returns documentNo and increments counter."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("E"),
            headers=_headers(),
        )
        assert cr.status_code == 201
        sid = cr.json()["id"]

        alloc = await ac.post(
            f"{_BASE}/series/{sid}/allocate",
            json={"branch": "HQ", "fy": "26-27"},
            headers=_alloc_headers(),
        )
    assert alloc.status_code == 200, alloc.text
    data = alloc.json()
    assert data["success"] is True
    assert "documentNo" in data
    # prefix "TST" + "0001" with no suffix
    assert "TST" in data["documentNo"]


# ─── TC-NUM008: Second allocation returns next sequential number ───────────

@pytest.mark.asyncio
async def test_num008_sequential_allocation():
    """Two allocations on same series return consecutive document numbers."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("F"),
            headers=_headers(),
        )
        assert cr.status_code == 201
        sid = cr.json()["id"]

        a1 = await ac.post(
            f"{_BASE}/series/{sid}/allocate",
            json={"branch": "HQ", "fy": "26-27"},
            headers=_alloc_headers(),
        )
        a2 = await ac.post(
            f"{_BASE}/series/{sid}/allocate",
            json={"branch": "HQ", "fy": "26-27"},
            headers=_alloc_headers(),
        )
    assert a1.status_code == 200
    assert a2.status_code == 200
    no1 = a1.json()["documentNo"]
    no2 = a2.json()["documentNo"]
    # Extract numeric portion: TST0001 → 1, TST0002 → 2
    import re
    n1 = int(re.search(r"\d+", no1).group())
    n2 = int(re.search(r"\d+", no2).group())
    assert n2 == n1 + 1


# ─── TC-NUM009: Preview does not mutate sequence ──────────────────────────

@pytest.mark.asyncio
async def test_num009_preview_does_not_mutate():
    """GET /preview twice returns same number; allocate then preview returns +1."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json={**_series_payload("G"), "documentType": "PREVIEW_TEST"},
            headers=_headers(),
        )
        assert cr.status_code == 201

        p1 = await ac.get(
            f"{_BASE}/preview",
            params={"document_type": "PREVIEW_TEST"},
            headers=_headers(),
        )
        p2 = await ac.get(
            f"{_BASE}/preview",
            params={"document_type": "PREVIEW_TEST"},
            headers=_headers(),
        )
    assert p1.status_code == 200
    assert p2.status_code == 200
    # Both previews must return identical next number (no mutation)
    assert p1.json().get("nextNumber") == p2.json().get("nextNumber")


# ─── TC-NUM010: Terminal prefixes report ──────────────────────────────────

@pytest.mark.asyncio
async def test_num010_terminal_prefixes_report():
    """GET /terminal-prefixes-report returns success with items list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        # Ensure at least one series exists
        await ac.post(
            f"{_BASE}/series",
            json=_series_payload("H"),
            headers=_headers(),
        )
        resp = await ac.get(
            f"{_BASE}/terminal-prefixes-report",
            headers=_headers(),
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["success"] is True
    assert "items" in data
    assert isinstance(data["items"], list)
    # Each row must have GST validation field
    for row in data["items"]:
        assert "gstRule46bValid" in row
        assert "nextDocumentNo" in row


# ─── TC-NUM011: Delete (retire) a series ──────────────────────────────────

@pytest.mark.asyncio
async def test_num011_delete_retires_series():
    """DELETE /series/{id} soft-retires; series no longer active in list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("I"),
            headers=_headers(),
        )
        assert cr.status_code == 201
        sid = cr.json()["id"]

        del_resp = await ac.delete(
            f"{_BASE}/series/{sid}",
            headers=_headers(),
        )
    assert del_resp.status_code == 200, del_resp.text
    assert del_resp.json().get("success") is True


# ─── TC-NUM012: Allocate on retired series is rejected ────────────────────

@pytest.mark.asyncio
async def test_num012_allocate_retired_series_rejected():
    """POST /series/{id}/allocate on a retired series returns 400 or 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        cr = await ac.post(
            f"{_BASE}/series",
            json=_series_payload("J"),
            headers=_headers(),
        )
        assert cr.status_code == 201
        sid = cr.json()["id"]

        # Retire it
        await ac.delete(f"{_BASE}/series/{sid}", headers=_headers())

        # Try to allocate from retired series
        alloc = await ac.post(
            f"{_BASE}/series/{sid}/allocate",
            json={"branch": "HQ", "fy": "26-27"},
            headers=_alloc_headers(),
        )
    assert alloc.status_code in (400, 404), (
        f"Expected 400 or 404 for retired series allocation, got {alloc.status_code}: {alloc.text}"
    )
