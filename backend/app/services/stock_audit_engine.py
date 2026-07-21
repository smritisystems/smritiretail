"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

stock_audit_engine.py — Domain service for Warehouse Stock Audit, Physical Cycle Counting,
Variance Calculation, and Stock Adjustment Reconciliation.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory import Product, StockCount, StockCountItem, StockAdjustment


class StockAuditEngine:
    """
    StockAuditEngine — Domain Engine managing physical stock audit sessions,
    variance calculation, stock adjustment vouchers, and Product.stock reconciliation.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def create_stock_count(
        self,
        name: str,
        count_type: str = "Full",
        product_ids: Optional[List[str]] = None,
        notes: Optional[str] = None
    ) -> StockCount:
        """
        Creates a new stock count audit session and snapshots current system stock per product.
        """
        query = select(Product).where(
            Product.is_deleted == False,
            Product.company_id == self.tenant.company_id
        )
        if product_ids:
            query = query.where(Product.id.in_(product_ids))

        products = (await self.db.execute(query)).scalars().all()
        if not products:
            raise HTTPException(status_code=400, detail="No active products found matching cycle count criteria.")

        count_id = f"cnt-{uuid.uuid4().hex[:12]}"
        count_no = f"CNT-{uuid.uuid4().hex[:8].upper()}"

        stock_count = StockCount(
            id=count_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            count_no=count_no,
            name=name,
            count_type=count_type.capitalize(),
            status="Draft",
            scheduled_date=datetime.now(timezone.utc),
            notes=notes,
            total_items=len(products),
            total_variance_qty=Decimal("0.0000"),
            total_variance_value=Decimal("0.00")
        )

        items = []
        for p in products:
            unit_cost = Decimal(str(getattr(p, "cost_price", 0) or p.price or 0))
            sys_stock = Decimal(str(p.stock))

            item = StockCountItem(
                id=f"cnt-item-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                count_id=count_id,
                product_id=p.id,
                system_stock=sys_stock,
                physical_count=None,
                variance_qty=Decimal("0.0000"),
                unit_cost=unit_cost,
                variance_value=Decimal("0.00"),
                status="Pending"
            )
            items.append(item)

        stock_count.items = items

        self.db.add(stock_count)
        self.db.add_all(items)
        await self.db.commit()
        return stock_count

    async def record_physical_counts(
        self,
        count_id: str,
        line_counts: List[Dict[str, Any]]
    ) -> StockCount:
        """
        Records physical counts per item and calculates quantity & value variances.
        """
        stmt = select(StockCount).where(
            StockCount.id == count_id,
            StockCount.is_deleted == False,
            StockCount.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        stock_count = res.scalars().first()

        if not stock_count:
            raise HTTPException(status_code=404, detail=f"Stock count session '{count_id}' not found.")

        if stock_count.status == "Completed":
            raise HTTPException(status_code=400, detail="Cannot edit physical counts on a completed stock audit.")

        count_map = {c["product_id"]: Decimal(str(c["physical_count"])) for c in line_counts if "product_id" in c and "physical_count" in c}

        tot_var_qty = Decimal("0.0000")
        tot_var_val = Decimal("0.00")

        for item in stock_count.items:
            if item.product_id in count_map:
                phys_qty = count_map[item.product_id]
                item.physical_count = phys_qty
                sys_qty = Decimal(str(item.system_stock))
                var_qty = phys_qty - sys_qty
                var_val = var_qty * Decimal(str(item.unit_cost))

                item.variance_qty = var_qty
                item.variance_value = var_val.quantize(Decimal("0.01"))
                item.status = "Counted"

            if item.physical_count is not None:
                tot_var_qty += Decimal(str(item.variance_qty))
                tot_var_val += Decimal(str(item.variance_value))

        stock_count.total_variance_qty = tot_var_qty
        stock_count.total_variance_value = tot_var_val.quantize(Decimal("0.01"))
        stock_count.status = "Counting"

        self.db.add(stock_count)
        await self.db.commit()
        return stock_count

    async def reconcile_and_adjust_stock(
        self,
        count_id: str,
        reason: Optional[str] = "Cycle Count Variance Reconciliation"
    ) -> Dict[str, Any]:
        """
        Reconciles physical stock audit, updates Product.stock directly to equal verified physical count,
        and posts a StockAdjustment voucher.
        """
        stmt = select(StockCount).where(
            StockCount.id == count_id,
            StockCount.is_deleted == False,
            StockCount.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        stock_count = res.scalars().first()

        if not stock_count:
            raise HTTPException(status_code=404, detail=f"Stock count session '{count_id}' not found.")

        if stock_count.status == "Completed":
            raise HTTPException(status_code=400, detail="Stock count session is already completed and reconciled.")

        # Update Product.stock to physical count for all counted lines
        for item in stock_count.items:
            if item.physical_count is not None:
                p_stmt = select(Product).where(Product.id == item.product_id)
                product = (await self.db.execute(p_stmt)).scalars().first()
                if product:
                    product.stock = int(Decimal(str(item.physical_count)))
                    self.db.add(product)
            item.status = "Reconciled"

        # Create StockAdjustment voucher
        adj_id = f"adj-{uuid.uuid4().hex[:12]}"
        adj_no = f"ADJ-{uuid.uuid4().hex[:8].upper()}"

        adjustment = StockAdjustment(
            id=adj_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            adjustment_no=adj_no,
            count_id=count_id,
            adjustment_date=datetime.now(timezone.utc),
            reason=reason or "Cycle Count Variance Reconciliation",
            total_adjustment_qty=stock_count.total_variance_qty,
            total_adjustment_value=stock_count.total_variance_value,
            status="Posted"
        )
        self.db.add(adjustment)

        stock_count.status = "Completed"
        stock_count.completed_date = datetime.now(timezone.utc)
        self.db.add(stock_count)

        await self.db.commit()
        return {
            "stock_count": stock_count,
            "stock_adjustment": adjustment
        }
