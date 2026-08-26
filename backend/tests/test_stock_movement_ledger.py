"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-27
Modified     : 2026-08-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import uuid
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select
from sqlalchemy import text

from app.main import app
from app.core.security import create_access_token
from app.db.session import get_company_sessionmaker, get_company_async_engine
from app.models.inventory import StockMovement, Product
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.services.sales import SalesService
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate, SalesReturnCreate, SalesReturnItemCreate
from app.api.deps import TenantContext
from scripts.reconcile_historical_stock import run_historical_stock_reconciliation


def _get_auth_headers(company_id="COMP-001", branch_id="MAIN"):
    token = create_access_token(data={
        "sub": "usr-super",
        "role": "SYSADMIN",
        "company_id": company_id,
        "branch_id": branch_id,
        "tenant_id": "smriti001",
        "db_name": "smriti001",
        "is_active": True,
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
        "X-Branch-ID": branch_id
    }


@pytest.mark.asyncio
async def test_stock_movement_ledger_api_endpoints():
    """
    Verifies that:
    1. GET /api/v1/inventory/ledger returns 200 and a valid list.
    2. GET /api/v1/inventory/stock-movements alias returns 200.
    3. Movement type, date, and search filters return valid responses.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Base ledger endpoint
        res = await client.get("/api/v1/inventory/ledger", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert isinstance(data, list)

        # 2. Route alias endpoint
        res_alias = await client.get("/api/v1/inventory/stock-movements", headers=_get_auth_headers())
        assert res_alias.status_code == 200
        assert isinstance(res_alias.json(), list)

        # 3. Filter by type
        res_filter = await client.get("/api/v1/inventory/ledger?movement_type=OUTWARD_SALE", headers=_get_auth_headers())
        assert res_filter.status_code == 200
        assert isinstance(res_filter.json(), list)

        # 4. Filter by search
        res_search = await client.get("/api/v1/inventory/ledger?search=INV-TEST", headers=_get_auth_headers())
        assert res_search.status_code == 200
        assert isinstance(res_search.json(), list)


@pytest.mark.asyncio
async def test_stock_movement_company_and_branch_isolation():
    """
    Verifies that querying with another company/branch returns isolated results and never leaks data.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Branch isolation: querying an isolated/empty branch returns 200 with empty list []
        res_branch = await client.get(
            "/api/v1/inventory/ledger",
            headers=_get_auth_headers(company_id="COMP-001", branch_id="BR-EMPTY-999")
        )
        assert res_branch.status_code == 200
        assert res_branch.json() == []

        # Company isolation: unauthorized company is rejected
        res_other = await client.get(
            "/api/v1/inventory/ledger",
            headers=_get_auth_headers(company_id="COMP-999", branch_id="BR-999")
        )
        assert res_other.status_code in [403, 404]


@pytest.mark.asyncio
async def test_completed_invoice_creates_outward_sale_movement():
    """
    Controlled transactional test:
    1. Create a completed sales invoice.
    2. Assert OUTWARD_SALE movement is recorded in stock_movements.
    3. Clean up test records completely to preserve production data state.
    """
    session_factory = get_company_sessionmaker("smriti001")

    async with session_factory() as session:
        tenant_ctx = TenantContext(
            company_id="COMP-001",
            branch_id="MAIN",
        )
        sales_svc = SalesService(session, tenant_ctx)

        # Fetch a stock-tracked product
        res = await session.execute(
            select(Product).filter(
                Product.tracking_mode != "No-stock",
                Product.is_deleted == False,
                Product.company_id == "COMP-001"
            ).limit(1)
        )
        prod = res.scalars().first()
        if not prod:
            pytest.skip("No stock-tracked product found in smriti001")
        prod.stock = Decimal("100.00")
        await session.flush()

        test_inv_no = f"INV-TEST-{uuid.uuid4().hex[:6]}"
        invoice_in = SalesInvoiceCreate(
            invoice_no=test_inv_no,
            date=datetime.now(timezone.utc).date(),
            customer_name="Walk-in Customer",
            status="Completed",
            payment_status="Paid",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("1.00"),
                    price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                )
            ]
        )

        db_inv = None
        try:
            db_inv = await sales_svc.create_sales_invoice(invoice_in)
            assert db_inv.id is not None

            # Verify OUTWARD_SALE stock movement was created
            stmt = select(StockMovement).filter(
                StockMovement.reference_doc_id == test_inv_no,
                StockMovement.reference_doc_type == "Sales Invoice",
                StockMovement.is_deleted == False
            )
            mv_res = await session.execute(stmt)
            movement = mv_res.scalars().first()

            assert movement is not None
            assert movement.movement_type == "OUTWARD_SALE"
            assert movement.product_id == prod.id
            assert movement.quantity == Decimal("1.00")
            assert movement.company_id == "COMP-001"
            assert movement.branch_id == "MAIN"
        finally:
            if db_inv:
                await session.execute(text("DELETE FROM stock_movements WHERE reference_doc_id = :ref_id OR reference_doc_id = :inv_id"), {"ref_id": test_inv_no, "inv_id": db_inv.id})
                await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :inv_id"), {"inv_id": db_inv.id})
                await session.execute(text("DELETE FROM sales_invoices WHERE id = :inv_id"), {"inv_id": db_inv.id})
                await session.commit()


