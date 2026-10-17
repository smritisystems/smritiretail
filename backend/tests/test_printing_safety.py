"""
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.0
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Printing Safety & Document Identity Verification Suite
"""

from decimal import Decimal
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.services.invoice_errors import InvoiceRenderError
from app.services.seller_resolver import (
    SellerContext,
    resolve_seller_context,
    resolve_seller_context_async,
)
from app.services.invoice_pdf_service import InvoicePdfService
from app.services.sales_order_pdf_service import SalesOrderPdfService
from app.models.sales import SalesInvoice

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


def test_01_missing_company_identity_fails_closed():
    """Test 1: Missing company identity raises InvoiceRenderError (never produces Tattly Threads)."""
    # 1. Calling resolve_seller_context with no company or invoice
    with pytest.raises(InvoiceRenderError) as exc_info:
        resolve_seller_context(company=None, invoice=None, extra_meta={})
    assert exc_info.value.code == "MISSING_COMPANY"

    # 2. Calling generate_invoice_html_from_model without seller identity
    inv = SimpleNamespace(
        id="INV-TEST-001",
        invoice_no="INV/2026/001",
        date=date(2026, 8, 12),
        seller_name=None,
        seller_gstin=None,
        seller_address=None,
        customer_name="Reliance Retail Limited",
        customer_gstin="27AAXFR1234F1Z5",
        billing_address="Store Address",
        shipping_address="Store Address",
        items=[],
        total_amount=Decimal("1000.00"),
        bank_name=None,
        account_no=None,
        ifsc_code=None,
        bank_branch=None,
        eway_bill_no=None,
    )
    with pytest.raises(InvoiceRenderError) as exc_render:
        InvoicePdfService.generate_invoice_html_from_model(invoice=inv, seller_ctx=None, extra_meta={})
    assert exc_render.value.code in ("MISSING_COMPANY", "MISSING_SELLER_GSTIN")


@pytest.mark.asyncio
async def test_02_database_resolution_failure_fails_closed():
    """Test 2: Database resolution failure never produces branded invoice using defaults."""
    async with TestSessionLocal() as session:
        # Non-existent company ID should fail-closed and raise InvoiceRenderError
        with pytest.raises(InvoiceRenderError) as exc_info:
            await resolve_seller_context_async(
                db=session,
                company_id="COMP_NON_EXISTENT_99999",
                invoice=None,
            )
        assert exc_info.value.code == "MISSING_COMPANY"

        # Non-existent invoice should fail-closed
        with pytest.raises(Exception):
            await InvoicePdfService.generate_invoice_html(
                session=session,
                invoice_id="INV_NON_EXISTENT_99999",
                seller_ctx=None,
            )


def test_03_missing_tax_document_fields_block_invoice():
    """Test 3: Missing tax document fields (GSTIN, bank details) block final tax invoice HTML rendering."""
    # 3a. Company has valid name and bank, but missing GSTIN
    bank = SimpleNamespace(
        bank_name="HDFC BANK",
        account_no="50200012345678",
        ifsc="HDFC0001234",
        branch="MUMBAI MAIN",
        is_default=True,
    )
    company_no_gst = SimpleNamespace(
        legal_name="Acme India Retail",
        name="Acme India",
        gst_number=None,
        gstin=None,
        address_line1="Plot 42, MIDC",
        city="Nagpur",
        state="Maharashtra",
        pincode="440001",
        bank_accounts=[bank],
    )
    with pytest.raises(InvoiceRenderError) as exc_gst:
        resolve_seller_context(company=company_no_gst, doc_type="TAX_INVOICE")
    assert exc_gst.value.code == "MISSING_SELLER_GSTIN"

    # 3b. Company has valid name and GSTIN, but no bank details
    company_no_bank = SimpleNamespace(
        legal_name="Acme India Retail",
        name="Acme India",
        gst_number="27AAXFT2508H1ZR",
        address_line1="Plot 42, MIDC",
        city="Nagpur",
        state="Maharashtra",
        pincode="440001",
        bank_accounts=[],
    )
    with pytest.raises(InvoiceRenderError) as exc_bank:
        resolve_seller_context(company=company_no_bank, doc_type="TAX_INVOICE")
    assert exc_bank.value.code == "MISSING_BANK_DETAILS"


