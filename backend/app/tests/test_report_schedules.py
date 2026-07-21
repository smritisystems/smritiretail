"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
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
    comp = Company(id=f"comp-sched-{suffix}", name=f"Sched Co {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-sched-{suffix}", company_id=comp.id, name=f"Sched Br {suffix}", code=f"BRSCHED-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-sched-{suffix}", username=f"usr_sched_{suffix}",
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


def _set_tenant(comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_report_schedules_crud(db_session):
    comp, br = await _make_tenant(db_session, "s1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create Report Schedule
        create_payload = {
            "report_id": "rpt-sales-daily",
            "report_name": "Daily Sales Audit Report",
            "frequency": "DAILY",
            "execution_time": "08:00",
            "delivery_channel": "EMAIL",
            "delivery_target": "audit@smritibooks.com",
            "delivery_format": "PDF"
        }
        res = await ac.post("/api/v1/reports/schedules", json=create_payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["report_name"] == "Daily Sales Audit Report"
        assert data["delivery_target"] == "audit@smritibooks.com"
        sched_id = data["id"]

        # 2. List Report Schedules
        res_list = await ac.get("/api/v1/reports/schedules", headers=headers)
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert len(list_data) == 1
        assert list_data[0]["id"] == sched_id

        # 3. Soft-delete Report Schedule
        res_del = await ac.delete(f"/api/v1/reports/schedules/{sched_id}", headers=headers)
        assert res_del.status_code == 204

        # 4. List should now be empty
        res_list_after = await ac.get("/api/v1/reports/schedules", headers=headers)
        assert res_list_after.status_code == 200
        assert len(res_list_after.json()) == 0
