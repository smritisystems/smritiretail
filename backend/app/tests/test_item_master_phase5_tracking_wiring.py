"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.0
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Domain Verification Test Suite — Phase 5 Tracking Wiring
"""

import sys
import os
import pytest
import uuid
import asyncio
from decimal import Decimal
from datetime import date
from sqlalchemy import select, text


from app.db.session import get_company_sessionmaker
from app.models.item_master import (
    Item,
    ItemVariant,
    ItemBatch,
    ItemSerial,
    ItemWarehouseLocation,
)
from app.models.inventory import StockMovement
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, Supplier
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.services.item.item_tracking_svc import ItemTrackingService


@pytest.mark.asyncio
async def test_schema_phase5_column_parity():
    """Verify Phase 5 database columns exist with correct types and nullable=YES across all 4 tables."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        query = text("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE (table_name = 'stock_movements' AND column_name IN ('batch_id', 'serial_id', 'location_id'))
               OR (table_name = 'purchase_receipt_items' AND column_name IN ('batch_id', 'warehouse_location_id'))
               OR (table_name = 'sales_invoice_items' AND column_name IN ('batch_id', 'serial_id', 'warehouse_location_id'))
               OR (table_name = 'sales_return_items' AND column_name IN ('batch_id', 'serial_id'));
        """)
        res = await session.execute(query)
        rows = [dict(r._mapping) for r in res.fetchall()]

        # Map by (table, col)
        col_map = {(r["table_name"], r["column_name"]): r for r in rows}

        expected = [
            ("stock_movements", "batch_id"),
            ("stock_movements", "serial_id"),
            ("stock_movements", "location_id"),
            ("purchase_receipt_items", "batch_id"),
            ("purchase_receipt_items", "warehouse_location_id"),
            ("sales_invoice_items", "batch_id"),
            ("sales_invoice_items", "serial_id"),
            ("sales_invoice_items", "warehouse_location_id"),
            ("sales_return_items", "batch_id"),
            ("sales_return_items", "serial_id"),
        ]

        for tbl, col in expected:
            assert (tbl, col) in col_map, f"Column {col} missing from table {tbl}"
            info = col_map[(tbl, col)]
            assert info["is_nullable"] == "YES", f"{tbl}.{col} must be nullable"
            assert "varying" in info["data_type"], f"{tbl}.{col} must be character varying"


@pytest.mark.asyncio
async def test_item_tracking_service_resolve_or_create_batch():
    """Verify batch resolution, idempotent creation, and attribute persistence."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Setup item and variant
        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        var_id = f"var_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="Batch Test Shoe",
            category="FOOTWEAR",
            status="ACTIVE",
        )
        variant = ItemVariant(
            id=var_id,
            company_id="COMP-001",
            item_id=item_id,
            variant_sku=f"SKU-{uuid.uuid4().hex[:8].upper()}",
            variant_name="Batch Test Shoe Black 42",
            mrp=Decimal("2999.00"),
            selling_price=Decimal("2499.00"),
        )
        session.add(item)
        session.add(variant)
        await session.flush()

        batch_no = f"BAT-TEST-{uuid.uuid4().hex[:6].upper()}"
        mfg = date(2026, 1, 1)
        exp = date(2028, 1, 1)

        # 1. First resolution creates the batch
        b1 = await ItemTrackingService.resolve_or_create_batch(
            session=session,
            item_id=item_id,
            batch_number=batch_no,
            variant_id=var_id,
            company_id="COMP-001",
            mfg_date=mfg,
            exp_date=exp,
            mrp=Decimal("2999.00"),
            cost_price=Decimal("1500.00"),
            auto_commit=False,
        )
        await session.flush()
        assert b1.id.startswith("batch_")
        assert b1.batch_number == batch_no
        assert b1.mfg_date == mfg
        assert b1.exp_date == exp

        # 2. Second resolution returns the exact existing batch (idempotent)
        b2 = await ItemTrackingService.resolve_or_create_batch(
            session=session,
            item_id=item_id,
            batch_number=batch_no,
            company_id="COMP-001",
            auto_commit=False,
        )
        assert b2.id == b1.id
        await session.rollback()


