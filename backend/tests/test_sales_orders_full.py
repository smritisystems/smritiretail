"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-27
Modified     : 2026-08-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.models.sales import SalesOrder
from app.core.security import create_access_token


def _get_auth_headers():
    token = create_access_token(data={
        "sub": "usr-super",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "BR-001",
        "tenant_id": "smriti001",
        "db_name": "smriti001",
        "is_active": True,
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001"
    }


@pytest.mark.asyncio
async def test_sales_order_full_suite():
    """Verify Sales Order PDF, HTML Preview, 1-Click Invoice Conversion, and Fulfillment Variance."""
    
    # 1. Check live Sales Orders exist in smriti001
    sm = get_company_sessionmaker("smriti001")
    async with sm() as db:
        res = await db.execute(select(SalesOrder))
        orders = res.scalars().all()
        assert len(orders) > 0, "Expected live sales orders in database"
        target_order = orders[0]
        order_id = target_order.id

    headers = _get_auth_headers()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 1: Get single Sales Order
        r = await client.get(f"/api/v1/sales/orders/{order_id}", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["id"] == order_id
        assert len(data.get("items", [])) > 0

        # Test 2: Get Sales Order HTML Preview
        r_html = await client.get(f"/api/v1/sales/orders/{order_id}/preview-html", headers=headers)
        assert r_html.status_code == 200
        assert "SALES ORDER CONFIRMATION" in r_html.text
        assert "TATTLY THREADS" in r_html.text

        # Test 3: Get Sales Order Fulfillment Variance Analytics
        r_var = await client.get("/api/v1/reports/sales-orders/fulfillment-variance", headers=headers)
        assert r_var.status_code == 200
        var_data = r_var.json()
        assert "summary" in var_data
        assert "aging_buckets" in var_data
        assert "stores" in var_data
        assert "styles" in var_data
        assert "orders" in var_data
        assert var_data["summary"]["total_orders"] > 0
        assert var_data["summary"]["total_booked_pairs"] > 0

        # Test 4: unsafe legacy conversion is explicitly unavailable.
        r_conv = await client.post(f"/api/v1/sales/orders/{order_id}/convert-to-invoice", headers=headers)
        assert r_conv.status_code == 410, f"Expected retired endpoint response, got {r_conv.status_code}: {r_conv.text}"
        assert "retired" in r_conv.json()["detail"]

        print("\n[SUCCESS] Sales Order read endpoints verified; unsafe legacy invoice conversion is retired.")
