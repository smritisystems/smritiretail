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
from httpx import ASGITransport, AsyncClient
from sqlalchemy import or_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token
from app.db.session import async_session, get_company_sessionmaker
from app.main import app
from app.models.sales import SalesOrder
from app.models.tenant import Branch


def _get_auth_headers(branch_id="BR-001"):
    token = create_access_token(data={
        "sub": "usr-super",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": branch_id,
        "tenant_id": "smriti001",
        "db_name": "smriti001",
        "is_active": True,
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": branch_id
    }


@pytest.mark.asyncio
async def test_sales_order_full_suite():
    """Verify Sales Order PDF, HTML Preview, 1-Click Invoice Conversion, and Fulfillment Variance."""
    
    async with async_session() as control_db:
        branch_result = await control_db.execute(
            select(Branch.id).where(
                Branch.company_id == "COMP-001",
                Branch.is_default.is_(True),
                Branch.is_deleted.is_(False),
                Branch.is_active.is_(True),
            )
        )
        default_branch_id = branch_result.scalar_one()

    # 1. Select a live order visible to the default branch.
    sm = get_company_sessionmaker("smriti001")
    async with sm() as db:
        res = await db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.company_id == "COMP-001",
                or_(
                    SalesOrder.branch_id == default_branch_id,
                    SalesOrder.branch_id.is_(None),
                ),
                SalesOrder.is_deleted == False,
            )
            .order_by(SalesOrder.date.desc(), SalesOrder.order_no)
        )
        orders = res.scalars().all()
        assert orders, "Expected a live sales order for COMP-001"
        target_order = orders[0]
        assert target_order.items, "Expected the selected sales order to have items"
        order_id = target_order.id
        customer_name = target_order.customer_name

    headers = _get_auth_headers(default_branch_id)
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
        assert customer_name in r_html.text

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
