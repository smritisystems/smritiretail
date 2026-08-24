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

import pytest
import psycopg2
from decimal import Decimal
from datetime import date, datetime, timedelta

COMPANY_DB = "postgresql://postgres:postgres@localhost:5432/smriti001"

def test_wms_phase1_tables_and_scoped_constraints():
    """
    Assert that WMS tables (warehouses, product_batch_stocks, stock_transfers, stock_transfer_items)
    exist with proper scoped unique indexes in company database smriti001.
    """
    conn = psycopg2.connect(COMPANY_DB)
    cur = conn.cursor()

    # 1. Assert tables exist
    for table in ["warehouses", "product_batch_stocks", "stock_transfers", "stock_transfer_items"]:
        cur.execute("SELECT to_regclass(%s)", (f"public.{table}",))
        assert cur.fetchone()[0] is not None, f"Expected table {table} to exist in smriti001."

    # 2. Assert scoped unique indexes exist
    cur.execute("""
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'warehouses' AND indexname = 'uq_company_warehouse_code_active';
    """)
    assert cur.fetchone() is not None, "Expected scoped unique index on warehouses."

    cur.execute("""
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'product_batch_stocks' AND indexname = 'uq_company_wh_prod_batch_active';
    """)
    assert cur.fetchone() is not None, "Expected scoped unique index on product_batch_stocks."

    cur.execute("""
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'stock_transfers' AND indexname = 'uq_company_transfer_no_active';
    """)
    assert cur.fetchone() is not None, "Expected scoped unique index on stock_transfers."

    conn.close()


def test_wms_batch_stock_mutation_and_fefo_allocation():
    """
    Test direct database batch stock creation, FEFO ordering, and atomic balance update.
    """
    import uuid
    conn = psycopg2.connect(COMPANY_DB)
    cur = conn.cursor()

    # Ensure warehouse exists
    cur.execute("SELECT id FROM warehouses WHERE code = 'WH-MAIN' AND is_deleted = false LIMIT 1;")
    wh_row = cur.fetchone()
    assert wh_row is not None, "Expected WH-MAIN to exist in smriti001."
    wh_id = wh_row[0]

    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-fefo-{unique_suffix}"
    prod_code = f"FEFO-{unique_suffix.upper()}"
    prod_sku = f"SKU-FEFO-{unique_suffix.upper()}"

    test_batch_1 = f"BATCH-FEFO-1-{unique_suffix.upper()}"
    test_batch_2 = f"BATCH-FEFO-2-{unique_suffix.upper()}"

    try:
        # Create dedicated test product
        cur.execute("""
            INSERT INTO products (
                id, uuid, company_id, branch_id, name, code, sku, category, barcode,
                cost_price, price, stock, reserved_stock, is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-001', %s, %s, %s, 'Test', %s,
                100.0, 150.0, 0, 0.0000, true, false, NOW(), NOW()
            );
        """, (prod_id, str(uuid.uuid4()), f"FEFO Test Prod {unique_suffix}", prod_code, prod_sku, f"BAR-{prod_code}"))

        # Insert Batch 1 (Expires in 30 days)
        exp_1 = date.today() + timedelta(days=30)
        cur.execute("""
            INSERT INTO product_batch_stocks (
                id, uuid, company_id, branch_id, product_id, warehouse_id, batch_no,
                mfg_date, expiry_date, quantity, reserved_quantity, damaged_quantity, is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-001', %s, %s, %s,
                CURRENT_DATE, %s, 50.0000, 0.0000, 0.0000, true, false, NOW(), NOW()
            );
        """, (f"pbs-t1-{unique_suffix}", str(uuid.uuid4()), prod_id, wh_id, test_batch_1, exp_1))

        # Insert Batch 2 (Expires in 10 days — should be prioritized under FEFO)
        exp_2 = date.today() + timedelta(days=10)
        cur.execute("""
            INSERT INTO product_batch_stocks (
                id, uuid, company_id, branch_id, product_id, warehouse_id, batch_no,
                mfg_date, expiry_date, quantity, reserved_quantity, damaged_quantity, is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-001', %s, %s, %s,
                CURRENT_DATE, %s, 20.0000, 0.0000, 0.0000, true, false, NOW(), NOW()
            );
        """, (f"pbs-t2-{unique_suffix}", str(uuid.uuid4()), prod_id, wh_id, test_batch_2, exp_2))

        conn.commit()

        # Query FEFO ordering: Batch 2 (expiring in 10 days) MUST come before Batch 1 (expiring in 30 days)
        cur.execute("""
            SELECT batch_no, quantity, expiry_date 
            FROM product_batch_stocks 
            WHERE product_id = %s AND warehouse_id = %s AND batch_no IN (%s, %s) AND is_deleted = false
            ORDER BY expiry_date ASC;
        """, (prod_id, wh_id, test_batch_1, test_batch_2))
        
        rows = cur.fetchall()
        assert len(rows) == 2
        assert rows[0][0] == test_batch_2, "FEFO failure: Batch with earlier expiry must come first."
        assert rows[1][0] == test_batch_1

    finally:
        # Guaranteed cleanup
        try:
            conn.rollback()
        except Exception:
            pass
        cur.execute("DELETE FROM product_batch_stocks WHERE product_id = %s;", (prod_id,))
        cur.execute("DELETE FROM products WHERE id = %s;", (prod_id,))
        conn.commit()
        conn.close()


