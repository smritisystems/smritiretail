"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 2 Headless Billing Core & GST Parity Test Suite
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.core.config import settings
from app.api.deps import TenantContext
from app.core.gst_engine import round_currency, calculate_line_item_tax
from app.models.tenant import Company, Branch
from app.models.auth import User
from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.models.crm import Customer, CustomerGroup, CustomerCreditLedgerEntry
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.accounting import JournalVoucher, GeneralLedgerEntry
from app.models.outbox import OutboxEvent
from app.models.transaction_integrity import TransactionIdempotencyRecord
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    BillingCalculationResult,
)
from app.services.headless_billing import HeadlessBillingCore
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.api.v1.billing import preview, checkout


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_fixtures(session):
    s = uuid.uuid4().hex[:8]
    company_id = f"CMP-{s}"
    branch_id = f"BR-{s}"
    user_id = f"USR-{s}"
    warehouse_id = f"WH-{s}"
    customer_group_id = f"CG-{s}"
    customer_id = f"CUST-{s}"
    product_id = f"PRD-{s}"

    # Company (Maharashtra - State 27)
    comp = Company(
        id=company_id,
        name=f"Headless Billing Test Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    session.add(comp)

    # Branch
    branch = Branch(
        id=branch_id,
        company_id=company_id,
        name=f"Headless Branch {s}",
        code=f"HBR_{s}".upper()[:16],
        is_active=True,
    )
    session.add(branch)
    await session.flush()

    # Warehouse
    warehouse = Warehouse(
        id=warehouse_id,
        company_id=company_id,
        branch_id=branch_id,
        code=f"HWH_{s}".upper()[:16],
        name="Headless Warehouse",
        is_active=True,
        address="100 Technology Park",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
    )
    session.add(warehouse)

    # Cashier User
    cashier = User(
        id=user_id,
        company_id=company_id,
        branch_id=branch_id,
        username=f"cashier_{s}",
        email=f"cashier_{s}@smritibooks.com",
        hashed_password="mock_hashed_password_headless",
        role="CASHIER",
        is_active=True,
    )
    session.add(cashier)

    # Customer Group
    group = CustomerGroup(
        id=customer_group_id,
        company_id=company_id,
        branch_id=branch_id,
        name=f"Retail Group {s}",
        credit_limit=Decimal("50000.00"),
        credit_days=30,
        can_purchase_on_credit=True,
        credit_hold=False,
        allow_override=True,
        max_discount_percent=Decimal("50.00"),
    )
    session.add(group)

    # Product
    prod = Product(
        id=product_id,
        company_id=company_id,
        branch_id=branch_id,
        name="Leather Wallet",
        code=f"WAL-{s}".upper()[:20],
        barcode=f"890200{s[:6]}",
        category="Accessories",
        mrp=Decimal("1499.00"),
        price=Decimal("1499.00"),
        gst_percentage=Decimal("12.00"),
        stock=Decimal("100.00"),
        is_active=True,
    )
    session.add(prod)
    await session.flush()

    # Intra-state Customer (State 27)
    customer = Customer(
        id=customer_id,
        company_id=company_id,
        branch_id=branch_id,
        customer_group_id=customer_group_id,
        name="Ramesh Retailers",
        mobile="9820012345",
        gst_number="27ABCDE9999F1Z9",
        outstanding=Decimal("1000.00"),
        is_active=True,
    )
    session.add(customer)

    # Product Batch Stock
    pbs = ProductBatchStock(
        id=f"pbs-{s}",
        uuid=f"pbs-{s}",
        company_id=company_id,
        branch_id=branch_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        batch_no="BATCH-001",
        quantity=Decimal("100.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("1499.00"),
        sale_rate=Decimal("1499.00"),
    )
    session.add(pbs)
    await session.commit()

    return {
        "company_id": company_id,
        "branch_id": branch_id,
        "warehouse_id": warehouse_id,
        "user_id": user_id,
        "cashier": cashier,
        "product": prod,
        "customer": customer,
        "customer_id": customer_id,
    }


# =========================================================================
# Scenario A: Basic Line Calculation
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_a_basic_line_calculation(session_factory):
    """
    Scenario A: Basic line calculation with single quantity, exclusive tax.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.gross_amount == Decimal("1000.00")
        assert res.discount_amount == Decimal("0.00")
        assert res.discounted_base == Decimal("1000.00")
        assert res.taxable_amount == Decimal("1000.00")
        assert res.tax_total == Decimal("180.00")
        assert res.cgst_amount == Decimal("90.00")
        assert res.sgst_amount == Decimal("90.00")
        assert res.igst_amount == Decimal("0.00")
        assert res.subtotal == Decimal("1180.00")
        assert res.net_amount == Decimal("1180.00")
        assert res.round_off == Decimal("0.00")
        assert len(res.lines) == 1


# =========================================================================
# Scenario B: Multiple Quantities
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_b_multiple_quantities(session_factory):
    """
    Scenario B: Line calculation scales linearly with multiple quantities.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("5.00"),
                    unit_price=Decimal("200.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.total_quantity == Decimal("5.00")
        assert res.gross_amount == Decimal("1000.00")
        assert res.taxable_amount == Decimal("1000.00")
        assert res.cgst_amount == Decimal("90.00")
        assert res.sgst_amount == Decimal("90.00")
        assert res.tax_total == Decimal("180.00")
        assert res.net_amount == Decimal("1180.00")


# =========================================================================
# Scenario C: Percentage Discount
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_c_percentage_discount(session_factory):
    """
    Scenario C: Percentage discount reduces gross base and GST proportionally.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1000.00"),
                    disc_pct=Decimal("10.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        # Gross: 2000.00, Disc (10%): 200.00, Taxable: 1800.00, Tax (18%): 324.00, Net: 2124.00
        assert res.gross_amount == Decimal("2000.00")
        assert res.discount_amount == Decimal("200.00")
        assert res.discounted_base == Decimal("1800.00")
        assert res.taxable_amount == Decimal("1800.00")
        assert res.tax_total == Decimal("324.00")
        assert res.cgst_amount == Decimal("162.00")
        assert res.sgst_amount == Decimal("162.00")
        assert res.net_amount == Decimal("2124.00")


# =========================================================================
# Scenario D: Fixed Discount
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_d_fixed_discount(session_factory):
    """
    Scenario D: Fixed discount amount applies directly to line.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1000.00"),
                    disc_amt=Decimal("150.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        # Gross: 2000.00, Disc: 150.00, Taxable: 1850.00, Tax (18%): 333.00, Net: 2183.00
        assert res.gross_amount == Decimal("2000.00")
        assert res.discount_amount == Decimal("150.00")
        assert res.discounted_base == Decimal("1850.00")
        assert res.taxable_amount == Decimal("1850.00")
        assert res.tax_total == Decimal("333.00")
        assert res.cgst_amount == Decimal("166.50")
        assert res.sgst_amount == Decimal("166.50")
        assert res.net_amount == Decimal("2183.00")


# =========================================================================
# Scenario E: Zero Discount
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_e_zero_discount(session_factory):
    """
    Scenario E: Zero discount ensures gross base equals taxable base for exclusive items.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("500.00"),
                    disc_pct=Decimal("0.00"),
                    disc_amt=Decimal("0.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("5.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.discount_amount == Decimal("0.00")
        assert res.gross_amount == res.discounted_base == res.taxable_amount == Decimal("500.00")
        assert res.tax_total == Decimal("25.00")
        assert res.net_amount == Decimal("525.00")


# =========================================================================
# Scenario F: Invalid / Zero Quantity & Price Validation
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_f_invalid_quantity_and_price_validation(session_factory):
    """
    Scenario F: Validates non-positive quantity, negative price, and MRP breach rejections.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)

        # 1. Zero quantity rejection (SMRITI-VAL-002)
        req_zero_qty = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("0.00"),
                    unit_price=Decimal("100.00"),
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_qty:
            await HeadlessBillingCore.calculate_billing(session=session, req=req_zero_qty)
        assert exc_qty.value.status_code == 400
        assert "SMRITI-VAL-002" in exc_qty.value.detail

        # 2. Negative unit price rejection (SMRITI-VAL-003)
        req_neg_price = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("-50.00"),
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_price:
            await HeadlessBillingCore.calculate_billing(session=session, req=req_neg_price)
        assert exc_price.value.status_code == 400
        assert "SMRITI-VAL-003" in exc_price.value.detail

        # 3. Price exceeds statutory MRP (SMRITI-PRICE-001)
        req_mrp_breach = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2000.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_mrp:
            await HeadlessBillingCore.calculate_billing(session=session, req=req_mrp_breach)
        assert exc_mrp.value.status_code == 400
        assert "SMRITI-PRICE-001" in exc_mrp.value.detail


# =========================================================================
# Scenario G: Intra-State GST (CGST + SGST)
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_g_intra_state_gst(session_factory):
    """
    Scenario G: Intra-state transaction (Seller=27, Buyer=27) levies CGST & SGST with zero IGST.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.is_interstate is False
        assert res.igst_amount == Decimal("0.00")
        assert res.cgst_amount == Decimal("90.00")
        assert res.sgst_amount == Decimal("90.00")
        assert res.tax_total == (res.cgst_amount + res.sgst_amount)


# =========================================================================
# Scenario H: Inter-State GST (IGST)
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_h_inter_state_gst(session_factory):
    """
    Scenario H: Inter-state transaction (Seller=27, Buyer=29 Karnataka) levies 100% IGST with zero CGST/SGST.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_gstin="29ABCDE1234F1Z5",  # Karnataka state 29
            place_of_supply="29",
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.is_interstate is True
        assert res.cgst_amount == Decimal("0.00")
        assert res.sgst_amount == Decimal("0.00")
        assert res.igst_amount == Decimal("180.00")
        assert res.tax_total == Decimal("180.00")
        assert res.net_amount == Decimal("1180.00")


# =========================================================================
# Scenario I: CGST / SGST Rounding & Remainder Conservation (ADR Frozen Example)
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_i_cgst_sgst_rounding_adr_frozen_example(session_factory):
    """
    Scenario I: Validates the exact ADR Section 1.3 frozen example:
    Gross: ₹2,998.00, Disc (10%): ₹299.80, Base: ₹2,698.20,
    Taxable: ₹2,409.11, Tax: ₹289.09, CGST: ₹144.55, SGST: ₹144.54,
    Subtotal: ₹2,698.20, Round-off: ₹0.00, Net: ₹2,698.20.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1499.00"),
                    disc_pct=Decimal("10.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("12.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.gross_amount == Decimal("2998.00")
        assert res.discount_amount == Decimal("299.80")
        assert res.discounted_base == Decimal("2698.20")
        assert res.taxable_amount == Decimal("2409.11")
        assert res.tax_total == Decimal("289.09")
        assert res.cgst_amount == Decimal("144.55")
        assert res.sgst_amount == Decimal("144.54")
        assert (res.cgst_amount + res.sgst_amount) == res.tax_total  # Remainder conserved
        assert res.subtotal == Decimal("2698.20")
        assert res.round_off == Decimal("0.00")
        assert res.net_amount == Decimal("2698.20")


# =========================================================================
# Scenario J: IGST Rounding (ADR Frozen Example Inter-State)
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_j_igst_rounding_adr_frozen_example(session_factory):
    """
    Scenario J: ADR Section 1.3 frozen example for inter-state supply:
    IGST: ₹289.09 with zero CGST/SGST.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1499.00"),
                    disc_pct=Decimal("10.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("12.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_gstin="29ABCDE1234F1Z5",  # Inter-state
            place_of_supply="29",
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert res.gross_amount == Decimal("2998.00")
        assert res.discount_amount == Decimal("299.80")
        assert res.discounted_base == Decimal("2698.20")
        assert res.taxable_amount == Decimal("2409.11")
        assert res.tax_total == Decimal("289.09")
        assert res.cgst_amount == Decimal("0.00")
        assert res.sgst_amount == Decimal("0.00")
        assert res.igst_amount == Decimal("289.09")
        assert res.subtotal == Decimal("2698.20")
        assert res.net_amount == Decimal("2698.20")


# =========================================================================
# Scenario K: ROUND_HALF_UP Boundary Cases
# =========================================================================
def test_scenario_k_round_half_up_boundary_cases():
    """
    Scenario K: Validates deterministic commercial ROUND_HALF_UP rounding across critical boundaries.
    """
    assert round_currency(Decimal("0.005")) == Decimal("0.01")
    assert round_currency(Decimal("0.0049")) == Decimal("0.00")
    assert round_currency(Decimal("0.015")) == Decimal("0.02")
    assert round_currency(Decimal("0.025")) == Decimal("0.03")
    assert round_currency(Decimal("0.125")) == Decimal("0.13")
    assert round_currency(Decimal("0.375")) == Decimal("0.38")
    assert round_currency(Decimal("144.545")) == Decimal("144.55")
    assert round_currency(Decimal("144.5449")) == Decimal("144.54")


# =========================================================================
# Scenario L & M: Multiple-Line Aggregation & Header Subtotal
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_l_m_multiple_line_aggregation_and_subtotal(session_factory):
    """
    Scenario L & M: Multiple lines with mixed GST rates aggregate cleanly to header subtotal.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)

        # Create two additional products with 5% and 18% GST
        p_5 = Product(
            id=f"PRD-5-{uuid.uuid4().hex[:6]}",
            company_id=fx["company_id"],
            branch_id=fx["branch_id"],
            name="Socks (5% GST)",
            code=f"SOC-{uuid.uuid4().hex[:6]}",
            barcode=f"890500{uuid.uuid4().hex[:6]}",
            category="Accessories",
            price=Decimal("100.00"),
            mrp=Decimal("100.00"),
            gst_percentage=Decimal("5.00"),
            stock=Decimal("50.00"),
            is_active=True,
        )
        p_18 = Product(
            id=f"PRD-18-{uuid.uuid4().hex[:6]}",
            company_id=fx["company_id"],
            branch_id=fx["branch_id"],
            name="Belt (18% GST)",
            code=f"BLT-{uuid.uuid4().hex[:6]}",
            barcode=f"890600{uuid.uuid4().hex[:6]}",
            category="Accessories",
            price=Decimal("500.00"),
            mrp=Decimal("500.00"),
            gst_percentage=Decimal("18.00"),
            stock=Decimal("50.00"),
            is_active=True,
        )
        session.add_all([p_5, p_18])
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,  # 12% GST
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1499.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("12.00"),
                    mrp=Decimal("1499.00"),
                ),
                CanonicalPostingLineItem(
                    code=p_5.code,  # 5% GST
                    quantity=Decimal("3.00"),
                    unit_price=Decimal("100.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("5.00"),
                    mrp=Decimal("100.00"),
                ),
                CanonicalPostingLineItem(
                    code=p_18.code,  # 18% GST
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("500.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("500.00"),
                ),
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert len(res.lines) == 3
        assert res.items_count == 3
        assert res.total_quantity == Decimal("6.00")

        # Sum of lines equals header totals
        line_taxable_sum = sum(l.taxable_value for l in res.lines)
        line_tax_sum = sum(l.tax_amount for l in res.lines)
        line_total_sum = sum(l.total_amount for l in res.lines)

        assert res.taxable_amount == line_taxable_sum
        assert res.tax_total == line_tax_sum
        assert res.subtotal == line_total_sum
        assert res.net_amount == (res.subtotal + res.round_off)


# =========================================================================
# Scenario N & O: Round-off & Final Net Determination
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_n_o_round_off_and_final_net(session_factory):
    """
    Scenario N & O: Final net equals subtotal plus round_off delta.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("333.33"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        # Taxable: 333.33, Tax (18%): 60.00 (CGST 30.00, SGST 30.00), Subtotal: 393.33
        assert res.taxable_amount == Decimal("333.33")
        assert res.tax_total == Decimal("60.00")
        assert res.subtotal == Decimal("393.33")
        assert res.net_amount == res.subtotal + res.round_off
        assert res.net_amount == round_currency(res.subtotal)


# =========================================================================
# Scenario P: Preview Has Zero Financial Mutation (Genuinely Read-Only)
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_p_preview_zero_financial_mutation(session_factory):
    """
    Scenario P: POST /api/v1/billing/preview performs ZERO mutations:
    - 0 Invoices created
    - 0 Invoice Items created
    - 0 Stock Movements created
    - 0 Customer Credit Ledger entries created
    - 0 General Ledger entries created
    - 0 Outbox events created
    - 0 Idempotency records created
    - Stock quantity and customer balance remain unchanged.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)

        # Record counts and values before preview
        cnt_inv_before = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        cnt_sm_before = await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.company_id == fx["company_id"]))
        cnt_ccl_before = await session.scalar(select(func.count()).select_from(CustomerCreditLedgerEntry).where(CustomerCreditLedgerEntry.company_id == fx["company_id"]))
        cnt_gl_before = await session.scalar(select(func.count()).select_from(GeneralLedgerEntry).where(GeneralLedgerEntry.company_id == fx["company_id"]))
        cnt_outbox_before = await session.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.company_id == fx["company_id"]))
        cnt_idemp_before = await session.scalar(select(func.count()).select_from(TransactionIdempotencyRecord).where(TransactionIdempotencyRecord.company_id == fx["company_id"]))

        pbs_before = await session.scalar(select(ProductBatchStock.quantity).where(ProductBatchStock.product_id == fx["product"].id))
        cust_before = await session.scalar(select(Customer.outstanding).where(Customer.id == fx["customer_id"]))

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1499.00"),
                    disc_pct=Decimal("10.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("12.00"),
                    mrp=Decimal("1499.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        tenant = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])

        # Call Preview API endpoint
        preview_res = await preview(
            req=req,
            db=session,
            tenant=tenant,
            current_user=fx["cashier"],
        )

        assert preview_res.net_amount == Decimal("2698.20")

        # Verify strict zero mutations
        cnt_inv_after = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        cnt_sm_after = await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.company_id == fx["company_id"]))
        cnt_ccl_after = await session.scalar(select(func.count()).select_from(CustomerCreditLedgerEntry).where(CustomerCreditLedgerEntry.company_id == fx["company_id"]))
        cnt_gl_after = await session.scalar(select(func.count()).select_from(GeneralLedgerEntry).where(GeneralLedgerEntry.company_id == fx["company_id"]))
        cnt_outbox_after = await session.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.company_id == fx["company_id"]))
        cnt_idemp_after = await session.scalar(select(func.count()).select_from(TransactionIdempotencyRecord).where(TransactionIdempotencyRecord.company_id == fx["company_id"]))

        pbs_after = await session.scalar(select(ProductBatchStock.quantity).where(ProductBatchStock.product_id == fx["product"].id))
        cust_after = await session.scalar(select(Customer.outstanding).where(Customer.id == fx["customer_id"]))

        assert cnt_inv_after == cnt_inv_before == 0
        assert cnt_sm_after == cnt_sm_before == 0
        assert cnt_ccl_after == cnt_ccl_before == 0
        assert cnt_gl_after == cnt_gl_before == 0
        assert cnt_outbox_after == cnt_outbox_before == 0
        assert cnt_idemp_after == cnt_idemp_before == 0
        assert pbs_after == pbs_before == Decimal("100.00")
        assert cust_after == cust_before == Decimal("1000.00")


# =========================================================================
# Scenario Q: Preview / Submission Calculation Parity
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_q_preview_submission_calculation_parity(session_factory):
    """
    Scenario Q: Strict calculation parity between POST /preview and POST /checkout.
    Every financial figure and line item computed during preview matches checkout exactly.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-PARITY-{s}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                idempotency_key=idemp_key,
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1499.00"),
                    disc_pct=Decimal("10.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("12.00"),
                    mrp=Decimal("1499.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        tenant = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])

        # 1. Preview calculation
        preview_res = await preview(
            req=req,
            db=session,
            tenant=tenant,
            current_user=fx["cashier"],
        )

        # 2. Checkout submission
        checkout_res = await checkout(
            req=req,
            idempotency_key_header=idemp_key,
            db=session,
            tenant=tenant,
            current_user=fx["cashier"],
        )

        # 3. Assert 100% Parity on all statutory totals
        assert preview_res.gross_amount == checkout_res.gross_amount
        assert preview_res.discount_amount == checkout_res.discount_amount
        assert preview_res.taxable_amount == checkout_res.taxable_amount
        assert preview_res.cgst_amount == checkout_res.cgst_amount
        assert preview_res.sgst_amount == checkout_res.sgst_amount
        assert preview_res.igst_amount == checkout_res.igst_amount
        assert preview_res.tax_total == checkout_res.tax_total
        assert preview_res.round_off == checkout_res.round_off
        assert preview_res.net_amount == checkout_res.net_amount
        assert preview_res.items_count == checkout_res.items_count
        assert preview_res.total_quantity == sum(l.quantity for l in checkout_res.lines)

        # 4. Assert 100% Parity on line items
        assert len(preview_res.lines) == len(checkout_res.lines)
        for p_line, c_line in zip(preview_res.lines, checkout_res.lines):
            assert p_line.line_no == c_line.line_no
            assert p_line.quantity == c_line.quantity
            assert p_line.unit_price == c_line.unit_price
            assert p_line.discount_amount == c_line.discount_amount
            assert p_line.taxable_value == c_line.taxable_value
            assert p_line.gst_rate == c_line.gst_rate
            assert p_line.cgst_amount == c_line.cgst_amount
            assert p_line.sgst_amount == c_line.sgst_amount
            assert p_line.igst_amount == c_line.igst_amount
            assert p_line.tax_amount == c_line.tax_amount
            assert p_line.total_amount == c_line.total_amount


# =========================================================================
# Scenario R: Decimal Precision
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_r_decimal_precision(session_factory):
    """
    Scenario R: Validates strict Decimal arithmetic with high-precision inputs.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("3.3333"),
                    unit_price=Decimal("123.45"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        assert isinstance(res.gross_amount, Decimal)
        assert isinstance(res.taxable_amount, Decimal)
        assert isinstance(res.net_amount, Decimal)
        assert res.total_quantity == Decimal("3.3333")


# =========================================================================
# Scenario S: Deterministic Repeated Calculation
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_s_deterministic_repeated_calculation(session_factory):
    """
    Scenario S: Running calculation 10 times consecutively produces identical results.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1499.00"),
                    disc_pct=Decimal("10.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("12.00"),
                    mrp=Decimal("1499.00"),
                )
            ],
            customer_id=fx["customer_id"],
        )

        first_res = await HeadlessBillingCore.calculate_billing(session=session, req=req)

        for _ in range(10):
            subsequent_res = await HeadlessBillingCore.calculate_billing(session=session, req=req)
            assert subsequent_res.net_amount == first_res.net_amount
            assert subsequent_res.taxable_amount == first_res.taxable_amount
            assert subsequent_res.tax_total == first_res.tax_total
            assert subsequent_res.cgst_amount == first_res.cgst_amount
            assert subsequent_res.sgst_amount == first_res.sgst_amount


# =========================================================================
# Scenario T: Tenant Isolation
# =========================================================================
@pytest.mark.asyncio
async def test_scenario_t_tenant_isolation(session_factory):
    """
    Scenario T: Tenant mismatch is rejected with HTTP 403 Forbidden.
    """
    async with session_factory() as session:
        fx = await _bootstrap_fixtures(session)
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="CMP-OTHER-UNAUTHORIZED",
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                )
            ],
        )

        tenant = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])

        # Preview endpoint enforces tenant isolation
        with pytest.raises(HTTPException) as exc_tenant:
            await preview(
                req=req,
                db=session,
                tenant=tenant,
                current_user=fx["cashier"],
            )

        assert exc_tenant.value.status_code == 403
        assert "SMRITI-TENANT-001" in exc_tenant.value.detail
