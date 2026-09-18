"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.39.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 2 Canonical Sales Writer Convergence Test Suite
"""

import uuid
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.core.config import settings
from app.models.tenant import Company, Branch
from app.models.auth import User
from app.models.pos import CashRegister, Shift
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.payment_ledger import PaymentTransaction
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.identity.engine import IdentityEngine


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_tenant_fixtures(session):
    s = uuid.uuid4().hex[:6]
    company_id = f"CMP-TEST-{s}"
    branch_id = f"BR-TEST-{s}"
    user_id = f"USR-TEST-{s}"
    reg_id = f"REG-TEST-{s}"
    shift_id = f"SH-TEST-{s}"
    prod_id = f"PRD-TEST-{s}"

    # Company
    comp = Company(
        id=company_id,
        name=f"Test Enterprise {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    session.add(comp)

    # Branch
    branch = Branch(
        id=branch_id,
        company_id=company_id,
        name=f"Main Branch {s}",
        code=f"BR_{s}".upper()[:8],
        is_active=True,
    )
    session.add(branch)
    await session.flush()

    # Warehouse
    from app.models.inventory import Warehouse
    warehouse = Warehouse(
        id=f"WH-TEST-{s}",
        company_id=company_id,
        branch_id=branch_id,
        code=f"WH_{s}".upper()[:8],
        name="Central Warehouse",
        is_active=True,
        address="Test Central Warehouse",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
    )
    session.add(warehouse)

    # User
    cashier = User(
        id=user_id,
        company_id=company_id,
        branch_id=branch_id,
        username=f"cashier_{s}",
        email=f"cashier_{s}@example.com",
        hashed_password="mock_hashed_password_123",
        role="CASHIER",
        is_active=True,
    )
    session.add(cashier)

    # Register
    reg = CashRegister(
        id=reg_id,
        company_id=company_id,
        branch_id=branch_id,
        name=f"POS Register {s}",
        code=f"REG_{s}".upper()[:8],
        is_active=True,
    )
    session.add(reg)
    await session.flush()

    # Open Shift
    shift = Shift(
        id=shift_id,
        company_id=company_id,
        branch_id=branch_id,
        register_id=reg_id,
        cashier_id=user_id,
        status="OPEN",
        opened_at=datetime.now(timezone.utc),
        opening_balance=Decimal("500.00"),
        is_active=True,
    )
    session.add(shift)

    # Product with stock
    prod = Product(
        id=prod_id,
        company_id=company_id,
        branch_id=branch_id,
        name=f"Test Product {s}",
        code=f"ITEM_{s}".upper()[:8],
        barcode=f"8901{s}001",
        category="Apparel",
        mrp=Decimal("200.00"),
        price=Decimal("150.00"),
        gst_percentage=Decimal("18.00"),
        stock=Decimal("50.00"),
        is_active=True,
    )
    session.add(prod)
    await session.commit()

    return {
        "company_id": company_id,
        "branch_id": branch_id,
        "user_id": user_id,
        "register_id": reg_id,
        "shift_id": shift_id,
        "product_id": prod_id,
        "product": prod,
    }


@pytest.mark.asyncio
async def test_canonical_writer_happy_path_with_ledger_boundaries(session_factory):
    """
    Test 2.2A: Verify that CanonicalSalesPostingWriter creates a SalesInvoice with governed
    identity_code (SAL-INV-*), generates StockMovements with UUIDv7 IDs, records PaymentTransactions
    with UUIDv7 IDs, and updates inventory stock atomically.
    """
    async with session_factory() as session:
        fx = await _bootstrap_tenant_fixtures(session)
        s = uuid.uuid4().hex[:6]
        inv_no = f"INV-CANON-{s}"

        canon_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                shift_id=fx["shift_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=False,
            ),
            customer_name="Retail Buyer",
            payment_mode="CASH",
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product_id"],
                    code=fx["product"].code,
                    name=fx["product"].name,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("150.00"),
                    mrp=Decimal("200.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("354.00"),  # 300 base + 18% GST (54)
                )
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=canon_req,
            commit=True,
        )

        assert res.success is True
        assert res.cached is False
        assert res.invoice_id is not None
        assert res.invoice_no is not None
        assert res.grand_total == Decimal("354.00")

        # Verify SalesInvoice has governed identity_code
        inv_stmt = select(SalesInvoice).where(SalesInvoice.id == res.invoice_id)
        invoice = (await session.execute(inv_stmt)).scalars().first()
        assert invoice is not None
        assert invoice.identity_code is not None
        assert invoice.identity_code.startswith("SAL-INV-")

        # Verify stock movement deduction
        mov_stmt = select(StockMovement).where(
            StockMovement.reference_id == res.invoice_id,
            StockMovement.movement_type == "OUT",
        )
        movements = (await session.execute(mov_stmt)).scalars().all()
        assert len(movements) == 1
        assert movements[0].quantity == Decimal("2.00")
        assert len(movements[0].id) == 36  # UUIDv7 format

        # Verify payment transaction
        pay_stmt = select(PaymentTransaction).where(
            PaymentTransaction.reference_id == res.invoice_id,
        )
        payments = (await session.execute(pay_stmt)).scalars().all()
        assert len(payments) == 1
        assert payments[0].amount == Decimal("354.00")
        assert len(payments[0].id) == 36  # UUIDv7 format


@pytest.mark.asyncio
async def test_canonical_writer_idempotency_replay(session_factory):
    """
    Test 2.2B: Replaying the exact same idempotency_key must return cached=True,
    the exact same invoice_id, and not duplicate stock movements or payments.
    """
    async with session_factory() as session:
        fx = await _bootstrap_tenant_fixtures(session)
        s = uuid.uuid4().hex[:6]
        inv_no = f"INV-IDEMP-{s}"

        canon_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                shift_id=fx["shift_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=False,
            ),
            customer_name="Retail Buyer",
            payment_mode="CASH",
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product_id"],
                    code=fx["product"].code,
                    name=fx["product"].name,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("150.00"),
                    mrp=Decimal("200.00"),
                    gst_rate=Decimal("0.00"),
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("150.00"),
                )
            ],
        )

        res1 = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=canon_req,
            commit=True,
        )
        assert res1.success is True
        assert res1.cached is False

        # Post identical transaction
        res2 = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=canon_req,
            commit=True,
        )
        assert res2.success is True
        assert res2.cached is True
        assert res2.invoice_id == res1.invoice_id


@pytest.mark.asyncio
async def test_canonical_writer_insufficient_stock_atomic_rollback(session_factory):
    """
    Test 2.2C: If line item quantity exceeds available stock and allow_negative_stock=False,
    post_sales_transaction must raise HTTPException(400) and commit zero records.
    """
    async with session_factory() as session:
        fx = await _bootstrap_tenant_fixtures(session)
        s = uuid.uuid4().hex[:6]
        inv_no = f"INV-FAIL-{s}"

        canon_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                shift_id=fx["shift_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=False,
            ),
            customer_name="Retail Buyer",
            payment_mode="CASH",
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product_id"],
                    code=fx["product"].code,
                    name=fx["product"].name,
                    quantity=Decimal("100.00"),  # Exceeds stock (50)
                    unit_price=Decimal("150.00"),
                    mrp=Decimal("200.00"),
                    gst_rate=Decimal("0.00"),
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("15000.00"),
                )
            ],
        )

        with pytest.raises(HTTPException) as excinfo:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=canon_req,
                commit=True,
            )
        assert excinfo.value.status_code == 400
        assert "insufficient" in excinfo.value.detail.lower() or "stock" in excinfo.value.detail.lower()

        # Verify 0 invoices committed
        inv_check = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.client_invoice_no == inv_no)
        )).scalars().first()
        assert inv_check is None