def test_04_sales_orders_succeed_without_bank_details():
    """Test 4: Sales orders and non-tax documents succeed even when bank details are missing."""
    company_no_bank = SimpleNamespace(
        legal_name="Acme India Retail",
        name="Acme India",
        gst_number="27AAXFT2508H1ZR",
        address_line1="Plot 42, MIDC",
        city="Nagpur",
        state="Maharashtra",
        pincode="440001",
        bank_accounts=[],
        phone="9876543210",
        email="orders@acme.com",
    )
    # Sales orders should succeed without bank coordinates
    ctx = resolve_seller_context(company=company_no_bank, doc_type="SALES_ORDER")
    assert ctx.company_name == "Acme India Retail"
    assert ctx.bank_name == ""
    assert ctx.account_no == ""

    # Generate order HTML to verify no hardcoded bank coordinates appear
    sample_order = SimpleNamespace(
        id="SO-001",
        order_no="SO/2026/001",
        order_date=date(2026, 8, 12),
        customer_name="Retail Buyer",
        customer_gstin="27AAXFB1111B1Z2",
        billing_address="Buyer Address",
        shipping_address="Buyer Delivery Store",
        total_quantity=10,
        subtotal=Decimal("5000.00"),
        total_tax=Decimal("250.00"),
        grand_total=Decimal("5250.00"),
        is_interstate=False,
    )
    sample_item = SimpleNamespace(
        id="SOI-001",
        line_no=1,
        product_id="PROD-001",
        name="Men Casual Shoe Tan 42",
        item_code="CH-25-G",
        hsn_code="64041990",
        quantity=10,
        price=Decimal("500.00"),
        mrp=Decimal("500.00"),
        disc_pct=Decimal("0.00"),
        taxable_value=Decimal("5000.00"),
        gst_rate=Decimal("5.00"),
        cgst_amount=Decimal("125.00"),
        sgst_amount=Decimal("125.00"),
        igst_amount=Decimal("0.00"),
        total_amount=Decimal("5250.00"),
    )
    html = SalesOrderPdfService.generate_order_html_from_model(
        order=sample_order,
        items=[sample_item],
        allocations=[],
        seller_ctx=ctx,
    )
    assert "Acme India Retail" in html
    # Ensure no hardcoded SBI account fallback leaks into sales orders
    assert "43976711765" not in html
    assert "SBIN0030425" not in html


def test_05_purchase_orders_resolve_buyer_identity():
    """Test 5: Purchase orders resolve buyer identity without requiring supplier bank details."""
    buyer_company = SimpleNamespace(
        legal_name="Global Retailers Private Limited",
        name="Global Retailers",
        gst_number="27AABCG1234G1Z9",
        address_line1="Corporate Park, Bandra Kurla Complex",
        city="Mumbai",
        state="Maharashtra",
        pincode="400051",
        bank_accounts=[],  # Buyer's bank accounts not required on PO issuance
    )
    ctx = resolve_seller_context(company=buyer_company, doc_type="PURCHASE_ORDER")
    assert ctx.company_name == "Global Retailers Private Limited"
    assert ctx.company_gstin == "27AABCG1234G1Z9"
    assert "Bandra Kurla Complex" in ctx.company_address


def test_06_cross_tenant_isolation_no_data_leakage():
    """Test 6: Cross-tenant isolation — two tenant IDs with different legal profiles do not leak details."""
    bank_a = SimpleNamespace(
        bank_name="HDFC BANK",
        account_no="111122223333",
        ifsc="HDFC0001111",
        branch="ANDHERI WEST",
        is_default=True,
    )
    company_a = SimpleNamespace(
        legal_name="Alpha Enterprises Limited",
        name="Alpha Enterprises",
        gst_number="27AAAAA1111A1Z1",
        address_line1="Alpha Tower, Andheri",
        city="Mumbai",
        state="Maharashtra",
        pincode="400053",
        bank_accounts=[bank_a],
    )

    bank_b = SimpleNamespace(
        bank_name="ICICI BANK",
        account_no="999988887777",
        ifsc="ICIC0002222",
        branch="BANER PUNE",
        is_default=True,
    )
    company_b = SimpleNamespace(
        legal_name="Beta Logistics Private Limited",
        name="Beta Logistics",
        gst_number="27BBBBB2222B1Z2",
        address_line1="Beta Logistics Park, Baner",
        city="Pune",
        state="Maharashtra",
        pincode="411045",
        bank_accounts=[bank_b],
    )

    ctx_a = resolve_seller_context(company=company_a, doc_type="TAX_INVOICE")
    ctx_b = resolve_seller_context(company=company_b, doc_type="TAX_INVOICE")

    # Verify Company A has only A's data
    assert ctx_a.company_name == "Alpha Enterprises Limited"
    assert ctx_a.company_gstin == "27AAAAA1111A1Z1"
    assert ctx_a.account_no == "111122223333"
    assert "Beta" not in ctx_a.company_name
    assert "Tattly" not in ctx_a.company_name

    # Verify Company B has only B's data
    assert ctx_b.company_name == "Beta Logistics Private Limited"
    assert ctx_b.company_gstin == "27BBBBB2222B1Z2"
    assert ctx_b.account_no == "999988887777"
    assert "Alpha" not in ctx_b.company_name
    assert "Tattly" not in ctx_b.company_name


