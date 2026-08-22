"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.inventory import (
    StockAudit, StockAuditItem, Warehouse, Product,
    ProductBatchStock, StockMovement
)
from app.services.stock_audit_service import StockAuditService
from app.api.deps import TenantContext

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"


@pytest.fixture
async def async_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.fixture
def tenant_ctx():
    return TenantContext(
        company_id="COMP-001",
        branch_id="BR-001"
    )


@pytest.mark.asyncio
async def test_stock_audit_creation_and_baseline_snapshot(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test that initiating a physical stock audit creates an immutable snapshot
    of active warehouse batch balances.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-aud1-{unique_suffix}"
    batch_1 = f"BATCH-AUD1-A-{unique_suffix.upper()}"
    batch_2 = f"BATCH-AUD1-B-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        # 1. Insert test product with reserved_stock
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Audit Test Product {unique_suffix}",
            code=f"AUD1-{unique_suffix.upper()}",
            sku=f"SKU-AUD1-{unique_suffix.upper()}",
            category="Hardware",
            barcode=f"BAR-AUD1-{unique_suffix.upper()}",
            stock=30,
            reserved_stock=0.0000,
            cost_price=500.0,
            price=750.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        # 2. Insert 2 active batches in wh-central-001
        pb1 = ProductBatchStock(
            id=f"pbs-aud1-a-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            warehouse_id="wh-central-001",
            product_id=prod_id,
            batch_no=batch_1,
            quantity=20.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        pb2 = ProductBatchStock(
            id=f"pbs-aud1-b-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            warehouse_id="wh-central-001",
            product_id=prod_id,
            batch_no=batch_2,
            quantity=10.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb1)
        async_db.add(pb2)
        await async_db.commit()

        # 3. Create stock audit
        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(
            warehouse_id="wh-central-001",
            audit_type="CYCLE_COUNT",
            notes="Quarterly Hardware Godown Cycle Count"
        )
        created_audit_id = audit.id

        assert audit.status == "IN_PROGRESS"
        assert audit.audit_no.startswith("AUD-")
        assert len(audit.items) >= 2

        # Verify our product lines exist in the audit snapshot
        prod_audit_items = [it for it in audit.items if it.product_id == prod_id]
        assert len(prod_audit_items) == 2
        b1_item = next(it for it in prod_audit_items if it.batch_no == batch_1)
        b2_item = next(it for it in prod_audit_items if it.batch_no == batch_2)
        assert float(b1_item.system_qty) == 20.0
        assert float(b2_item.system_qty) == 10.0
        assert float(b1_item.counted_qty) == 0.0
        assert float(b1_item.variance_qty) == -20.0
        assert b1_item.is_reconciled is False

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_stock_audit_barcode_scanning_and_surplus_handling(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test rapid barcode scanner counting and unlisted surplus discovery.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-scan-{unique_suffix}"
    prod_barcode = f"BAR-SCAN-{unique_suffix.upper()}"
    batch_no = f"BATCH-SCAN-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Scanner Test Product {unique_suffix}",
            code=f"SCAN-{unique_suffix.upper()}",
            sku=f"SKU-SCAN-{unique_suffix.upper()}",
            category="Hardware",
            barcode=prod_barcode,
            stock=10,
            reserved_stock=0.0000,
            cost_price=200.0,
            price=300.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        pb = ProductBatchStock(
            id=f"pbs-scan-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            warehouse_id="wh-central-001",
            product_id=prod_id,
            batch_no=batch_no,
            quantity=10.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb)
        await async_db.commit()

        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(warehouse_id="wh-central-001")
        created_audit_id = audit.id

        # Scan 1: Scans 5 items
        scan1 = await service.scan_barcode_increment(
            audit_id=created_audit_id,
            barcode_or_sku=prod_barcode,
            qty_increment=5.0,
            batch_no=batch_no
        )
        assert scan1["status"] == "SCAN_RECORDED"
        assert scan1["counted_qty"] == 5.0
        assert scan1["variance_qty"] == -5.0

        # Scan 2: Scans 5 more items (counted = 10 -> matches system stock)
        scan2 = await service.scan_barcode_increment(
            audit_id=created_audit_id,
            barcode_or_sku=prod_barcode,
            qty_increment=5.0,
            batch_no=batch_no
        )
        assert scan2["counted_qty"] == 10.0
        assert scan2["variance_qty"] == 0.0
        assert scan2["discrepancy_reason"] == "MATCHED"

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_stock_audit_reconciliation_deficit_write_off(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test that finalizing an audit with physical deficits posts PHYSICAL_INVENTORY_WRITE_OFF movements
    and decrements the batch stock.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-def-{unique_suffix}"
    batch_no = f"BATCH-DEF-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Deficit Item {unique_suffix}",
            code=f"DEF-{unique_suffix.upper()}",
            sku=f"SKU-DEF-{unique_suffix.upper()}",
            category="Appliances",
            barcode=f"BAR-DEF-{unique_suffix.upper()}",
            stock=20,
            reserved_stock=0.0000,
            cost_price=1000.0,
            price=1500.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        pb = ProductBatchStock(
            id=f"pbs-def-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            warehouse_id="wh-central-001",
            product_id=prod_id,
            batch_no=batch_no,
            quantity=20.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb)
        await async_db.commit()

        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(warehouse_id="wh-central-001")
        created_audit_id = audit.id

        # Find line item for this product
        item = next(it for it in audit.items if it.product_id == prod_id and it.batch_no == batch_no)

        # Record physical count: 16 (4 units missing / broken)
        await service.record_item_count(
            audit_id=created_audit_id,
            item_id=item.id,
            counted_qty=16.0,
            discrepancy_reason="DAMAGED",
            notes="4 cartons water damaged in storage"
        )

        # Reconcile audit
        reconciled_audit = await service.reconcile_and_post_discrepancies(audit_id=created_audit_id)
        assert reconciled_audit.status == "COMPLETED"
        assert reconciled_audit.reconciled_at is not None

        # Verify batch quantity dropped from 20 to 16
        res_pb = await async_db.execute(
            select(ProductBatchStock).where(ProductBatchStock.id == pb.id)
        )
        updated_pb = res_pb.scalar_one()
        assert float(updated_pb.quantity) == 16.0

        # Verify StockMovement was written
        sm_res = await async_db.execute(
            select(StockMovement).where(
                StockMovement.product_id == prod_id,
                StockMovement.movement_type == "OUTWARD_LOSS"
            )
        )
        sm = sm_res.scalars().first()
        assert sm is not None
        assert float(sm.quantity) == 4.0
        assert sm.warehouse_id == "wh-central-001"

        # Verify products.stock was resynchronized
        p_res = await async_db.execute(select(Product).where(Product.id == prod_id))
        assert p_res.scalar_one().stock == 16

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_stock_audit_reconciliation_surplus_inward(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test that finalizing an audit with physical surplus posts INWARD_SURPLUS movements
    and increments the batch stock.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-sur-{unique_suffix}"
    batch_no = f"BATCH-SUR-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Surplus Item {unique_suffix}",
            code=f"SUR-{unique_suffix.upper()}",
            sku=f"SKU-SUR-{unique_suffix.upper()}",
            category="Appliances",
            barcode=f"BAR-SUR-{unique_suffix.upper()}",
            stock=10,
            reserved_stock=0.0000,
            cost_price=500.0,
            price=750.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        pb = ProductBatchStock(
            id=f"pbs-sur-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            warehouse_id="wh-shop-001",
            product_id=prod_id,
            batch_no=batch_no,
            quantity=10.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb)
        await async_db.commit()

        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(warehouse_id="wh-shop-001")
        created_audit_id = audit.id

        item = next(it for it in audit.items if it.product_id == prod_id and it.batch_no == batch_no)

        # Record physical count: 15 (5 extra found on shelf)
        await service.record_item_count(
            audit_id=created_audit_id,
            item_id=item.id,
            counted_qty=15.0,
            discrepancy_reason="SURPLUS_FOUND",
            notes="5 extra boxes found in back shelf"
        )

        reconciled_audit = await service.reconcile_and_post_discrepancies(audit_id=created_audit_id)
        assert reconciled_audit.status == "COMPLETED"

        # Verify batch stock increased from 10 to 15
        res_pb = await async_db.execute(select(ProductBatchStock).where(ProductBatchStock.id == pb.id))
        assert float(res_pb.scalar_one().quantity) == 15.0

        # Verify StockMovement was written
        sm_res = await async_db.execute(
            select(StockMovement).where(
                StockMovement.product_id == prod_id,
                StockMovement.movement_type == "INWARD_SURPLUS"
            )
        )
        sm = sm_res.scalars().first()
        assert sm is not None
        assert float(sm.quantity) == 5.0
        assert sm.warehouse_id == "wh-shop-001"

        # Verify products.stock was resynchronized to 15
        p_res = await async_db.execute(select(Product).where(Product.id == prod_id))
        assert p_res.scalar_one().stock == 15

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()