@pytest.mark.asyncio
async def test_item_tracking_service_resolve_or_create_serial():
    """Verify serial registration, duplicate lookup, and status update."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="Serial Test Watch",
            category="ACCESSORIES",
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        serial_no = f"SN-{uuid.uuid4().hex[:8].upper()}"

        # 1. Create serial as AVAILABLE
        s1 = await ItemTrackingService.resolve_or_create_serial(
            session=session,
            item_id=item_id,
            serial_number=serial_no,
            company_id="COMP-001",
            warehouse_id="WH-CENTRAL",
            status="AVAILABLE",
            auto_commit=False,
        )
        await session.flush()
        assert s1.id.startswith("ser_")
        assert s1.serial_number == serial_no
        assert s1.status == "AVAILABLE"

        # 2. Update status to SOLD
        s2 = await ItemTrackingService.resolve_or_create_serial(
            session=session,
            item_id=item_id,
            serial_number=serial_no,
            company_id="COMP-001",
            status="SOLD",
            auto_commit=False,
        )
        await session.flush()
        assert s2.id == s1.id
        assert s2.status == "SOLD"
        await session.rollback()


@pytest.mark.asyncio
async def test_item_tracking_service_resolve_or_create_warehouse_location():
    """Verify warehouse location bin assignment and update."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="Bin Test Apparel",
            category="APPAREL",
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        wh_id = f"WH-{uuid.uuid4().hex[:6].upper()}"

        # 1. Create location
        loc1 = await ItemTrackingService.resolve_or_create_warehouse_location(
            session=session,
            item_id=item_id,
            warehouse_id=wh_id,
            company_id="COMP-001",
            location_bin="Aisle-3-Shelf-B",
            min_reorder_level=Decimal("10.00"),
            max_capacity=Decimal("100.00"),
            reorder_quantity=Decimal("25.00"),
            auto_commit=False,
        )
        await session.flush()
        assert loc1.id.startswith("loc_")
        assert loc1.location_bin == "Aisle-3-Shelf-B"

        # 2. Update bin
        loc2 = await ItemTrackingService.resolve_or_create_warehouse_location(
            session=session,
            item_id=item_id,
            warehouse_id=wh_id,
            company_id="COMP-001",
            location_bin="Aisle-4-Shelf-C",
            auto_commit=False,
        )
        await session.flush()
        assert loc2.id == loc1.id
        assert loc2.location_bin == "Aisle-4-Shelf-C"
        await session.rollback()