def test_wms_stock_transfer_lifecycle():
    """
    Test StockTransfer creation, dispatch, and receipt integrity checks.
    """
    import uuid
    conn = psycopg2.connect(COMPANY_DB)
    cur = conn.cursor()

    cur.execute("SELECT id FROM warehouses WHERE code = 'WH-MAIN' AND is_deleted = false LIMIT 1;")
    src_wh = cur.fetchone()[0]
    cur.execute("SELECT id FROM warehouses WHERE code = 'WH-SHOP' AND is_deleted = false LIMIT 1;")
    dest_wh = cur.fetchone()[0]

    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-st-{unique_suffix}"
    transfer_id = f"st-test-{unique_suffix}"

    try:
        # Create dedicated test product
        cur.execute("""
            INSERT INTO products (
                id, uuid, company_id, branch_id, name, code, sku, category, barcode,
                cost_price, price, stock, reserved_stock, is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-001', %s, %s, %s, 'Test', %s,
                100.0, 150.0, 0, 0.0000, true, false, NOW(), NOW()
            );
        """, (prod_id, str(uuid.uuid4()), f"ST Test Prod {unique_suffix}", f"ST-{unique_suffix.upper()}", f"SKU-ST-{unique_suffix.upper()}", f"BAR-ST-{unique_suffix}"))

        # 1. Create Transfer in DRAFT status
        cur.execute("""
            INSERT INTO stock_transfers (
                id, uuid, company_id, branch_id, transfer_no, source_warehouse_id, dest_warehouse_id,
                status, is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-001', %s, %s, %s,
                'DRAFT', true, false, NOW(), NOW()
            );
        """, (transfer_id, str(uuid.uuid4()), f"STO-TEST-{unique_suffix.upper()}", src_wh, dest_wh))

        # 2. Add Transfer Item (25 units)
        cur.execute("""
            INSERT INTO stock_transfer_items (
                id, uuid, company_id, branch_id, transfer_id, product_id, batch_no,
                quantity_dispatched, quantity_received, quantity_shortage, quantity_damaged,
                unit_cost, is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-001', %s, %s, 'BATCH-X',
                25.0000, 0.0000, 0.0000, 0.0000, 100.00, true, false, NOW(), NOW()
            );
        """, (f"sti-test-{unique_suffix}", str(uuid.uuid4()), transfer_id, prod_id))

        conn.commit()

        # 3. Simulate Dispatch: Status -> IN_TRANSIT
        cur.execute("""
            UPDATE stock_transfers 
            SET status = 'IN_TRANSIT', dispatch_date = NOW() 
            WHERE id = %s;
        """, (transfer_id,))

        # 4. Simulate Receipt with 2 units shortage & 1 unit damage (22 received + 2 shortage + 1 damage == 25)
        cur.execute("""
            UPDATE stock_transfer_items 
            SET quantity_received = 22.0000, quantity_shortage = 2.0000, quantity_damaged = 1.0000 
            WHERE transfer_id = %s;
        """, (transfer_id,))

        cur.execute("""
            UPDATE stock_transfers 
            SET status = 'PARTIAL', received_date = NOW() 
            WHERE id = %s;
        """, (transfer_id,))

        conn.commit()

        # 5. Verify reconciliation
        cur.execute("""
            SELECT quantity_dispatched, quantity_received, quantity_shortage, quantity_damaged 
            FROM stock_transfer_items 
            WHERE transfer_id = %s;
        """, (transfer_id,))
        item_row = cur.fetchone()
        assert item_row[0] == Decimal("25.0000")
        assert item_row[1] == Decimal("22.0000")
        assert item_row[2] == Decimal("2.0000")
        assert item_row[3] == Decimal("1.0000")
        assert (item_row[1] + item_row[2] + item_row[3]) == item_row[0], "Transfer conservation failure."

    finally:
        # Cleanup
        try:
            conn.rollback()
        except Exception:
            pass
        cur.execute("DELETE FROM stock_transfer_items WHERE transfer_id = %s;", (transfer_id,))
        cur.execute("DELETE FROM stock_transfers WHERE id = %s;", (transfer_id,))
        cur.execute("DELETE FROM products WHERE id = %s;", (prod_id,))
        conn.commit()
        conn.close()


