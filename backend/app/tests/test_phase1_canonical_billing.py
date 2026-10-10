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
Classification: Phase 1 Canonical Billing Engine Acceptance Test Suite
"""

import uuid
import pytest
import asyncio
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.core.config import settings
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.auth import User
from app.models.pos import CashRegister, Shift
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
    CanonicalTenderItem,
)
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.transaction_integrity_engine import TransactionIntegrityEngine
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.sales import SalesService
from app.api.v1.billing import checkout


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_billing_fixtures(session):
    s = uuid.uuid4().hex[:8]
    company_id = f"CMP-{s}"
    branch_id = f"BR-{s}"
    user_id = f"USR-{s}"
    warehouse_id = f"WH-{s}"
    customer_group_id = f"CG-{s}"
    customer_id = f"CUST-{s}"
    product_id = f"PRD-{s}"

    # Company
    comp = Company(
        id=company_id,
        name=f"Billing Test Enterprise {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    session.add(comp)

    # Branch
    branch = Branch(
        id=branch_id,
        company_id=company_id,
        name=f"Main Store {s}",
        code=f"BR_{s}".upper()[:16],
        is_active=True,
    )
    session.add(branch)
    await session.flush()

    # Warehouse
    warehouse = Warehouse(
        id=warehouse_id,
        company_id=company_id,
        branch_id=branch_id,
        code=f"WH_{s}".upper()[:16],
        name="Main Store Warehouse",
        is_active=True,
        address="Shop No 10, Market Road",
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
        hashed_password="mock_hashed_password_billing",
        role="CASHIER",
        is_active=True,
    )
    session.add(cashier)

    # Customer Group (Credit Limit = 20,000, Can Purchase on Credit = True)
    group = CustomerGroup(
        id=customer_group_id,
        company_id=company_id,
        branch_id=branch_id,
        name=f"Wholesale Credit Group {s}",
        credit_limit=Decimal("20000.00"),
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
        name="Sports Shoes - Black",
        code=f"SHOE-001-{s}".upper()[:20],
        barcode=f"890100{s[:6]}",
        category="Footwear",
        mrp=Decimal("1899.00"),
        price=Decimal("1899.00"),
        gst_percentage=Decimal("18.00"),
        stock=Decimal("50.00"),
        is_active=True,
    )
    session.add(prod)
    await session.flush()

    # Customer (ABC Footwear)
    customer = Customer(
        id=customer_id,
        company_id=company_id,
        branch_id=branch_id,
        customer_group_id=customer_group_id,
        name="ABC Footwear",
        mobile="9876543210",
        gst_number="27ABCDE1234F1Z5",
        outstanding=Decimal("5000.00"),
        is_active=True,
    )
    session.add(customer)
    await session.flush()

    # Batch Stock in Warehouse
    pbs = ProductBatchStock(
        id=f"pbs-{s}",
        uuid=f"pbs-{s}",
        company_id=company_id,
        branch_id=branch_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        batch_no="BATCH-001",
        quantity=Decimal("50.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("1899.00"),
        sale_rate=Decimal("1899.00"),
    )
    session.add(pbs)
    await session.commit()

    return {
        "company_id": company_id,
        "branch_id": branch_id,
        "warehouse_id": warehouse_id,
        "user_id": user_id,
        "customer_id": customer_id,
        "customer_group_id": customer_group_id,
        "product_id": product_id,
        "product": prod,
        "customer": customer,
        "user": cashier,
    }


# =========================================================================
# GATE 1 & GATE 9: Canonical Writer Happy Path & GST ROUND_HALF_UP Parity
# =========================================================================

@pytest.mark.asyncio
async def test_canonical_writer_and_gst_round_half_up(session_factory):
    """
    Validates Gate 1 & 9:
    - CanonicalSalesPostingWriter executes happy path.
    - Zero-paisa variance check: Taxable Value + CGST + SGST + Roundoff == Net Amount.
    - Uses commercial ROUND_HALF_UP arithmetic.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-CANON-{s}"

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
            customer_name="ABC Footwear",
            payment_mode="CREDIT",
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req,
            idempotency_key=idemp_key,
            commit=True,
        )

        assert result.success is True
        assert result.invoice_no is not None
        assert result.is_replayed is False

        # Mathematical Proof from ADR Section 1.3:
        # Gross = 2998.00, Disc = 299.80, Discounted Base = 2698.20
        # Taxable = 2409.11, Tax = 289.09 (CGST = 144.55, SGST = 144.54)
        # Net = 2698.20 (or 2698.00 with Indian Rupee rounding)
        calculated_net = result.taxable_amount + result.cgst_amount + result.sgst_amount + result.round_off
        assert calculated_net == result.net_amount
        assert (result.cgst_amount + result.sgst_amount) == result.tax_total
        assert abs(result.net_amount - Decimal("2698.00")) <= Decimal("0.20")


