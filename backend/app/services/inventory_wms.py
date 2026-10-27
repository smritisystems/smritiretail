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
from sqlalchemy.orm import selectinload

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
