"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.39.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.api.deps import get_company_db
from app.db.session import get_company_sessionmaker

TEST_DB_NAME = "smriti_test_phase2c"


@pytest.fixture(autouse=True)
def override_db_dependency():
    session_factory = get_company_sessionmaker(TEST_DB_NAME)

    async def _override_get_company_db():
        async with session_factory() as session:
            session.info.update({
                "tenant_id": TEST_DB_NAME,
                "company_id": "COMP-001",
                "branch_id": "BR-001",
                "resolved_database_name": TEST_DB_NAME,
                "control_plane_database": "smritisys",
                "transactional_scope_validated": True,
            })
            yield session

    app.dependency_overrides[get_company_db] = _override_get_company_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_company_db, None)


def _get_auth_headers():
    token = create_access_token(data={
        "sub": "usr-super",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "BR-001",
        "tenant_id": "smriti_test_phase2c",
        "db_name": "smriti_test_phase2c",
        "is_active": True,
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001"
    }


@pytest.mark.asyncio
async def test_tax_register_report_endpoint():
    """RPT-TAX-001 / SR202300 Tax Register verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/tax-register", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_invoices" in data
        assert "total_taxable" in data
        assert "total_tax" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_bill_wise_sales_report_endpoint():
    """RPT-TAX-002 / SR202400 Bill-wise Sales verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/bill-wise-sales", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_bills" in data
        assert "total_gross" in data
        assert "total_net" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_item_wise_sales_report_endpoint():
    """RPT-TAX-003 / SR202200 Item-wise Sales verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/item-wise-sales", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_items" in data
        assert "total_qty" in data
        assert "total_net" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_cancelled_bills_report_endpoint():
    """RPT-TAX-004 / SR210200 Cancelled Bills verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/cancelled-bills", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_cancelled" in data
        assert "total_value_voided" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_bill_wise_items_report_endpoint():
    """RPT-TAX-005 / SR202000 Bill-wise Items Detail verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/bill-wise-items", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_invoices" in data
        assert "total_lines" in data
        assert "total_quantity" in data
        assert "total_amount" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_salesperson_discount_report_endpoint():
    """RPT-MIS-005 / SR238400 Salesperson-wise Discount verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/salesperson-discount", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_salespersons" in data
        assert "total_discount" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_discount_summary_report_endpoint():
    """RPT-OPS-001 / SR202100 Discount Given Summary verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/discount-summary", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_bills" in data
        assert "total_gross" in data
        assert "total_discount" in data
        assert "total_net" in data
        assert "overall_discount_pct" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_item_wise_returns_report_endpoint():
    """RPT-MRC-003 / SR214100 Item-wise Sales Returns verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/item-wise-returns", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_returns" in data
        assert "total_qty" in data
        assert "total_amount" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_attribute_size_sales_report_endpoint():
    """RPT-MRC-001 / SR236300 Attribute+Size wise Sales verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/attribute-size-sales", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_groups" in data
        assert "total_qty" in data
        assert "total_net" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)


@pytest.mark.asyncio
async def test_purchase_inward_register_report_endpoint():
    """RPT-PUR-001 / Purchase Inward Register (GRN Detailed Line Items) verification."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/reports/purchase-inward-register", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "total_grns" in data
        assert "total_qty" in data
        assert "total_landed" in data
        assert "lines" in data
        assert isinstance(data["lines"], list)
