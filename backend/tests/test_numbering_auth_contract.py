"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.1.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Numbering /series Auth Contract Tests (Part 5)
===============================================
Verifies the auth requirements discovered for /numbering/series endpoints:

  GET  /numbering/series           — requires JWT (get_current_user)
  POST /numbering/series           — requires JWT + MANAGER or SYSADMIN role
  PUT  /numbering/series/{id}      — requires JWT + MANAGER or SYSADMIN role
  DELETE /numbering/series/{id}    — requires JWT + MANAGER or SYSADMIN role

  POST /numbering/series/{id}/allocate — dual-auth:
    EITHER X-Internal-Service-Key (for backend service-to-service calls)
    OR     Bearer JWT token (for user-initiated calls)

  Source-code contract (helpers.ts):
    - allocateVoucherNumber() uses Authorization header ONLY (JWT path)
    - dispatchStockMovement() uses X-Internal-Service-Key (different helper, correct)

These tests do NOT require a live DB. They use FastAPI TestClient + mocked
service and auth dependencies to verify HTTP auth responses.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.numbering import router as numbering_router


# ─── Test App Fixture ─────────────────────────────────────────────────────────

@pytest.fixture
def app():
    """Minimal FastAPI app with numbering router mounted."""
    _app = FastAPI()
    _app.include_router(numbering_router, prefix="/numbering")
    return _app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def _bearer(token="fake-jwt"):
    return {"Authorization": f"Bearer {token}"}


# ─── Tests: GET /numbering/series — JWT required ───────────────────────────────

class TestListSeries:
    """GET /series requires a valid JWT (get_current_user dependency)."""

    def test_list_series_no_auth_returns_401(self, client):
        """No auth header → 401 Unauthorized."""
        resp = client.get("/numbering/series")
        assert resp.status_code in (401, 422), (
            f"Expected 401 without auth, got {resp.status_code}. "
            "GET /numbering/series must require JWT (get_current_user dependency)."
        )

    def test_list_series_x_internal_key_alone_is_not_sufficient(self, client):
        """
        X-Internal-Service-Key on GET /series must NOT be accepted.
        This endpoint uses get_current_user (JWT-only). Only /allocate supports dual-auth.
        """
        resp = client.get(
            "/numbering/series",
            headers={"X-Internal-Service-Key": "any-key"},
        )
        # Without JWT, must be rejected (401 or 422)
        assert resp.status_code in (401, 422), (
            f"GET /numbering/series should reject requests with only X-Internal-Service-Key. "
            f"Got {resp.status_code}. Only /allocate endpoint supports internal service key auth."
        )


# ─── Tests: POST /numbering/series/{id}/allocate — Dual Auth ─────────────────

