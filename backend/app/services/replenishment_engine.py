"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 9.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

replenishment_engine.py — Domain service for Warehouse Inventory Replenishment, Reorder Point Calculation,
Strategic Vendor Sourcing Integration, and Automated Purchase Order Conversion.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory import Product, ReplenishmentPlan, ReplenishmentItem, ProductVendor
from app.models.purchase import PurchaseOrder, PurchaseOrderItem


class ReplenishmentEngine:
    """
    ReplenishmentEngine — Domain Engine evaluating stock levels against reorder thresholds,
    generating reorder suggestions with vendor sourcing, and converting plans into draft Purchase Orders.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def generate_reorder_suggestions(self) -> List[Dict[str, Any]]:
        """
        Scans product catalog and generates live reorder suggestions for SKUs at or below reorder level.
        """
        stmt = select(Product).where(
            Product.is_deleted == False,
            Product.company_id == self.tenant.company_id
        )
        products = (await self.db.execute(stmt)).scalars().all()

        suggestions = []
        for p in products:
            curr_stock = Decimal(str(p.stock))
            res_stock = Decimal(str(getattr(p, "reserved_stock", 0) or 0))
            avail_stock = curr_stock - res_stock

            attrs = getattr(p, "attributes", {}) or {}
            reorder_lvl = Decimal(str(attrs.get("reorder_level", 20.0)))
            target_stk = Decimal(str(attrs.get("target_stock", 100.0)))

            if avail_stock <= reorder_lvl:
                suggested_qty = max(Decimal("1.00"), target_stk - avail_stock)

                # Resolve preferred vendor & price from ProductVendor catalog
                pv_stmt = select(ProductVendor).where(
                    ProductVendor.product_id == p.id,
                    ProductVendor.company_id == self.tenant.company_id
                ).order_by(ProductVendor.is_preferred.desc())
                pv = (await self.db.execute(pv_stmt)).scalars().first()

                vendor_id = None
                unit_price = Decimal(str(getattr(p, "cost_price", 0) or p.price or 0))

                if pv:
                    vendor_id = pv.supplier_id
                    unit_price = Decimal(str(pv.cost_price if pv.cost_price > 0 else unit_price))

                est_cost = (suggested_qty * unit_price).quantize(Decimal("0.01"))

                suggestions.append({
                    "product_id": p.id,
                    "product_code": p.code,
                    "product_name": p.name,
                    "current_stock": curr_stock,
                    "reserved_stock": res_stock,
                    "reorder_level": reorder_lvl,
                    "target_stock": target_stk,
                    "suggested_qty": suggested_qty,
                    "preferred_vendor_id": vendor_id,
                    "unit_price": unit_price,
                    "estimated_cost": est_cost
                })

        return suggestions

    async def create_replenishment_plan(
        self,
        name: str,
        items: List[Dict[str, Any]],
        notes: Optional[str] = None
    ) -> ReplenishmentPlan:
        """
        Creates a draft ReplenishmentPlan with line item reorder details.
        """
        if not items:
            raise HTTPException(status_code=400, detail="Replenishment plan must include at least one reorder line item.")

        plan_id = f"plan-{uuid.uuid4().hex[:12]}"
        plan_no = f"REP-{uuid.uuid4().hex[:8].upper()}"

        plan = ReplenishmentPlan(
            id=plan_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            plan_no=plan_no,
            name=name,
            plan_date=datetime.now(timezone.utc),
            status="Draft",
            notes=notes,
            total_items=len(items),
            total_estimated_cost=Decimal("0.00")
        )

        plan_items = []
        tot_cost = Decimal("0.00")

        for line in items:
            p_id = line.get("product_id")
            sug_qty = Decimal(str(line.get("suggested_qty", 0)))
            u_price = Decimal(str(line.get("unit_price", 0)))
            line_tot = (sug_qty * u_price).quantize(Decimal("0.01"))
            tot_cost += line_tot

            item = ReplenishmentItem(
                id=f"plan-item-{uuid.uuid4().hex[:12]}" if "id" not in line else line["id"],
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                plan_id=plan_id,
                product_id=p_id,
                preferred_vendor_id=line.get("preferred_vendor_id"),
                current_stock=Decimal(str(line.get("current_stock", 0))),
                reorder_level=Decimal(str(line.get("reorder_level", 0))),
                suggested_qty=sug_qty,
                unit_price=u_price,
                line_total=line_tot,
                status="Pending"
            )
            plan_items.append(item)

        plan.total_estimated_cost = tot_cost.quantize(Decimal("0.01"))
        plan.items = plan_items

        self.db.add(plan)
        self.db.add_all(plan_items)
        await self.db.commit()
        return plan

    async def convert_plan_to_purchase_orders(self, plan_id: str) -> List[PurchaseOrder]:
        """
        Groups replenishment plan items by vendor and automatically generates draft PurchaseOrders.
        """
        stmt = select(ReplenishmentPlan).where(
            ReplenishmentPlan.id == plan_id,
            ReplenishmentPlan.is_deleted == False,
            ReplenishmentPlan.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        plan = res.scalars().first()

        if not plan:
            raise HTTPException(status_code=404, detail=f"Replenishment plan '{plan_id}' not found.")

        if plan.status == "Converted":
            raise HTTPException(status_code=400, detail="Replenishment plan has already been converted to Purchase Orders.")

        # Group items by vendor ID
        vendor_groups: Dict[str, List[ReplenishmentItem]] = {}
        for item in plan.items:
            v_id = item.preferred_vendor_id or "UNKNOWN_VENDOR"
            if v_id not in vendor_groups:
                vendor_groups[v_id] = []
            vendor_groups[v_id].append(item)

        created_pos = []
        for v_id, group_items in vendor_groups.items():
            po_id = f"po-rep-{uuid.uuid4().hex[:12]}"
            po_no = f"PO-REP-{uuid.uuid4().hex[:8].upper()}"

            tot_val = sum(item.line_total for item in group_items)

            po = PurchaseOrder(
                id=po_id,
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                order_no=po_no,
                supplier_id=v_id if v_id != "UNKNOWN_VENDOR" else "default-vendor",
                status="Draft",
                subtotal=tot_val,
                tax_total=Decimal("0.00"),
                grand_total=tot_val,
                notes=f"Auto-generated from Replenishment Plan '{plan.plan_no}'"
            )

            po_items = []
            for item in group_items:
                # Fetch product details for item name and code
                prod_stmt = select(Product).where(Product.id == item.product_id)
                prod = (await self.db.execute(prod_stmt)).scalars().first()

                po_item = PurchaseOrderItem(
                    id=f"po-item-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    order_id=po_id,
                    product_id=item.product_id,
                    code=prod.code if prod else item.product_id,
                    name=prod.name if prod else "Replenishment Product",
                    quantity=item.suggested_qty,
                    cost_price=item.unit_price,
                    line_total=item.line_total
                )
                po_items.append(po_item)
                item.purchase_order_id = po_id
                item.status = "Converted"

            po.items = po_items
            self.db.add(po)
            self.db.add_all(po_items)
            created_pos.append(po)

        plan.status = "Converted"
        self.db.add(plan)

        await self.db.commit()
        return created_pos
