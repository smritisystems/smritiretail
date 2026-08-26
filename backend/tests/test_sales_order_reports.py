"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.39.0
Created      : 2026-08-26
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
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
async def test_sales_order_summary_report_endpoint():
    """RPT-SO-001: Sales Order Summary Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/summary", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_orders" in data
        assert "total_ordered_qty" in data
        assert "total_order_value" in data
        assert "total_billed_value" in data
        assert "total_pending_value" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_pending_sales_orders_report_endpoint():
    """RPT-SO-002: Pending Orders Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/pending", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_pending_orders" in data
        assert "total_pending_qty" in data
        assert "total_pending_value" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_billed_vs_pending_orders_report_endpoint():
    """RPT-SO-003: Billed vs Pending Orders Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/billed-vs-pending", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_orders" in data
        assert "total_order_value" in data
        assert "total_billed_value" in data
        assert "total_pending_value" in data
        assert "overall_billing_pct" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_customer_wise_orders_report_endpoint():
    """RPT-SO-004: Customer-wise Orders Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/customer-wise", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_customers" in data
        assert "total_orders" in data
        assert "total_value" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_product_wise_ordered_quantity_report_endpoint():
    """RPT-SO-005: Product-wise Ordered Quantity Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/product-wise", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_products" in data
        assert "total_ordered_qty" in data
        assert "total_value" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_order_fulfillment_status_report_endpoint():
    """RPT-SO-006: Order Fulfillment Status Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/fulfillment-status", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_orders" in data
        assert "total_value" in data
        assert "groups" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_invoice_allocation_report_endpoint():
    """RPT-SO-007: Invoice Allocation Report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/invoice-allocations", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_allocations" in data
        assert "total_po_value" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_shoper9_sales_reports_endpoints():
    """Verify Shoper9 Sales Report endpoints run with valid 200 responses."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        endpoints = [
            "/api/v1/sales-reports/top-selling",
            "/api/v1/sales-reports/day-wise",
            "/api/v1/sales-reports/salesperson-sales",
            "/api/v1/sales-reports/salesperson-summary",
            "/api/v1/sales-reports/returned-bills",
            "/api/v1/sales-reports/node-wise",
            "/api/v1/sales-reports/bill-items-live",
            "/api/v1/sales-reports/size-wise",
            "/api/v1/sales-reports/item-returns-live",
        ]
        for ep in endpoints:
            res = await client.get(ep, headers=_get_auth_headers())
            assert res.status_code == 200, f"Failed on {ep}: {res.status_code} - {res.text}"
            data = res.json()
            assert isinstance(data, dict), f"Expected dict response for {ep}"