@pytest.mark.asyncio
async def test_draft_invoice_creates_no_movement():
    """
    Verifies that a Draft invoice does NOT create any stock movements.
    """
    session_factory = get_company_sessionmaker("smriti001")

    async with session_factory() as session:
        tenant_ctx = TenantContext(
            company_id="COMP-001",
            branch_id="MAIN",
        )
        sales_svc = SalesService(session, tenant_ctx)

        res = await session.execute(
            select(Product).filter(Product.is_deleted == False).limit(1)
        )
        prod = res.scalars().first()
        if not prod:
            pytest.skip("No product found")

        test_inv_no = f"INV-DRAFT-{uuid.uuid4().hex[:6]}"
        invoice_in = SalesInvoiceCreate(
            invoice_no=test_inv_no,
            date=datetime.now(timezone.utc).date(),
            customer_name="Draft Customer",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("2.00"),
                    price=Decimal("150.00"),
                    gst_rate=Decimal("18.00"),
                )
            ]
        )

        db_inv = None
        try:
            db_inv = await sales_svc.create_sales_invoice(invoice_in)
            assert db_inv.id is not None

            # Verify NO movement created
            stmt = select(StockMovement).filter(
                StockMovement.reference_doc_id == test_inv_no,
                StockMovement.is_deleted == False
            )
            mv_res = await session.execute(stmt)
            movements = list(mv_res.scalars().all())
            assert len(movements) == 0
        finally:
            if db_inv:
                await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :inv_id"), {"inv_id": db_inv.id})
                await session.execute(text("DELETE FROM sales_invoices WHERE id = :inv_id"), {"inv_id": db_inv.id})
                await session.commit()


@pytest.mark.asyncio
async def test_sales_return_creates_return_inward_movement():
    """
    Controlled transactional test:
    1. Create a sales return.
    2. Assert RETURN_INWARD movement with positive quantity is recorded.
    3. Clean up test records to preserve DB cleanliness.
    """
    session_factory = get_company_sessionmaker("smriti001")

    async with session_factory() as session:
        tenant_ctx = TenantContext(
            company_id="COMP-001",
            branch_id="MAIN",
        )
        sales_svc = SalesService(session, tenant_ctx)

        # Lookup an existing sales invoice
        inv_res = await session.execute(
            select(SalesInvoice).filter(
                SalesInvoice.is_deleted == False,
                SalesInvoice.company_id == "COMP-001",
                SalesInvoice.branch_id == "MAIN"
            ).limit(1)
        )
        orig_inv = inv_res.scalars().first()
        if not orig_inv:
            pytest.skip("No sales invoice found for return test")

        res = await session.execute(
            select(Product).filter(
                Product.tracking_mode != "No-stock",
                Product.is_deleted == False
            ).limit(1)
        )
        prod = res.scalars().first()
        if not prod:
            pytest.skip("No product found")

        test_ret_id = f"sr-{uuid.uuid4().hex[:8]}"
        test_ret_no = f"RET-TEST-{uuid.uuid4().hex[:6]}"
        return_in = SalesReturnCreate(
            id=test_ret_id,
            return_no=test_ret_no,
            original_invoice_id=orig_inv.id,
            date=datetime.now(timezone.utc).date(),
            status="Completed",
            items=[
                SalesReturnItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("3.00"),
                    price=Decimal("200.00"),
                    gst_rate=Decimal("18.00"),
                    tax_amount=Decimal("36.00"),
                    total_amount=Decimal("636.00"),
                )
            ]
        )

        db_ret = None
        try:
            db_ret = await sales_svc.create_sales_return(return_in)
            assert db_ret.id is not None

            # Verify RETURN_INWARD movement
            stmt = select(StockMovement).filter(
                StockMovement.reference_doc_id == db_ret.id,
                StockMovement.movement_type == "RETURN_INWARD",
                StockMovement.is_deleted == False
            )
            mv_res = await session.execute(stmt)
            movement = mv_res.scalars().first()

            assert movement is not None
            assert movement.movement_type == "RETURN_INWARD"
            assert movement.quantity == Decimal("3.00")
            assert movement.company_id == "COMP-001"
            assert movement.branch_id == "MAIN"
        finally:
            if db_ret:
                await session.execute(text("DELETE FROM stock_movements WHERE reference_doc_id = :ret_id"), {"ret_id": db_ret.id})
                await session.execute(text("DELETE FROM sales_return_items WHERE return_id = :ret_id"), {"ret_id": db_ret.id})
                await session.execute(text("DELETE FROM sales_returns WHERE id = :ret_id"), {"ret_id": db_ret.id})
                await session.commit()


