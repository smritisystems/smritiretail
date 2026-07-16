"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smriti.com
Version      : 3.21.0
Created      : 2026-07-16
Modified     : 2026-07-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.core.security import create_access_token, hash_password
from app.api.deps import get_db
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _create_user(db_session, role=UserRole.MANAGER):
    company = Company(
        id="comp-test-1",
        name="Test Company",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id="br-test-1",
        company_id=company.id,
        name="Test Branch",
        code="BR-TEST-1",
        is_active=True,
    )
    user = User(
        id="usr-test-1",
        username="test_user",
        email="test@smriti.test",
        hashed_password=hash_password("Test@1234"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([company, branch, user])
    await db_session.commit()
    return user, company, branch


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
async def test_api_v1_migration_endpoints(db_session):
    user, _, _ = await _create_user(db_session)
    headers = _auth_headers(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_ai = await client.post(
            "/api/v1/ai/chat",
            json={"message": "What is Weeks of Cover?", "context": {"stock": []}},
            headers=headers,
        )
        assert res_ai.status_code == 200
        assert "reply" in res_ai.json()

        res_layout = await client.get("/api/v1/layout/preferences", headers=headers)
        assert res_layout.status_code == 200
        layout_data = res_layout.json()
        assert layout_data["position"] == "left"

        res_save_layout = await client.post(
            "/api/v1/layout/preferences",
            json={"position": "right", "collapsed": True, "favorites": ["sales"]},
            headers=headers,
        )
        assert res_save_layout.status_code == 200
        assert res_save_layout.json()["success"] is True

        res_setup = await client.post(
            "/api/v1/company/setup",
            json={"businessInfo": {"name": "Demo Co"}, "orgStructure": {"stores": [{"name": "Flagship"}]}}
            , headers=headers,
        )
        assert res_setup.status_code == 200
        setup_payload = res_setup.json()
        assert setup_payload["success"] is True
        assert setup_payload["company"]["name"] == "Demo Co"
        assert setup_payload["company"]["branches"][0]["name"] == "Flagship"
        assert setup_payload["company"]["branches"][0]["code"] == "BR-01"
        assert setup_payload["company"]["users"] == []

        res_setup_status = await client.get("/api/v1/system/setup-status", headers=headers)
        assert res_setup_status.status_code == 200
        assert res_setup_status.json()["setupCompleted"] is True

        res_partners = await client.get("/api/v1/exchange/partners", headers=headers)
        assert res_partners.status_code == 200
        assert isinstance(res_partners.json(), list)

        res_logs = await client.get("/api/v1/exchange/logs", headers=headers)
        assert res_logs.status_code == 200
        assert isinstance(res_logs.json(), list)

        res_validate = await client.post(
            "/api/v1/exchange/validate",
            json={"partnerId": "PRT-01", "rows": [{"sku": "SKU-001", "quantity": 5}]},
            headers=headers,
        )
        assert res_validate.status_code == 200
        assert res_validate.json()["rowCount"] == 1

        res_commit = await client.post(
            "/api/v1/exchange/commit",
            json={"partnerId": "PRT-01", "rows": [{"sku": "SKU-001", "quantity": 5}]},
            headers=headers,
        )
        assert res_commit.status_code == 200
        assert res_commit.json()["success"] is True

        res_approve = await client.post(
            "/api/v1/exchange/approve-log/EXLOG-001",
            headers=headers,
        )
        assert res_approve.status_code == 200
        assert res_approve.json()["success"] is True

        res_validate_customer = await client.post(
            "/api/v1/customers/validate-add",
            json={"customer": {"name": "John Doe", "mobile": "9876543210", "email": "john@example.com", "customer_group_id": "CG-RETAIL"}},
            headers=headers,
        )
        assert res_validate_customer.status_code == 200
        assert res_validate_customer.json()["valid"] is True