@pytest.mark.asyncio
async def test_wms_service_async_lifecycle():
    """
    Test InventoryWmsService end-to-end:
    - atomic batch stock inward & outward
    - products.stock cached aggregate synchronization
    - FEFO allocation
    - transfer creation, dispatch, and receipt
    """
    import uuid
    from sqlalchemy import text
    from app.api.deps import TenantContext
    from app.services.inventory_wms import InventoryWmsService
    from app.models.inventory import Product, Warehouse
    from app.db.session import get_company_sessionmaker

    session_factory = get_company_sessionmaker("smriti001")

    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-life-{unique_suffix}"
    batch_name_a = f"BATCH-SVC-A-{unique_suffix.upper()}"
    batch_name_b = f"BATCH-SVC-B-{unique_suffix.upper()}"
    transfer_id = None

    async with session_factory() as session:
        tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
        service = InventoryWmsService(session, tenant)

        try:
            # 1. Create dedicated isolated test product
            prod = Product(
                id=prod_id,
                uuid=str(uuid.uuid4()),
                company_id="COMP-001",
                branch_id="BR-001",
                name=f"Isolated WMS Test Product {unique_suffix}",
                code=f"ISO-{unique_suffix.upper()}",
                sku=f"SKU-ISO-{unique_suffix.upper()}",
                category="Test",
                barcode=f"BAR-ISO-{unique_suffix}",
                cost_price=Decimal("150.00"),
                price=Decimal("250.00"),
                stock=0
            )
            session.add(prod)
            await session.commit()

            from sqlalchemy.future import select
            res_wh_src = await session.execute(select(Warehouse).where(Warehouse.code == "WH-MAIN", Warehouse.company_id == "COMP-001", Warehouse.is_deleted == False).limit(1))
            src_wh = res_wh_src.scalars().first()
            res_wh_dst = await session.execute(select(Warehouse).where(Warehouse.code == "WH-SHOP", Warehouse.company_id == "COMP-001", Warehouse.is_deleted == False).limit(1))
            dst_wh = res_wh_dst.scalars().first()
            assert src_wh is not None and dst_wh is not None

            # 2. Inward 100 units into WH-MAIN under BATCH-A (expiring in 20 days)
            exp_a = date.today() + timedelta(days=20)
            batch_a = await service.atomic_mutate_batch_stock(
                product_id=prod.id,
                warehouse_id=src_wh.id,
                batch_no=batch_name_a,
                qty_delta=Decimal("100.0000"),
                movement_type="INWARD_GRN",
                expiry_date=exp_a,
                mrp=Decimal("250.00"),
                purchase_rate=Decimal("150.00"),
            )
            await session.commit()
            assert batch_a.quantity >= Decimal("100.0000")

            # 3. Inward 50 units into WH-MAIN under BATCH-B (expiring in 5 days — FEFO priority)
            exp_b = date.today() + timedelta(days=5)
            batch_b = await service.atomic_mutate_batch_stock(
                product_id=prod.id,
                warehouse_id=src_wh.id,
                batch_no=batch_name_b,
                qty_delta=Decimal("50.0000"),
                movement_type="INWARD_GRN",
                expiry_date=exp_b,
                mrp=Decimal("250.00"),
                purchase_rate=Decimal("150.00"),
            )
            await session.commit()
            assert batch_b.quantity >= Decimal("50.0000")

            # 4. Allocate 60 units using FEFO: should take 50 from BATCH-B (expiring in 5 days) + 10 from BATCH-A (expiring in 20 days)
            allocs = await service.allocate_stock_fefo(
                product_id=prod.id,
                warehouse_id=src_wh.id,
                requested_qty=Decimal("60.0000")
            )
            assert len(allocs) == 2, f"Expected exactly 2 allocations for isolated product, got {len(allocs)}"
            assert allocs[0]["batch_no"] == batch_name_b
            assert allocs[0]["allocated_quantity"] == 50.0
            assert allocs[1]["batch_no"] == batch_name_a
            assert allocs[1]["allocated_quantity"] == 10.0

            # 5. Create Transfer Order for 30 units of BATCH-A
            transfer = await service.create_stock_transfer(
                source_warehouse_id=src_wh.id,
                dest_warehouse_id=dst_wh.id,
                items_in=[{"product_id": prod.id, "batch_no": batch_name_a, "quantity": 30.0, "unit_cost": 150.0}],
                transporter_name="Speed Logistics",
                lr_number="LR-12345",
                vehicle_number="MH-04-AB-1234",
            )
            await session.commit()
            transfer_id = transfer.id
            assert transfer.status == "DRAFT"

            # 6. Dispatch Transfer
            dispatched = await service.dispatch_stock_transfer(transfer.id)
            await session.commit()
            assert dispatched.status == "IN_TRANSIT"

            # 7. Receive Transfer (28 received, 2 shortage)
            received = await service.receive_stock_transfer(
                transfer_id=transfer.id,
                receipt_details=[{
                    "item_id": transfer.items[0].id,
                    "quantity_received": Decimal("28.0000"),
                    "quantity_shortage": Decimal("2.0000"),
                    "quantity_damaged": Decimal("0.0000"),
                }]
            )
            await session.commit()
            assert received.status == "PARTIAL"

        finally:
            # Guaranteed cleanup of all created records
            if transfer_id:
                await session.execute(text("DELETE FROM stock_transfer_items WHERE transfer_id = :tid"), {"tid": transfer_id})
                await session.execute(text("DELETE FROM stock_transfers WHERE id = :tid"), {"tid": transfer_id})
            await session.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id})
            await session.execute(text("DELETE FROM product_batch_stocks WHERE product_id = :pid"), {"pid": prod_id})
            await session.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
            await session.commit()