@pytest.mark.asyncio
async def test_stock_movement_phase5_fk_wiring_and_relationships():
    """Verify StockMovement successfully persists and eagerly joins batch_id, serial_id, and location_id."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="Movement Test Item",
            category="FOOTWEAR",
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        batch = await ItemTrackingService.resolve_or_create_batch(
            session=session,
            item_id=item_id,
            batch_number=f"BAT-MOV-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        serial = await ItemTrackingService.resolve_or_create_serial(
            session=session,
            item_id=item_id,
            serial_number=f"SN-MOV-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        loc = await ItemTrackingService.resolve_or_create_warehouse_location(
            session=session,
            item_id=item_id,
            warehouse_id=f"WH-MOV-{uuid.uuid4().hex[:4].upper()}",
            company_id="COMP-001",
            location_bin="BIN-01",
            auto_commit=False,
        )
        await session.flush()

        # Create StockMovement linking all three
        mov_id = f"mov_{uuid.uuid4().hex[:12]}"
        mov = StockMovement(
            id=mov_id,
            company_id="COMP-001",
            product_id=None,
            item_id=item_id,
            product_name="Movement Test Item",
            sku=item.item_code,
            quantity=Decimal("5.00"),
            movement_type="INWARD_GRN",
            batch_id=batch.id,
            serial_id=serial.id,
            location_id=loc.id,
        )
        session.add(mov)
        await session.commit()

        # Query back and verify relations
        q = select(StockMovement).where(StockMovement.id == mov_id)
        saved = (await session.execute(q)).scalar_one_or_none()
        assert saved is not None
        assert saved.batch_id == batch.id
        assert saved.serial_id == serial.id
        assert saved.location_id == loc.id
        assert saved.batch_rel.batch_number == batch.batch_number
        assert saved.serial_rel.serial_number == serial.serial_number
        assert saved.location_rel.location_bin == "BIN-01"


@pytest.mark.asyncio
async def test_purchase_receipt_item_phase5_fk_wiring():
    """Verify PurchaseReceiptItem successfully links batch_id and warehouse_location_id."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Supplier
        supp = Supplier(
            id=f"sup_{uuid.uuid4().hex[:10]}",
            company_id="COMP-001",
            name="Test Supplier GRN",
            code=f"SUP-{uuid.uuid4().hex[:6].upper()}",
        )
        session.add(supp)
        await session.flush()

        # Receipt parent
        rcpt = PurchaseReceipt(
            id=f"rcpt_{uuid.uuid4().hex[:10]}",
            company_id="COMP-001",
            receipt_no=f"GRN-{uuid.uuid4().hex[:8].upper()}",
            supplier_id=supp.id,
            status="RECEIVED",
        )
        session.add(rcpt)
        await session.flush()

        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="GRN Test Item",
            category="FOOTWEAR",
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        batch = await ItemTrackingService.resolve_or_create_batch(
            session=session,
            item_id=item_id,
            batch_number=f"BAT-GRN-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        loc = await ItemTrackingService.resolve_or_create_warehouse_location(
            session=session,
            item_id=item_id,
            warehouse_id=f"WH-GRN-{uuid.uuid4().hex[:4].upper()}",
            company_id="COMP-001",
            location_bin="BAY-9",
            auto_commit=False,
        )
        await session.flush()

        line = PurchaseReceiptItem(
            id=f"pri_{uuid.uuid4().hex[:10]}",
            company_id="COMP-001",
            receipt_id=rcpt.id,
            product_id=None,
            item_id=item_id,
            code=item.item_code,
            name=item.item_name,
            quantity_received=Decimal("12.00"),
            cost_price=Decimal("1000.00"),
            gst_rate=Decimal("18.00"),
            tax_amount=Decimal("2160.00"),
            line_total=Decimal("14160.00"),
            batch_id=batch.id,
            warehouse_location_id=loc.id,
        )
        session.add(line)
        await session.commit()

        # Query back and verify relations
        q = select(PurchaseReceiptItem).where(PurchaseReceiptItem.id == line.id)
        saved = (await session.execute(q)).scalar_one_or_none()
        assert saved is not None
        assert saved.batch_id == batch.id
        assert saved.warehouse_location_id == loc.id
        assert saved.batch.batch_number == batch.batch_number
        assert saved.warehouse_location.location_bin == "BAY-9"


