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

DB_001_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"
DB_002_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti002"


@pytest.fixture
async def async_db():
    engine = create_async_engine(DB_001_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def async_db_002():
    engine = create_async_engine(DB_002_URL, echo=False)
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


@pytest.fixture
def tenant_ctx_002():
    return TenantContext(
        company_id="COMP-002",
        branch_id="BR-002"
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

        # 3. Create Audit Snapshot
        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(
            warehouse_id="wh-central-001",
            audit_type="CYCLE_COUNT",
            notes="Snapshot test audit"
        )
        created_audit_id = audit.id

        assert audit.audit_no.startswith("AUD-")
        assert audit.status == "IN_PROGRESS"
        assert audit.warehouse_id == "wh-central-001"
        assert len(audit.items) >= 2

        # Verify our items are snapshotted
        item1 = next((it for it in audit.items if it.product_id == prod_id and it.batch_no == batch_1), None)
        item2 = next((it for it in audit.items if it.product_id == prod_id and it.batch_no == batch_2), None)

        assert item1 is not None
        assert float(item1.system_qty) == 20.0
        assert float(item1.counted_qty) == 0.0
        assert float(item1.variance_qty) == -20.0
        assert item1.discrepancy_reason == "PENDING_COUNT"

        assert item2 is not None
        assert float(item2.system_qty) == 10.0
        assert float(item2.counted_qty) == 0.0

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_stock_audit_barcode_scanning_and_secondary_barcodes(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test rapid barcode scanner increments, including secondary barcode array resolution and surplus handling.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-scan-{unique_suffix}"
    primary_barcode = f"BAR-PRI-{unique_suffix.upper()}"
    sec_barcode = f"BAR-SEC-{unique_suffix.upper()}"
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
            barcode=primary_barcode,
            secondary_barcodes=[sec_barcode, f"EXTRA-{unique_suffix.upper()}"],
            stock=15,
            reserved_stock=0.0000,
            cost_price=400.0,
            price=600.0,
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
            quantity=15.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb)
        await async_db.commit()

        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(warehouse_id="wh-central-001")
        created_audit_id = audit.id

        # Scan 1: Using Primary Barcode (+5)
        res1 = await service.scan_barcode_increment(
            audit_id=created_audit_id,
            barcode_or_sku=primary_barcode,
            qty_increment=5.0,
            batch_no=batch_no
        )
        assert res1["status"] == "SCAN_RECORDED"
        assert res1["counted_qty"] == 5.0
        assert res1["variance_qty"] == -10.0

        # Scan 2: Using Secondary Barcode (+10) -> Should match same product!
        res2 = await service.scan_barcode_increment(
            audit_id=created_audit_id,
            barcode_or_sku=sec_barcode,
            qty_increment=10.0,
            batch_no=batch_no
        )
        assert res2["counted_qty"] == 15.0
        assert res2["variance_qty"] == 0.0
        assert res2["discrepancy_reason"] == "MATCHED"

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
    Test reconciliation with deficit write-off creates OUTWARD_LOSS stock movement
    and correctly deducts batch quantity.
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
            name=f"Deficit Test Product {unique_suffix}",
            code=f"DEF-{unique_suffix.upper()}",
            sku=f"SKU-DEF-{unique_suffix.upper()}",
            category="Hardware",
            barcode=f"BAR-DEF-{unique_suffix.upper()}",
            stock=50,
            reserved_stock=0.0000,
            cost_price=300.0,
            price=450.0,
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
            quantity=50.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb)
        await async_db.commit()

        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(warehouse_id="wh-central-001")
        created_audit_id = audit.id

        target_item = next(it for it in audit.items if it.product_id == prod_id)

        # Count 42 units (Deficit of 8 units due to damage)
        await service.record_item_count(
            audit_id=created_audit_id,
            item_id=target_item.id,
            counted_qty=42.0,
            discrepancy_reason="DAMAGED",
            notes="Water damage on bottom shelf"
        )

        # Reconcile Audit
        reconciled_audit = await service.reconcile_and_post_discrepancies(
            audit_id=created_audit_id,
            user_identifier="AUDITOR-USER"
        )
        assert reconciled_audit.status == "COMPLETED"
        assert reconciled_audit.reconciled_at is not None

        # Verify Batch Stock mutated to 42.0
        pbs_res = await async_db.execute(
            select(ProductBatchStock).where(ProductBatchStock.id == pb.id)
        )
        updated_pbs = pbs_res.scalar_one()
        assert float(updated_pbs.quantity) == 42.0

        # Verify Product Stock cache updated to 42
        p_res = await async_db.execute(select(Product).where(Product.id == prod_id))
        updated_p = p_res.scalar_one()
        assert updated_p.stock == 42

        # Verify Stock Movement OUTWARD_LOSS created
        sm_res = await async_db.execute(
            select(StockMovement).where(
                StockMovement.product_id == prod_id,
                StockMovement.reference_doc_type == "STOCK_AUDIT"
            )
        )
        sm = sm_res.scalar_one()
        assert sm.movement_type == "OUTWARD_LOSS"
        assert float(sm.quantity) == 8.0
        assert sm.warehouse_id == "wh-central-001"
        assert sm.batch == batch_no
        assert "Audit Write-off: DAMAGED" in sm.remarks

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
    Test reconciliation with surplus adds INWARD_SURPLUS stock movement
    and increases batch stock.
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
            name=f"Surplus Test Product {unique_suffix}",
            code=f"SUR-{unique_suffix.upper()}",
            sku=f"SKU-SUR-{unique_suffix.upper()}",
            category="Hardware",
            barcode=f"BAR-SUR-{unique_suffix.upper()}",
            stock=10,
            reserved_stock=0.0000,
            cost_price=200.0,
            price=350.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        pb = ProductBatchStock(
            id=f"pbs-sur-{unique_suffix}",
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

        target_item = next(it for it in audit.items if it.product_id == prod_id)

        # Count 14 units (Surplus of +4 units)
        await service.record_item_count(
            audit_id=created_audit_id,
            item_id=target_item.id,
            counted_qty=14.0,
            discrepancy_reason="SURPLUS_FOUND"
        )

        reconciled_audit = await service.reconcile_and_post_discrepancies(
            audit_id=created_audit_id,
            user_identifier="AUDITOR-USER"
        )
        assert reconciled_audit.status == "COMPLETED"

        # Verify Batch Stock increased to 14.0
        pbs_res = await async_db.execute(
            select(ProductBatchStock).where(ProductBatchStock.id == pb.id)
        )
        updated_pbs = pbs_res.scalar_one()
        assert float(updated_pbs.quantity) == 14.0

        # Verify Product Stock cache updated to 14
        p_res = await async_db.execute(select(Product).where(Product.id == prod_id))
        updated_p = p_res.scalar_one()
        assert updated_p.stock == 14

        # Verify Stock Movement INWARD_SURPLUS created
        sm_res = await async_db.execute(
            select(StockMovement).where(
                StockMovement.product_id == prod_id,
                StockMovement.reference_doc_type == "STOCK_AUDIT"
            )
        )
        sm = sm_res.scalar_one()
        assert sm.movement_type == "INWARD_SURPLUS"
        assert float(sm.quantity) == 4.0
        assert sm.batch == batch_no

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_stock_audit_multi_company_isolation_smriti002(async_db_002: AsyncSession, tenant_ctx_002: TenantContext):
    """
    Test that stock audit execution runs cleanly in smriti002 tenant database.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-comp2-{unique_suffix}"
    batch_no = f"BATCH-COMP2-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        # Check warehouse in smriti002 or create fallback
        wh_res = await async_db_002.execute(
            select(Warehouse).where(Warehouse.company_id == tenant_ctx_002.company_id, Warehouse.is_deleted == False)
        )
        wh = wh_res.scalars().first()
        if not wh:
            wh = Warehouse(
                id=f"wh-002-{unique_suffix}",
                uuid=str(uuid.uuid4()),
                company_id=tenant_ctx_002.company_id,
                branch_id=tenant_ctx_002.branch_id,
                code=f"WH2-{unique_suffix.upper()}",
                name="COMP-002 Main Godown",
                warehouse_type="CENTRAL_WAREHOUSE"
            )
            async_db_002.add(wh)
            await async_db_002.flush()

        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx_002.company_id,
            branch_id=tenant_ctx_002.branch_id,
            name=f"Comp2 Audit Product {unique_suffix}",
            code=f"C2-{unique_suffix.upper()}",
            sku=f"SKU-C2-{unique_suffix.upper()}",
            category="Hardware",
            barcode=f"BAR-C2-{unique_suffix.upper()}",
            stock=25,
            reserved_stock=0.0000,
            cost_price=150.0,
            price=250.0,
            gst_percentage=18.0
        )
        async_db_002.add(product)

        pb = ProductBatchStock(
            id=f"pbs-c2-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx_002.company_id,
            branch_id=tenant_ctx_002.branch_id,
            warehouse_id=wh.id,
            product_id=prod_id,
            batch_no=batch_no,
            quantity=25.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db_002.add(pb)
        await async_db_002.commit()

        service = StockAuditService(async_db_002, tenant_ctx_002)
        audit = await service.create_stock_audit(warehouse_id=wh.id, notes="Tenant 002 audit")
        created_audit_id = audit.id

        assert audit.company_id == "COMP-002"
        assert audit.status == "IN_PROGRESS"
        assert len(audit.items) >= 1

        # Scan count in smriti002
        scan_res = await service.scan_barcode_increment(
            audit_id=created_audit_id,
            barcode_or_sku=product.barcode,
            qty_increment=25.0,
            batch_no=batch_no
        )
        assert scan_res["counted_qty"] == 25.0
        assert scan_res["variance_qty"] == 0.0

        # Reconcile in smriti002
        reconciled = await service.reconcile_and_post_discrepancies(created_audit_id)
        assert reconciled.status == "COMPLETED"

    finally:
        if created_audit_id:
            await async_db_002.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db_002.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db_002.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id})
        await async_db_002.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db_002.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db_002.commit()


@pytest.mark.asyncio
async def test_stock_audit_intervening_movement_detection_and_locking(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test that intervening stock movements post-snapshot are detected and recorded
    in the reconciled audit trail remarks.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-inter-{unique_suffix}"
    batch_no = f"BATCH-INTER-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Intervening Movement Product {unique_suffix}",
            code=f"INT-{unique_suffix.upper()}",
            sku=f"SKU-INT-{unique_suffix.upper()}",
            category="Hardware",
            barcode=f"BAR-INT-{unique_suffix.upper()}",
            stock=100,
            reserved_stock=0.0000,
            cost_price=100.0,
            price=200.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        pb = ProductBatchStock(
            id=f"pbs-inter-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            warehouse_id="wh-central-001",
            product_id=prod_id,
            batch_no=batch_no,
            quantity=100.0,
            reserved_quantity=0.0,
            damaged_quantity=0.0
        )
        async_db.add(pb)
        await async_db.commit()

        # Step 1: Snapshot audit
        service = StockAuditService(async_db, tenant_ctx)
        audit = await service.create_stock_audit(warehouse_id="wh-central-001")
        created_audit_id = audit.id

        # Step 2: Intervening sale / dispatch occurs while counting
        intervening_sm = StockMovement(
            id=f"sm-inter-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            product_id=prod_id,
            product_name=product.name,
            sku=product.sku,
            movement_type="OUT",
            quantity=10.0,
            warehouse_id="wh-central-001",
            batch=batch_no,
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=f"INV-{unique_suffix.upper()}",
            remarks="Concurrent dispatch during audit"
        )
        async_db.add(intervening_sm)
        await async_db.commit()

        # Step 3: Count physical inventory (found 95 units -> variance is -5 vs snapshot of 100)
        target_item = next(it for it in audit.items if it.product_id == prod_id)
        await service.record_item_count(
            audit_id=created_audit_id,
            item_id=target_item.id,
            counted_qty=95.0,
            discrepancy_reason="DEFICIT_UNSPECIFIED"
        )

        # Step 4: Reconcile and verify intervening movement detection in audit trail
        reconciled = await service.reconcile_and_post_discrepancies(created_audit_id)
        assert reconciled.status == "COMPLETED"

        # Verify Stock Movement generated with intervening note
        sm_res = await async_db.execute(
            select(StockMovement).where(
                StockMovement.product_id == prod_id,
                StockMovement.reference_doc_type == "STOCK_AUDIT"
            )
        )
        audit_sm = sm_res.scalar_one()
        assert "intervening transactions post-snapshot" in audit_sm.remarks

    finally:
        if created_audit_id:
            await async_db.execute(text("DELETE FROM stock_audit_items WHERE audit_id = :aid"), {"aid": created_audit_id})
            await async_db.execute(text("DELETE FROM stock_audits WHERE id = :aid"), {"aid": created_audit_id})
        await async_db.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()
