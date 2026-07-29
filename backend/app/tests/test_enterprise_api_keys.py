"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.security import SMRITIPermissionSet
from app.models.api_key import SMRITIServiceAccount, SMRITIAPIKey, SMRITIAPIKeyLog
from app.services.api_key_service import APIKeyService
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


def _bearer(user: User) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
        "company_id": "comp-test",
        "branch_id": "br-test",
        "is_platform_admin": user.is_platform_admin,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_service_account_and_generate_api_key(db_session):
    """Test creating a service account and generating an API key credential."""
    svc = APIKeyService()
    sa = await svc.create_service_account(
        db=db_session,
        code="SA-TEST-01",
        name="WMS Sync Service",
        description="Warehouse Management Integration Agent",
        company_id="comp-test",
        branch_id="br-test",
    )
    assert sa.id is not None
    assert sa.code == "SA-TEST-01"

    key_res = await svc.generate_api_key(
        db=db_session,
        service_account_id=sa.id,
        name="Primary WMS Key",
        permission_set_ids=["pol-inventory-mgmt"],
        company_id="comp-test",
        branch_id="br-test",
    )
    assert key_res["raw_key"].startswith("smriti_live_")
    assert key_res["key_prefix"] is not None


@pytest.mark.asyncio
async def test_authenticate_api_key_success(db_session):
    """Test successful authentication of a raw API key token."""
    svc = APIKeyService()
    sa = await svc.create_service_account(
        db=db_session,
        code="SA-POS-01",
        name="POS Agent",
    )

    gen = await svc.generate_api_key(
        db=db_session,
        service_account_id=sa.id,
        name="POS Terminal Key",
        permission_set_ids=["pol-sales-mgmt"],
    )

    raw_key = gen["raw_key"]
    auth_key = await svc.authenticate_api_key(db=db_session, raw_key=raw_key)
    assert auth_key.id == gen["api_key_id"]
    assert auth_key.last_used_at is not None

    perms = await svc.get_effective_permissions(auth_key)
    assert isinstance(perms, list)


@pytest.mark.asyncio
async def test_authenticate_api_key_expired_fails(db_session):
    """Test that an expired API key is rejected."""
    svc = APIKeyService()
    sa = await svc.create_service_account(db=db_session, code="SA-EXP-01", name="Expired Service")

    past_date = datetime.now(timezone.utc) - timedelta(days=1)
    gen = await svc.generate_api_key(
        db=db_session,
        service_account_id=sa.id,
        name="Expired Key",
        permission_set_ids=[],
        expires_at=past_date,
    )

    with pytest.raises(ValueError, match="expired"):
        await svc.authenticate_api_key(db=db_session, raw_key=gen["raw_key"])


@pytest.mark.asyncio
async def test_authenticate_api_key_ip_cidr_containment(db_session):
    """Test IP CIDR whitelisting enforcement."""
    svc = APIKeyService()
    sa = await svc.create_service_account(db=db_session, code="SA-IP-01", name="IP Restricted Service")

    gen = await svc.generate_api_key(
        db=db_session,
        service_account_id=sa.id,
        name="IP Whitelisted Key",
        permission_set_ids=[],
        allowed_ip_cidrs=["192.168.1.0/24"],
    )

    # Permitted IP
    auth_key = await svc.authenticate_api_key(db=db_session, raw_key=gen["raw_key"], client_ip="192.168.1.45")
    assert auth_key.id == gen["api_key_id"]

    # Blocked IP
    with pytest.raises(PermissionError, match="not permitted"):
        await svc.authenticate_api_key(db=db_session, raw_key=gen["raw_key"], client_ip="10.0.0.99")


@pytest.mark.asyncio
async def test_api_keys_rest_endpoints(db_session):
    """Test REST API endpoints /api/v1/api-keys."""
    user = User(
        id="usr-key-admin",
        username="key_admin",
        hashed_password="hashed_password",
        role=UserRole.SYSADMIN,
        is_platform_admin=True,
    )
    db_session.add(user)
    await db_session.commit()

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id="comp-test", branch_id="br-test")

    headers = _bearer(user)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create service account
        res_sa = await client.post(
            "/api/v1/api-keys/service-accounts",
            json={"code": "SA-REST-01", "name": "REST Service Account", "description": "Testing REST endpoints"},
            headers=headers,
        )
        assert res_sa.status_code == 200
        sa_id = res_sa.json()["id"]

        # 2. Generate API key
        res_gen = await client.post(
            "/api/v1/api-keys/generate",
            json={
                "service_account_id": sa_id,
                "name": "REST Generated Key",
                "permission_set_ids": ["pol-reporting"],
                "rate_limit_per_minute": 300,
            },
            headers=headers,
        )
        assert res_gen.status_code == 200
        key_data = res_gen.json()
        assert "raw_key" in key_data
        key_id = key_data["api_key_id"]

        # 3. List API keys
        res_list = await client.get("/api/v1/api-keys", headers=headers)
        assert res_list.status_code == 200
        assert len(res_list.json()) >= 1

        # 4. Revoke API key
        res_del = await client.delete(f"/api/v1/api-keys/{key_id}", headers=headers)
        assert res_del.status_code == 200

    app.dependency_overrides.pop(get_tenant_context, None)
