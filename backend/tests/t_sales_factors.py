"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.1
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "MAIN",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "MAIN",
    }


@pytest.mark.asyncio
async def test_sales_factors_crud_and_price_group_filter():
    """Verify REST API pricing/sales-factors endpoints: upsert, filter by price group, and deactivate."""
    unique_suffix = uuid.uuid4().hex[:4]
    factor_code = f"SF_{unique_suffix.upper()}"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Upsert Factor via POST /api/v1/pricing/sales-factors
        upsert_res = await client.post(
            "/api/v1/pricing/sales-factors",
            json={
                "code": factor_code,
                "description": f"VIP Privilege Deduction {unique_suffix}",
                "factor_type": "DEDUCTION",
                "factor_category": "PRICE_GROUP_SPECIFIC",
                "price_group_code": f"GRP_{unique_suffix.upper()}",
                "computation_timing": "ABOVE_TAX",
                "computed_on": "DISCOUNTED_VALUE",
                "rate_or_amount": "RATE",
                "value": 10.0,
                "is_variable": True,
                "min_bill_value": 500.0,
                "valid_from": "2026-01-01",
                "valid_to": "2026-12-31",
                "applicable_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
                "is_active": True,
            },
            headers=_get_auth_headers(),
        )
        assert upsert_res.status_code in (200, 201)
        factor_dto = upsert_res.json()
        assert factor_dto["code"] == factor_code
        assert factor_dto["value"] == 10.0
        assert factor_dto["computation_timing"] == "ABOVE_TAX"
        created_factor_id = factor_dto["id"]

        # 2. Query Factors via GET /api/v1/pricing/sales-factors with price_group_code filter
        list_res = await client.get(
            f"/api/v1/pricing/sales-factors?price_group_code=GRP_{unique_suffix.upper()}",
            headers=_get_auth_headers(),
        )
        assert list_res.status_code == 200
        factors_list = list_res.json()
        matched = [f for f in factors_list if f["code"] == factor_code]
        assert len(matched) == 1
        assert matched[0]["description"] == f"VIP Privilege Deduction {unique_suffix}"
        assert matched[0]["factor_type"] == "DEDUCTION"

        # 3. Deactivate Factor via DELETE /api/v1/pricing/sales-factors/{id}
        del_res = await client.delete(
            f"/api/v1/pricing/sales-factors/{created_factor_id}",
            headers=_get_auth_headers(),
        )
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # 4. Verify deactivated factor is omitted from active list
        list_res_after = await client.get(
            f"/api/v1/pricing/sales-factors?price_group_code=GRP_{unique_suffix.upper()}",
            headers=_get_auth_headers(),
        )
        assert list_res_after.status_code == 200
        factors_list_after = list_res_after.json()
        assert not any(f["id"] == created_factor_id for f in factors_list_after)
