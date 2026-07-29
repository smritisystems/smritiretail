"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.8.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, LandedCostVoucher
from app.models.inventory import Product
from app.api.deps import TenantContext


class LandedCostEngine:
    """
    Proportional Landed Cost Allocation Engine.
    Supports 5 Allocation Methods: VALUE, WEIGHT, VOLUME, QUANTITY, and MANUAL.
    Updates PurchaseReceiptItem.allocated_landed_cost and true_landed_unit_cost.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def allocate_landed_costs(
        self,
        grn_id: str,
        vouchers_in: List[Dict[str, Any]],
        manual_ratios: Optional[Dict[str, float]] = None
    ) -> List[PurchaseReceiptItem]:

        # 1. Fetch GRN & Items
        grn_stmt = select(PurchaseReceipt).where(
            PurchaseReceipt.id == grn_id,
            PurchaseReceipt.company_id == self.tenant.company_id,
            PurchaseReceipt.is_deleted == False
        )
        grn = (await self.db.execute(grn_stmt)).scalars().first()
        if not grn:
            raise HTTPException(status_code=404, detail=f"Goods receipt (GRN) '{grn_id}' not found")

        item_stmt = select(PurchaseReceiptItem).where(
            PurchaseReceiptItem.receipt_id == grn_id,
            PurchaseReceiptItem.is_deleted == False
        )
        items = list((await self.db.execute(item_stmt)).scalars().all())
        if not items:
            raise HTTPException(status_code=400, detail=f"GRN '{grn_id}' has no line items to allocate costs over")

        # Fetch product metadata (weight, volume)
        product_ids = [it.product_id for it in items]
        prod_stmt = select(Product).where(Product.id.in_(product_ids))
        products = {p.id: p for p in (await self.db.execute(prod_stmt)).scalars().all()}

        # 2. Reset landed cost totals for calculation
        item_landed_additions: Dict[str, Decimal] = {it.id: Decimal("0.00") for it in items}

        # Save LandedCostVoucher records
        for v in vouchers_in:
            charge_type = v.get("charge_type", "Freight")
            amount = Decimal(str(v.get("charge_amount", 0.0)))
            method = v.get("allocation_method", "VALUE").upper()

            if amount < Decimal("0.00"):
                raise HTTPException(status_code=400, detail="Landed cost charge amount cannot be negative")

            v_obj = LandedCostVoucher(
                id=v.get("id") or f"lcv-{grn_id[:6]}-{charge_type[:4]}",
                grn_id=grn_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                charge_type=charge_type,
                charge_amount=amount,
                vendor_name=v.get("vendor_name"),
                allocation_method=method
            )
            self.db.add(v_obj)

            if amount == Decimal("0.00"):
                continue

            # Compute Allocation Basis per Item
            bases: Dict[str, Decimal] = {}
            for it in items:
                p = products.get(it.product_id)
                if method == "VALUE":
                    bases[it.id] = Decimal(str(it.line_total))
                elif method == "QUANTITY":
                    bases[it.id] = Decimal(str(it.quantity_received))
                elif method == "WEIGHT":
                    w = Decimal(str(p.weight_grams)) if p and p.weight_grams else Decimal("1.00")
                    bases[it.id] = w * Decimal(str(it.quantity_received))
                elif method == "VOLUME":
                    v_cbm = Decimal(str(p.attributes.get("cbm", 0.01))) if p and isinstance(p.attributes, dict) else Decimal("1.00")
                    bases[it.id] = v_cbm * Decimal(str(it.quantity_received))
                elif method == "MANUAL":
                    ratio = Decimal(str(manual_ratios.get(it.id, 1.0))) if manual_ratios else Decimal("1.00")
                    bases[it.id] = ratio
                else:
                    bases[it.id] = Decimal(str(it.line_total))

            total_basis = sum(bases.values())
            if total_basis <= Decimal("0.00"):
                # Fallback to equal split if total basis is zero
                total_basis = Decimal(str(len(items)))
                bases = {it.id: Decimal("1.00") for it in items}

            # Formula: Allocated Cost = Charge Amount * (Item Basis / Total Shipment Basis)
            for it in items:
                share = (amount * bases[it.id] / total_basis).quantize(Decimal("0.01"))
                item_landed_additions[it.id] += share

        # 3. Apply True Landed Cost calculation to items
        updated_items = []
        for it in items:
            allocated = item_landed_additions[it.id]
            it.allocated_landed_cost = float(allocated)
            unit_cost = Decimal(str(it.cost_price))
            qty_recv = Decimal(str(it.quantity_received))
            
            # Formula: True Landed Unit Cost = Net Unit Cost + (Allocated Cost / Received Qty)
            if qty_recv > Decimal("0.00"):
                landed_unit_cost = unit_cost + (allocated / qty_recv)
            else:
                landed_unit_cost = unit_cost

            it.true_landed_unit_cost = float(landed_unit_cost.quantize(Decimal("0.01")))
            self.db.add(it)
            updated_items.append(it)

        await self.db.commit()
        return updated_items