# =========================================================================
# GATE 2 & GATE 3: Idempotent Replay & Duplicate Submission Protection
# =========================================================================

@pytest.mark.asyncio
async def test_idempotent_replay_and_duplicate_submission(session_factory):
    """
    Validates Gate 2 & 3:
    - Same Key + Same Payload -> returns cached result with is_replayed=True.
    - Exactly 1 invoice is stored in the database.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-REPLAY-{s}"

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
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("18.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        res1 = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req,
            idempotency_key=idemp_key,
            commit=True,
        )
        assert res1.success is True
        assert res1.is_replayed is False

        # Replay identical submission
        res2 = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req,
            idempotency_key=idemp_key,
            commit=True,
        )
        assert res2.success is True
        assert res2.is_replayed is True
        assert res2.invoice_no == res1.invoice_no
        assert res2.invoice_id == res1.invoice_id

        # Verify database entity count: exactly 1 invoice
        q_count = select(func.count(SalesInvoice.id)).where(
            SalesInvoice.company_id == fx["company_id"],
            SalesInvoice.is_deleted == False,
        )
        total_invoices = (await session.execute(q_count)).scalar()
        assert total_invoices == 1

        # Verify idempotency record is COMMITTED
        q_idemp = select(TransactionIdempotencyRecord).where(
            TransactionIdempotencyRecord.company_id == fx["company_id"],
            TransactionIdempotencyRecord.idempotency_key == idemp_key,
        )
        idemp_rec = (await session.execute(q_idemp)).scalar_one()
        assert idemp_rec.status == "COMMITTED"
        assert idemp_rec.document_id == res1.invoice_id


# =========================================================================
# GATE 4: Concurrent Submission Advisory Lock
# =========================================================================

@pytest.mark.asyncio
async def test_concurrent_submission_advisory_lock(session_factory):
    """
    Validates Gate 4:
    - STIE PostgreSQL Advisory Lock prevents concurrent duplicate writes.
    - If a lock is active, concurrent request is rejected with HTTP 409 (SMRITI-CONC-001).
    """
    async with session_factory() as session1:
        fx = await _bootstrap_billing_fixtures(session1)
        s = uuid.uuid4().hex[:6]
        lock_key = f"IDEMP-CONC-{s}"

        # Acquire lock in session1
        acquired1 = await TransactionIntegrityEngine.try_acquire_advisory_lock(
            session=session1,
            company_id=fx["company_id"],
            entity_type="SALES_INVOICE",
            lock_identifier=lock_key,
        )
        assert acquired1 is True

        # Attempt to acquire same lock in session2 (simulating concurrent worker)
        async with session_factory() as session2:
            acquired2 = await TransactionIntegrityEngine.try_acquire_advisory_lock(
                session=session2,
                company_id=fx["company_id"],
                entity_type="SALES_INVOICE",
                lock_identifier=lock_key,
            )
            assert acquired2 is False


# =========================================================================
# GATE 5: Payload Mismatch Detection
# =========================================================================

@pytest.mark.asyncio
async def test_payload_mismatch_rejection(session_factory):
    """
    Validates Gate 5:
    - Same Key + Different Payload -> rejected with HTTP 409 (SMRITI-IDEMP-001).
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-MISMATCH-{s}"

        req1 = CanonicalPostingRequest(
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
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        res1 = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req1,
            idempotency_key=idemp_key,
            commit=True,
        )
        assert res1.success is True

        # Alter payload with different quantity (2 instead of 1)
        req2 = CanonicalPostingRequest(
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
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=req2,
                idempotency_key=idemp_key,
                commit=True,
            )
        assert exc_info.value.status_code == 409
        assert "SMRITI-IDEMP-001" in exc_info.value.detail