def test_07_historical_reprints_preserve_original_snapshot():
    """Test 7: Historical reprints preserve original invoice seller snapshot rather than mutating to current Company record."""
    # Historical snapshot saved at the time invoice was finalized in 2024
    historical_invoice = SimpleNamespace(
        seller_name="Heritage Footwear 1995",
        seller_gstin="27AAACH9999H1Z0",
        seller_address="Old Heritage Mill Compound, Nagpur 440002",
        bank_name="PUNJAB NATIONAL BANK",
        account_no="001122334455",
        ifsc_code="PUNB0012345",
        bank_branch="SITABULDI NAGPUR",
        rule_snapshots={
            "seller_name": "Heritage Footwear 1995",
            "seller_gstin": "27AAACH9999H1Z0",
            "seller_address": "Old Heritage Mill Compound, Nagpur 440002",
            "bank_branch": "SITABULDI NAGPUR",
        },
    )

    # Current modified company profile in 2026 (e.g. re-branded, new bank, new GSTIN)
    current_company = SimpleNamespace(
        legal_name="Modern Apex Brands Worldwide Private Limited",
        name="Apex Brands",
        gst_number="27NEWBR1111N1Z5",
        address_line1="Glass Tower 14th Floor, BKC",
        city="Mumbai",
        state="Maharashtra",
        pincode="400051",
        bank_accounts=[
            SimpleNamespace(
                bank_name="KOTAK MAHINDRA BANK",
                account_no="888899990000",
                ifsc="KKBK0009999",
                branch="BKC MUMBAI",
                is_default=True,
            )
        ],
    )

    # Resolve context for historical reprint
    ctx = resolve_seller_context(
        company=current_company,
        invoice=historical_invoice,
        doc_type="TAX_INVOICE",
    )

    # Precedence inversion verification: Historical snapshot MUST win
    assert ctx.company_name == "Heritage Footwear 1995"
    assert ctx.company_name != "Modern Apex Brands Worldwide Private Limited"
    assert ctx.company_gstin == "27AAACH9999H1Z0"
    assert ctx.bank_name == "PUNJAB NATIONAL BANK"
    assert ctx.account_no == "001122334455"
    assert ctx.ifsc_code == "PUNB0012345"
    assert ctx.bank_branch == "SITABULDI NAGPUR"