@pytest.mark.asyncio
async def test_no_stock_product_creates_no_movement():
    """
    Verifies that items with tracking_mode == 'No-stock' do NOT create stock movements.
    """
    session_factory = get_company_sessionmaker("smriti001")

    async with session_factory() as session:
        tenant_ctx = TenantContext(
            company_id="COMP-001",
            branch_id="MAIN",
        )
        sales_svc = SalesService(session, tenant_ctx)

        # Create a temporary non-stock product
        prod_id = f"prod-nostock-{uuid.uuid4().hex[:6]}"
        prod = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            branch_id="MAIN",
            code=f"SRV-{uuid.uuid4().hex[:4]}",
            name="Delivery / Service Charge",
            category="Services",
            barcode=f"BC-{uuid.uuid4().hex[:8]}",
            tracking_mode="No-stock",
            price=Decimal("50.00"),
            stock=Decimal("0.00"),
        )
        session.add(prod)
        await session.flush()

        test_inv_no = f"INV-SRV-{uuid.uuid4().hex[:6]}"
        invoice_in = SalesInvoiceCreate(
            invoice_no=test_inv_no,
            date=datetime.now(timezone.utc).date(),
            customer_name="Service Customer",
            status="Completed",
            payment_status="Paid",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("1.00"),
                    price=Decimal("50.00"),
                    gst_rate=Decimal("18.00"),
                )
            ]
        )

        db_inv = None
        try:
            db_inv = await sales_svc.create_sales_invoice(invoice_in)
            assert db_inv.id is not None

            # Verify NO movement created for No-stock item
            stmt = select(StockMovement).filter(
                StockMovement.reference_doc_id == test_inv_no,
                StockMovement.is_deleted == False
            )
            mv_res = await session.execute(stmt)
            movements = list(mv_res.scalars().all())
            assert len(movements) == 0
        finally:
            if db_inv:
                await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :inv_id"), {"inv_id": db_inv.id})
                await session.execute(text("DELETE FROM sales_invoices WHERE id = :inv_id"), {"inv_id": db_inv.id})
            await session.execute(text("DELETE FROM products WHERE id = :prod_id"), {"prod_id": prod_id})
            await session.commit()


@pytest.mark.asyncio
async def test_repeated_processing_does_not_create_duplicates():
    """
    Verifies that calling create_sales_invoice idempotently returns the existing invoice
    without creating duplicate stock movements.
    """
    session_factory = get_company_sessionmaker("smriti001")

    async with session_factory() as session:
        tenant_ctx = TenantContext(
            company_id="COMP-001",
            branch_id="MAIN",
        )
        sales_svc = SalesService(session, tenant_ctx)

        res = await session.execute(
            select(Product).filter(
                Product.tracking_mode != "No-stock",
                Product.is_deleted == False,
                Product.company_id == "COMP-001"
            ).limit(1)
        )
        prod = res.scalars().first()
        if not prod:
            pytest.skip("No stock-tracked product found in smriti001")
        prod.stock = Decimal("100.00")
        await session.flush()

        test_inv_no = f"INV-IDEMP-{uuid.uuid4().hex[:6]}"
        invoice_in = SalesInvoiceCreate(
            invoice_no=test_inv_no,
            date=datetime.now(timezone.utc).date(),
            customer_name="Idempotent Customer",
            status="Completed",
            payment_status="Paid",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("1.00"),
                    price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                )
            ]
        )

        db_inv1 = None
        try:
            # First call
            db_inv1 = await sales_svc.create_sales_invoice(invoice_in)
            assert db_inv1.id is not None

            # Second repeated call with same invoice_no
            db_inv2 = await sales_svc.create_sales_invoice(invoice_in)
            assert db_inv2.id == db_inv1.id

            # Verify exactly ONE movement exists for this invoice
            stmt = select(StockMovement).filter(
                StockMovement.reference_doc_id == test_inv_no,
                StockMovement.is_deleted == False
            )
            mv_res = await session.execute(stmt)
            movements = list(mv_res.scalars().all())
            assert len(movements) == 1
        finally:
            if db_inv1:
                await session.execute(text("DELETE FROM stock_movements WHERE reference_doc_id = :ref_id OR reference_doc_id = :inv_id"), {"ref_id": test_inv_no, "inv_id": db_inv1.id})
                await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :inv_id"), {"inv_id": db_inv1.id})
                await session.execute(text("DELETE FROM sales_invoices WHERE id = :inv_id"), {"inv_id": db_inv1.id})
                await session.commit()


def test_historical_apply_guard_failures():
    """
    Verifies that running historical reconciliation with apply requires confirmation and backup file.
    """
    # 1. Missing confirm flag
    with pytest.raises(ValueError, match="CRITICAL GUARD: Apply mode requires explicit '--confirm-historical-posting'"):
        run_historical_stock_reconciliation(
            database="smriti001",
            mode="apply",
            confirm_historical_posting=False,
        )

    # 2. Missing backup file
    with pytest.raises(ValueError, match="CRITICAL GUARD: Apply mode requires a verified pre-migration '--backup-file'"):
        run_historical_stock_reconciliation(
            database="smriti001",
            mode="apply",
            confirm_historical_posting=True,
            backup_file="non_existent_backup_file.sql",
        )
