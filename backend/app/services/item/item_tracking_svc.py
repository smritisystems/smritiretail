"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ItemTrackingService
────────────────────
Responsibility: 5-bucket inventory computation, batch registration, serial registration.
Extracted from: item_master_svc.py::_compute_inventory_buckets (L931–L1068)
                item_master_svc.py::create_batch (L2186–L2209)
                item_master_svc.py::register_serial_numbers (L2211–L2238)

SRP: This service ONLY handles tracking state — inventory buckets, batch records, serial records.
     It does NOT resolve items by barcode or compute pricing.

Audit finding: item_batches and item_serials are not yet wired to any transactional FK.
               The get_legacy_product_view adapter is also kept here as it bridges batch/stock.
"""

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.item_master import (
    Item,
    ItemBatch,
    ItemSerial,
    ItemVariant,
    ItemWarehouseLocation,
)
from ...models.inventory import Product, ProductBatchStock
from ...schemas.item_master import (
    ItemBatchItem,
    ItemSerialItem,
    LegacyProductAdapterResponse,
)


class ItemTrackingService:
    """
    5-Bucket Inventory Computation + Batch/Serial Registration.

    Enterprise Available-To-Promise (ATP) Formula:
        available_to_promise = max(
            0.0,
            (physical_on_hand + in_transit_qty)
            - (reserved_qty + committed_qty + quarantine_qty)
        )

    Bucket definitions:
        physical_on_hand  — Total physical stock in store/warehouse
        in_transit_qty    — Dispatched via transfer, awaiting receipt
        reserved_qty      — Soft holds (cart / POS session)
        committed_qty     — Hard allocations for confirmed sales orders / PO dispatches
        quarantine_qty    — Damaged / expired / QC hold stock
    """

    @classmethod
    async def _compute_inventory_buckets(
        cls,
        session: AsyncSession,
        item_id: str,
        variant_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        item_code: Optional[str] = None,
        variant_sku: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Compute the 5 canonical enterprise inventory buckets for a given item/variant."""
        physical_on_hand = 0.0
        in_transit_qty = 0.0
        reserved_qty = 0.0
        committed_qty = 0.0
        quarantine_qty = 0.0

        # ── Primary: ProductBatchStock (variant-level) ─────────────────────
        if variant_id:
            batch_stock_stmt = select(ProductBatchStock).where(
                ProductBatchStock.variant_id == variant_id,
                ProductBatchStock.is_deleted == False,
            )
            if branch_id:
                batch_stock_stmt = batch_stock_stmt.where(
                    ProductBatchStock.warehouse_id == branch_id
                )
            batch_stocks = (await session.execute(batch_stock_stmt)).scalars().all()
            if batch_stocks:
                for bs in batch_stocks:
                    physical_on_hand += float(bs.quantity or 0.0)
                    reserved_qty += float(bs.reserved_quantity or 0.0)
                    quarantine_qty += float(bs.damaged_quantity or 0.0)

        # ── Fallback: Product table (legacy/migration bridge) ──────────────
        if physical_on_hand == 0.0 and reserved_qty == 0.0:
            clauses = [Product.is_deleted == False]
            ident_clauses = []
            if variant_id:
                ident_clauses.append(Product.item_variant_id == variant_id)
            if item_id:
                ident_clauses.append(Product.item_id == item_id)
            if item_code:
                ident_clauses.append(Product.code == item_code)
            if variant_sku:
                ident_clauses.append(Product.sku == variant_sku)
            if ident_clauses:
                prod_stmt = (
                    select(Product)
                    .where(and_(*clauses, or_(*ident_clauses)))
                    .limit(1)
                )
                prod_row = (await session.execute(prod_stmt)).scalar_one_or_none()
                if prod_row:
                    physical_on_hand = float(prod_row.stock or 0.0)
                    reserved_qty = float(prod_row.reserved_stock or 0.0)

        # ── Committed: SalesOrderReservation (hard B2B allocations) ────────
        try:
            async with session.begin_nested():
                from app.models.sales import SalesOrderReservation
                res_stmt = (
                    select(func.coalesce(func.sum(SalesOrderReservation.reserved_quantity), 0.0))
                    .where(
                        SalesOrderReservation.is_deleted == False,
                        SalesOrderReservation.status.in_(["ACTIVE", "PARTIAL"]),
                    )
                )
                if branch_id:
                    res_stmt = res_stmt.where(SalesOrderReservation.warehouse_id == branch_id)
                if variant_id or item_id:
                    prod_sub = select(Product.id).where(
                        or_(
                            Product.item_variant_id == variant_id if variant_id else False,
                            Product.item_id == item_id,
                        )
                    )
                    res_stmt = res_stmt.where(SalesOrderReservation.product_id.in_(prod_sub))
                committed_qty = float((await session.execute(res_stmt)).scalar() or 0.0)
        except Exception:
            committed_qty = 0.0

        # ── In-Transit: StockTransfer dispatched, not yet received ─────────
        try:
            async with session.begin_nested():
                from app.models.inventory import StockTransfer, StockTransferItem
                xfer_stmt = (
                    select(func.coalesce(
                        func.sum(
                            StockTransferItem.quantity_dispatched
                            - StockTransferItem.quantity_received
                        ),
                        0.0,
                    ))
                    .select_from(StockTransferItem)
                    .join(StockTransfer, StockTransfer.id == StockTransferItem.transfer_id)
                    .where(
                        StockTransfer.is_deleted == False,
                        StockTransferItem.is_deleted == False,
                        StockTransfer.status.in_(["DISPATCHED", "IN_TRANSIT"]),
                    )
                )
                if branch_id:
                    xfer_stmt = xfer_stmt.where(StockTransfer.dest_warehouse_id == branch_id)
                if variant_id or item_id:
                    prod_sub = select(Product.id).where(
                        or_(
                            Product.item_variant_id == variant_id if variant_id else False,
                            Product.item_id == item_id,
                        )
                    )
                    xfer_stmt = xfer_stmt.where(StockTransferItem.product_id.in_(prod_sub))
                in_transit_qty = float((await session.execute(xfer_stmt)).scalar() or 0.0)
        except Exception:
            in_transit_qty = 0.0

        # ── De-duplication: remove committed qty from reserved to prevent double-deduction
        raw_reserved_qty = reserved_qty
        net_reserved_qty = max(0.0, round(raw_reserved_qty - committed_qty, 4))

        # ── ATP formula ───────────────────────────────────────────────────
        atp = max(
            0.0,
            round(
                (physical_on_hand + in_transit_qty)
                - (net_reserved_qty + committed_qty + quarantine_qty),
                4,
            ),
        )

        return {
            "physical_on_hand": physical_on_hand,
            "in_transit_qty": in_transit_qty,
            "reserved_qty": net_reserved_qty,
            "committed_qty": committed_qty,
            "quarantine_qty": quarantine_qty,
            "available_to_promise": atp,
        }

    @classmethod
    async def create_batch(
        cls,
        session: AsyncSession,
        item_id: str,
        b_data: ItemBatchItem,
    ) -> ItemBatch:
        """
        Registers an inventory batch with manufacturing and expiration dates.

        NOTE (Audit Finding): item_batches is not yet referenced by any transactional
        table (purchase_receipt_items, sales_invoice_items, stock_movements).
        Phase 5 of the refactoring roadmap will add batch_id FK to those tables.
        """
        from .item_catalog_svc import ItemCatalogService
        item = await ItemCatalogService.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        batch = ItemBatch(
            id=f"batch_{uuid.uuid4().hex[:12]}",
            item_id=item.id,
            variant_id=b_data.variant_id or (item.variants[0].id if item.variants else None),
            batch_number=b_data.batch_number,
            mrp=Decimal(str(b_data.mrp or item.mrp)),
            cost_price=Decimal(str(b_data.cost_price or item.cost_price)),
            is_active=b_data.is_active,
        )
        session.add(batch)
        item.batches.append(batch)
        await session.commit()
        return batch

    @classmethod
    async def register_serial_numbers(
        cls,
        session: AsyncSession,
        item_id: str,
        serial_items: List[ItemSerialItem],
    ) -> List[ItemSerial]:
        """
        Registers a collection of serialized unit IDs.

        NOTE (Audit Finding): item_serials is not yet referenced by any transactional
        table (sales_invoice_items, sales_return_items, stock_movements).
        Phase 5 of the refactoring roadmap will add serial_id FK to those tables.
        """
        from .item_catalog_svc import ItemCatalogService
        item = await ItemCatalogService.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        created = []
        for s_data in serial_items:
            ser = ItemSerial(
                id=f"ser_{uuid.uuid4().hex[:12]}",
                item_id=item.id,
                variant_id=s_data.variant_id or (item.variants[0].id if item.variants else None),
                serial_number=s_data.serial_number,
                status=s_data.status,
                warehouse_id=s_data.warehouse_id,
            )
            session.add(ser)
            item.serials.append(ser)
            created.append(ser)

        await session.commit()
        return created

    @classmethod
    async def get_legacy_product_view(
        cls,
        session: AsyncSession,
        item_id: str,
    ) -> Optional[LegacyProductAdapterResponse]:
        """Compatibility adapter: Projects Universal Item as a legacy Product object."""
        from .item_catalog_svc import ItemCatalogService
        item = await ItemCatalogService.get_item_by_id(session, item_id)
        if not item:
            return None

        return LegacyProductAdapterResponse(
            id=item.id,
            sku=item.item_code,
            name=item.item_name,
            category=item.category,
            brand=item.brand,
            hsn_code=item.hsn_code,
            tax_rate=float(item.tax_rate),
            price=float(item.selling_price),
            cost=float(item.cost_price),
            mrp=float(item.mrp),
            uom=item.primary_uom,
            is_active=item.status == "ACTIVE",
        )

    # ───────────────────────────────────────────────────────────────────────────
    # Phase 5: Transactional Tracking Resolution Engines
    # ───────────────────────────────────────────────────────────────────────────

    @classmethod
    async def resolve_or_create_batch(
        cls,
        session: AsyncSession,
        item_id: str,
        batch_number: str,
        variant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        mfg_date: Optional[Any] = None,
        exp_date: Optional[Any] = None,
        mrp: Optional[Decimal] = None,
        cost_price: Optional[Decimal] = None,
        auto_commit: bool = False,
    ) -> ItemBatch:
        """
        Idempotently resolves an existing batch or creates a canonical ItemBatch.
        Wired to stock_movements.batch_id, purchase_receipt_items.batch_id,
        sales_invoice_items.batch_id, and sales_return_items.batch_id.
        """
        clean_batch_no = str(batch_number).strip().upper()
        stmt = select(ItemBatch).where(
            ItemBatch.item_id == item_id,
            ItemBatch.batch_number == clean_batch_no,
            ItemBatch.is_deleted == False,
        )
        if company_id:
            stmt = stmt.where(or_(ItemBatch.company_id == company_id, ItemBatch.company_id.is_(None)))
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            return existing

        batch = ItemBatch(
            id=f"batch_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            item_id=item_id,
            variant_id=variant_id,
            batch_number=clean_batch_no,
            mfg_date=mfg_date,
            exp_date=exp_date,
            mrp=mrp or Decimal("0.00"),
            cost_price=cost_price or Decimal("0.00"),
            is_active=True,
        )
        session.add(batch)
        if auto_commit:
            await session.commit()
        else:
            await session.flush()
        return batch

    @classmethod
    async def resolve_or_create_serial(
        cls,
        session: AsyncSession,
        item_id: str,
        serial_number: str,
        variant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        status: str = "AVAILABLE",
        auto_commit: bool = False,
    ) -> ItemSerial:
        """
        Idempotently resolves an existing unit serial or registers a new ItemSerial.
        Wired to stock_movements.serial_id, sales_invoice_items.serial_id,
        and sales_return_items.serial_id.
        """
        clean_serial = str(serial_number).strip().upper()
        stmt = select(ItemSerial).where(
            ItemSerial.item_id == item_id,
            ItemSerial.serial_number == clean_serial,
            ItemSerial.is_deleted == False,
        )
        if company_id:
            stmt = stmt.where(or_(ItemSerial.company_id == company_id, ItemSerial.company_id.is_(None)))
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            if status and existing.status != status:
                existing.status = status
                if auto_commit:
                    await session.commit()
            return existing

        ser = ItemSerial(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            item_id=item_id,
            variant_id=variant_id,
            serial_number=clean_serial,
            status=status,
            warehouse_id=warehouse_id,
            is_active=True,
        )
        session.add(ser)
        if auto_commit:
            await session.commit()
        else:
            await session.flush()
        return ser

    @classmethod
    async def resolve_or_create_warehouse_location(
        cls,
        session: AsyncSession,
        item_id: str,
        warehouse_id: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        location_bin: Optional[str] = None,
        min_reorder_level: Decimal = Decimal("0.00"),
        max_capacity: Decimal = Decimal("0.00"),
        reorder_quantity: Decimal = Decimal("0.00"),
        auto_commit: bool = False,
    ) -> ItemWarehouseLocation:
        """
        Idempotently resolves or creates an ItemWarehouseLocation for an item in a warehouse.
        Wired to stock_movements.location_id, purchase_receipt_items.warehouse_location_id,
        and sales_invoice_items.warehouse_location_id.
        """
        stmt = select(ItemWarehouseLocation).where(
            ItemWarehouseLocation.item_id == item_id,
            ItemWarehouseLocation.warehouse_id == warehouse_id,
            ItemWarehouseLocation.is_deleted == False,
        )
        if company_id:
            stmt = stmt.where(or_(ItemWarehouseLocation.company_id == company_id, ItemWarehouseLocation.company_id.is_(None)))
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            if location_bin and existing.location_bin != location_bin:
                existing.location_bin = location_bin
                if auto_commit:
                    await session.commit()
            return existing

        loc = ItemWarehouseLocation(
            id=f"loc_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            item_id=item_id,
            warehouse_id=warehouse_id,
            location_bin=location_bin,
            min_reorder_level=min_reorder_level,
            max_capacity=max_capacity,
            reorder_quantity=reorder_quantity,
            is_active=True,
        )
        session.add(loc)
        if auto_commit:
            await session.commit()
        else:
            await session.flush()
        return loc
