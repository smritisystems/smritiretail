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
from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, date
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from ..api.deps import TenantContext
from ..models.inventory import (
    Warehouse, Product, StockMovement,
    ProductBatchStock, StockTransfer, StockTransferItem, TransferStatus
)


class InventoryWmsService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def allocate_stock_fefo(
        self,
        product_id: str,
        warehouse_id: str,
        requested_qty: Decimal,
    ) -> List[Dict[str, Any]]:
        """
        Allocates required stock from candidate batches using First-Expired, First-Out (FEFO).
        Locks candidate batch rows with SELECT ... FOR UPDATE to ensure atomic serialization.
        """
        if requested_qty <= 0:
            raise HTTPException(status_code=400, detail="Requested allocation quantity must be greater than zero.")

        # Query active batches ordered by expiry date (oldest first)
        q = (
            select(ProductBatchStock)
            .where(
                ProductBatchStock.company_id == self.tenant_ctx.company_id,
                ProductBatchStock.warehouse_id == warehouse_id,
                ProductBatchStock.product_id == product_id,
                ProductBatchStock.is_deleted == False,
                (ProductBatchStock.quantity - ProductBatchStock.reserved_quantity - ProductBatchStock.damaged_quantity) > 0
            )
            .order_by(
                ProductBatchStock.expiry_date.asc().nulls_last(),
                ProductBatchStock.created_at.asc()
            )
            .with_for_update()
        )
        res = await self.db.execute(q)
        batches = res.scalars().all()

        allocations: List[Dict[str, Any]] = []
        remaining = Decimal(str(requested_qty))

        for b in batches:
            available = Decimal(str(b.quantity)) - Decimal(str(b.reserved_quantity)) - Decimal(str(b.damaged_quantity))
            if available <= 0:
                continue

            alloc_qty = min(available, remaining)
            allocations.append({
                "batch_id": b.id,
                "batch_no": b.batch_no,
                "allocated_quantity": float(alloc_qty),
                "mfg_date": b.mfg_date,
                "expiry_date": b.expiry_date,
                "mrp": float(b.mrp) if b.mrp else None,
                "purchase_rate": float(b.purchase_rate) if b.purchase_rate else None,
                "sale_rate": float(b.sale_rate) if b.sale_rate else None,
            })
            remaining -= alloc_qty
            if remaining <= 0:
                break

        if remaining > 0:
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-STOCK-001: Insufficient available stock for product {product_id} in warehouse {warehouse_id}. Short by {remaining} units."
            )

        return allocations

    async def atomic_mutate_batch_stock(
        self,
        product_id: str,
        warehouse_id: str,
        batch_no: str,
        qty_delta: Decimal,
        movement_type: str,
        mfg_date: Optional[date] = None,
        expiry_date: Optional[date] = None,
        mrp: Optional[Decimal] = None,
        purchase_rate: Optional[Decimal] = None,
        sale_rate: Optional[Decimal] = None,
        unit_cost: Optional[Decimal] = None,
        remarks: Optional[str] = None,
        reference_doc_type: Optional[str] = None,
        reference_doc_id: Optional[str] = None,
        user: Optional[str] = None,
    ) -> ProductBatchStock:
        """
        Atomically updates batch inventory, writes an audit StockMovement,
        and synchronizes the cached products.stock aggregate.
        """
        # 1. Verify product exists
        q_prod = select(Product).where(
            Product.id == product_id,
            Product.company_id == self.tenant_ctx.company_id,
            Product.is_deleted == False
        ).with_for_update()
        res_prod = await self.db.execute(q_prod)
        product = res_prod.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

        # 2. Lock or create batch stock record
        q_batch = select(ProductBatchStock).where(
            ProductBatchStock.company_id == self.tenant_ctx.company_id,
            ProductBatchStock.warehouse_id == warehouse_id,
            ProductBatchStock.product_id == product_id,
            ProductBatchStock.batch_no == batch_no,
            ProductBatchStock.is_deleted == False
        ).with_for_update()
        res_batch = await self.db.execute(q_batch)
        batch_stock = res_batch.scalars().first()

        qty_delta_dec = Decimal(str(qty_delta))

        if not batch_stock:
            if qty_delta_dec < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-STOCK-001: Cannot deduct from non-existent batch {batch_no} in warehouse {warehouse_id}."
                )
            batch_stock = ProductBatchStock(
                id=f"pbs-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                batch_no=batch_no,
                mfg_date=mfg_date,
                expiry_date=expiry_date,
                mrp=mrp,
                purchase_rate=purchase_rate or unit_cost,
                sale_rate=sale_rate,
                quantity=qty_delta_dec,
                reserved_quantity=Decimal("0.0000"),
                damaged_quantity=Decimal("0.0000"),
                last_counted_date=datetime.now(timezone.utc),
            )
            self.db.add(batch_stock)
        else:
            # Outward validation
            if qty_delta_dec < 0:
                available = Decimal(str(batch_stock.quantity)) - Decimal(str(batch_stock.reserved_quantity)) - Decimal(str(batch_stock.damaged_quantity))
                if available < abs(qty_delta_dec):
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-STOCK-001: Insufficient available stock in batch {batch_no}. Available: {available}, Requested: {abs(qty_delta_dec)}."
                    )
            batch_stock.quantity = Decimal(str(batch_stock.quantity)) + qty_delta_dec
            if mfg_date:
                batch_stock.mfg_date = mfg_date
            if expiry_date:
                batch_stock.expiry_date = expiry_date
            if mrp is not None:
                batch_stock.mrp = mrp
            if purchase_rate is not None:
                batch_stock.purchase_rate = purchase_rate
            if sale_rate is not None:
                batch_stock.sale_rate = sale_rate

        # 3. Create immutable StockMovement audit record
        movement = StockMovement(
            id=f"sm-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            product_id=product_id,
            product_name=product.name,
            sku=product.sku or product.code,
            quantity=abs(qty_delta_dec),
            movement_type=movement_type,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            warehouse_id=warehouse_id,
            batch=batch_no,
            unit_cost=unit_cost or purchase_rate,
            remarks=remarks,
            user=user,
            source_module="WMS",
        )
        self.db.add(movement)

        await self.db.flush()

        # 4. Synchronize products.stock cached aggregate (Total usable on-hand: SUM(quantity - damaged_quantity))
        q_sum = select(func.coalesce(func.sum(ProductBatchStock.quantity - ProductBatchStock.damaged_quantity), 0)).where(
            ProductBatchStock.company_id == self.tenant_ctx.company_id,
            ProductBatchStock.product_id == product_id,
            ProductBatchStock.is_deleted == False
        )
        res_sum = await self.db.execute(q_sum)
        total_usable = res_sum.scalar()
        product.stock = int(total_usable)

        await self.db.flush()
        return batch_stock

    async def create_stock_transfer(
        self,
        source_warehouse_id: str,
        dest_warehouse_id: str,
        items_in: List[Dict[str, Any]],
        transporter_name: Optional[str] = None,
        lr_number: Optional[str] = None,
        vehicle_number: Optional[str] = None,
        e_way_bill_no: Optional[str] = None,
        notes: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> StockTransfer:
        """
        Creates a new Stock Transfer Order in DRAFT status.
        """
        if source_warehouse_id == dest_warehouse_id:
            raise HTTPException(status_code=400, detail="Source and destination warehouses cannot be the same.")

        # Verify both warehouses exist and belong to active company tenant
        q_wh = select(Warehouse).where(
            Warehouse.id.in_([source_warehouse_id, dest_warehouse_id]),
            Warehouse.company_id == self.tenant_ctx.company_id,
            Warehouse.is_deleted == False
        )
        res_wh = await self.db.execute(q_wh)
        whs = res_wh.scalars().all()
        if len(whs) != 2:
            raise HTTPException(
                status_code=400,
                detail="Both source and destination warehouses must exist and belong to the active company tenant."
            )

        if not items_in:
            raise HTTPException(status_code=400, detail="Stock transfer must contain at least one item.")

        # Check idempotency
        if idempotency_key:
            q_idem = select(StockTransfer).where(
                StockTransfer.company_id == self.tenant_ctx.company_id,
                StockTransfer.idempotency_key == idempotency_key,
                StockTransfer.is_deleted == False
            )
            res_idem = await self.db.execute(q_idem)
            existing = res_idem.scalars().first()
            if existing:
                return existing

        transfer_no = f"STO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        transfer = StockTransfer(
            id=f"st-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            transfer_no=transfer_no,
            source_warehouse_id=source_warehouse_id,
            dest_warehouse_id=dest_warehouse_id,
            status=TransferStatus.DRAFT.value,
            transporter_name=transporter_name,
            lr_number=lr_number,
            vehicle_number=vehicle_number,
            e_way_bill_no=e_way_bill_no,
            idempotency_key=idempotency_key,
            notes=notes,
        )
        try:
            self.db.add(transfer)
            await self.db.flush()

            seen_items = set()
            for it in items_in:
                prod_id = it["product_id"]
                batch = it["batch_no"]
                qty = Decimal(str(it["quantity"]))
                cost = Decimal(str(it.get("unit_cost", 0.0)))

                if qty <= 0:
                    raise HTTPException(status_code=400, detail=f"Transfer quantity for product {prod_id} must be positive.")

                item_key = f"{prod_id}:{batch}"
                if item_key in seen_items:
                    raise HTTPException(status_code=400, detail=f"Duplicate product/batch entry in transfer: {item_key}.")
                seen_items.add(item_key)

                transfer_item = StockTransferItem(
                    id=f"sti-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    transfer_id=transfer.id,
                    product_id=prod_id,
                    batch_no=batch,
                    quantity_dispatched=qty,
                    quantity_received=Decimal("0.0000"),
                    quantity_shortage=Decimal("0.0000"),
                    quantity_damaged=Decimal("0.0000"),
                    unit_cost=cost,
                    notes=it.get("notes"),
                )
                self.db.add(transfer_item)

            await self.db.flush()
            return transfer
        except IntegrityError:
            if idempotency_key:
                q_idem = select(StockTransfer).where(
                    StockTransfer.company_id == self.tenant_ctx.company_id,
                    StockTransfer.idempotency_key == idempotency_key,
                    StockTransfer.is_deleted == False
                )
                res_idem = await self.db.execute(q_idem)
                existing = res_idem.scalars().first()
                if existing:
                    return existing
            raise

    async def dispatch_stock_transfer(self, transfer_id: str) -> StockTransfer:
        """
        Dispatches a Stock Transfer Order. Deducts stock from source warehouse and sets status to IN_TRANSIT.
        """
        q = select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.company_id == self.tenant_ctx.company_id,
            StockTransfer.is_deleted == False
        ).options(selectinload(StockTransfer.items)).with_for_update()
        res = await self.db.execute(q)
        transfer = res.scalars().first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Stock transfer order not found.")

        if transfer.status != TransferStatus.DRAFT.value:
            raise HTTPException(status_code=400, detail=f"Cannot dispatch transfer in status '{transfer.status}'. Must be DRAFT.")

        # Deduct items from source warehouse
        for item in transfer.items:
            await self.atomic_mutate_batch_stock(
                product_id=item.product_id,
                warehouse_id=transfer.source_warehouse_id,
                batch_no=item.batch_no,
                qty_delta=-Decimal(str(item.quantity_dispatched)),
                movement_type="TRANSFER_OUT",
                reference_doc_type="STOCK_TRANSFER",
                reference_doc_id=transfer.transfer_no,
                remarks=f"Dispatched via transfer {transfer.transfer_no} to warehouse {transfer.dest_warehouse_id}",
            )

        transfer.status = TransferStatus.IN_TRANSIT.value
        transfer.dispatch_date = datetime.now(timezone.utc)
        await self.db.flush()
        return transfer

    async def receive_stock_transfer(
        self,
        transfer_id: str,
        receipt_details: List[Dict[str, Any]],
    ) -> StockTransfer:
        """
        Receives an IN_TRANSIT Stock Transfer Order at the destination warehouse.
        Verifies received + shortage + damaged == dispatched.
        """
        q = select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.company_id == self.tenant_ctx.company_id,
            StockTransfer.is_deleted == False
        ).options(selectinload(StockTransfer.items)).with_for_update()
        res = await self.db.execute(q)
        transfer = res.scalars().first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Stock transfer order not found.")

        if transfer.status != TransferStatus.IN_TRANSIT.value:
            raise HTTPException(status_code=400, detail=f"Cannot receive transfer in status '{transfer.status}'. Must be IN_TRANSIT.")

        receipt_map = {r["item_id"]: r for r in receipt_details}

        has_partial = False
        for item in transfer.items:
            detail = receipt_map.get(item.id)
            if not detail:
                # Default to full receipt if not explicitly specified
                qty_rec = item.quantity_dispatched
                qty_short = Decimal("0.0000")
                qty_dam = Decimal("0.0000")
            else:
                qty_rec = Decimal(str(detail.get("quantity_received", item.quantity_dispatched)))
                qty_short = Decimal(str(detail.get("quantity_shortage", 0.0)))
                qty_dam = Decimal(str(detail.get("quantity_damaged", 0.0)))

            if (qty_rec + qty_short + qty_dam) != Decimal(str(item.quantity_dispatched)):
                raise HTTPException(
                    status_code=400,
                    detail=f"Item {item.product_id} reconciliation error: received ({qty_rec}) + shortage ({qty_short}) + damaged ({qty_dam}) != dispatched ({item.quantity_dispatched})."
                )

            item.quantity_received = qty_rec
            item.quantity_shortage = qty_short
            item.quantity_damaged = qty_dam

            if qty_short > 0 or qty_dam > 0:
                has_partial = True

            # Inward received quantity into destination warehouse
            if qty_rec > 0:
                await self.atomic_mutate_batch_stock(
                    product_id=item.product_id,
                    warehouse_id=transfer.dest_warehouse_id,
                    batch_no=item.batch_no,
                    qty_delta=qty_rec,
                    movement_type="TRANSFER_IN",
                    reference_doc_type="STOCK_TRANSFER",
                    reference_doc_id=transfer.transfer_no,
                    remarks=f"Received via transfer {transfer.transfer_no} from warehouse {transfer.source_warehouse_id}",
                )

        transfer.status = TransferStatus.PARTIAL.value if has_partial else TransferStatus.RECEIVED.value
        transfer.received_date = datetime.now(timezone.utc)
        await self.db.flush()
        return transfer