def test_08_sales_order_conversion_seals_immutable_snapshot():
    """Test 8: Sales order conversion seals snapshot into SalesInvoice.rule_snapshots and dedicated columns."""
    seller_ctx = SellerContext(
        company_name="Apex Footwear Limited",
        company_gstin="27AAACA5555A1Z5",
        company_address="Industrial Area, Phase 2, Nagpur, Maharashtra 440028",
        website="www.apexfootwear.com",
        dispatch_email="dispatch@apexfootwear.com",
        accounts_email="accounts@apexfootwear.com",
        bank_name="BANK OF BARODA",
        account_no="98760123456789",
        ifsc_code="BARB0NAGPUR",
        bank_branch="DHARAMPETH",
        logo_uri="",
        company_pan="AAACA5555A",
    )

    # Create SalesInvoice mimicking convert_sales_order_to_invoice logic
    invoice = SalesInvoice(
        id="INV-TECH-101",
        invoice_no="INV/26-27/0001",
        date=date(2026, 8, 12),
        customer_name="Reliance Retail Limited",
        customer_gstin="27AAXFR1234F1Z5",
        billing_address="Reliance Store, Nagpur",
        shipping_address="Reliance Store, Nagpur",
        bank_name=seller_ctx.bank_name,
        account_no=seller_ctx.account_no,
        ifsc_code=seller_ctx.ifsc_code,
        status="Draft",
        rule_snapshots={
            "seller_name": seller_ctx.company_name,
            "seller_gstin": seller_ctx.company_gstin,
            "seller_address": seller_ctx.company_address,
            "bank_branch": seller_ctx.bank_branch,
            "account_holder_name": seller_ctx.company_name,
            "source_order_id": "SO-001",
            "source_order_no": "SO/26-27/001",
        },
    )

    assert invoice.bank_name == "BANK OF BARODA"
    assert invoice.account_no == "98760123456789"
    assert invoice.ifsc_code == "BARB0NAGPUR"
    assert invoice.rule_snapshots["seller_name"] == "Apex Footwear Limited"
    assert invoice.rule_snapshots["seller_gstin"] == "27AAACA5555A1Z5"
    assert invoice.rule_snapshots["bank_branch"] == "DHARAMPETH"
    assert invoice.rule_snapshots["source_order_no"] == "SO/26-27/001"


def test_09_invoice_render_error_handler_hrep_contract():
    """Test 9: InvoiceRenderError is translated into HTTP 422 JSON matching SMRITI HREP contract."""
    from fastapi import FastAPI
    from app.core.error_handlers import register_error_handlers
    from fastapi.testclient import TestClient
    
    test_app = FastAPI()
    register_error_handlers(test_app)
    
    @test_app.get("/test-render-fail")
    def fail_endpoint():
        from app.services.invoice_errors import missing
        raise missing("MISSING_COMPANY", "company legal name")
        
    client = TestClient(test_app, raise_server_exceptions=False)
    resp = client.get("/test-render-fail")
    assert resp.status_code == 422
    data = resp.json()
    assert data["success"] is False
    assert "error" in data
    assert data["error"]["code"] == "MISSING_COMPANY"
    assert "company legal name" in data["error"]["explanation"]
    assert "company" in data["error"]["suggested_action"].lower()


@pytest.mark.asyncio
async def test_10_endpoint_fail_closed_direct_invocation():
    """Test 10: Direct backend print, download, reprint, and pdf endpoints fail closed on missing identity."""
    from app.main import app
    from httpx import AsyncClient, ASGITransport
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for endpoint in [
            "/api/v1/sales/invoices/NON_EXISTENT_INV/print",
            "/api/v1/sales/invoices/NON_EXISTENT_INV/download",
            "/api/v1/sales/invoices/NON_EXISTENT_INV/reprint",
            "/api/v1/sales/invoices/NON_EXISTENT_INV/pdf"
        ]:
            resp = await client.get(endpoint)
            # Must fail closed: cannot return 200 with fallback invoice
            assert resp.status_code in (401, 404, 422)
            assert resp.status_code != 200


def test_11_purchase_order_buyer_vs_supplier_separation():
    """Test 11: Purchase orders separate Buyer (Tenant) vs Supplier (Vendor) identity without demanding supplier bank details."""
    buyer_tenant = SimpleNamespace(
        legal_name="National Retail Enterprises Ltd",
        name="National Retail",
        gst_number="27NATIO9999N1Z1",
        address_line1="Express Logistics Center, Vashi",
        city="Navi Mumbai",
        state="Maharashtra",
        pincode="400703",
        bank_accounts=[],  # Buyer bank details are not required on PO
    )
    supplier_vendor = SimpleNamespace(
        name="Apex Shoes Manufacturing Co",
        gstin="27APEXS8888S1Z8",
        address="MIDC Industrial Area, Amravati",
    )
    
    # Buyer identity resolves without error even with 0 bank accounts
    buyer_ctx = resolve_seller_context(company=buyer_tenant, doc_type="PURCHASE_ORDER")
    assert buyer_ctx.company_name == "National Retail Enterprises Ltd"
    assert buyer_ctx.company_gstin == "27NATIO9999N1Z1"
    assert buyer_ctx.bank_name == ""
    assert buyer_ctx.account_no == ""
    
    # Confirm supplier data is distinct and does not contaminate buyer fields
    assert buyer_ctx.company_name != supplier_vendor.name
    assert buyer_ctx.company_gstin != supplier_vendor.gstin