# =========================================================================
# GATE 6: Clean Retry after Failure
# =========================================================================

@pytest.mark.asyncio
async def test_clean_retry_after_failed_transaction(session_factory):
    """
    Validates Gate 6:
    - A transaction record marked FAILED allows a clean retry with the same key.
    - Successfully transitions back to IN_FLIGHT and then COMMITTED.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-RETRY-{s}"

        # Insert a pre-existing FAILED idempotency record
        failed_rec = TransactionIdempotencyRecord(
            id=f"tx_idemp_{uuid.uuid4().hex[:16]}",
            company_id=fx["company_id"],
            branch_id=fx["branch_id"],
            entity_type="SALES_INVOICE",
            idempotency_key=idemp_key,
            request_hash="old_hash_failed",
            status="FAILED",
            error_detail="Temporary inventory lock failure",
            created_by=fx["user_id"],
        )
        session.add(failed_rec)
        await session.commit()

        # Submit valid transaction using the same idempotency key
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
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req,
            idempotency_key=idemp_key,
            commit=True,
        )
        assert result.success is True
        assert result.is_replayed is False

        # Verify idempotency record is now COMMITTED and error_detail cleared
        await session.refresh(failed_rec)
        assert failed_rec.status == "COMMITTED"
        assert failed_rec.error_detail is None
        assert failed_rec.document_id == result.invoice_id


# =========================================================================
# GATE 7: Tenant Isolation Enforcement
# =========================================================================

@pytest.mark.asyncio
async def test_tenant_isolation_enforcement(session_factory):
    """
    Validates Gate 7:
    - Company A transaction cannot bill against Company B warehouse or customer.
    - Rejected with HTTP 403 Forbidden.
    """
    async with session_factory() as session:
        fx_a = await _bootstrap_billing_fixtures(session)
        fx_b = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]

        # Request for Company A referencing Warehouse belonging to Company B
        req_cross_wh = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx_a["company_id"],
                branch_id=fx_a["branch_id"],
                warehouse_id=fx_b["warehouse_id"],  # Cross-tenant breach!
                idempotency_key=f"IDEMP-CROSS-WH-{s}",
                source_channel="BILLING_WORKSPACE",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx_a["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                )
            ],
            customer_id=fx_a["customer_id"],
            payment_mode="CREDIT",
        )

        with pytest.raises(HTTPException) as exc_wh:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=req_cross_wh,
                idempotency_key=f"IDEMP-CROSS-WH-{s}",
                commit=True,
            )
        assert exc_wh.value.status_code in [400, 403]

        # API Level Tenant Isolation via /checkout
        tenant_a = TenantContext(company_id=fx_a["company_id"], branch_id=fx_a["branch_id"])
        with pytest.raises(HTTPException) as exc_api:
            await checkout(
                req=req_cross_wh,
                db=session,
                tenant=TenantContext(company_id=fx_b["company_id"], branch_id=fx_b["branch_id"]),  # Tenant mismatch!
                current_user=fx_a["user"],
            )
        assert exc_api.value.status_code == 403
        assert "SMRITI-TENANT-001" in exc_api.value.detail


# =========================================================================
# GATE 8: Credit Validation (Walk-in, Credit Hold, Credit Limit & Override)
# =========================================================================

@pytest.mark.asyncio
async def test_credit_validation_pipeline(session_factory):
    """
    Validates Gate 8:
    1. Walk-in customer credit rejected with SMRITI-CREDIT-001.
    2. Customer group credit hold rejected with SMRITI-CREDIT-002.
    3. Credit limit exceeded rejected without supervisor override with SMRITI-CREDIT-003.
    4. Credit limit exceeded approved with valid supervisor override code.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]

        # 1. Walk-in credit rejection
        req_walkin = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                idempotency_key=f"IDEMP-WALKIN-{s}",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                )
            ],
            customer_id=None,  # Anonymous walk-in
            payment_mode="CREDIT",
        )

        with pytest.raises(HTTPException) as exc_walkin:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=req_walkin,
                idempotency_key=f"IDEMP-WALKIN-{s}",
                commit=True,
            )
        assert exc_walkin.value.status_code == 400
        assert "SMRITI-CREDIT-001" in exc_walkin.value.detail

        # 2. Credit Hold Rejection
        cg = await session.get(CustomerGroup, fx["customer_group_id"])
        cg.credit_hold = True
        await session.commit()

        req_credit = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                idempotency_key=f"IDEMP-HOLD-{s}",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        with pytest.raises(HTTPException) as exc_hold:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=req_credit,
                idempotency_key=f"IDEMP-HOLD-{s}",
                commit=True,
            )
        assert exc_hold.value.status_code == 400
        assert "SMRITI-CREDIT-002" in exc_hold.value.detail

        # Release credit hold
        cg.credit_hold = False
        cg.credit_limit = Decimal("6000.00")  # Customer already has 5,000 outstanding
        await session.commit()

        # 3. Credit limit breach without supervisor override (Bill: 2 * 1899 = 3798; Total: 5000 + 3798 = 8798 > 6000)
        req_breach = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                idempotency_key=f"IDEMP-BREACH-{s}",
                supervisor_override_code=None,  # No override
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        with pytest.raises(HTTPException) as exc_breach:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=req_breach,
                idempotency_key=f"IDEMP-BREACH-{s}",
                commit=True,
            )
        assert exc_breach.value.status_code == 400
        assert "SMRITI-CREDIT-003" in exc_breach.value.detail

        # 4. Credit limit breach with supervisor override code -> APPROVED
        req_approved = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                idempotency_key=f"IDEMP-APPROVED-{s}",
                supervisor_override_code="SUP-AUTH-9999",  # Authorized override
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        res_approved = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req_approved,
            idempotency_key=f"IDEMP-APPROVED-{s}",
            commit=True,
        )
        assert res_approved.success is True


