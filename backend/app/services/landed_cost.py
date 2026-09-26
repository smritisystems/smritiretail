"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.33.0
* Created    : 2026-09-19
* Modified   : 2026-09-19
* Copyright  : © SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Capability : @SmritiCapability("PURCHASE", "LANDED_COST_ENGINE")
Classification: Internal
"""

import uuid
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.inward_cost import (
    InwardCostComponentType,
    InwardCostComponent,
    InwardCostAllocation,
    InwardCostAdjustment,
)
from ..models.purchase import PurchaseReceipt, PurchaseReceiptItem
from ..schemas.inward_cost import (
    InwardCostComponentCreate,
    CostAllocationPreviewLine,
    CostAllocationPreviewResponse,
    WhyThisCostBreakdownResponse,
    LandedCostComponentLineBreakdown,
)


class LandedCostAllocationEngine:
    """
    Core mathematical & ledger engine for SMRITI Inward Landed Cost & Freight.
    Supports Value, Quantity, and Weight allocation with Hamilton-Hare Largest
    Remainder penny cent-balancing and explainability drill-downs.
    """

    @staticmethod
    def calculate_capitalizable_amount(
        amount: Decimal,
        taxable_amount: Optional[Decimal],
        tax_amount: Decimal,
        itc_eligible: bool,
        is_capitalizable: bool,
    ) -> Decimal:
        """
        Under Ind-AS 2 / AS-2:
        - If not capitalizable: 0.00 (treated as immediate P&L period expense).
        - If ITC eligible: recoverable taxes (GST) are an asset, so only taxable base is capitalized.
        - If non-creditable: duties/taxes (Customs, Toll, Octroi) cannot be refunded, so total amount is capitalized.
        """
        if not is_capitalizable:
            return Decimal("0.00")
        
        base = taxable_amount if taxable_amount is not None else amount
        if itc_eligible:
            return Decimal(str(base))
        else:
            return Decimal(str(base)) + Decimal(str(tax_amount))

    @classmethod
    def preview_allocation(
        cls,
        component_type: str,
        total_amount: Decimal,
        allocation_method: str,
        items: List[Dict[str, Any]],
    ) -> CostAllocationPreviewResponse:
        """
        Preview how an amount distributes across items with 100% penny balancing.
        items: list of dicts with keys:
          - grn_item_id (optional)
          - product_id (str)
          - sku (str)
          - product_name (str)
          - quantity (Decimal)
          - rate (Decimal)
          - line_total (Decimal)
        """
        method = (allocation_method or "VALUE").upper()
        total_addon = Decimal(str(total_amount))
        
        if not items or total_addon <= Decimal("0.00"):
            lines = [
                CostAllocationPreviewLine(
                    grn_item_id=it.get("grn_item_id") or it.get("id"),
                    product_id=it.get("product_id") or it.get("item_id") or it.get("id") or "UNKNOWN",
                    sku=it.get("sku") or it.get("item_id") or it.get("code") or "UNKNOWN",
                    product_name=it.get("product_name") or it.get("item_name") or it.get("name") or "Product",
                    quantity=Decimal(str(it.get("accepted_qty") or it.get("quantity") or it.get("quantity_received", 0))),
                    rate=Decimal(str(it.get("purchase_rate") or it.get("unit_price") or it.get("rate") or it.get("cost_price", 0))),
                    purchase_value=Decimal(str(it.get("net_amount") or it.get("line_total", 0))),
                    share_percent=Decimal("0.0000"),
                    allocated_amount=Decimal("0.00"),
                    allocated_per_unit=Decimal("0.0000"),
                    net_landed_cost_per_unit=Decimal(str(it.get("purchase_rate") or it.get("unit_price") or it.get("rate") or it.get("cost_price", 0))),
                )
                for it in items
            ]
            return CostAllocationPreviewResponse(
                component_type=component_type,
                allocation_method=method,
                total_component_amount=total_addon,
                reconciled_total=Decimal("0.00"),
                is_balanced=True,
                variance=Decimal("0.00"),
                lines=lines,
            )

        # 1. Determine Basis for each item
        raw_basis_list = []
        for it in items:
            qty = Decimal(str(it.get("accepted_qty") or it.get("quantity") or it.get("quantity_received", 0)))
            rate = Decimal(str(it.get("purchase_rate") or it.get("unit_price") or it.get("rate") or it.get("cost_price", 0)))
            val = Decimal(str(it.get("net_amount") or it.get("line_total") or (qty * rate)))

            if method == "QUANTITY":
                basis = qty
            elif method == "WEIGHT":
                weight = Decimal(str(it.get("weight_kg") or it.get("weight", 1.0)))
                basis = qty * weight
            else:  # VALUE or fallback
                basis = val
            raw_basis_list.append((it, qty, rate, val, max(Decimal("0.00"), basis)))

        total_basis = sum(b[4] for b in raw_basis_list)
        if total_basis <= Decimal("0.00"):
            total_basis = Decimal(len(raw_basis_list))
            raw_basis_list = [(b[0], b[1], b[2], b[3], Decimal("1.00")) for b in raw_basis_list]

        # 2. Raw fractional allocation and largest-remainder penny distribution
        calc_rows = []
        for it, qty, rate, val, basis in raw_basis_list:
            share = basis / total_basis
            raw_allocated = total_addon * share
            floored = raw_allocated.quantize(Decimal("0.01"), rounding=ROUND_FLOOR)
            remainder = raw_allocated - floored
            calc_rows.append({
                "it": it,
                "qty": qty,
                "rate": rate,
                "val": val,
                "basis": basis,
                "share": share,
                "raw_allocated": raw_allocated,
                "allocated": floored,
                "remainder": remainder,
                "rounding_adj": Decimal("0.0000"),
            })

        # Calculate undistributed pennies
        allocated_sum = sum(r["allocated"] for r in calc_rows)
        diff_cents = int((total_addon - allocated_sum) * Decimal("100"))

        if diff_cents > 0:
            sorted_indices = sorted(
                range(len(calc_rows)),
                key=lambda i: calc_rows[i]["remainder"],
                reverse=True,
            )
            for i in range(min(diff_cents, len(calc_rows))):
                idx = sorted_indices[i]
                calc_rows[idx]["allocated"] += Decimal("0.01")
                calc_rows[idx]["rounding_adj"] += Decimal("0.0100")

        # 3. Build response lines
        preview_lines = []
        reconciled_sum = Decimal("0.00")
        for r in calc_rows:
            allocated = r["allocated"]
            reconciled_sum += allocated
            qty = r["qty"]
            per_unit = (allocated / qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if qty > 0 else Decimal("0.0000")
            net_landed = (r["rate"] + per_unit).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            share_pct = (r["share"] * Decimal("100")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

            item_id_val = r["it"].get("product_id") or r["it"].get("item_id") or r["it"].get("id") or "UNKNOWN"
            sku_val = r["it"].get("sku") or r["it"].get("item_id") or r["it"].get("code") or "UNKNOWN"
            name_val = r["it"].get("product_name") or r["it"].get("item_name") or r["it"].get("name") or "Product"

            preview_lines.append(
                CostAllocationPreviewLine(
                    grn_item_id=r["it"].get("grn_item_id") or r["it"].get("id"),
                    product_id=item_id_val,
                    item_id=item_id_val,
                    sku=sku_val,
                    product_name=name_val,
                    quantity=qty,
                    accepted_qty=qty,
                    rate=r["rate"],
                    purchase_rate=r["rate"],
                    purchase_value=r["val"],
                    share_percent=share_pct,
                    allocated_amount=allocated,
                    allocated_cost=allocated,
                    allocated_per_unit=per_unit,
                    addon_per_unit=per_unit,
                    net_landed_cost_per_unit=net_landed,
                    landed_cost=net_landed,
                )
            )

        variance = total_addon - reconciled_sum
        total_purchase_val = sum(l.purchase_value for l in preview_lines)
        final_inv_cost = total_purchase_val + total_addon

        alloc_dicts = [
            {
                "item_id": l.item_id or l.product_id,
                "sku": l.sku,
                "product_name": l.product_name,
                "accepted_qty": float(l.quantity),
                "purchase_rate": float(l.rate),
                "addon_per_unit": float(l.allocated_per_unit),
                "landed_cost": float(l.net_landed_cost_per_unit),
                "allocated_cost": float(l.allocated_amount),
            }
            for l in preview_lines
        ]

        return CostAllocationPreviewResponse(
            component_type=component_type,
            allocation_method=method,
            total_component_amount=total_addon,
            total_addon_cost=total_addon,
            total_purchase_value=total_purchase_val,
            final_inventory_cost=final_inv_cost,
            reconciled_total=reconciled_sum,
            reconciled_allocated_cost=reconciled_sum,
            is_balanced=(variance == Decimal("0.00")),
            variance=variance,
            lines=preview_lines,
            allocations=alloc_dicts,
        )

    @classmethod
    async def allocate_and_persist_components_async(
        cls,
        db: AsyncSession,
        receipt: PurchaseReceipt,
        item_rows: List[PurchaseReceiptItem],
        components_in: List[InwardCostComponentCreate],
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[InwardCostComponent]:
        """
        Persists multiple cost components, runs cent-balanced allocation across receipt items,
        writes immutable InwardCostAllocation rows, and updates receipt item landed costs.
        """
        if not receipt or not item_rows or not components_in:
            return []

        item_dicts = [
            {
                "grn_item_id": item.id,
                "id": item.id,
                "product_id": item.product_id,
                "sku": item.code,
                "code": item.code,
                "product_name": item.name,
                "name": item.name,
                "quantity": Decimal(str(item.quantity_received)),
                "quantity_received": Decimal(str(item.quantity_received)),
                "rate": Decimal(str(item.cost_price)),
                "cost_price": Decimal(str(item.cost_price)),
                "line_total": Decimal(str(item.line_total)),
            }
            for item in item_rows
        ]

        created_components = []
        item_addons: Dict[str, Decimal] = {item.id: Decimal("0.00") for item in item_rows}
        item_addon_per_unit: Dict[str, Decimal] = {item.id: Decimal("0.0000") for item in item_rows}

        for comp_data in components_in:
            amt = Decimal(str(comp_data.amount))
            taxable = Decimal(str(comp_data.taxable_amount)) if comp_data.taxable_amount is not None else amt
            tax_rate = Decimal(str(comp_data.tax_rate or Decimal("0.00")))
            tax_amt = Decimal(str(comp_data.tax_amount or Decimal("0.00")))
            tot_amt = Decimal(str(comp_data.total_amount or (taxable + tax_amt)))
            itc_el = True if comp_data.itc_eligible is None else comp_data.itc_eligible
            is_cap = True if comp_data.is_capitalizable is None else comp_data.is_capitalizable
            alloc_method = (comp_data.allocation_method or "VALUE").upper()

            # 1. Create InwardCostComponent
            comp_id = comp_data.id or f"icc_{uuid.uuid4().hex[:12]}"
            comp_model = InwardCostComponent(
                id=comp_id,
                company_id=company_id or receipt.company_id,
                branch_id=branch_id or receipt.branch_id,
                grn_id=receipt.id,
                component_type=comp_data.component_type.upper(),
                description=comp_data.description,
                amount=amt,
                taxable_amount=taxable,
                tax_amount=tax_amt,
                total_amount=tot_amt,
                tax_rate=tax_rate,
                itc_eligible=itc_el,
                is_capitalizable=is_cap,
                allocation_method=alloc_method,
                allocation_scope=comp_data.allocation_scope or "DOCUMENT",
                scope_reference_id=comp_data.scope_reference_id,
                transporter_name=comp_data.transporter_name,
                document_type=comp_data.document_type or "LR",
                document_no=comp_data.document_no,
                document_date=comp_data.document_date,
                vehicle_no=comp_data.vehicle_no,
                status="ALLOCATED",
                created_at=datetime.now(timezone.utc),
                created_by=user_id,
            )
            db.add(comp_model)
            created_components.append(comp_model)

            # 2. Calculate Capitalizable sum to allocate
            capitalizable_amt = cls.calculate_capitalizable_amount(
                amount=amt,
                taxable_amount=taxable,
                tax_amount=tax_amt,
                itc_eligible=itc_el,
                is_capitalizable=is_cap,
            )

            if capitalizable_amt > Decimal("0.00"):
                preview = cls.preview_allocation(
                    component_type=comp_data.component_type,
                    total_amount=capitalizable_amt,
                    allocation_method=alloc_method,
                    items=item_dicts,
                )

                for line in preview.lines:
                    alloc_id = f"ica_{uuid.uuid4().hex[:12]}"
                    alloc_model = InwardCostAllocation(
                        id=alloc_id,
                        company_id=company_id or receipt.company_id,
                        branch_id=branch_id or receipt.branch_id,
                        grn_id=receipt.id,
                        grn_item_id=line.grn_item_id,
                        cost_component_id=comp_id,
                        product_id=line.product_id,
                        allocation_method=alloc_method,
                        basis_value=line.purchase_value if alloc_method == "VALUE" else line.quantity,
                        allocated_amount=line.allocated_amount,
                        allocated_per_unit=line.allocated_per_unit,
                        rounding_adjustment=Decimal("0.0000"),
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(alloc_model)

                    item_addons[line.grn_item_id] += line.allocated_amount
                    item_addon_per_unit[line.grn_item_id] += line.allocated_per_unit

        # 3. Update PurchaseReceiptItem fields
        for item in item_rows:
            addon = item_addons.get(item.id, Decimal("0.00"))
            addon_pu = item_addon_per_unit.get(item.id, Decimal("0.0000"))
            item.freight_allocated = addon
            item.landed_cost = (Decimal(str(item.cost_price)) + addon_pu).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return created_components

    @classmethod
    async def get_why_this_cost_breakdown_async(
        cls,
        db: AsyncSession,
        receipt_id: str,
        grn_item_id: str,
    ) -> Optional[WhyThisCostBreakdownResponse]:
        """
        Explainability drill-down query: Returns full forensic breakdown for a GRN line item.
        """
        res_rcpt = await db.execute(select(PurchaseReceipt).where(PurchaseReceipt.id == receipt_id))
        receipt = res_rcpt.scalars().first()
        if not receipt:
            return None

        res_item = await db.execute(
            select(PurchaseReceiptItem).where(
                PurchaseReceiptItem.id == grn_item_id,
                PurchaseReceiptItem.receipt_id == receipt_id,
            )
        )
        item = res_item.scalars().first()
        if not item:
            return None

        # Fetch allocations for this item
        stmt_alloc = (
            select(InwardCostAllocation, InwardCostComponent)
            .join(InwardCostComponent, InwardCostAllocation.cost_component_id == InwardCostComponent.id)
            .where(InwardCostAllocation.grn_item_id == grn_item_id)
        )
        res_alloc = await db.execute(stmt_alloc)
        allocations = res_alloc.all()

        component_breakdowns = []
        total_addon = Decimal("0.0000")
        for alloc, comp in allocations:
            total_addon += alloc.allocated_per_unit
            component_breakdowns.append(
                LandedCostComponentLineBreakdown(
                    component_id=comp.id,
                    component_type=comp.component_type,
                    component_name=comp.description or comp.component_type.title(),
                    allocated_amount=alloc.allocated_amount,
                    allocated_per_unit=alloc.allocated_per_unit,
                    allocation_method=alloc.allocation_method,
                    document_no=comp.document_no,
                    document_date=comp.document_date,
                    transporter_name=comp.transporter_name,
                )
            )

        po_rate = Decimal(str(item.cost_price))
        net_purchase_rate = po_rate
        final_landed = (net_purchase_rate + total_addon).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        mrp = Decimal(str(item.mrp)) if item.mrp else None
        margin_pct = None
        if mrp and mrp > Decimal("0.00"):
            margin_pct = (((mrp - final_landed) / mrp) * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return WhyThisCostBreakdownResponse(
            grn_id=receipt.id,
            grn_no=receipt.receipt_no,
            grn_item_id=item.id,
            product_id=item.product_id,
            sku=item.code,
            product_name=item.name,
            po_rate=po_rate,
            invoice_rate=po_rate,
            variance_rate=Decimal("0.00"),
            trade_discount_per_unit=Decimal("0.00"),
            net_purchase_rate=net_purchase_rate,
            quantity=Decimal(str(item.quantity_received)),
            total_addon_per_unit=total_addon,
            final_landed_cost=final_landed,
            mrp=mrp,
            margin_percent=margin_pct,
            components=component_breakdowns,
        )
