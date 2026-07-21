"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

stock_transfer_engine.py — Domain service for Inter-Branch & Inter-Warehouse Stock Transfer Orders,
Stock Reservations, Dispatch Tracking, and Destination Receipt Reconciliation.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.tenant import Branch
from app.models.inventory import Product, StockTransfer, StockTransferItem, StockTransferShipment


class StockTransferEngine:
    """
    StockTransferEngine — Domain Engine managing inter-branch stock transfers,
    source branch stock deduction on dispatch, in-transit tracking, and destination stock receipt.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def create_transfer_order(
        self,
        source_branch_id: str,
        destination_branch_id: str,
        items: List[Dict[str, Any]],
        notes: Optional[str] = None
    ) -> StockTransfer:
        """
        Creates a draft StockTransfer order between two distinct branches.
        """
        if source_branch_id == destination_branch_id:
            raise HTTPException(status_code=400, detail="Source and destination branches cannot be identical.")

        # Verify branches exist within company
        s_stmt = select(Branch).where(Branch.id == source_branch_id, Branch.company_id == self.tenant.company_id)
        d_stmt = select(Branch).where(Branch.id == destination_branch_id, Branch.company_id == self.tenant.company_id)

        source_br = (await self.db.execute(s_stmt)).scalars().first()
        dest_br = (await self.db.execute(d_stmt)).scalars().first()

        if not source_br or not dest_br:
            raise HTTPException(status_code=404, detail="Source or destination branch not found within tenant company.")

        if not items:
            raise HTTPException(status_code=400, detail="Stock transfer order must include at least one item line.")

        transfer_id = f"trf-{uuid.uuid4().hex[:12]}"
        transfer_no = f"TRF-{uuid.uuid4().hex[:8].upper()}"

        transfer = StockTransfer(
            id=transfer_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            transfer_no=transfer_no,
            source_branch_id=source_branch_id,
            destination_branch_id=destination_branch_id,
            transfer_date=datetime.now(timezone.utc),
            status="Draft",
            notes=notes,
            total_transfer_qty=Decimal("0.0000"),
            total_transfer_value=Decimal("0.00")
        )

        tot_qty = Decimal("0.0000")
        tot_val = Decimal("0.00")
        transfer_items = []

        for line in items:
            p_id = line.get("product_id")
            qty = Decimal(str(line.get("requested_qty", 0)))

            if qty <= Decimal("0.00"):
                raise HTTPException(status_code=400, detail=f"Transfer quantity for product '{p_id}' must be greater than zero.")

            p_stmt = select(Product).where(Product.id == p_id, Product.company_id == self.tenant.company_id)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product '{p_id}' not found.")

            unit_cost = Decimal(str(getattr(product, "cost_price", 0) or product.price or 0))
            line_val = (qty * unit_cost).quantize(Decimal("0.01"))

            tot_qty += qty
            tot_val += line_val

            trf_item = StockTransferItem(
                id=f"trf-item-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                transfer_id=transfer_id,
                product_id=p_id,
                requested_qty=qty,
                shipped_qty=Decimal("0.0000"),
                received_qty=Decimal("0.0000"),
                unit_cost=unit_cost,
                line_total=line_val,
                status="Pending"
            )
            transfer_items.append(trf_item)

        transfer.total_transfer_qty = tot_qty
        transfer.total_transfer_value = tot_val
        transfer.items = transfer_items

        self.db.add(transfer)
        self.db.add_all(transfer_items)
        await self.db.commit()
        return transfer

    async def approve_transfer_order(self, transfer_id: str) -> StockTransfer:
        """
        Approves stock transfer order and verifies stock availability at source branch.
        """
        stmt = select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.is_deleted == False,
            StockTransfer.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        transfer = res.scalars().first()

        if not transfer:
            raise HTTPException(status_code=404, detail=f"Stock transfer order '{transfer_id}' not found.")

        # Verify product stock at source branch
        for item in transfer.items:
            p_stmt = select(Product).where(Product.id == item.product_id)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if product:
                avail_stock = Decimal(str(product.stock))
                if avail_stock < Decimal(str(item.requested_qty)):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock at source branch for product '{item.product_id}' (Available: {avail_stock}, Requested: {item.requested_qty})."
                    )

        transfer.status = "Approved"
        self.db.add(transfer)
        await self.db.commit()
        return transfer

    async def dispatch_transfer(
        self,
        transfer_id: str,
        carrier: Optional[str] = None,
        tracking_no: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dispatches transfer shipment, deducts product stock from source branch, and sets status to InTransit.
        """
        stmt = select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.is_deleted == False,
            StockTransfer.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        transfer = res.scalars().first()

        if not transfer:
            raise HTTPException(status_code=404, detail=f"Stock transfer order '{transfer_id}' not found.")

        # Deduct stock at source branch
        for item in transfer.items:
            p_stmt = select(Product).where(Product.id == item.product_id)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if product:
                product.stock = product.stock - int(Decimal(str(item.requested_qty)))
                self.db.add(product)

            item.shipped_qty = item.requested_qty
            item.status = "Shipped"

        # Create StockTransferShipment
        shipment_id = f"shp-{uuid.uuid4().hex[:12]}"
        shipment_no = f"SHP-{uuid.uuid4().hex[:8].upper()}"

        shipment = StockTransferShipment(
            id=shipment_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            shipment_no=shipment_no,
            transfer_id=transfer_id,
            dispatch_date=datetime.now(timezone.utc),
            carrier=carrier,
            tracking_no=tracking_no,
            status="DISPATCHED"
        )
        self.db.add(shipment)

        transfer.status = "InTransit"
        transfer.carrier = carrier
        transfer.tracking_no = tracking_no
        self.db.add(transfer)

        await self.db.commit()
        return {
            "transfer": transfer,
            "shipment": shipment
        }

    async def receive_transfer(
        self,
        transfer_id: str,
        line_receipts: Optional[List[Dict[str, Any]]] = None
    ) -> StockTransfer:
        """
        Receives stock transfer at destination branch, adds product stock, and sets status to Received.
        """
        stmt = select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.is_deleted == False,
            StockTransfer.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        transfer = res.scalars().first()

        if not transfer:
            raise HTTPException(status_code=404, detail=f"Stock transfer order '{transfer_id}' not found.")

        rcv_map = {r["product_id"]: Decimal(str(r.get("received_qty", 0))) for r in line_receipts if "product_id" in r} if line_receipts else {}

        # Add stock at destination branch
        for item in transfer.items:
            rcv_qty = rcv_map.get(item.product_id, Decimal(str(item.shipped_qty or item.requested_qty)))
            item.received_qty = rcv_qty
            item.status = "Received"

            p_stmt = select(Product).where(Product.id == item.product_id)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if product:
                product.stock = product.stock + int(rcv_qty)
                self.db.add(product)

        transfer.status = "Received"
        self.db.add(transfer)

        await self.db.commit()
        return transfer
