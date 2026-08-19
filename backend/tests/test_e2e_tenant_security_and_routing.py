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
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole


@pytest.fixture
def comp001_user_token():
    """Generates a valid JWT token for a Cashier assigned strictly to COMP-001."""
    return create_access_token(
        data={
            "sub": "usr-cashier",
            "username": "cashier",
            "role": UserRole.CASHIER.value,
            "company_id": "COMP-001",
            "branch_id": "BR-001"
        }
    )


@pytest.fixture
def comp001_manager_token():
    """Generates a valid JWT token for a Manager assigned strictly to COMP-001."""
    return create_access_token(
        data={
            "sub": "usr-manager",
            "username": "manager",
            "role": UserRole.MANAGER.value,
            "company_id": "COMP-001",
            "branch_id": "BR-001"
        }
    )


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected():
    """Verify that unauthenticated requests to transactional endpoints receive 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/sales/invoices")
        assert res.status_code == 401, f"Expected 401 Unauthorized, got {res.status_code}: {res.text}"


@pytest.mark.asyncio
async def test_authorized_company_request_success(comp001_user_token):
    """Verify that authenticated user assigned to COMP-001 succeeds with 200 OK."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {comp001_user_token}"}
        res = await client.get("/api/v1/sales/invoices", headers=headers)
        assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"
        data = res.json()
        assert isinstance(data, list)


@pytest.mark.asyncio
async def test_header_tampering_cross_tenant_attack_blocked(comp001_user_token):
    """
    CRITICAL SECURITY TEST:
    Verify that a client assigned to COMP-001 attempting to access COMP-002
    via X-Company-Id / X-Company-Code header is strictly blocked with 403 Forbidden.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {
            "Authorization": f"Bearer {comp001_user_token}",
            "X-Company-Id": "COMP-002"
        }
        res = await client.get("/api/v1/sales/invoices", headers=headers)
        assert res.status_code == 403, f"Expected 403 Forbidden for header tampering, got {res.status_code}: {res.text}"
        assert "Header Tampering Forbidden" in res.json().get("detail", "")


@pytest.mark.asyncio
async def test_barcode_layout_company_isolation(comp001_manager_token):
    """
    Verify that BarcodeLayout operations are isolated by company:
    1. Manager in COMP-001 creates a layout.
    2. list_layouts returns the layout for COMP-001.
    3. Tampered header X-Company-Id: COMP-002 is blocked with 403.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        auth_headers = {"Authorization": f"Bearer {comp001_manager_token}"}

        # 1. Create layout for COMP-001
        layout_payload = {
            "name": "E2E Test 50x25 Thermal Label",
            "widthMm": 50.0,
            "heightMm": 25.0,
            "columns": 1,
            "isDefault": False,
            "elements": [{"type": "text", "x": 5, "y": 5, "field": "name"}]
        }
        create_res = await client.post("/api/v1/barcode/layouts", json=layout_payload, headers=auth_headers)
        assert create_res.status_code == 201, f"Expected 201 Created, got {create_res.status_code}: {create_res.text}"
        layout_id = create_res.json()["id"]

        # 2. List layouts for COMP-001
        list_res = await client.get("/api/v1/barcode/layouts", headers=auth_headers)
        assert list_res.status_code == 200
        ids = [l["id"] for l in list_res.json()]
        assert layout_id in ids

        # 3. Verify header tampering attempt on barcode layout is rejected
        tampered_headers = {
            "Authorization": f"Bearer {comp001_manager_token}",
            "X-Company-Id": "COMP-002"
        }
        tampered_res = await client.get("/api/v1/barcode/layouts", headers=tampered_headers)
        assert tampered_res.status_code == 403
        assert "Header Tampering Forbidden" in tampered_res.json().get("detail", "")

        # Clean up layout
        del_res = await client.delete(f"/api/v1/barcode/layouts/{layout_id}", headers=auth_headers)
        assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_barcode_printer_settings_and_test_print_isolation(comp001_manager_token):
    """
    Verify printer settings and test-print are isolated and routed via get_company_db.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        auth_headers = {"Authorization": f"Bearer {comp001_manager_token}"}

        # 1. Get printer settings
        get_res = await client.get("/api/v1/barcode/printer-settings", headers=auth_headers)
        assert get_res.status_code == 200
        assert "connection_type" in get_res.json()

        # 2. Diagnostics
        diag_res = await client.get("/api/v1/barcode/diagnostics", headers=auth_headers)
        assert diag_res.status_code == 200
        assert "software_engines" in diag_res.json()

        # 3. Test print with saveAsPrn=True (safe export mode)
        print_res = await client.post(
            "/api/v1/barcode/test-print",
            json={"format": "ZPL", "saveAsPrn": True},
            headers=auth_headers
        )
        assert print_res.status_code == 200
        assert print_res.json().get("status") == "PRN_GENERATED"

        # 4. Header tampering on printer settings rejected
        tampered = {"Authorization": f"Bearer {comp001_manager_token}", "X-Company-Id": "COMP-002"}
        t_res = await client.get("/api/v1/barcode/printer-settings", headers=tampered)
        assert t_res.status_code == 403