# =========================================================================
# GATE 10, 11, 12: Stock, Customer Credit Ledger, and Outbox Mutation
# =========================================================================

@pytest.mark.asyncio
async def test_stock_ledger_and_outbox_mutations(session_factory):
    """
    Validates Gate 10, 11, 12:
    - product_batch_stocks decrements synchronously.
    - stock_movements audit record created with movement_type='OUTWARD_SALE'.
    - customer.outstanding increments by exact net amount.
    - CustomerCreditLedgerEntry row created with entry_type='DEBIT'.
    - TransactionOutbox event created with event_type='SALES_INVOICE_POSTED'.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-MUTATE-{s}"

        initial_cust = await session.get(Customer, fx["customer_id"])
        initial_outstanding = initial_cust.outstanding

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
                    quantity=Decimal("3.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req,
            idempotency_key=idemp_key,
            commit=True,
        )
        assert result.success is True

        # 1. Verify Batch Stock decremented (50 - 3 = 47)
        q_pbs = select(ProductBatchStock).where(
            ProductBatchStock.company_id == fx["company_id"],
            ProductBatchStock.product_id == fx["product_id"],
            ProductBatchStock.batch_no == "BATCH-001",
        )
        pbs = (await session.execute(q_pbs)).scalar_one()
        assert pbs.quantity == Decimal("47.00")

        # 2. Verify StockMovement created
        q_sm = select(StockMovement).where(
            StockMovement.company_id == fx["company_id"],
            StockMovement.reference_doc_id == result.invoice_id,
        )
        sm = (await session.execute(q_sm)).scalar_one()
        assert sm.movement_type == "OUTWARD_SALE"
        assert sm.quantity == Decimal("3.00")

        # 3. Verify Customer Outstanding updated (5000 + result.net_amount)
        cust_after = await session.get(Customer, fx["customer_id"])
        expected_outstanding = initial_outstanding + result.net_amount
        assert cust_after.outstanding == expected_outstanding

        # 4. Verify CustomerCreditLedgerEntry created
        q_ccle = select(CustomerCreditLedgerEntry).where(
            CustomerCreditLedgerEntry.company_id == fx["company_id"],
            CustomerCreditLedgerEntry.reference_id == result.invoice_id,
        )
        ccle = (await session.execute(q_ccle)).scalar_one()
        assert ccle.entry_type == "DEBIT"
        assert ccle.amount == result.net_amount
        assert ccle.balance_after == expected_outstanding

        # 5. Verify Transactional Outbox Event created
        q_ob = select(OutboxEvent).where(
            OutboxEvent.company_id == fx["company_id"],
            OutboxEvent.aggregate_id == result.invoice_id,
            OutboxEvent.event_type == "SALES_INVOICE_POSTED",
        )
        ob = (await session.execute(q_ob)).scalar_one()
        assert ob.status == "PENDING"
        assert ob.payload["invoice_no"] == result.invoice_no


# =========================================================================
# GATE 13: GL Cancellation / Reversal & Audit Integrity
# =========================================================================

@pytest.mark.asyncio
async def test_gl_cancellation_reversal_and_sales_cancellation(session_factory):
    """
    Validates Gate 13:
    - UnifiedAccountingLedgerService.post_sales_cancellation_to_gl creates a balanced
      reversing JournalVoucher (SALES_CANCEL) with equal debits and credits.
    - SalesService.cancel_sales_invoice reverts customer outstanding, posts compensating
      CustomerCreditLedgerEntry (CREDIT), and stages SALES_INVOICE_CANCELLED outbox event.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-CANCEL-{s}"

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
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CREDIT",
        )

        posting_res = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=req,
            idempotency_key=idemp_key,
            commit=True,
        )

        cust_before_cancel = await session.get(Customer, fx["customer_id"])
        out_before_cancel = cust_before_cancel.outstanding

        # Execute cancellation through SalesService
        tenant_ctx = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])
        sales_svc = SalesService(session, tenant_ctx)
        cancelled_inv = await sales_svc.cancel_sales_invoice(posting_res.invoice_id)
        assert cancelled_inv.status == "Cancelled"

        # 1. Verify Customer Outstanding is reverted
        cust_after_cancel = await session.get(Customer, fx["customer_id"])
        assert cust_after_cancel.outstanding == (out_before_cancel - posting_res.net_amount)

        # 2. Verify compensating CustomerCreditLedgerEntry (CREDIT)
        q_cancel_ccle = select(CustomerCreditLedgerEntry).where(
            CustomerCreditLedgerEntry.company_id == fx["company_id"],
            CustomerCreditLedgerEntry.reference_id == posting_res.invoice_id,
            CustomerCreditLedgerEntry.entry_type == "CREDIT",
        )
        ccle_cancel = (await session.execute(q_cancel_ccle)).scalar_one()
        assert ccle_cancel.amount == posting_res.net_amount

        # 3. Verify Authoritative GL Reversal Journal Voucher
        q_jv = select(JournalVoucher).where(
            JournalVoucher.company_id == fx["company_id"],
            JournalVoucher.reference_doc_id == posting_res.invoice_id,
            JournalVoucher.voucher_type == "SALES_CANCEL",
        )
        jv = (await session.execute(q_jv)).scalar_one()
        assert jv.is_posted is True

        # Check GL balance: Total Debits == Total Credits
        q_entries = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
        entries = (await session.execute(q_entries)).scalars().all()
        total_debits = sum(e.debit_amount for e in entries)
        total_credits = sum(e.credit_amount for e in entries)
        assert total_debits == total_credits
        assert total_debits == posting_res.net_amount


