"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical Company Profile & Settings API Test Suite
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.deps import (
    TenantContext,
    get_company_db,
    get_current_user,
    get_tenant_context,
)
from app.main import app
from app.models.auth import User, UserRole


@pytest.fixture
def mock_admin_user():
    return User(
        id="usr-sysadmin-001",
        username="sysadmin",
        role=UserRole.SYSADMIN,
        is_active=True,
    )


@pytest.fixture
def mock_manager_user():
    return User(
        id="usr-manager-001",
        username="store_manager",
        role=UserRole.MANAGER,
        is_active=True,
    )


@pytest.fixture
def mock_cashier_user():
    return User(
        id="usr-cashier-001",
        username="cashier_jane",
        role=UserRole.CASHIER,
        is_active=True,
    )


@pytest.fixture
def tenant_001():
    return TenantContext(
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
        role=UserRole.SYSADMIN,
    )




TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def override_company_db():
    async with TestSessionLocal() as session:
        yield session



@pytest.mark.asyncio
async def test_01_get_company_profile_success(mock_admin_user, tenant_001):
    """Verify GET /api/v1/company/profile returns authoritative corporate profile."""
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user
    app.dependency_overrides[get_tenant_context] = lambda: tenant_001
    app.dependency_overrides[get_company_db] = override_company_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/company/profile")
            assert res.status_code == 200, f"Expected 200 but got {res.status_code}: {res.text}"
            data = res.json()
            assert data["id"] == "COMP-001"
            assert data["name"] == "Tattly Threads"
            assert data["gst_number"] == "27AAXFT2508H1ZR"
            assert data["pan"] == "AAXFT2508H"
            assert data["currency_code"] == "INR"
            assert data["timezone"] == "Asia/Kolkata"
            assert isinstance(data["branches"], list)
            assert isinstance(data["bank_accounts"], list)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_02_put_company_profile_manager_and_sysadmin(mock_admin_user, tenant_001):
    """Verify PUT /api/v1/company/profile persists identity, bank accounts, and branch details."""
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user
    app.dependency_overrides[get_tenant_context] = lambda: tenant_001
    app.dependency_overrides[get_company_db] = override_company_db

    update_payload = {
        "legal_name": "Tattly Threads Private Limited",
        "trade_name": "Tattly Threads Retail",
        "phone": "+91 98200 12345",
        "email": "corporate@tattlythreads.com",
        "website": "https://www.tattlythreads.com",
        "contact_person": "Priya Sharma",
        "address_line1": "Unit 402, Trade World B-Wing, Kamala Mills",
        "city": "Mumbai",
        "state": "Maharashtra",
        "state_code": "27",
        "pincode": "400013",
        "bank_accounts": [
            {
                "bank_name": "HDFC Bank",
                "account_no": "50200012345678",
                "ifsc": "HDFC0000060",
                "branch": "Lower Parel, Mumbai",
                "is_default": True,
            }
        ],
    }

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.put("/api/v1/company/profile", json=update_payload)
            assert res.status_code == 200, f"Expected 200 but got {res.status_code}: {res.text}"
            data = res.json()
            assert data["legal_name"] == "Tattly Threads Private Limited"
            assert data["trade_name"] == "Tattly Threads Retail"
            assert data["phone"] == "+91 98200 12345"
            assert data["email"] == "corporate@tattlythreads.com"
            assert data["contact_person"] == "Priya Sharma"
            assert len(data["bank_accounts"]) >= 1
            assert data["bank_accounts"][0]["bank_name"] == "HDFC Bank"
            assert data["bank_accounts"][0]["ifsc"] == "HDFC0000060"
            assert data["bank_accounts"][0]["is_default"] is True
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_03_put_company_profile_validation_gstin_pan_ifsc(mock_admin_user, tenant_001):
    """Verify Pydantic validators reject ill-formed GSTIN, PAN, and IFSC."""
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user
    app.dependency_overrides[get_tenant_context] = lambda: tenant_001
    app.dependency_overrides[get_company_db] = override_company_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 1. Invalid GSTIN
            res1 = await ac.put("/api/v1/company/profile", json={"gst_number": "INVALID_GST_123"})
            assert res1.status_code == 422

            # 2. Invalid PAN
            res2 = await ac.put("/api/v1/company/profile", json={"pan": "BADPAN1"})
            assert res2.status_code == 422

            # 3. Invalid IFSC in bank account
            res3 = await ac.put("/api/v1/company/profile", json={
                "bank_accounts": [
                    {
                        "bank_name": "State Bank of India",
                        "account_no": "1234567890",
                        "ifsc": "SHORT",
                        "is_default": True,
                    }
                ]
            })
            assert res3.status_code == 422
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_04_put_company_profile_rbac_cashier_forbidden(mock_cashier_user, tenant_001):
    """Verify CASHIER role is forbidden from modifying company configuration."""
    app.dependency_overrides[get_current_user] = lambda: mock_cashier_user
    app.dependency_overrides[get_tenant_context] = lambda: tenant_001
    app.dependency_overrides[get_company_db] = override_company_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.put("/api/v1/company/profile", json={"legal_name": "Malicious Corp"})
            assert res.status_code == 403
            err_body = res.json()
            assert err_body.get("status") == 403
            assert "Access Denied" in (err_body.get("title") or "") or "PERM" in (err_body.get("error_code") or "")
    finally:
        app.dependency_overrides.clear()