@pytest.mark.asyncio
async def test_sales_invoice_item_phase5_fk_wiring():
    """Verify SalesInvoiceItem successfully links batch_id, serial_id, and warehouse_location_id."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        inv = SalesInvoice(
            id=f"inv_{uuid.uuid4().hex[:10]}",
            company_id="COMP-001",
            invoice_no=f"INV-{uuid.uuid4().hex[:8].upper()}",
            customer_name="Walk-in Customer",
            status="Draft",
            tax_total=Decimal("449.82"),
            grand_total=Decimal("2948.82"),
        )
        session.add(inv)
        await session.flush()

        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="Sales Test Item",
            category="FOOTWEAR",
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        batch = await ItemTrackingService.resolve_or_create_batch(
            session=session,
            item_id=item_id,
            batch_number=f"BAT-SALE-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        serial = await ItemTrackingService.resolve_or_create_serial(
            session=session,
            item_id=item_id,
            serial_number=f"SN-SALE-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        loc = await ItemTrackingService.resolve_or_create_warehouse_location(
            session=session,
            item_id=item_id,
            warehouse_id=f"WH-SALE-{uuid.uuid4().hex[:4].upper()}",
            company_id="COMP-001",
            location_bin="POS-DRAWER-1",
            auto_commit=False,
        )
        await session.flush()

        s_line = SalesInvoiceItem(
            invoice_id=inv.id,
            company_id="COMP-001",
            product_id=None,
            item_id=item_id,
            code=item.item_code,
            name=item.item_name,
            quantity=Decimal("1.00"),
            price=Decimal("2499.00"),
            gst_rate=Decimal("18.00"),
            tax_amount=Decimal("449.82"),
            total_amount=Decimal("2948.82"),
            batch_id=batch.id,
            serial_id=serial.id,
            warehouse_location_id=loc.id,
        )
        session.add(s_line)
        await session.commit()

        # Query back and verify relations
        q = select(SalesInvoiceItem).where(SalesInvoiceItem.invoice_id == inv.id)
        saved = (await session.execute(q)).scalar_one_or_none()
        assert saved is not None
        assert saved.batch_id == batch.id
        assert saved.serial_id == serial.id
        assert saved.warehouse_location_id == loc.id
        assert saved.batch.batch_number == batch.batch_number
        assert saved.serial.serial_number == serial.serial_number
        assert saved.warehouse_location.location_bin == "POS-DRAWER-1"


@pytest.mark.asyncio
async def test_sales_return_item_phase5_fk_wiring():
    """Verify SalesReturnItem successfully links batch_id and serial_id."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create parent invoice for return
        parent_inv = SalesInvoice(
            id=f"inv_{uuid.uuid4().hex[:10]}",
            company_id="COMP-001",
            invoice_no=f"INV-RET-{uuid.uuid4().hex[:8].upper()}",
            status="Draft",
            tax_total=Decimal("449.82"),
            grand_total=Decimal("2948.82"),
        )
        session.add(parent_inv)
        await session.flush()

        ret = SalesReturn(
            id=f"ret_{uuid.uuid4().hex[:10]}",
            company_id="COMP-001",
            return_no=f"RET-{uuid.uuid4().hex[:8].upper()}",
            original_invoice_id=parent_inv.id,
            status="Draft",
            tax_total=Decimal("449.82"),
            grand_total=Decimal("2948.82"),
        )
        session.add(ret)
        await session.flush()

        item_id = f"itm_{uuid.uuid4().hex[:12]}"
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"CODE-{uuid.uuid4().hex[:8].upper()}",
            item_name="Return Test Item",
            category="FOOTWEAR",
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        batch = await ItemTrackingService.resolve_or_create_batch(
            session=session,
            item_id=item_id,
            batch_number=f"BAT-RET-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        serial = await ItemTrackingService.resolve_or_create_serial(
            session=session,
            item_id=item_id,
            serial_number=f"SN-RET-{uuid.uuid4().hex[:6].upper()}",
            company_id="COMP-001",
            auto_commit=False,
        )
        await session.flush()

        ret_line = SalesReturnItem(
            return_id=ret.id,
            company_id="COMP-001",
            product_id=None,
            item_id=item_id,
            code=item.item_code,
            name=item.item_name,
            quantity=Decimal("1.00"),
            price=Decimal("2499.00"),
            gst_rate=Decimal("18.00"),
            tax_amount=Decimal("449.82"),
            total_amount=Decimal("2948.82"),
            batch_id=batch.id,
            serial_id=serial.id,
        )
        session.add(ret_line)
        await session.commit()

        # Query back and verify relations
        q = select(SalesReturnItem).where(SalesReturnItem.return_id == ret.id)
        saved = (await session.execute(q)).scalar_one_or_none()
        assert saved is not None
        assert saved.batch_id == batch.id
        assert saved.serial_id == serial.id
        assert saved.batch.batch_number == batch.batch_number
        assert saved.serial.serial_number == serial.serial_number