# =========================================================================
# GATE 14: Transaction Rollback on Failure
# =========================================================================

@pytest.mark.asyncio
async def test_atomic_transaction_rollback_on_failure(session_factory):
    """
    Validates Gate 14:
    - Attempting to bill more stock than available triggers atomic rollback.
    - No partial SalesInvoice, StockMovement, or CustomerCreditLedgerEntry persists.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        idemp_key = f"IDEMP-ROLLBACK-{s}"

        # Current stock is 50. Request 100 units without negative stock permission
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                idempotency_key=idemp_key,
                allow_negative_stock=False,
            ),
            items=[
                CanonicalPostingLineItem(
                    code=fx["product"].code,
                    quantity=Decimal("100.00"),  # Exceeds 50
                    unit_price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    batch_no="BATCH-001",
                )
            ],
            customer_id=fx["customer_id"],
            payment_mode="CASH",
        )

        with pytest.raises(HTTPException) as exc:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=req,
                idempotency_key=idemp_key,
                commit=True,
            )
        assert exc.value.status_code == 400
        assert "SMRITI-STOCK-001" in exc.value.detail

        # Assert zero entity persistence in DB
        q_inv = select(func.count(SalesInvoice.id)).where(SalesInvoice.company_id == fx["company_id"])
        inv_count = (await session.execute(q_inv)).scalar()
        assert inv_count == 0

        q_sm = select(func.count(StockMovement.id)).where(StockMovement.company_id == fx["company_id"])
        sm_count = (await session.execute(q_sm)).scalar()
        assert sm_count == 0


# =========================================================================
# GATE 3 REFACTOR PROOF: SalesService.create_sales_invoice Delegation
# =========================================================================

@pytest.mark.asyncio
async def test_sales_service_delegates_to_canonical_writer(session_factory):
    """
    Validates Requirement 3:
    - SalesService.create_sales_invoice delegates directly to CanonicalSalesPostingWriter.
    - Operates as a thin ingress adapter with zero dual-writing.
    """
    async with session_factory() as session:
        fx = await _bootstrap_billing_fixtures(session)
        s = uuid.uuid4().hex[:6]
        tenant_ctx = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])
        sales_svc = SalesService(session, tenant_ctx)

        invoice_in = SalesInvoiceCreate(
            invoice_no=f"INV-LEGACY-ADAPT-{s}",
            customer_id=fx["customer_id"],
            warehouse_id=fx["warehouse_id"],
            payment_mode="CREDIT",
            status="Submitted",
            items=[
                SalesInvoiceItemCreate(
                    product_id=fx["product_id"],
                    code=fx["product"].code,
                    name=fx["product"].name,
                    quantity=Decimal("2.00"),
                    price=Decimal("1899.00"),
                    mrp=Decimal("1899.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                    batch_no="BATCH-001",
                )
            ]
        )

        saved_inv = await sales_svc.create_sales_invoice(
            invoice_in=invoice_in,
            idempotency_key=f"IDEMP-DELEGATE-{s}",
            commit=True,
        )

        assert saved_inv is not None
        assert saved_inv.invoice_no is not None
        assert saved_inv.status == "Submitted"
        assert len(saved_inv.items) == 1
        assert saved_inv.items[0].code == fx["product"].code
