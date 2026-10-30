"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-22
Modified     : 2026-10-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.core.security import create_access_token, hash_password
from app.api.deps import get_db, get_company_db


@pytest.fixture(autouse=True)
def override_db(db_session: AsyncSession):
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)


async def _create_test_user(db_session: AsyncSession):
    s = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-ux-{s}",
        name=f"UX Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-ux-{s}",
        company_id=company.id,
        name=f"Branch {s}",
        code=f"BR-{s.upper()}",
        is_active=True,
    )
    user = User(
        id=f"usr-ux-{s}",
        username=f"ux_operator_{s}",
        email=f"ux_{s}@smriti.test",
        hashed_password=hash_password("TestPass123"),
        role=UserRole.CASHIER,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([company, branch, user])
    await db_session.commit()
    return user


def _auth_headers(user: User):
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_ux_mode_preferences_lifecycle(db_session: AsyncSession):
    user = await _create_test_user(db_session)
    headers = _auth_headers(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Fetch default layout preferences
        res_get = await client.get("/api/v1/layout/preferences", headers=headers)
        assert res_get.status_code == 200
        data = res_get.json()
        assert data.get("uxMode") == "regular"

        # 2. Update UX mode to classic
        res_save = await client.post(
            "/api/v1/layout/preferences",
            json={"uxMode": "classic", "sidebarWidth": 240},
            headers=headers,
        )
        assert res_save.status_code == 200
        save_data = res_save.json()
        assert save_data["success"] is True
        assert save_data["prefs"]["uxMode"] == "classic"

        # 3. Verify persistence across requests
        res_get2 = await client.get("/api/v1/layout/preferences", headers=headers)
        assert res_get2.status_code == 200
        data2 = res_get2.json()
        assert data2.get("uxMode") == "classic"

        # 4. Switch back to regular
        res_save2 = await client.post(
            "/api/v1/layout/preferences",
            json={"uxMode": "regular"},
            headers=headers,
        )
        assert res_save2.status_code == 200
        assert res_save2.json()["prefs"]["uxMode"] == "regular"
