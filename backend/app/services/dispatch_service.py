# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

import uuid
from typing import Dict, Any, List, Optional
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ..models.dispatch import StockDispatch, StockDispatchLine, DispatchApprovalEvent
from ..models.inventory import Product
from ..schemas.dispatch import StockDispatchCreate
from ..api.deps import TenantContext
from ..services.sre.sre_service import SreService


class DispatchService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def create_dispatch(
        self, payload: StockDispatchCreate, origin_gstin_id: str, destination_gstin: str, ip_address: Optional[str] = None
    ) -> StockDispatch:
        """
        Create a unified stock dispatch.
        Consults the SRE engine to evaluate tax rules, updates inventory, and creates invoices if needed.
        """
        if not payload.items:
            raise HTTPException(status_code=400, detail="Dispatch must contain at least one item.")

        dispatch_id = str(uuid.uuid4())[:8]
        
        # 1. Run compliance evaluation for the first item (representative of the dispatch SKU)
        # SRE requires origin_gstin_id, destination_gstin, dispatch_type, sku, qty, cost, gst_rate
        first_item = payload.items[0]
        sre_service = SreService(self.db, self.tenant_ctx)
        
        sre_payload = {
            "dispatch_id": dispatch_id,
            "origin_gstin_id": origin_gstin_id,
            "destination_gstin": destination_gstin,
            "dispatch_type": payload.dispatch_type,
            "sku": first_item.sku,
            "batch_no": "B1",
            "qty": float(first_item.qty_sent),
            "unit_cost": float(first_item.rate),
            "gst_rate": float(first_item.gst_rate),
            "dispatch_date": str(payload.dispatch_date)
        }
        
        compliance = await sre_service.evaluate_dispatch_compliance(sre_payload)

        # 2. Allocate Document Number
        prefix = "CH" if compliance["action_required"] == "GENERATE_DELIVERY_CHALLAN" else "INV"
        year = payload.dispatch_date.year
        
        # Query series sequence count
        from sqlalchemy import func
        seq_res = await self.db.execute(select(func.count(StockDispatch.id)))
        seq = (seq_res.scalar() or 0) + 1
        dispatch_no = f"{prefix}-{year}-{seq:06d}"


        # 3. Create Dispatch lines and decrease stock
        dispatch_lines = []
        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")

        for item in payload.items:
            # Query Product
            prod_res = await self.db.execute(
                select(Product).filter(Product.id == item.product_id, Product.is_deleted == False)
            )
            product = prod_res.scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id}")
            
            if product.stock < item.qty_sent:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product {product.name}. Available: {product.stock}, Requested: {item.qty_sent}"
                )

            # Deduct stock
            product.stock -= item.qty_sent
            
            # Calculate values
            line_tax = (item.qty_sent * item.rate * item.gst_rate) / Decimal("100.00")
            line_total = (item.qty_sent * item.rate) + line_tax
            
            tax_total += line_tax
            grand_total += line_total

            line = StockDispatchLine(
                id=str(uuid.uuid4())[:8],
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                dispatch_id=dispatch_id,
                product_id=item.product_id,
                sku=item.sku,
                name=item.name,
                qty_sent=item.qty_sent,
                qty_invoiced=Decimal("0.0000"),
                qty_returned=Decimal("0.0000"),
                qty_on_hand=item.qty_sent,
                rate=item.rate,
                gst_rate=item.gst_rate,
                tax_amount=line_tax,
                total_amount=line_total
            )
            dispatch_lines.append(line)

        # 4. Save Dispatch
        dispatch = StockDispatch(
            id=dispatch_id,
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            dispatch_no=dispatch_no,
            dispatch_type=payload.dispatch_type,
            partner_id=payload.partner_id,
            dispatch_date=payload.dispatch_date,
            status="Dispatched",
            tax_total=tax_total,
            grand_total=grand_total,
            notes=payload.notes,
            items=dispatch_lines
        )
        self.db.add(dispatch)

        # 5. Log audit event
        audit = DispatchApprovalEvent(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            dispatch_id=dispatch_id,
            action="DISPATCH",
            qty=sum(item.qty_sent for item in payload.items),
            ip_address=ip_address,
            reason=f"Stock dispatch finalized under number {dispatch_no}."
        )
        self.db.add(audit)
        
        await self.db.commit()
        await self.db.refresh(dispatch)
        return dispatch

    async def get_dispatch(self, dispatch_id: str) -> StockDispatch:
        res = await self.db.execute(
            select(StockDispatch).filter(
                StockDispatch.id == dispatch_id,
                StockDispatch.is_deleted == False
            )
        )
        dispatch = res.scalars().first()
        if not dispatch:
            raise HTTPException(status_code=404, detail="Stock dispatch document not found.")
        return dispatch

    async def submit_sale_report(self, dispatch_id: str, items: List[Dict[str, Any]], ip_address: Optional[str] = None) -> StockDispatch:
        """Record sales of goods from a dispatched lot (e.g. consignment sales reports)."""
        dispatch = await self.get_dispatch(dispatch_id)
        
        total_qty_sold = Decimal("0.0000")
        
        for sale_item in items:
            line_id = sale_item["line_id"]
            qty_sold = Decimal(str(sale_item["qty_sold"]))
            
            # Find matching line
            line_res = await self.db.execute(
                select(StockDispatchLine).filter(
                    StockDispatchLine.id == line_id,
                    StockDispatchLine.dispatch_id == dispatch_id,
                    StockDispatchLine.is_deleted == False
                )
            )
            line = line_res.scalars().first()
            if not line:
                raise HTTPException(status_code=404, detail=f"Dispatch line not found: {line_id}")
                
            if line.qty_on_hand < qty_sold:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot sell more than available. Available: {line.qty_on_hand}, Requested: {qty_sold}"
                )
                
            line.qty_invoiced += qty_sold
            line.qty_on_hand -= qty_sold
            total_qty_sold += qty_sold
            
        # Log event
        audit = DispatchApprovalEvent(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            dispatch_id=dispatch_id,
            action="SALE_REPORT",
            qty=total_qty_sold,
            ip_address=ip_address,
            reason="Processed sales report update on dispatched units."
        )
        self.db.add(audit)
        await self.db.commit()
        await self.db.refresh(dispatch)
        return dispatch

    async def process_return(self, dispatch_id: str, items: List[Dict[str, Any]], ip_address: Optional[str] = None) -> StockDispatch:
        """Return remaining stock from dispatch back to inventory."""
        dispatch = await self.get_dispatch(dispatch_id)
        
        total_qty_returned = Decimal("0.0000")
        
        for ret_item in items:
            line_id = ret_item["line_id"]
            qty_returned = Decimal(str(ret_item["qty_returned"]))
            
            line_res = await self.db.execute(
                select(StockDispatchLine).filter(
                    StockDispatchLine.id == line_id,
                    StockDispatchLine.dispatch_id == dispatch_id,
                    StockDispatchLine.is_deleted == False
                )
            )
            line = line_res.scalars().first()
            if not line:
                raise HTTPException(status_code=404, detail=f"Dispatch line not found: {line_id}")
                
            if line.qty_on_hand < qty_returned:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot return more than available. Available: {line.qty_on_hand}, Requested: {qty_returned}"
                )
                
            line.qty_returned += qty_returned
            line.qty_on_hand -= qty_returned
            total_qty_returned += qty_returned
            
            # Restore stock
            prod_res = await self.db.execute(
                select(Product).filter(Product.id == line.product_id, Product.is_deleted == False)
            )
            product = prod_res.scalars().first()
            if product:
                product.stock += qty_returned

        # Log event
        audit = DispatchApprovalEvent(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            dispatch_id=dispatch_id,
            action="RETURN",
            qty=total_qty_returned,
            ip_address=ip_address,
            reason="Processed stock return from dispatched lot."
        )
        self.db.add(audit)
        await self.db.commit()
        await self.db.refresh(dispatch)
        return dispatch
