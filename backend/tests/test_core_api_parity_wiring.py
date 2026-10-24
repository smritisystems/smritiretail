"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.64.0
Created      : 2026-10-03
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core API Parity and Supervisor Auth Verification Suite
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token


def _get_auth_headers(role: str = "MANAGER", username: str = "manager") -> dict:
    sub_id = "usr-admin" if role == "SYSADMIN" else "usr-manager-direct"
    token = create_access_token(
        data={
            "sub": sub_id,
            "username": username,
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "COMP-001",
    }


@pytest.mark.asyncio
async def test_supervisor_pin_verification_success():
    """Verify that POST /api/v1/auth/verify-supervisor-pin approves manager overrides."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "username": "manager",
            "pin": "1234",
            "action_type": "PRICE_OVERRIDE",
            "reason": "Manager discount approval for loyalty customer"
        }
        res = await client.post("/api/v1/auth/verify-supervisor-pin", json=payload)
        assert res.status_code == 200, f"Unexpected status: {res.status_code}, {res.text}"
        data = res.json()
        assert data["verified"] is True
        assert "token-sup-" in data["auth_token"]
        assert data["action_type"] == "PRICE_OVERRIDE"


@pytest.mark.asyncio
async def test_supervisor_pin_verification_invalid_pin():
    """Verify that POST /api/v1/auth/verify-supervisor-pin rejects wrong PIN."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "username": "manager",
            "pin": "0099",
            "action_type": "NEGATIVE_CASH_DRAWER",
            "reason": "Test invalid pin"
        }
        res = await client.post("/api/v1/auth/verify-supervisor-pin", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["verified"] is False
        assert "Invalid Supervisor PIN" in data["message"]


@pytest.mark.asyncio
async def test_supervisor_pin_non_existent_user():
    """Verify that non-existent username is rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "username": "non_existent_supervisor_999",
            "pin": "1234",
            "action_type": "FORCED_SHIFT_RESET",
            "reason": "Test non-existent user"
        }
        res = await client.post("/api/v1/auth/verify-supervisor-pin", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["verified"] is False


@pytest.mark.asyncio
async def test_universal_import_route_alias():
    """Verify that POST /api/v1/universal-import/preview is registered and not 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _get_auth_headers(role="SYSADMIN")
        # Empty payload will give 422 Unprocessable Entity, which confirms route exists (not 404)
        res = await client.post("/api/v1/universal-import/preview", json={}, headers=headers)
        assert res.status_code != 404, f"Route /universal-import/preview returned 404: {res.text}"


@pytest.mark.asyncio
async def test_warehouses_route_alias():
    """Verify that GET /api/v1/warehouses is registered and accessible."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _get_auth_headers(role="MANAGER")
        res = await client.get("/api/v1/warehouses", headers=headers)
        assert res.status_code == 200, f"Route /warehouses failed: {res.status_code}, {res.text}"
        assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_security_audit_log_endpoint():
    """Verify that GET /api/v1/security/audit-log returns structured entries."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _get_auth_headers(role="SYSADMIN")
        res = await client.get("/api/v1/security/audit-log?limit=5", headers=headers)
        assert res.status_code == 200, f"Route /security/audit-log failed: {res.status_code}, {res.text}"
        data = res.json()
        assert "entries" in data
        assert "total" in data


@pytest.mark.asyncio
async def test_localization_uoms_endpoint():
    """Verify that GET /api/v1/localization/uoms returns standard GST UQC units."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _get_auth_headers(role="MANAGER")
        res = await client.get("/api/v1/localization/uoms?active_only=true", headers=headers)
        assert res.status_code == 200, f"Route /localization/uoms failed: {res.status_code}, {res.text}"
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        uqc_codes = [u.get("code") for u in data]
        assert any(c in uqc_codes for c in ["PCS", "PAIR", "NOS", "KGS"])


@pytest.mark.asyncio
async def test_crm_loyalty_member_adjustment_route():
    """Verify that POST /api/v1/crm/loyalty/members/{id}/{adj_type} route exists and processes payload."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _get_auth_headers(role="MANAGER")
        payload = {
            "points": 50,
            "reason": "Parity test loyalty adjustment",
            "reference_id": "TEST-ADJ-001"
        }
        res = await client.post("/api/v1/crm/loyalty/members/mem-test-999/bonus", json=payload, headers=headers)
        data = res.json()
        # Route is registered and calls CrmGrowthEngine which validates the member
        assert "Loyalty member 'mem-test-999' not found" in data.get("detail", "")


@pytest.mark.asyncio
async def test_purchase_3way_matching_commit():
    """Verify that POST /api/v1/purchase/3way-matching/commit creates reconciliation and AP voucher."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _get_auth_headers(role="MANAGER")
        payload = {
            "po_no": "PO-2026-001",
            "grn_no": "GRN-2026-001",
            "vendor_invoice_no": "INV-2026-001",
            "vendor_gstin": "27AABCU9603R1ZM",
            "reconciliation_status": "MATCHED",
            "total_po_value": 15000.0,
            "total_grn_value": 15000.0,
            "total_invoice_value": 15000.0,
            "variance_amount": 0.0,
            "lines": [
                {
                    "item_code": "SKU-TEST-01",
                    "po_qty": 10,
                    "grn_accepted_qty": 10,
                    "invoice_qty": 10,
                    "po_rate": 1500,
                    "invoice_rate": 1500,
                    "status": "MATCHED"
                }
            ]
        }
        res = await client.post("/api/v1/purchase/3way-matching/commit", json=payload, headers=headers)
        assert res.status_code == 200, f"Route /purchase/3way-matching/commit failed: {res.status_code}, {res.text}"
        data = res.json()
        assert data["status"] == "COMMITTED"
        assert "AP-VOUCH-" in data["ap_voucher_no"]
        assert "rec-3way-" in data["reconciliation_id"]
        assert data["po_no"] == "PO-2026-001"
        assert data["grn_no"] == "GRN-2026-001"
        assert data["vendor_invoice_no"] == "INV-2026-001"