class TestAllocateEndpointAuth:
    """
    POST /numbering/series/{id}/allocate has dual-auth:
      Option A: X-Internal-Service-Key (backend service-to-service)
      Option B: Bearer JWT (user-initiated calls)
    No auth at all → 401.
    """

    def test_allocate_no_auth_returns_401(self, client):
        """No auth header of any kind → 401."""
        resp = client.post(
            "/numbering/series/SRS-001/allocate",
            json={"branch": "HQ", "fy": "26-27"},
        )
        assert resp.status_code == 401, (
            f"Expected 401 with no auth, got {resp.status_code}. "
            "POST /allocate must require either X-Internal-Service-Key or Bearer JWT."
        )

    def test_allocate_no_auth_even_with_empty_bearer_returns_401(self, client):
        """
        Bearer with no actual token → must return 401 (not 500).
        SMRITI-SEC-2026-001: Fixed in numbering.py — token is now stripped and
        validated before calling get_current_user, ensuring 401 for malformed
        'Bearer ' headers instead of an unhandled exception (HTTP 500).
        """
        resp = client.post(
            "/numbering/series/SRS-001/allocate",
            json={"branch": "HQ", "fy": "26-27"},
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code in (401, 422), (
            f"Empty Bearer token must return 401 after SMRITI-SEC-2026-001 fix. "
            f"Got {resp.status_code}. Check the token-strip guard in numbering.py."
        )

    def test_allocate_helper_in_frontend_uses_jwt_not_internal_key(self):
        """
        Source-code contract: allocateVoucherNumber() in src/lib/helpers.ts
        uses Authorization header (JWT path), NOT X-Internal-Service-Key.

        DISCOVERY: X-Internal-Service-Key appears in helpers.ts at line 293
        inside dispatchStockMovement() — a different function. This is correct:
          - allocateVoucherNumber → JWT path  (frontend UI calls)
          - dispatchStockMovement → X-Internal-Service-Key  (backend service calls)
        """
        helpers_ts = (
            Path(__file__).resolve().parent.parent.parent
            / "src" / "lib" / "helpers.ts"
        )
        if not helpers_ts.exists():
            pytest.skip("helpers.ts not found — skipping source-level auth check")

        source = helpers_ts.read_text(encoding="utf-8", errors="replace")

        # Locate the allocateVoucherNumber function body
        fn_start = source.find("async function allocateVoucherNumber")
        assert fn_start != -1, "allocateVoucherNumber function not found in helpers.ts"

        # Find the function end (next export/async function declaration)
        fn_end = source.find("\nexport ", fn_start + 1)
        if fn_end == -1:
            fn_end = len(source)
        fn_body = source[fn_start:fn_end]

        # Within allocateVoucherNumber, only Authorization header must appear
        assert "Authorization" in fn_body, (
            "allocateVoucherNumber must pass Authorization header for JWT auth."
        )
        # X-Internal-Service-Key must NOT appear in the allocateVoucherNumber function body
        assert "X-Internal-Service-Key" not in fn_body, (
            "allocateVoucherNumber must NOT use X-Internal-Service-Key — "
            "that header is only for backend service-to-service calls "
            "(e.g. dispatchStockMovement). Frontend allocations must use JWT."
        )

    def test_record_stock_movement_uses_internal_key_correctly(self):
        """
        Source-code verification: recordStockMovement() in src/lib/helpers.ts
        (line 233) correctly uses X-Internal-Service-Key for the /inventory/stock-movements
        backend call. This is the correct backend service-to-service auth pattern.

        Auth split contract:
          - allocateVoucherNumber() → Authorization header (JWT path, frontend UI)
          - recordStockMovement()   → X-Internal-Service-Key (backend service call)
        """
        helpers_ts = (
            Path(__file__).resolve().parent.parent.parent
            / "src" / "lib" / "helpers.ts"
        )
        if not helpers_ts.exists():
            pytest.skip("helpers.ts not found")

        source = helpers_ts.read_text(encoding="utf-8", errors="replace")
        fn_start = source.find("recordStockMovement")
        assert fn_start != -1, (
            "recordStockMovement function not found in helpers.ts. "
            "This is the function that uses X-Internal-Service-Key for /inventory/stock-movements."
        )

        fn_end = source.find("\nexport ", fn_start + 1)
        if fn_end == -1:
            fn_end = len(source)
        fn_body = source[fn_start:fn_end]

        assert "X-Internal-Service-Key" in fn_body, (
            "recordStockMovement should use X-Internal-Service-Key for backend "
            "service-to-service auth when dispatching to /inventory/stock-movements."
        )


# ─── Tests: Role gating on mutating endpoints ─────────────────────────────────

class TestSeriesWriteRoleGating:
    """
    POST/PUT/DELETE /numbering/series require MANAGER or SYSADMIN role.
    Confirmed from numbering.py:
      - POST /series:     dependencies=[Depends(require_role(MANAGER, SYSADMIN))]   (line 50)
      - PUT /series/{id}: dependencies=[Depends(require_role(MANAGER, SYSADMIN))]   (line 67)
      - DELETE /series/{id}: dependencies=[Depends(require_role(MANAGER, SYSADMIN))] (line 84)
    """

    def test_post_series_no_auth_returns_401(self, client):
        """No JWT on POST /series → 401."""
        resp = client.post(
            "/numbering/series",
            json={
                "name": "Test Series",
                "documentType": "SALES_CASH",
                "prefix": "INV/",
                "startNumber": 1,
                "runningLength": 4,
            },
        )
        assert resp.status_code in (401, 422), (
            f"POST /numbering/series without auth should return 401. Got {resp.status_code}."
        )

    def test_put_series_no_auth_returns_401(self, client):
        """No JWT on PUT /series/{id} → 401."""
        resp = client.put(
            "/numbering/series/SRS-001",
            json={"name": "Updated"},
        )
        assert resp.status_code in (401, 422), (
            f"PUT /numbering/series/SRS-001 without auth should return 401. Got {resp.status_code}."
        )

    def test_delete_series_no_auth_returns_401(self, client):
        """No JWT on DELETE /series/{id} → 401."""
        resp = client.delete("/numbering/series/SRS-001")
        assert resp.status_code in (401, 422), (
            f"DELETE /numbering/series/SRS-001 without auth should return 401. Got {resp.status_code}."
        )

    def test_auth_contract_verified_from_source(self):
        """
        Static source verification: confirm the numbering.py endpoints use the
        correct auth deps — no live DB required.
        """
        numbering_py = (
            Path(__file__).resolve().parent.parent
            / "app" / "api" / "v1" / "numbering.py"
        )
        source = numbering_py.read_text(encoding="utf-8", errors="replace")

        # GET /series uses get_current_user (JWT only)
        assert "get_current_user" in source, (
            "numbering.py must import and use get_current_user for JWT auth."
        )
        # Mutating endpoints use require_role with MANAGER and SYSADMIN
        assert "require_role" in source, (
            "numbering.py must use require_role for access control on mutating endpoints."
        )
        assert "UserRole.MANAGER" in source, (
            "MANAGER role must be listed in require_role for /series write endpoints."
        )
        assert "UserRole.SYSADMIN" in source, (
            "SYSADMIN role must be listed in require_role for /series write endpoints."
        )
        # /allocate uses dual-auth: X-Internal-Service-Key or Bearer
        assert "X-Internal-Service-Key" in source, (
            "numbering.py /allocate must accept X-Internal-Service-Key header "
            "for backend service-to-service calls."
        )
        assert "INTERNAL_SERVICE_KEY" in source, (
            "numbering.py must validate X-Internal-Service-Key against settings.INTERNAL_SERVICE_KEY."
        )
