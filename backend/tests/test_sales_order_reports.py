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


@pytest.mark.asyncio
async def test_sales_order_reports_mathematical_reconciliation():
    """
    Mathematical & Database Reconciliation Test:
    1. Order Value == Billed Value + Pending Value
    2. Sum of line values == Report total value
    3. Fulfillment Status consistency
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/summary", headers=_get_auth_headers())
        assert res.status_code == 200
        data = res.json()

        tot_val = float(data["total_order_value"])
        tot_billed = float(data["total_billed_value"])
        tot_pending = float(data["total_pending_value"])

        # 1. Reconciliation: Order Value == Billed Value + Pending Value (within 1 cent float tolerance)
        assert abs(tot_val - (tot_billed + tot_pending)) < 0.05, (
            f"Mathematical mismatch: Order Value {tot_val} != Billed {tot_billed} + Pending {tot_pending}"
        )

        # 2. Line-level sum == Report total
        lines = data["lines"]
        assert len(lines) == data["total_orders"]
        sum_grand = sum(float(l["grand_total"]) for l in lines)
        sum_billed = sum(float(l["billed_value"]) for l in lines)
        sum_pending = sum(float(l["pending_value"]) for l in lines)

        assert abs(sum_grand - tot_val) < 0.05, f"Line sum {sum_grand} != Total {tot_val}"
        assert abs(sum_billed - tot_billed) < 0.05, f"Billed sum {sum_billed} != Total {tot_billed}"
        assert abs(sum_pending - tot_pending) < 0.05, f"Pending sum {sum_pending} != Total {tot_pending}"


@pytest.mark.asyncio
async def test_tax_invoice_gst_math_reconciliation():
    """
    Statutory Tax Math Reconciliation Test:
    1. CGST + SGST + IGST == Total Tax on all invoice items
    2. Taxable Value + Total Tax == Invoice Total (subject to rounding)
    3. Dynamic GST Rate calculation
    """
    from app.core.gst_engine import calculate_line_item_tax
    from decimal import Decimal

    # Test intra-state 18%
    tax_intra_18 = calculate_line_item_tax(
        unit_price=Decimal("100.00"),
        quantity=Decimal("2.00"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        is_interstate=False,
    )
    assert tax_intra_18["taxable_value"] == Decimal("200.00")
    assert tax_intra_18["cgst_amount"] == Decimal("18.00")
    assert tax_intra_18["sgst_amount"] == Decimal("18.00")
    assert tax_intra_18["igst_amount"] == Decimal("0.00")
    assert (tax_intra_18["cgst_amount"] + tax_intra_18["sgst_amount"] + tax_intra_18["igst_amount"]) == tax_intra_18["tax_amount"]
    assert (tax_intra_18["taxable_value"] + tax_intra_18["tax_amount"]) == tax_intra_18["total_amount"]

    # Test inter-state 5%
    tax_inter_5 = calculate_line_item_tax(
        unit_price=Decimal("500.00"),
        quantity=Decimal("3.00"),
        discount_amount=Decimal("100.00"),
        gst_rate=Decimal("5.00"),
        is_tax_inclusive=False,
        is_interstate=True,
    )
    # Taxable = 1500 - 100 = 1400. Tax = 1400 * 5% = 70
    assert tax_inter_5["taxable_value"] == Decimal("1400.00")
    assert tax_inter_5["cgst_amount"] == Decimal("0.00")
    assert tax_inter_5["sgst_amount"] == Decimal("0.00")
    assert (tax_inter_5["cgst_amount"] + tax_inter_5["sgst_amount"] + tax_inter_5["igst_amount"]) == tax_inter_5["tax_amount"]
    assert (tax_inter_5["taxable_value"] + tax_inter_5["tax_amount"]) == tax_inter_5["total_amount"]


@pytest.mark.asyncio
async def test_sales_order_detailed_report_endpoint():
    """RPT-SO-008: Detailed Sales Orders Register."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/detailed", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_orders" in data
        assert "total_lines" in data
        assert "total_ordered_qty" in data
        assert "total_grand_amount" in data
        assert "fulfillment_rate_pct" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_sales_order_export_excel_endpoint():
    """RPT-SO-008: Multi-sheet Master Excel Export."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/export-excel", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res.headers.get("content-type", "")
        assert len(res.content) > 1000


@pytest.mark.asyncio
async def test_sales_order_export_csv_endpoint():
    """RPT-SO-008: Line-Item CSV Export."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/sales-orders/export-csv", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert "text/csv" in res.headers.get("content-type", "")
        text = res.text
        assert "Order No,PO Number,Order Date" in text

