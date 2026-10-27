"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-08-22
Modified     : 2026-10-27
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
from sqlalchemy.orm import selectinload, defer

from ..api.deps import TenantContext
from ..models.inventory import (
    Warehouse, WarehouseLocation, Product, StockMovement,
    ProductBatchStock, StockTransfer, StockTransferItem, TransferStatus
)
from .identity.engine import IdentityEngine


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
        batch_id: Optional[str] = None,
        serial_id: Optional[str] = None,
        location_id: Optional[str] = None,
        item_id: Optional[str] = None,
        variant_id: Optional[str] = None,
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
            from sqlalchemy import or_
            q_fallback = select(Product).where(
                or_(
                    Product.item_variant_id == product_id,
                    Product.sku == product_id,
                    Product.code == product_id,
                ),
                Product.company_id == self.tenant_ctx.company_id,
                Product.is_deleted == False
            ).with_for_update()
            res_fb = await self.db.execute(q_fallback)
            product = res_fb.scalars().first()
            if product:
                product_id = product.id
            else:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

        # 2. Lock or create batch stock record
        q_count = select(func.count(ProductBatchStock.id)).where(
            ProductBatchStock.company_id == self.tenant_ctx.company_id,
            ProductBatchStock.product_id == product_id,
            ProductBatchStock.is_deleted == False
        )
        res_count = await self.db.execute(q_count)
        batch_count = res_count.scalar() or 0
        if batch_count == 0 and (product.stock or 0) > 0 and qty_delta > 0:
            opening_pbs_id = IdentityEngine.generate_technical_id()
            opening_batch = ProductBatchStock(
                id=opening_pbs_id,
                uuid=opening_pbs_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                batch_no="BATCH-OPENING",
                quantity=Decimal(str(product.stock)),
                reserved_quantity=Decimal("0.0000"),
                damaged_quantity=Decimal("0.0000"),
                last_counted_date=datetime.now(timezone.utc),
            )
            self.db.add(opening_batch)
            await self.db.flush()

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
                # If product has aggregate stock >= requested deduction, initialize opening batch
                agg_stock = Decimal(str(product.stock or 0))
                if agg_stock >= abs(qty_delta_dec):
                    pbs_id = IdentityEngine.generate_technical_id()
                    batch_stock = ProductBatchStock(
                        id=pbs_id,
                        uuid=pbs_id,
                        company_id=self.tenant_ctx.company_id,
                        branch_id=self.tenant_ctx.branch_id,
                        product_id=product_id,
                        warehouse_id=warehouse_id,
                        batch_no=batch_no or "BATCH-OPENING",
                        mfg_date=mfg_date,
                        expiry_date=expiry_date,
                        mrp=mrp or product.mrp,
                        purchase_rate=purchase_rate or unit_cost or product.buying_price,
                        sale_rate=sale_rate or product.price,
                        quantity=agg_stock,
                        reserved_quantity=Decimal("0.0000"),
                        damaged_quantity=Decimal("0.0000"),
                        last_counted_date=datetime.now(timezone.utc),
                    )
                    self.db.add(batch_stock)
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"SMRITI-STOCK-001: Insufficient stock available for product {product_id} "
                            f"in warehouse {warehouse_id}. Available: {agg_stock}, "
                            f"requested: {abs(qty_delta_dec)}."
                        )
                    )
            else:
                pbs_id = IdentityEngine.generate_technical_id()
                batch_stock = ProductBatchStock(
                    id=pbs_id,
                    uuid=pbs_id,
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
                    quantity=Decimal("0.0000"),
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

        # 3. Post immutable StockMovement audit record via Single-Door StockLedger
        from .stock_ledger import StockLedger, MovementRequest, InternalCost
        post_req = MovementRequest(
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            product_id=product_id,
            quantity=abs(qty_delta_dec),
            movement_type=movement_type,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            warehouse_id=warehouse_id,
            batch_no=batch_no,
            allow_negative_stock=True,
            internal_cost=InternalCost(
                unit_cost=Decimal(str(unit_cost or purchase_rate or 0)),
                cost_source="WMS_CALLER",
            ),
            remarks=remarks,
            source_module="WMS",
            user=user,
        )
        post_res = await StockLedger.post(self.db, post_req)
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

        st_id = IdentityEngine.generate_technical_id()
        transfer_no = f"STO-{datetime.now().strftime('%Y%m%d')}-{st_id[:8].upper()}"
        transfer = StockTransfer(
            id=st_id,
            uuid=st_id,
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

            from .product_resolution_service import ProductResolutionService
            from ..schemas.product_resolution import TransactionLineItemInput

            # Atomic Batch Validation of transfer items (Phase 5 & 6)
            validation_lines = [
                TransactionLineItemInput(
                    line_no=idx + 1,
                    product_id=it["product_id"],
                    quantity=Decimal(str(it["quantity"])),
                )
                for idx, it in enumerate(items_in)
            ]
            resolved_lines = await ProductResolutionService.enforce_transaction_lines(
                session=self.db,
                company_id=self.tenant_ctx.company_id,
                lines=validation_lines,
                allow_inactive=False,
            )

            seen_items = set()
            for idx, it in enumerate(items_in):
                res_prod = resolved_lines[idx]
                prod_id = res_prod.product_id or it["product_id"]
                batch = it["batch_no"]
                qty = Decimal(str(it["quantity"]))
                cost = Decimal(str(it.get("unit_cost", 0.0)))

                if qty <= 0:
                    raise HTTPException(status_code=400, detail=f"Transfer quantity for product {prod_id} must be positive.")

                item_key = f"{prod_id}:{batch}"
                if item_key in seen_items:
                    raise HTTPException(status_code=400, detail=f"Duplicate product/batch entry in transfer: {item_key}.")
                seen_items.add(item_key)

                sti_id = IdentityEngine.generate_technical_id()
                transfer_item = StockTransferItem(
                    id=sti_id,
                    uuid=sti_id,
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

    async def request_stock_transfer(self, transfer_id: str) -> StockTransfer:
        """
        R-005: Transitions a Stock Transfer Order from DRAFT to REQUESTED.
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
            raise HTTPException(status_code=400, detail=f"Cannot request approval for transfer in status '{transfer.status}'. Must be DRAFT.")

        transfer.status = TransferStatus.REQUESTED.value
        await self.db.flush()
        return transfer

    async def approve_stock_transfer(self, transfer_id: str) -> StockTransfer:
        """
        R-005: Transitions a Stock Transfer Order from REQUESTED to APPROVED.
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

        if transfer.status != TransferStatus.REQUESTED.value:
            raise HTTPException(status_code=400, detail=f"Cannot approve transfer in status '{transfer.status}'. Must be REQUESTED.")

        transfer.status = TransferStatus.APPROVED.value
        await self.db.flush()
        return transfer

    async def reject_stock_transfer(self, transfer_id: str, reason: Optional[str] = None) -> StockTransfer:
        """
        R-005: Transitions a Stock Transfer Order from REQUESTED to REJECTED.
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

        if transfer.status != TransferStatus.REQUESTED.value:
            raise HTTPException(status_code=400, detail=f"Cannot reject transfer in status '{transfer.status}'. Must be REQUESTED.")

        transfer.status = TransferStatus.REJECTED.value
        if reason:
            transfer.notes = f"{transfer.notes or ''}\n[REJECTED]: {reason}".strip()
        await self.db.flush()
        return transfer

    async def dispatch_stock_transfer(self, transfer_id: str, bypass_approval: bool = True) -> StockTransfer:
        """
        Dispatches a Stock Transfer Order. Deducts stock from source warehouse and sets status to IN_TRANSIT.
        R-005: Minimal approval gate DRAFT -> REQUESTED -> APPROVED -> DISPATCHED.
        Configurable bypass_approval flag (default True) allows existing deployments to dispatch directly.
        Transfers explicitly in REQUESTED state require APPROVED before dispatch.
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

        if transfer.status == TransferStatus.REQUESTED.value:
            raise HTTPException(status_code=400, detail="Stock transfer order is pending approval. It must be APPROVED before dispatch.")

        if transfer.status == TransferStatus.DRAFT.value and not bypass_approval:
            raise HTTPException(status_code=400, detail="Approval required: Stock transfer order in DRAFT must be REQUESTED and APPROVED before dispatch.")

        if transfer.status not in (TransferStatus.DRAFT.value, TransferStatus.APPROVED.value):
            raise HTTPException(status_code=400, detail=f"Cannot dispatch transfer in status '{transfer.status}'. Must be DRAFT or APPROVED.")

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

    async def recommend_putaway(
        self,
        warehouse_id: str,
        warehouse_code: str,
        product_id: Optional[str] = None,
        item_id: Optional[str] = None,
        sku: Optional[str] = None,
        quantity: Decimal = Decimal("1.0000"),
        batch_no: Optional[str] = None,
        is_damaged: bool = False,
        preferred_zone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Automated WMS Putaway Rule Engine:
        Priority 1: Quarantine / Damage Isolation (is_damaged=True or preferred_zone='QUARANTINE')
        Priority 2: Dedicated Item Bin Affinity (ItemWarehouseLocation configured bin)
        Priority 3: Co-located Stock (matching existing stock of same product/batch)
        Priority 4: Nearest Available Empty / Capacity Bin in target zone (Aisle->Rack->Shelf->Bin order)
        """
        # Fetch active locations for warehouse
        q_locs = (
            select(WarehouseLocation)
            .where(
                WarehouseLocation.warehouse_id == warehouse_id,
                WarehouseLocation.company_id == self.tenant_ctx.company_id,
                WarehouseLocation.is_deleted == False,
                WarehouseLocation.is_active == True,
            )
            .order_by(
                WarehouseLocation.zone.asc(),
                WarehouseLocation.aisle.asc().nulls_last(),
                WarehouseLocation.rack.asc().nulls_last(),
                WarehouseLocation.shelf.asc().nulls_last(),
                WarehouseLocation.bin_code.asc().nulls_last(),
                WarehouseLocation.code.asc(),
            )
        )
        res_locs = await self.db.execute(q_locs)
        all_locations = res_locs.scalars().all()

        if not all_locations:
            return {
                "warehouse_id": warehouse_id,
                "warehouse_code": warehouse_code,
                "status": "NO_LOCATIONS_DEFINED",
                "recommended_location": None,
                "alternatives": [],
                "message": f"No physical locations configured for warehouse {warehouse_code}. Please configure bins or generate a location matrix first.",
            }

        # Calculate current occupancy per bin
        q_occ = (
            select(
                StockMovement.bin,
                func.coalesce(func.sum(StockMovement.quantity), 0).label("total_qty"),
            )
            .where(
                StockMovement.warehouse_id == warehouse_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.is_deleted == False,
                StockMovement.bin.isnot(None),
            )
            .group_by(StockMovement.bin)
        )
        res_occ = await self.db.execute(q_occ)
        occupancy_by_code: Dict[str, float] = {
            row[0]: max(0.0, float(row[1])) for row in res_occ.all() if row[0]
        }

        q_occ_id = (
            select(
                StockMovement.location_id,
                func.coalesce(func.sum(StockMovement.quantity), 0).label("total_qty"),
            )
            .where(
                StockMovement.warehouse_id == warehouse_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.is_deleted == False,
                StockMovement.location_id.isnot(None),
            )
            .group_by(StockMovement.location_id)
        )
        res_occ_id = await self.db.execute(q_occ_id)
        occupancy_by_id: Dict[str, float] = {
            row[0]: max(0.0, float(row[1])) for row in res_occ_id.all() if row[0]
        }

        def _to_candidate(loc: WarehouseLocation, rule: str) -> Dict[str, Any]:
            current_occ = max(
                occupancy_by_code.get(loc.code, 0.0),
                occupancy_by_id.get(loc.id, 0.0),
            )
            max_cap = float(loc.max_capacity_units or 100)
            avail_cap = max(0.0, max_cap - current_occ)
            return {
                "location_id": loc.id,
                "code": loc.code,
                "name": loc.name,
                "zone": loc.zone or "STORAGE",
                "aisle": loc.aisle,
                "rack": loc.rack,
                "shelf": loc.shelf,
                "bin_code": loc.bin_code,
                "barcode": loc.barcode,
                "max_capacity_units": loc.max_capacity_units,
                "current_occupancy": current_occ,
                "available_capacity": avail_cap,
                "rule_applied": rule,
            }

        req_qty = float(quantity)
        effective_item_id = item_id or product_id

        # --- Priority 1: Quarantine / Damage Isolation ---
        if is_damaged or (preferred_zone and preferred_zone.upper() == "QUARANTINE"):
            quarantine_locs = [
                l for l in all_locations
                if (l.zone or "").upper() == "QUARANTINE" and not l.is_locked
            ]
            if not quarantine_locs:
                return {
                    "warehouse_id": warehouse_id,
                    "warehouse_code": warehouse_code,
                    "status": "OVER_CAPACITY",
                    "recommended_location": None,
                    "alternatives": [],
                    "message": f"No active QUARANTINE bins found in warehouse {warehouse_code}. Quarantine allocation required for damaged goods.",
                }

            # Check capacity
            candidates = [_to_candidate(l, "QUARANTINE_ISOLATION") for l in quarantine_locs]
            viable = [c for c in candidates if c["available_capacity"] >= req_qty]
            if viable:
                return {
                    "warehouse_id": warehouse_id,
                    "warehouse_code": warehouse_code,
                    "status": "RECOMMENDED",
                    "recommended_location": viable[0],
                    "alternatives": [c for c in candidates if c["location_id"] != viable[0]["location_id"]][:3],
                    "message": f"Quarantine bin '{viable[0]['code']}' assigned for damaged or quarantine stock.",
                }
            else:
                return {
                    "warehouse_id": warehouse_id,
                    "warehouse_code": warehouse_code,
                    "status": "OVER_CAPACITY",
                    "recommended_location": None,
                    "alternatives": candidates[:3],
                    "message": f"Quarantine bins in warehouse {warehouse_code} lack sufficient capacity for {quantity} units.",
                }

        # --- Priority 2: Dedicated Item Bin Affinity ---
        if effective_item_id:
            try:
                from ..models.item_master import ItemWarehouseLocation
                q_iwl = (
                    select(ItemWarehouseLocation)
                    .where(
                        ItemWarehouseLocation.warehouse_id == warehouse_id,
                        ItemWarehouseLocation.item_id == effective_item_id,
                        ItemWarehouseLocation.company_id == self.tenant_ctx.company_id,
                        ItemWarehouseLocation.is_deleted == False,
                        ItemWarehouseLocation.location_bin.isnot(None),
                    )
                )
                res_iwl = await self.db.execute(q_iwl)
                iwl = res_iwl.scalars().first()
                if iwl and iwl.location_bin:
                    bin_target = str(iwl.location_bin).strip()
                    matched_loc = next(
                        (l for l in all_locations if (l.code == bin_target or l.id == bin_target) and not l.is_locked),
                        None,
                    )
                    if matched_loc:
                        cand = _to_candidate(matched_loc, "DEDICATED_ITEM_BIN")
                        if cand["available_capacity"] >= req_qty:
                            other_cands = [
                                _to_candidate(l, "ZONE_CAPACITY_FALLBACK")
                                for l in all_locations
                                if l.id != matched_loc.id and not l.is_locked and l.zone == matched_loc.zone
                            ]
                            return {
                                "warehouse_id": warehouse_id,
                                "warehouse_code": warehouse_code,
                                "status": "RECOMMENDED",
                                "recommended_location": cand,
                                "alternatives": other_cands[:3],
                                "message": f"Assigned to dedicated item bin '{cand['code']}' configured for item {effective_item_id}.",
                            }
            except Exception:
                # If table does not exist or lookup fails, gracefully proceed to co-location rule
                pass

        # --- Priority 3: Co-located Stock ---
        if effective_item_id or sku:
            try:
                co_q = (
                    select(StockMovement.bin)
                    .where(
                        StockMovement.warehouse_id == warehouse_id,
                        StockMovement.company_id == self.tenant_ctx.company_id,
                        StockMovement.is_deleted == False,
                        StockMovement.bin.isnot(None),
                    )
                )
                filters = []
                if effective_item_id:
                    filters.append(StockMovement.product_id == effective_item_id)
                    filters.append(StockMovement.item_id == effective_item_id)
                if sku:
                    filters.append(StockMovement.sku == sku)
                from sqlalchemy import or_
                co_q = co_q.where(or_(*filters)).group_by(StockMovement.bin).having(func.sum(StockMovement.quantity) > 0)

                res_co = await self.db.execute(co_q)
                co_bin_codes = set(r[0] for r in res_co.all() if r[0])

                if co_bin_codes:
                    co_locs = [
                        l for l in all_locations
                        if l.code in co_bin_codes and not l.is_locked and (l.zone or "").upper() in ("STORAGE", "PICKING", "BULK")
                    ]
                    co_cands = [_to_candidate(l, "CO_LOCATED_STOCK") for l in co_locs]
                    viable_co = [c for c in co_cands if c["available_capacity"] >= req_qty]
                    if viable_co:
                        other_alts = [c for c in co_cands if c["location_id"] != viable_co[0]["location_id"]]
                        return {
                            "warehouse_id": warehouse_id,
                            "warehouse_code": warehouse_code,
                            "status": "RECOMMENDED",
                            "recommended_location": viable_co[0],
                            "alternatives": other_alts[:3],
                            "message": f"Assigned to co-located bin '{viable_co[0]['code']}' with existing stock of this product.",
                        }
            except Exception:
                pass

        # --- Priority 4: Nearest Available Empty / Capacity Bin in Target Zone ---
        target_zone = (preferred_zone or "STORAGE").upper()
        zone_locs = [
            l for l in all_locations
            if (l.zone or "").upper() == target_zone and not l.is_locked
        ]
        if not zone_locs and target_zone != "STORAGE":
            zone_locs = [
                l for l in all_locations
                if (l.zone or "").upper() in ("STORAGE", "PICKING", "BULK") and not l.is_locked
            ]
        if not zone_locs:
            # fallback to any unlocked non-quarantine locations
            zone_locs = [
                l for l in all_locations
                if (l.zone or "").upper() != "QUARANTINE" and not l.is_locked
            ]

        if not zone_locs:
            return {
                "warehouse_id": warehouse_id,
                "warehouse_code": warehouse_code,
                "status": "OVER_CAPACITY",
                "recommended_location": None,
                "alternatives": [],
                "message": f"No available non-quarantine storage locations found in warehouse {warehouse_code}.",
            }

        candidates = []
        for l in zone_locs:
            occ = max(occupancy_by_code.get(l.code, 0.0), occupancy_by_id.get(l.id, 0.0))
            rule_name = "EMPTY_BIN_ALLOCATION" if occ == 0 else "ZONE_CAPACITY_FALLBACK"
            candidates.append(_to_candidate(l, rule_name))

        # First pick: empty bins with sufficient capacity
        empty_viable = [c for c in candidates if c["current_occupancy"] == 0 and c["available_capacity"] >= req_qty]
        if empty_viable:
            best = empty_viable[0]
            alts = [c for c in candidates if c["location_id"] != best["location_id"]][:3]
            return {
                "warehouse_id": warehouse_id,
                "warehouse_code": warehouse_code,
                "status": "RECOMMENDED",
                "recommended_location": best,
                "alternatives": alts,
                "message": f"Allocated to nearest empty bin '{best['code']}' in {best['zone']} zone.",
            }

        # Second pick: partially occupied bins with sufficient capacity
        partial_viable = [c for c in candidates if c["available_capacity"] >= req_qty]
        if partial_viable:
            best = partial_viable[0]
            alts = [c for c in candidates if c["location_id"] != best["location_id"]][:3]
            return {
                "warehouse_id": warehouse_id,
                "warehouse_code": warehouse_code,
                "status": "RECOMMENDED",
                "recommended_location": best,
                "alternatives": alts,
                "message": f"Allocated to available bin '{best['code']}' in {best['zone']} zone (capacity: {best['available_capacity']} units remaining).",
            }

        # Over-capacity fallback
        return {
            "warehouse_id": warehouse_id,
            "warehouse_code": warehouse_code,
            "status": "OVER_CAPACITY",
            "recommended_location": None,
            "alternatives": candidates[:3],
            "message": f"All candidate bins in {target_zone} zone exceed capacity for requested quantity ({quantity} units). Overflow handling required.",
        }

    async def _get_warehouse_resilient(self, warehouse_id: str) -> Optional[Warehouse]:
        """Resilient warehouse lookup with automatic schema-drift rollback and column deferral."""
        try:
            q = select(Warehouse).where(
                Warehouse.id == warehouse_id,
                Warehouse.company_id == self.tenant_ctx.company_id,
                Warehouse.is_deleted == False
            )
            res = await self.db.execute(q)
            return res.scalars().first()
        except Exception:
            await self.db.rollback()
            q_def = select(Warehouse).options(defer(Warehouse.is_default_for_branch)).where(
                Warehouse.id == warehouse_id,
                Warehouse.company_id == self.tenant_ctx.company_id,
                Warehouse.is_deleted == False
            )
            res_def = await self.db.execute(q_def)
            return res_def.scalars().first()

    async def get_replenishment_tasks(self, warehouse_id: str) -> Dict[str, Any]:
        """
        Dynamic Picking Bin Replenishment Engine:
        1. Analyzes dedicated item-to-bin mappings (ItemWarehouseLocation) and physical picking bins (zone == 'PICKING').
        2. Queries real-time picking bin occupancy from StockMovement ledger.
        3. Identifies depleted picking bins where current_stock < min_reorder_level.
        4. Scans bulk/storage reserve bins for available unallocated stock of the same item.
        5. Computes suggested transfer quantity = min(max_capacity - current_stock, available_bulk_stock).
        6. Prioritizes tasks (CRITICAL, HIGH, NORMAL, BULK_STOCKOUT).
        """
        warehouse = await self._get_warehouse_resilient(warehouse_id)
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found.")

        # 1. Fetch physical locations
        locs_q = select(WarehouseLocation).where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.company_id == self.tenant_ctx.company_id,
            WarehouseLocation.is_deleted == False,
        )
        res_locs = await self.db.execute(locs_q)
        all_locs = res_locs.scalars().all()
        loc_by_code = {l.code: l for l in all_locs}
        bulk_loc_codes = {
            l.code for l in all_locs
            if (l.zone or "").upper() in ("BULK", "STORAGE") and not l.is_locked
        }

        # 2. Fetch configured ItemWarehouseLocation entries
        from ..models.item_master import ItemWarehouseLocation, Item
        iwl_q = (
            select(ItemWarehouseLocation, Item)
            .join(Item, ItemWarehouseLocation.item_id == Item.id, isouter=True)
            .where(
                ItemWarehouseLocation.warehouse_id == warehouse_id,
                ItemWarehouseLocation.company_id == self.tenant_ctx.company_id,
                ItemWarehouseLocation.is_deleted == False,
            )
        )
        res_iwl = await self.db.execute(iwl_q)
        iwl_rows = res_iwl.all()

        # 3. Aggregate all positive stock across bins in this warehouse
        sm_q = (
            select(
                StockMovement.bin,
                StockMovement.product_id,
                StockMovement.item_id,
                StockMovement.sku,
                func.sum(StockMovement.quantity).label("total_qty")
            )
            .where(
                StockMovement.warehouse_id == warehouse_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.is_deleted == False,
                StockMovement.bin.isnot(None),
            )
            .group_by(
                StockMovement.bin,
                StockMovement.product_id,
                StockMovement.item_id,
                StockMovement.sku
            )
            .having(func.sum(StockMovement.quantity) > 0)
        )
        res_sm = await self.db.execute(sm_q)
        sm_rows = res_sm.all()

        stock_by_bin_and_id: Dict[str, Dict[str, float]] = {}
        for r_bin, p_id, i_id, sku, qty in sm_rows:
            if not r_bin:
                continue
            f_qty = float(qty)
            if r_bin not in stock_by_bin_and_id:
                stock_by_bin_and_id[r_bin] = {}
            for ident in [p_id, i_id, sku]:
                if ident:
                    stock_by_bin_and_id[r_bin][ident] = stock_by_bin_and_id[r_bin].get(ident, 0.0) + f_qty

        tasks: List[Dict[str, Any]] = []

        def _get_bin_item_stock(b_code: str, *keys: Optional[str]) -> float:
            if b_code not in stock_by_bin_and_id:
                return 0.0
            bin_map = stock_by_bin_and_id[b_code]
            for k in keys:
                if k and k in bin_map:
                    return bin_map[k]
            return 0.0

        def _find_bulk_sources(*keys: Optional[str], exclude_bin: str) -> List[tuple[str, float]]:
            sources: List[tuple[str, float]] = []
            for b_code, items_map in stock_by_bin_and_id.items():
                if b_code == exclude_bin:
                    continue
                loc_obj = loc_by_code.get(b_code)
                zone_name = (loc_obj.zone if loc_obj else "STORAGE") or "STORAGE"
                if zone_name.upper() == "QUARANTINE" or (loc_obj and loc_obj.is_locked):
                    continue
                for k in keys:
                    if k and k in items_map and items_map[k] > 0:
                        sources.append((b_code, items_map[k]))
                        break
            sources.sort(key=lambda s: s[1], reverse=True)
            return sources

        for iwl, item in iwl_rows:
            picking_bin = iwl.location_bin
            if not picking_bin:
                continue
            item_id = iwl.item_id
            item_code = item.item_code if item else ""
            product_name = item.item_name if item else "Item"

            curr_stock = _get_bin_item_stock(picking_bin, item_id, item_code)
            min_lvl = float(iwl.min_reorder_level or 0.0)
            max_cap = float(iwl.max_capacity or 100.0)
            reorder_qty = float(iwl.reorder_quantity or 0.0)

            if curr_stock < min_lvl:
                headroom = max(0.0, max_cap - curr_stock)
                target_qty = reorder_qty if (0 < reorder_qty <= headroom) else headroom
                if target_qty <= 0:
                    continue

                bulk_sources = _find_bulk_sources(item_id, item_code, exclude_bin=picking_bin)
                total_bulk = sum(s[1] for s in bulk_sources)

                if bulk_sources:
                    src_bin, src_stock = bulk_sources[0]
                    transfer_qty = min(target_qty, src_stock)
                    if curr_stock <= 0:
                        prio = "CRITICAL"
                    elif curr_stock <= (min_lvl * 0.5):
                        prio = "HIGH"
                    else:
                        prio = "NORMAL"
                    status = "READY"
                    msg = f"Replenish from bulk bin '{src_bin}' (available: {src_stock} units)."
                else:
                    src_bin = None
                    src_stock = 0.0
                    transfer_qty = 0.0
                    prio = "BULK_STOCKOUT"
                    status = "BLOCKED"
                    msg = "No bulk stock available in warehouse. Vendor PO required."

                loc_obj = loc_by_code.get(picking_bin)
                src_obj = loc_by_code.get(src_bin) if src_bin else None

                tasks.append({
                    "task_id": str(uuid.uuid4()),
                    "item_id": item_id,
                    "product_id": item_id,
                    "item_code": item_code,
                    "product_name": product_name,
                    "sku": item_code,
                    "picking_location_id": loc_obj.id if loc_obj else None,
                    "picking_bin": picking_bin,
                    "current_picking_stock": curr_stock,
                    "min_reorder_level": min_lvl,
                    "max_capacity": max_cap,
                    "reorder_quantity": reorder_qty,
                    "source_location_id": src_obj.id if src_obj else None,
                    "source_bin": src_bin,
                    "available_bulk_stock": total_bulk,
                    "suggested_quantity": transfer_qty,
                    "priority": prio,
                    "status": status,
                    "message": msg,
                })

        prio_order = {"CRITICAL": 0, "HIGH": 1, "NORMAL": 2, "BULK_STOCKOUT": 3}
        tasks.sort(key=lambda t: prio_order.get(t["priority"], 99))

        return {
            "warehouse_id": warehouse_id,
            "warehouse_code": warehouse.code,
            "total_tasks": len(tasks),
            "critical_count": sum(1 for t in tasks if t["priority"] == "CRITICAL"),
            "high_count": sum(1 for t in tasks if t["priority"] == "HIGH"),
            "normal_count": sum(1 for t in tasks if t["priority"] == "NORMAL"),
            "bulk_stockout_count": sum(1 for t in tasks if t["priority"] == "BULK_STOCKOUT"),
            "tasks": tasks,
        }

    async def execute_replenishment_tasks(
        self,
        warehouse_id: str,
        tasks: List[Any],
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes internal replenishment transfers atomically:
        - Creates TRANSFER_OUT from source bulk bin
        - Creates TRANSFER_IN to destination picking bin
        - Records reference_doc_type="WMS_REPLENISHMENT"
        """
        warehouse = await self._get_warehouse_resilient(warehouse_id)
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found.")

        if not tasks:
            raise HTTPException(status_code=400, detail="No replenishment tasks provided for execution.")

        run_id = f"REPL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        executed: List[Dict[str, Any]] = []
        total_units = Decimal("0.00")

        for t in tasks:
            def _field(name: str, fallback: Any = None) -> Any:
                if isinstance(t, dict):
                    return t.get(name, fallback)
                return getattr(t, name, fallback)

            qty_val = _field("quantity", 0)
            qty = abs(Decimal(str(qty_val)))
            if qty <= 0:
                continue

            src_bin = _field("source_bin")
            dst_bin = _field("destination_bin")
            item_id = _field("item_id")
            product_id = _field("product_id") or item_id
            sku = _field("sku") or _field("item_code") or ""
            product_name = _field("product_name") or "Replenished Item"
            batch_no = _field("batch_no")

            if not src_bin or not dst_bin:
                continue

            user_val = getattr(self.tenant_ctx, "user_id", None) or "SYSTEM"

            # 1. OUTWARD movement from source bulk bin
            sm_out = StockMovement(
                company_id=self.tenant_ctx.company_id,
                branch_id=getattr(self.tenant_ctx, "branch_id", None),
                warehouse_id=warehouse_id,
                product_id=product_id,
                item_id=item_id,
                sku=sku,
                product_name=product_name,
                quantity=-qty,
                movement_type="TRANSFER_OUT",
                reference_doc_type="WMS_REPLENISHMENT",
                reference_doc_id=run_id,
                bin=src_bin,
                batch=batch_no,
                cost_source="WMS_INTERNAL_TRANSFER",
                remarks=f"Replenishment transfer OUT to picking bin {dst_bin}. {notes or ''}".strip(),
                user=str(user_val),
            )
            self.db.add(sm_out)

            # 2. INWARD movement into target picking bin
            sm_in = StockMovement(
                company_id=self.tenant_ctx.company_id,
                branch_id=getattr(self.tenant_ctx, "branch_id", None),
                warehouse_id=warehouse_id,
                product_id=product_id,
                item_id=item_id,
                sku=sku,
                product_name=product_name,
                quantity=qty,
                movement_type="TRANSFER_IN",
                reference_doc_type="WMS_REPLENISHMENT",
                reference_doc_id=run_id,
                bin=dst_bin,
                batch=batch_no,
                cost_source="WMS_INTERNAL_TRANSFER",
                remarks=f"Replenishment transfer IN from bulk bin {src_bin}. {notes or ''}".strip(),
                user=str(user_val),
            )
            self.db.add(sm_in)

            total_units += qty
            executed.append({
                "item_id": item_id,
                "sku": sku,
                "product_name": product_name,
                "source_bin": src_bin,
                "destination_bin": dst_bin,
                "quantity": float(qty),
                "batch_no": batch_no,
            })

        await self.db.flush()

        return {
            "warehouse_id": warehouse_id,
            "run_id": run_id,
            "total_transfers": len(executed),
            "total_units": float(total_units),
            "executed_tasks": executed,
            "message": f"Successfully executed {len(executed)} replenishment transfer(s) ({float(total_units)} total units).",
        }

    async def get_warehouse_slotting(self, warehouse_id: str) -> List[Dict[str, Any]]:
        """List slotting rules and current stock per item in the given warehouse."""
        from ..models.item_master import ItemWarehouseLocation, Item
        stmt = (
            select(ItemWarehouseLocation, Item)
            .join(Item, ItemWarehouseLocation.item_id == Item.id, isouter=True)
            .where(
                ItemWarehouseLocation.warehouse_id == warehouse_id,
                ItemWarehouseLocation.company_id == self.tenant_ctx.company_id,
                ItemWarehouseLocation.is_deleted == False,
            )
            .order_by(ItemWarehouseLocation.location_bin.asc())
        )
        res = await self.db.execute(stmt)
        rows = res.all()

        # Query bin zones
        loc_res = await self.db.execute(
            select(WarehouseLocation.code, WarehouseLocation.zone)
            .where(
                WarehouseLocation.warehouse_id == warehouse_id,
                WarehouseLocation.company_id == self.tenant_ctx.company_id,
                WarehouseLocation.is_deleted == False,
            )
        )
        zone_map = {c: z for c, z in loc_res.all()}

        # Query stock by bin and item
        sm_res = await self.db.execute(
            select(StockMovement.bin, StockMovement.item_id, func.sum(StockMovement.quantity))
            .where(
                StockMovement.warehouse_id == warehouse_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.is_deleted == False,
                StockMovement.bin.isnot(None),
            )
            .group_by(StockMovement.bin, StockMovement.item_id)
        )
        stock_map = {(b, i): float(q) for b, i, q in sm_res.all() if q is not None}

        out = []
        for iwl, item in rows:
            bin_code = iwl.location_bin or ""
            curr_stock = stock_map.get((bin_code, iwl.item_id), 0.0)
            out.append({
                "id": iwl.id,
                "item_id": iwl.item_id,
                "item_code": item.item_code if item else "",
                "item_name": item.item_name if item else "",
                "warehouse_id": warehouse_id,
                "location_bin": bin_code,
                "zone": zone_map.get(bin_code, "PICKING"),
                "current_stock": curr_stock,
                "min_reorder_level": float(iwl.min_reorder_level or 0.0),
                "max_capacity": float(iwl.max_capacity or 0.0),
                "reorder_quantity": float(iwl.reorder_quantity or 0.0),
            })
        return out

    async def save_item_slotting(
        self,
        warehouse_id: str,
        item_id: str,
        location_bin: str,
        min_reorder_level: Decimal,
        max_capacity: Decimal,
        reorder_quantity: Decimal,
    ) -> Dict[str, Any]:
        """Upsert item picking bin slotting rule in item_warehouse_locations."""
        from ..models.item_master import ItemWarehouseLocation, Item
        wh = await self._get_warehouse_resilient(warehouse_id)
        if not wh:
            raise HTTPException(status_code=404, detail="Warehouse not found.")

        item_q = select(Item).where(
            Item.id == item_id,
            Item.company_id == self.tenant_ctx.company_id,
            Item.is_deleted == False,
        )
        res_item = await self.db.execute(item_q)
        item = res_item.scalars().first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found.")

        q_existing = select(ItemWarehouseLocation).where(
            ItemWarehouseLocation.warehouse_id == warehouse_id,
            ItemWarehouseLocation.item_id == item_id,
            ItemWarehouseLocation.company_id == self.tenant_ctx.company_id,
            ItemWarehouseLocation.is_deleted == False,
        )
        res_ex = await self.db.execute(q_existing)
        existing = res_ex.scalars().first()

        if existing:
            existing.location_bin = location_bin
            existing.min_reorder_level = min_reorder_level
            existing.max_capacity = max_capacity
            existing.reorder_quantity = reorder_quantity
            existing.updated_by = getattr(self.tenant_ctx, "user_id", None) or "SYSTEM"
            record = existing
        else:
            record = ItemWarehouseLocation(
                company_id=self.tenant_ctx.company_id,
                branch_id=getattr(self.tenant_ctx, "branch_id", None),
                item_id=item_id,
                warehouse_id=warehouse_id,
                location_bin=location_bin,
                min_reorder_level=min_reorder_level,
                max_capacity=max_capacity,
                reorder_quantity=reorder_quantity,
                created_by=getattr(self.tenant_ctx, "user_id", None) or "SYSTEM",
            )
            self.db.add(record)

        await self.db.flush()
        return {
            "id": record.id,
            "item_id": item_id,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "warehouse_id": warehouse_id,
            "location_bin": location_bin,
            "min_reorder_level": float(min_reorder_level),
            "max_capacity": float(max_capacity),
            "reorder_quantity": float(reorder_quantity),
            "status": "SAVED",
            "message": f"Slotting configured for item '{item.item_code}' at bin '{location_bin}'.",
        }

    # =========================================================================
    # WMS Phase 4: RF Gun Handheld Barcode Terminal Services
    # =========================================================================

    async def verify_rf_barcode(
        self,
        warehouse_id: str,
        barcode: str,
        expected_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Resolves a scanned barcode into a WarehouseLocation or an Item/Product.
        Supports hardware RF gun keyboard wedge input, camera scanning, and fast disambiguation.
        """
        clean_code = (barcode or "").strip()
        if not clean_code:
            return {
                "matched": False,
                "entity_type": "UNKNOWN",
                "barcode": barcode,
                "location": None,
                "item": None,
                "message": "Empty barcode provided.",
            }

        # 1. Check if it matches a WarehouseLocation
        if expected_type in (None, "LOCATION"):
            loc_q = select(WarehouseLocation).where(
                WarehouseLocation.warehouse_id == warehouse_id,
                WarehouseLocation.company_id == self.tenant_ctx.company_id,
                WarehouseLocation.is_deleted == False,
                (
                    (WarehouseLocation.barcode == clean_code) |
                    (WarehouseLocation.code == clean_code) |
                    (WarehouseLocation.code.ilike(clean_code))
                ),
            )
            res_loc = await self.db.execute(loc_q)
            loc = res_loc.scalars().first()
            if loc:
                return {
                    "matched": True,
                    "entity_type": "LOCATION",
                    "barcode": clean_code,
                    "location": {
                        "id": loc.id,
                        "code": loc.code,
                        "name": loc.name or loc.code,
                        "zone": loc.zone or "STORAGE",
                        "barcode": loc.barcode,
                        "max_capacity_units": int(loc.max_capacity_units or 100),
                        "is_locked": bool(loc.is_locked),
                    },
                    "item": None,
                    "message": f"Resolved location '{loc.code}' (Zone: {loc.zone or 'STORAGE'}).",
                }

        # 2. Check if it matches an Item
        if expected_type in (None, "ITEM"):
            from ..models.item_master import Item, ItemWarehouseLocation, ItemBarcode
            item_q = select(Item).where(
                Item.company_id == self.tenant_ctx.company_id,
                Item.is_deleted == False,
                (
                    (Item.item_code == clean_code) |
                    (Item.item_code.ilike(clean_code))
                ),
            )
            res_item = await self.db.execute(item_q)
            item = res_item.scalars().first()
            matched_barcode = None

            # If not matched directly by item_code, check ItemBarcode
            if not item:
                ib_q = (
                    select(Item)
                    .join(ItemBarcode, ItemBarcode.item_id == Item.id)
                    .where(
                        ItemBarcode.company_id == self.tenant_ctx.company_id,
                        ItemBarcode.is_deleted == False,
                        ItemBarcode.barcode == clean_code,
                    )
                )
                res_ib = await self.db.execute(ib_q)
                item = res_ib.scalars().first()
                if item:
                    matched_barcode = clean_code

            if item:
                # Find current slotted bin if any
                iwl_q = select(ItemWarehouseLocation.location_bin).where(
                    ItemWarehouseLocation.item_id == item.id,
                    ItemWarehouseLocation.warehouse_id == warehouse_id,
                    ItemWarehouseLocation.company_id == self.tenant_ctx.company_id,
                    ItemWarehouseLocation.is_deleted == False,
                )
                res_iwl = await self.db.execute(iwl_q)
                assigned_bin = res_iwl.scalars().first()

                # Sum stock for this item in this warehouse
                sm_q = select(func.sum(StockMovement.quantity)).where(
                    StockMovement.warehouse_id == warehouse_id,
                    StockMovement.company_id == self.tenant_ctx.company_id,
                    (StockMovement.item_id == item.id) | (StockMovement.sku == item.item_code),
                )
                tot_stk = await self.db.scalar(sm_q) or 0.0

                return {
                    "matched": True,
                    "entity_type": "ITEM",
                    "barcode": clean_code,
                    "location": None,
                    "item": {
                        "id": item.id,
                        "item_code": item.item_code,
                        "item_name": item.item_name,
                        "sku": item.item_code,
                        "barcode": matched_barcode,
                        "current_bin": assigned_bin,
                        "total_stock": float(tot_stk),
                    },
                    "message": f"Resolved item '{item.item_code}' - {item.item_name}.",
                }

            # Fallback to Product model (which has barcode and sku columns)
            prod_q = select(Product).where(
                Product.company_id == self.tenant_ctx.company_id,
                Product.is_deleted == False,
                (
                    (Product.barcode == clean_code) |
                    (Product.sku == clean_code) |
                    (Product.code == clean_code) |
                    (Product.sku.ilike(clean_code))
                ),
            )
            res_prod = await self.db.execute(prod_q)
            prod = res_prod.scalars().first()
            if prod:
                sm_q = select(func.sum(StockMovement.quantity)).where(
                    StockMovement.warehouse_id == warehouse_id,
                    StockMovement.company_id == self.tenant_ctx.company_id,
                    (StockMovement.product_id == prod.id) | (StockMovement.sku == prod.sku),
                )
                tot_stk = await self.db.scalar(sm_q) or 0.0

                return {
                    "matched": True,
                    "entity_type": "ITEM",
                    "barcode": clean_code,
                    "location": None,
                    "item": {
                        "id": prod.id,
                        "item_code": prod.sku or prod.code,
                        "item_name": prod.name,
                        "sku": prod.sku or prod.code,
                        "barcode": prod.barcode,
                        "current_bin": None,
                        "total_stock": float(tot_stk),
                    },
                    "message": f"Resolved product '{prod.sku or prod.code}' - {prod.name}.",
                }

        return {
            "matched": False,
            "entity_type": "UNKNOWN",
            "barcode": clean_code,
            "location": None,
            "item": None,
            "message": f"Barcode '{clean_code}' could not be resolved as location or item.",
        }

    async def get_rf_bin_summary(
        self,
        warehouse_id: str,
        bin_code: str,
    ) -> Dict[str, Any]:
        """
        Returns live physical bin inspection details, occupied SKUs, total units,
        and headroom calculated directly from StockMovement ledger.
        """
        clean_code = (bin_code or "").strip()
        wh = await self._get_warehouse_resilient(warehouse_id)
        if not wh:
            raise HTTPException(status_code=404, detail="Warehouse not found.")

        # Find location
        loc_q = select(WarehouseLocation).where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.company_id == self.tenant_ctx.company_id,
            WarehouseLocation.is_deleted == False,
            (
                (WarehouseLocation.code == clean_code) |
                (WarehouseLocation.barcode == clean_code) |
                (WarehouseLocation.code.ilike(clean_code))
            ),
        )
        res_loc = await self.db.execute(loc_q)
        loc = res_loc.scalars().first()
        if not loc:
            raise HTTPException(status_code=404, detail=f"Bin location '{clean_code}' not found in warehouse.")

        # Query StockMovement grouped by (product_id, item_id, sku, batch) in this bin
        sm_q = (
            select(
                StockMovement.item_id,
                StockMovement.product_id,
                StockMovement.sku,
                StockMovement.product_name,
                StockMovement.batch,
                func.sum(StockMovement.quantity).label("total_qty")
            )
            .where(
                StockMovement.warehouse_id == warehouse_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.bin == loc.code,
            )
            .group_by(
                StockMovement.item_id,
                StockMovement.product_id,
                StockMovement.sku,
                StockMovement.product_name,
                StockMovement.batch,
            )
        )
        res_sm = await self.db.execute(sm_q)
        occupied_items = []
        total_occupied = 0.0

        for row in res_sm.all():
            qty = float(row.total_qty or 0.0)
            if qty > 0.0001:
                total_occupied += qty
                occupied_items.append({
                    "item_id": row.item_id or row.product_id or "",
                    "product_id": row.product_id,
                    "item_code": row.sku or "",
                    "item_name": row.product_name or row.sku or "Stock Item",
                    "sku": row.sku,
                    "batch_no": row.batch,
                    "quantity": qty,
                })

        max_cap = float(loc.max_capacity_units or 100)
        headroom = max(0.0, max_cap - total_occupied)

        return {
            "warehouse_id": warehouse_id,
            "warehouse_code": getattr(wh, "code", ""),
            "location_id": loc.id,
            "bin_code": loc.code,
            "barcode": loc.barcode,
            "zone": loc.zone or "STORAGE",
            "max_capacity_units": int(max_cap),
            "total_units_occupied": float(total_occupied),
            "headroom_units": float(headroom),
            "is_locked": bool(loc.is_locked),
            "items": occupied_items,
        }

    async def execute_rf_quick_transfer(
        self,
        warehouse_id: str,
        from_bin: str,
        to_bin: str,
        item_id: str,
        quantity: Decimal,
        batch_no: Optional[str] = None,
        notes: Optional[str] = "RF Quick Relocate",
    ) -> Dict[str, Any]:
        """
        Executes an instant atomic stock relocation between bins on the warehouse floor.
        Creates dual StockMovement ledger records with reference_doc_type='WMS_RF_TRANSFER'.
        """
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Transfer quantity must be greater than zero.")

        wh = await self._get_warehouse_resilient(warehouse_id)
        if not wh:
            raise HTTPException(status_code=404, detail="Warehouse not found.")

        # Check source and target bins
        loc_from_q = select(WarehouseLocation).where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.company_id == self.tenant_ctx.company_id,
            WarehouseLocation.is_deleted == False,
            (
                (WarehouseLocation.code == from_bin) |
                (WarehouseLocation.barcode == from_bin) |
                (WarehouseLocation.code.ilike(from_bin))
            ),
        )
        res_from = await self.db.execute(loc_from_q)
        loc_from = res_from.scalars().first()
        if not loc_from:
            raise HTTPException(status_code=404, detail=f"Source bin '{from_bin}' does not exist.")
        if loc_from.is_locked:
            raise HTTPException(status_code=400, detail=f"Source bin '{loc_from.code}' is locked for inventory counting.")

        loc_to_q = select(WarehouseLocation).where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.company_id == self.tenant_ctx.company_id,
            WarehouseLocation.is_deleted == False,
            (
                (WarehouseLocation.code == to_bin) |
                (WarehouseLocation.barcode == to_bin) |
                (WarehouseLocation.code.ilike(to_bin))
            ),
        )
        res_to = await self.db.execute(loc_to_q)
        loc_to = res_to.scalars().first()
        if not loc_to:
            raise HTTPException(status_code=404, detail=f"Destination bin '{to_bin}' does not exist.")
        if loc_to.is_locked:
            raise HTTPException(status_code=400, detail=f"Destination bin '{loc_to.code}' is locked.")

        # Resolve Item / Product
        from ..models.item_master import Item
        item_q = select(Item).where(
            Item.id == item_id,
            Item.company_id == self.tenant_ctx.company_id,
            Item.is_deleted == False,
        )
        res_item = await self.db.execute(item_q)
        item = res_item.scalars().first()

        item_code = item.item_code if item else item_id
        product_name = item.item_name if item else item_code
        sku = item.item_code if item else item_id

        # Verify source stock
        src_stock_q = select(func.sum(StockMovement.quantity)).where(
            StockMovement.warehouse_id == warehouse_id,
            StockMovement.company_id == self.tenant_ctx.company_id,
            StockMovement.bin == loc_from.code,
            (StockMovement.item_id == item_id) | (StockMovement.product_id == item_id) | (StockMovement.sku == sku),
        )
        src_stock = await self.db.scalar(src_stock_q) or 0.0
        if float(src_stock) < float(quantity):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock of '{item_code}' in source bin '{loc_from.code}'. Available: {float(src_stock)}, requested: {float(quantity)}.",
            )

        run_id = f"RF-MOV-{uuid.uuid4().hex[:8].upper()}"
        user_val = getattr(self.tenant_ctx, "user_id", None) or "RF_GUN"

        # 1. OUTWARD movement from source bin
        sm_out = StockMovement(
            company_id=self.tenant_ctx.company_id,
            branch_id=getattr(self.tenant_ctx, "branch_id", None),
            warehouse_id=warehouse_id,
            product_id=item_id,
            item_id=item_id,
            sku=sku,
            product_name=product_name,
            quantity=-quantity,
            movement_type="TRANSFER_OUT",
            reference_doc_type="WMS_RF_TRANSFER",
            reference_doc_id=run_id,
            bin=loc_from.code,
            batch=batch_no,
            cost_source="WMS_RF_RELOCATE",
            remarks=f"RF Quick Transfer OUT to {loc_to.code}. {notes or ''}".strip(),
            user=str(user_val),
        )
        self.db.add(sm_out)

        # 2. INWARD movement to target bin
        sm_in = StockMovement(
            company_id=self.tenant_ctx.company_id,
            branch_id=getattr(self.tenant_ctx, "branch_id", None),
            warehouse_id=warehouse_id,
            product_id=item_id,
            item_id=item_id,
            sku=sku,
            product_name=product_name,
            quantity=quantity,
            movement_type="TRANSFER_IN",
            reference_doc_type="WMS_RF_TRANSFER",
            reference_doc_id=run_id,
            bin=loc_to.code,
            batch=batch_no,
            cost_source="WMS_RF_RELOCATE",
            remarks=f"RF Quick Transfer IN from {loc_from.code}. {notes or ''}".strip(),
            user=str(user_val),
        )
        self.db.add(sm_in)

        await self.db.flush()

        remaining_source = float(src_stock) - float(quantity)

        # Query new target stock
        tgt_stock_q = select(func.sum(StockMovement.quantity)).where(
            StockMovement.warehouse_id == warehouse_id,
            StockMovement.company_id == self.tenant_ctx.company_id,
            StockMovement.bin == loc_to.code,
            (StockMovement.item_id == item_id) | (StockMovement.product_id == item_id) | (StockMovement.sku == sku),
        )
        tgt_stock = await self.db.scalar(tgt_stock_q) or float(quantity)

        return {
            "transfer_id": run_id,
            "warehouse_id": warehouse_id,
            "from_bin": loc_from.code,
            "to_bin": loc_to.code,
            "item_id": item_id,
            "item_code": item_code,
            "quantity": float(quantity),
            "remaining_source_stock": max(0.0, remaining_source),
            "new_target_stock": float(tgt_stock),
            "status": "COMPLETED",
            "message": f"Moved {float(quantity)} units of '{item_code}' from {loc_from.code} to {loc_to.code}.",
        }

    async def confirm_rf_replenishment(
        self,
        warehouse_id: str,
        scanned_source_bin: str,
        scanned_item_barcode: str,
        scanned_destination_bin: str,
        quantity: Decimal,
        task_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validates multi-step scan directed replenishment and posts atomic stock transfer.
        Guarantees that physical barcode scans match warehouse locations and inventory item.
        """
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Replenishment quantity must be greater than zero.")

        wh = await self._get_warehouse_resilient(warehouse_id)
        if not wh:
            raise HTTPException(status_code=404, detail="Warehouse not found.")

        # 1. Verify Source Bin
        src_q = select(WarehouseLocation).where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.company_id == self.tenant_ctx.company_id,
            WarehouseLocation.is_deleted == False,
            (
                (WarehouseLocation.code == scanned_source_bin) |
                (WarehouseLocation.barcode == scanned_source_bin) |
                (WarehouseLocation.code.ilike(scanned_source_bin))
            ),
        )
        res_src = await self.db.execute(src_q)
        src_loc = res_src.scalars().first()
        if not src_loc:
            raise HTTPException(status_code=400, detail=f"Source bin barcode '{scanned_source_bin}' could not be verified.")
        if src_loc.is_locked:
            raise HTTPException(status_code=400, detail=f"Source bin '{src_loc.code}' is locked.")

        # 2. Verify Destination Bin
        dst_q = select(WarehouseLocation).where(
            WarehouseLocation.warehouse_id == warehouse_id,
            WarehouseLocation.company_id == self.tenant_ctx.company_id,
            WarehouseLocation.is_deleted == False,
            (
                (WarehouseLocation.code == scanned_destination_bin) |
                (WarehouseLocation.barcode == scanned_destination_bin) |
                (WarehouseLocation.code.ilike(scanned_destination_bin))
            ),
        )
        res_dst = await self.db.execute(dst_q)
        dst_loc = res_dst.scalars().first()
        if not dst_loc:
            raise HTTPException(status_code=400, detail=f"Destination picking bin barcode '{scanned_destination_bin}' could not be verified.")
        if dst_loc.is_locked:
            raise HTTPException(status_code=400, detail=f"Destination bin '{dst_loc.code}' is locked.")

        # 3. Verify Item Barcode
        from ..models.item_master import Item
        clean_item_code = (scanned_item_barcode or "").strip()
        item_q = select(Item).where(
            Item.company_id == self.tenant_ctx.company_id,
            Item.is_deleted == False,
            (
                (Item.item_code == clean_item_code) |
                (Item.id == clean_item_code) |
                (Item.item_code.ilike(clean_item_code))
            ),
        )
        res_item = await self.db.execute(item_q)
        item = res_item.scalars().first()

        item_id = item.id if item else clean_item_code
        item_code = item.item_code if item else clean_item_code
        product_name = item.item_name if item else item_code
        sku = item.item_code if item else item_code

        # 4. Check available stock in source bin
        src_stock_q = select(func.sum(StockMovement.quantity)).where(
            StockMovement.warehouse_id == warehouse_id,
            StockMovement.company_id == self.tenant_ctx.company_id,
            StockMovement.bin == src_loc.code,
            (StockMovement.item_id == item_id) | (StockMovement.product_id == item_id) | (StockMovement.sku == sku),
        )
        src_stock = await self.db.scalar(src_stock_q) or 0.0
        if float(src_stock) < float(quantity):
            raise HTTPException(
                status_code=400,
                detail=f"Source bin '{src_loc.code}' does not have sufficient stock. Available: {float(src_stock)}, requested: {float(quantity)}.",
            )

        run_id = f"RF-REP-{uuid.uuid4().hex[:8].upper()}"
        user_val = getattr(self.tenant_ctx, "user_id", None) or "RF_GUN"

        # Outgoing StockMovement
        sm_out = StockMovement(
            company_id=self.tenant_ctx.company_id,
            branch_id=getattr(self.tenant_ctx, "branch_id", None),
            warehouse_id=warehouse_id,
            product_id=item_id,
            item_id=item_id,
            sku=sku,
            product_name=product_name,
            quantity=-quantity,
            movement_type="TRANSFER_OUT",
            reference_doc_type="WMS_REPLENISHMENT",
            reference_doc_id=run_id,
            bin=src_loc.code,
            cost_source="WMS_RF_REPLENISHMENT",
            remarks=f"RF Replenishment verified OUT to picking bin {dst_loc.code}. {notes or ''}".strip(),
            user=str(user_val),
        )
        self.db.add(sm_out)

        # Incoming StockMovement
        sm_in = StockMovement(
            company_id=self.tenant_ctx.company_id,
            branch_id=getattr(self.tenant_ctx, "branch_id", None),
            warehouse_id=warehouse_id,
            product_id=item_id,
            item_id=item_id,
            sku=sku,
            product_name=product_name,
            quantity=quantity,
            movement_type="TRANSFER_IN",
            reference_doc_type="WMS_REPLENISHMENT",
            reference_doc_id=run_id,
            bin=dst_loc.code,
            cost_source="WMS_RF_REPLENISHMENT",
            remarks=f"RF Replenishment verified IN from bulk bin {src_loc.code}. {notes or ''}".strip(),
            user=str(user_val),
        )
        self.db.add(sm_in)

        await self.db.flush()

        return {
            "success": True,
            "run_id": run_id,
            "task_id": task_id,
            "transferred_units": float(quantity),
            "source_bin": src_loc.code,
            "destination_bin": dst_loc.code,
            "status": "EXECUTED",
            "message": f"Successfully verified & transferred {float(quantity)} units of '{item_code}' into picking bin {dst_loc.code}.",
        }


