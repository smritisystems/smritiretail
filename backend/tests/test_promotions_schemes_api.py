"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.21.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Integration Test Suite
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token


from app.api.deps import get_current_user, get_tenant_context, TenantContext
from app.models.auth import User, UserRole


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-test-promo",
            "username": "test_promo_admin",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_promotions_schemes_lifecycle_api():
    """Verify statutory scheme synchronization endpoints (GET, POST, DELETE)."""
    mock_user = User(
        id="usr-test-promo",
        username="test_promo_admin",
        role=UserRole.SYSADMIN,
        company_id="COMP-001",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id="COMP-001", branch_id="BR-001")

    suffix = uuid.uuid4().hex[:6]
    test_code = f"SCHEME-{suffix.upper()}"
    test_name = f"Festival Dhamaka {suffix}"
    headers = _get_auth_headers()
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. GET initial schemes
            get_res = await client.get("/api/v1/promotions/schemes", headers=headers)
            assert get_res.status_code == 200
            initial_list = get_res.json()
            assert isinstance(initial_list, list)

            # 2. POST to upsert a new promotional scheme
            upsert_payload = {
                "code": test_code,
                "name": test_name,
                "description": "Flat 25% festive discount for retail shoppers",
                "level": "ITEM_LEVEL",
                "category": "ITEM_DISCOUNT_PERCENT",
                "priority": 2,
                "discount_value": 25.0,
                "min_bill_value": 500.0,
                "min_qty": 1,
                "buy_qty": 1,
                "free_qty": 0,
                "max_discount": 1000.0,
                "applicable_categories": ["Apparel", "Footwear"],
                "applicable_brands": ["Raymond", "Bata"],
                "applicable_customer_groups": ["ALL"],
                "valid_from": "2026-09-01",
                "valid_to": "2026-10-31",
                "is_happy_hours": False,
                "is_active": True,
            }

            post_res = await client.post("/api/v1/promotions/schemes", json=upsert_payload, headers=headers)
            assert post_res.status_code == 200, f"Failed: {post_res.text}"
            scheme_data = post_res.json()
            assert scheme_data["code"] == test_code
            assert scheme_data["name"] == test_name
            assert scheme_data["discount_value"] == 25.0
            assert scheme_data["priority"] == 2
            scheme_id = scheme_data["id"]

            # 3. GET schemes to verify presence in active list
            get2_res = await client.get("/api/v1/promotions/schemes", headers=headers)
            assert get2_res.status_code == 200
            found = [s for s in get2_res.json() if s["id"] == scheme_id or s["code"] == test_code]
            assert len(found) >= 1
            assert found[0]["name"] == test_name

            # 4. DELETE scheme
            del_res = await client.delete(f"/api/v1/promotions/schemes/{scheme_id}", headers=headers)
            assert del_res.status_code == 200
            assert del_res.json()["status"] == "SUCCESS"

            # 5. GET schemes to verify removal
            get3_res = await client.get("/api/v1/promotions/schemes", headers=headers)
            assert get3_res.status_code == 200
            remaining = [s for s in get3_res.json() if s["id"] == scheme_id]
            assert len(remaining) == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)
