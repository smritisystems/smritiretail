"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.barcode import BarcodeLayout, PrintHistory
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables.
    """
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-bar-{suffix}", name=f"Bar Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-bar-{suffix}", company_id=comp.id,
                   name=f"Bar Br {suffix}", code=f"BRBAR-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-bar-{suffix}", username=f"usr_bar_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": comp_id, "branch_id": br_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_get_and_save_printer_settings(db_session):
    comp, br = await _make_tenant(db_session, "s1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.SYSADMIN)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Default settings
        res = await client.get("/api/v1/barcode/printer-settings", headers=headers)
        print("\nDEBUG GET SETTINGS RESPONSE STATUS:", res.status_code)
        print("DEBUG GET SETTINGS RESPONSE BODY:", res.text)
        assert res.status_code == 200
        assert res.json()["ip"] == "192.168.1.200"

        # Update settings
        payload = {"ip": "10.0.0.50", "port": 9200}
        res = await client.post("/api/v1/barcode/printer-settings", json=payload, headers=headers)
        assert res.status_code == 200
        assert res.json()["ip"] == "10.0.0.50"

        # Fetch again to verify persistence
        res = await client.get("/api/v1/barcode/printer-settings", headers=headers)
        assert res.status_code == 200
        assert res.json()["ip"] == "10.0.0.50"
        assert res.json()["port"] == 9200


@pytest.mark.asyncio
async def test_print_labels_recording_history(db_session):
    comp, br = await _make_tenant(db_session, "s2")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Seed layout
    layout = BarcodeLayout(
        id="lay-test-print",
        name="Test Print Layout",
        width_mm=50,
        height_mm=25,
        columns=1,
        is_default=True,
        elements_json="[]",
        created_by="SYSADMIN",
        updated_by="SYSADMIN"
    )
    db_session.add(layout)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Trigger print labels
        # Printer is offline so we expect 400 with a detailed connection refusal error, but logs must be captured!
        payload = {
            "layoutId": "lay-test-print",
            "items": [
                {
                    "code": "SKU-001",
                    "name": "Cool Sneaker",
                    "barcode": "12345678",
                    "price": "99.0",
                    "mrp": "120.0",
                    "size": "10",
                    "color": "Blue",
                    "qty": 3
                }
            ]
        }
        res = await client.post("/api/v1/barcode/print", json=payload, headers=headers)
        assert res.status_code == 400
        assert "failed to dispatch to printer" in res.json()["detail"]

        # Verify that print log was still captured as "Failed"
        res_history = await client.get("/api/v1/barcode/print-history", headers=headers)
        assert res_history.status_code == 200
        logs = res_history.json()
        assert len(logs) == 1
        assert logs[0]["itemCode"] == "SKU-001"
        assert logs[0]["status"] == "Failed"
        assert logs[0]["quantity"] == 3
        assert "refused" in logs[0]["errorMessage"].lower() or "timeout" in logs[0]["errorMessage"].lower() or "timed out" in logs[0]["errorMessage"].lower() or "unreachable" in logs[0]["errorMessage"].lower() or "connection" in logs[0]["errorMessage"].lower()


@pytest.mark.asyncio
async def test_print_labels_dynamic_placeholder_replacement(db_session):
    import json
    comp, br = await _make_tenant(db_session, "s3")
    manager = await _make_user(db_session, "mgr3", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Seed layout with custom PRN template containing dynamic placeholders
    layout_data = {
        "elements": [],
        "prn_template": "^XA^FD{name}^FS^FD{custom_fabric}^FS^FD{custom_color}^FS^XZ"
    }
    layout = BarcodeLayout(
        id="lay-test-dynamic",
        name="Dynamic Print Layout",
        width_mm=50,
        height_mm=25,
        columns=1,
        is_default=False,
        elements_json=json.dumps(layout_data),
        created_by="SYSADMIN",
        updated_by="SYSADMIN"
    )
    db_session.add(layout)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "layoutId": "lay-test-dynamic",
            "items": [
                {
                    "code": "SKU-002",
                    "name": "Linen Shirt",
                    "barcode": "87654321",
                    "price": "150.0",
                    "mrp": "200.0",
                    "qty": 1,
                    "custom_fabric": "100% Linen",
                    "custom_color": "Olive Green"
                }
            ]
        }
        res = await client.post("/api/v1/barcode/print", json=payload, headers=headers)
        assert res.status_code == 400
        assert "failed to dispatch to printer" in res.json()["detail"]

        # Verify that print log was captured
        res_history = await client.get("/api/v1/barcode/print-history", headers=headers)
        assert res_history.status_code == 200
        logs = res_history.json()
        assert len(logs) == 1
        log_codes = [l["itemCode"] for l in logs]
        assert "SKU-002" in log_codes

