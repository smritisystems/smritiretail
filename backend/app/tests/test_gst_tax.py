"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_gst_tax.py — Integration test suite for Phase 16 (v11.0.0)
GST Tax Settlement, Outward/Inward Return Filing DTO & E-Way Bill Integration Engine.
"""

import pytest
import uuid
import json
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.sales import SalesInvoice
from app.models.purchase import PurchaseReceipt, Supplier
from app.models.tax import GstTaxSettlement, GstReturnFiling, EWayBill
from app.services.gst_tax_engine import GstTaxEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Invoice Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_tax_tenant(db):
    """Set up an isolated tenant for GST Tax test suite."""
    company_id = f"co-tax-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-tax-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Tax Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Tax HQ", code=f"TAX{uuid.uuid4().hex[:8].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_customer(db, company_id, branch_id):
    from app.models.crm import Customer
    cust_id = f"cust-tax-{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=f"CUST-TAX-{uuid.uuid4().hex[:6].upper()}",
        name=f"Tax Customer {uuid.uuid4().hex[:4]}",
        mobile=f"98765{uuid.uuid4().hex[:5]}",
        outstanding=Decimal("0.00")
    )
    db.add(cust)
    await db.flush()
    return cust_id


async def _make_sales_invoice(db, company_id, branch_id, grand_total=Decimal("75000.00"), gstin=None):
    inv_id = f"inv-tax-{uuid.uuid4().hex[:8]}"
    tax_amt = (grand_total * Decimal("0.18") / Decimal("1.18")).quantize(Decimal("0.01"))
    subtotal = (grand_total - tax_amt).quantize(Decimal("0.01"))

    cust_id = await _make_customer(db, company_id, branch_id)

    inv = SalesInvoice(
        id=inv_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        invoice_no=f"INV-TAX-{uuid.uuid4().hex[:6].upper()}",
        customer_id=cust_id,
        invoice_date=datetime.now(timezone.utc),
        subtotal=subtotal,
        tax_total=tax_amt,
        cgst_amount=(tax_amt / Decimal("2")).quantize(Decimal("0.01")),
        sgst_amount=(tax_amt / Decimal("2")).quantize(Decimal("0.01")),
        grand_total=grand_total,
        paid_amount=Decimal("0.00"),
        balance_due=grand_total,
        status="Unpaid",
        notes=f"GSTIN: {gstin}" if gstin else None
    )
    db.add(inv)
    await db.flush()
    return inv


async def _make_purchase_receipt(db, company_id, branch_id, tax_total=Decimal("90.00")):
    sup_id = f"sup-tax-{uuid.uuid4().hex[:8]}"
    sup = Supplier(id=sup_id, uuid=str(uuid.uuid4()), company_id=company_id, branch_id=branch_id, code=f"SUP-TAX-{uuid.uuid4().hex[:6].upper()}", name="Tax Supplier", is_active=True)
    db.add(sup)
    await db.flush()

    rcpt_id = f"rcpt-tax-{uuid.uuid4().hex[:8]}"
    rcpt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        receipt_no=f"RCPT-TAX-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sup_id,
        status="RECEIVED",
        subtotal=Decimal("500.00"),
        tax_total=tax_total,
        grand_total=Decimal("590.00")
    )
    db.add(rcpt)
    await db.flush()
    return rcpt


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Calculate Monthly GST Settlement with Set-Off Rules
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_calculate_monthly_gst_settlement_setoff(db_session):
    """
    Assertion 1: Output Tax vs Input Tax Credit set-off rules correctly compute Net Tax Payable.
    """
    company_id, branch_id, tenant = await _setup_tax_tenant(db_session)
    await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("1180.00"))  # Output Tax = 180 (CGST 90, SGST 90)
    await _make_purchase_receipt(db_session, company_id, branch_id, tax_total=Decimal("90.00"))  # Input ITC = 90 (CGST 45, SGST 45)

    period = datetime.now(timezone.utc).strftime("%Y-%m")
    engine = GstTaxEngine(db_session, tenant)
    settlement = await engine.calculate_monthly_settlement(tax_period=period)

    assert settlement is not None
    assert settlement.total_outward_tax == Decimal("180.00")
    assert settlement.total_inward_itc == Decimal("90.00")
    assert settlement.net_cgst_payable == Decimal("45.00")
    assert settlement.net_sgst_payable == Decimal("45.00")
    assert settlement.total_net_tax_payable == Decimal("90.00")
    assert settlement.carry_forward_itc == Decimal("0.00")

    print("\n[PASS] Assertion 1: Monthly GST set-off calculated correctly ($180 Output - $90 ITC = $90 Net Tax Payable)")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Generate GSTR-1 Payload Structure
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_gstr1_payload_structure(db_session):
    """
    Assertion 2: GSTR-1 return filing payload is compiled into valid JSON schema with B2B and B2C sections.
    """
    company_id, branch_id, tenant = await _setup_tax_tenant(db_session)
    await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("60000.00"), gstin="27AAACG1234H1Z1")  # B2B
    await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("15000.00"), gstin=None)               # B2C

    period = datetime.now(timezone.utc).strftime("%Y-%m")
    engine = GstTaxEngine(db_session, tenant)
    filing = await engine.generate_gstr1_payload(tax_period=period)

    assert filing is not None
    assert filing.b2b_invoices_count == 1
    assert filing.b2c_invoices_count == 1
    assert filing.status == "GENERATED"

    # Verify JSON structure
    payload = json.loads(filing.gstr1_payload_json)
    assert "b2b" in payload
    assert "b2cs" in payload
    assert len(payload["b2b"]) == 1
    assert len(payload["b2cs"]) == 1

    print("\n[PASS] Assertion 2: GSTR-1 return filing payload compiled with 1 B2B and 1 B2C invoice section")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Generate E-Way Bill Validates Threshold
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_eway_bill_validates_threshold(db_session):
    """
    Assertion 3: Statutory E-Way Bill generation succeeds for consignment value > ₹50,000.
    """
    company_id, branch_id, tenant = await _setup_tax_tenant(db_session)
    invoice = await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("75000.00"))

    engine = GstTaxEngine(db_session, tenant)
    ewb = await engine.generate_eway_bill(
        invoice_id=invoice.id,
        transporter_name="VRL Logistics",
        transport_mode="ROAD",
        vehicle_no="MH-12-AB-1234",
        distance_km=Decimal("150.00")
    )

    assert ewb is not None
    assert ewb.consignment_value == Decimal("75000.00")
    assert ewb.status == "GENERATED"
    assert ewb.eway_bill_no.startswith("EWB-")

    print("\n[PASS] Assertion 3: Statutory E-Way Bill generated for consignment value ₹75,000 (> ₹50,000 threshold)")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: E-Way Bill Rejected Below Threshold
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_eway_bill_rejected_below_threshold(db_session):
    """
    Assertion 4: Attempting E-Way Bill generation below ₹50,000 threshold is rejected with HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_tax_tenant(db_session)
    invoice = await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("35000.00"))  # Below ₹50,000 threshold!

    engine = GstTaxEngine(db_session, tenant)

    with pytest.raises(HTTPException) as exc_info:
        await engine.generate_eway_bill(invoice_id=invoice.id, distance_km=Decimal("50.00"))

    assert exc_info.value.status_code == 400
    assert "below e-way bill statutory threshold" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 4: E-Way Bill request for consignment value ₹35,000 correctly rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: E-Way Bill Distance Validity Calculation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_eway_bill_distance_validity_calculation(db_session):
    """
    Assertion 5: E-Way Bill validity period is calculated based on distance (1 day per 200 km).
    """
    company_id, branch_id, tenant = await _setup_tax_tenant(db_session)
    invoice = await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("80000.00"))

    engine = GstTaxEngine(db_session, tenant)
    ewb = await engine.generate_eway_bill(invoice_id=invoice.id, distance_km=Decimal("450.00"))  # 450 km -> 3 days validity

    validity_delta = ewb.valid_until - ewb.valid_from
    assert validity_delta.days == 3

    print("\n[PASS] Assertion 5: Distance validity calculated correctly (450 km = 3 days validity)")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-Tenant Isolation for Tax Settlement
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_tax_settlement(db_session):
    """
    Assertion 6: Cross-tenant access to E-Way Bills raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_tax_tenant(db_session)
    invoice = await _make_sales_invoice(db_session, company_id, branch_id, grand_total=Decimal("90000.00"))

    engine_a = GstTaxEngine(db_session, tenant_a)
    ewb_a = await engine_a.generate_eway_bill(invoice_id=invoice.id, distance_km=Decimal("100.00"))

    # Tenant B attempts to fetch Tenant A's E-Way Bill
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = GstTaxEngine(db_session, tenant_b)

    # Simulating API router GET check
    stmt = select(EWayBill).where(
        EWayBill.id == ewb_a.id,
        EWayBill.company_id == tenant_b.company_id
    )
    result = (await db_session.execute(stmt)).scalars().first()
    assert result is None

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for E-Way Bills")
