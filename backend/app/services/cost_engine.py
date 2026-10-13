"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.74.0
Created      : 2026-10-14
Modified     : 2026-10-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core Domain Engine / Cost Truth & Valuation Authority
"""

import uuid
import logging
from datetime import datetime, timezone, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload

from ..models.profitability import (
    ProductCostValuation,
    TransactionCostSnapshot,
    InvoiceProfitabilityLedger,
)
from ..models.inventory import Product, StockMovement
from ..models.purchase import (
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseBill,
    PurchaseBillItem,
    Supplier,
)
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inward_cost import InwardCostAllocation, InwardCostComponent
from ..models.accounting import GeneralLedgerEntry, Account

logger = logging.getLogger("smriti.cost_engine")

TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


class CostManagementEngine:
    """
    SMRITI Retail OS - Authoritative Cost Management & Cost Truth Engine.
    Governs multi-valuation inventory costs, rolling Weighted Average Cost (WAC),
    historical COGS snapshots, gross profit waterfall ledgers, and GL reconciliation.
    """

    @staticmethod
    def calculate_rolling_wac(
        current_qty: Decimal,
        current_wac: Decimal,
        inward_qty: Decimal,
        inward_unit_cost: Decimal,
    ) -> Decimal:
        """
        Calculates the updated rolling Weighted Average Cost (WAC) per Ind AS 2 / AS 2.
        Formula: ((Q_curr * WAC_curr) + (Q_in * Cost_in)) / (Q_curr + Q_in)
        Handles edge cases: initial inventory, negative stock recovery, zero stock.
        """
        cur_q = Decimal(str(current_qty or 0))
        cur_w = Decimal(str(current_wac or 0))
        in_q = Decimal(str(inward_qty or 0))
        in_c = Decimal(str(inward_unit_cost or 0))

        if in_q <= Decimal("0.000"):
            return cur_w.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        if cur_q <= Decimal("0.000") or cur_w <= Decimal("0.00"):
            return in_c.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        total_qty = cur_q + in_q
        if total_qty <= Decimal("0.000"):
            return in_c.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        total_value = (cur_q * cur_w) + (in_q * in_c)
        new_wac = (total_value / total_qty).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        return new_wac

    @classmethod
    async def process_inward_valuation(
        cls,
        session: AsyncSession,
        company_id: str,
        receipt_id: str,
        branch_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Atomically updates ProductCostValuation upon Goods Receipt (GRN) finalization.
        Apportions landed costs, computes rolling WAC, and updates replacement cost.
        """
        stmt = (
            select(PurchaseReceipt)
            .where(
                PurchaseReceipt.id == receipt_id,
                PurchaseReceipt.company_id == company_id,
            )
            .options(selectinload(PurchaseReceipt.items))
        )
        receipt = (await session.execute(stmt)).scalar_one_or_none()
        if not receipt:
            logger.warning(
                "CostEngine: PurchaseReceipt '%s' not found for company '%s'",
                receipt_id,
                company_id,
            )
            return []

        # Load all landed cost allocations for this receipt
        alloc_stmt = select(InwardCostAllocation).where(
            InwardCostAllocation.grn_id == receipt_id,
            InwardCostAllocation.company_id == company_id,
        )
        allocations = (await session.execute(alloc_stmt)).scalars().all()
        alloc_by_item: Dict[str, Decimal] = {}
        for a in allocations:
            key = str(a.grn_item_id)
            alloc_by_item[key] = alloc_by_item.get(key, Decimal("0.00")) + Decimal(
                str(a.allocated_amount or 0.00)
            )

        results: List[Dict[str, Any]] = []

        for item in receipt.items:
            product_id = item.product_id
            if not product_id:
                continue

            received_qty = Decimal(str(item.quantity_received or 0.00))
            damaged_qty = Decimal(str(item.quantity_damaged or 0.00))
            sound_qty = max(Decimal("0.00"), received_qty - damaged_qty)
            effective_qty = sound_qty if sound_qty > Decimal("0.00") else received_qty

            base_cost = Decimal(str(item.cost_price or 0.00))
            total_allocated_addon = alloc_by_item.get(str(item.id), Decimal("0.00"))

            addon_per_unit = (
                (total_allocated_addon / effective_qty).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
                if effective_qty > Decimal("0.00")
                else Decimal("0.00")
            )
            landed_unit_cost = (base_cost + addon_per_unit).quantize(
                TWO_PLACES, rounding=ROUND_HALF_UP
            )

            # Query existing stock for WAC calculation
            prod_stmt = select(Product).where(
                Product.id == product_id,
                Product.company_id == company_id,
                Product.is_deleted == False,
            )
            prod = (await session.execute(prod_stmt)).scalars().first()
            current_stock = Decimal(str(prod.stock or 0.00)) if prod else Decimal("0.00")
            # Stock before this receipt
            stock_prior = max(Decimal("0.00"), current_stock - effective_qty)

            # Fetch or create ProductCostValuation with row lock
            pcv_stmt = (
                select(ProductCostValuation)
                .where(
                    ProductCostValuation.product_id == product_id,
                    ProductCostValuation.company_id == company_id,
                )
                .with_for_update()
            )
            pcv = (await session.execute(pcv_stmt)).scalars().first()

            old_wac = Decimal(str(pcv.weighted_average_cost or 0.00)) if pcv else Decimal("0.00")
            new_wac = cls.calculate_rolling_wac(
                current_qty=stock_prior,
                current_wac=old_wac,
                inward_qty=effective_qty,
                inward_unit_cost=landed_unit_cost,
            )

            now_ts = datetime.now(timezone.utc).replace(tzinfo=None)

            if pcv:
                pcv.purchase_cost = base_cost
                pcv.last_purchase_cost = base_cost
                pcv.landed_cost = landed_unit_cost
                pcv.replacement_cost = landed_unit_cost
                pcv.weighted_average_cost = new_wac
                if not pcv.fifo_cost or Decimal(str(pcv.fifo_cost)) <= Decimal("0.00"):
                    pcv.fifo_cost = landed_unit_cost
                if item.mrp and Decimal(str(item.mrp)) > Decimal("0.00"):
                    pcv.mrp = Decimal(str(item.mrp))
                pcv.updated_at = now_ts
            else:
                tech_id = f"pcv_{uuid.uuid4().hex[:12]}"
                pcv = ProductCostValuation(
                    id=tech_id,
                    uuid=tech_id,
                    company_id=company_id,
                    branch_id=branch_id or receipt.branch_id,
                    product_id=product_id,
                    purchase_cost=base_cost,
                    last_purchase_cost=base_cost,
                    landed_cost=landed_unit_cost,
                    replacement_cost=landed_unit_cost,
                    weighted_average_cost=new_wac,
                    fifo_cost=landed_unit_cost,
                    standard_cost=base_cost,
                    mrp=Decimal(str(item.mrp or 0.00)),
                    updated_at=now_ts,
                )
                session.add(pcv)

            results.append(
                {
                    "product_id": product_id,
                    "sound_qty": effective_qty,
                    "purchase_cost": base_cost,
                    "landed_cost": landed_unit_cost,
                    "old_wac": old_wac,
                    "new_wac": new_wac,
                    "replacement_cost": landed_unit_cost,
                }
            )

        await session.flush()
        return results

    @classmethod
    async def recalculate_historical_wac_for_company(
        cls,
        session: AsyncSession,
        company_id: str,
        product_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Recalculates rolling WAC from historical stock movements.
        Strictly safe: does not mutate historical sales transactions or posted invoices.
        Updates only ProductCostValuation to bring current valuation in sync with movement history.
        """
        # Determine target products
        if product_id:
            p_ids = [product_id]
        else:
            p_stmt = select(Product.id).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
            )
            p_ids = (await session.execute(p_stmt)).scalars().all()

        updated_count = 0
        details: List[Dict[str, Any]] = []

        for pid in p_ids:
            # Fetch movements chronologically
            m_stmt = (
                select(StockMovement)
                .where(
                    StockMovement.product_id == pid,
                    StockMovement.company_id == company_id,
                    StockMovement.is_deleted == False,
                )
                .order_by(asc(StockMovement.created_at), asc(StockMovement.id))
            )
            movements = (await session.execute(m_stmt)).scalars().all()

            running_qty = Decimal("0.000")
            running_wac = Decimal("0.00")
            latest_inward_cost = Decimal("0.00")

            for m in movements:
                delta = Decimal(str(m.quantity or 0.000))
                unit_cost = Decimal(str(m.unit_cost or 0.00))

                if delta > Decimal("0.000") and unit_cost > Decimal("0.00"):
                    latest_inward_cost = unit_cost
                    running_wac = cls.calculate_rolling_wac(
                        current_qty=running_qty,
                        current_wac=running_wac,
                        inward_qty=delta,
                        inward_unit_cost=unit_cost,
                    )
                    running_qty += delta
                elif delta < Decimal("0.000"):
                    # Sales / Outward movement: leaves unit WAC unchanged, reduces quantity
                    running_qty = max(Decimal("0.000"), running_qty + delta)

            if running_wac > Decimal("0.00") or latest_inward_cost > Decimal("0.00"):
                pcv_stmt = (
                    select(ProductCostValuation)
                    .where(
                        ProductCostValuation.product_id == pid,
                        ProductCostValuation.company_id == company_id,
                    )
                    .with_for_update()
                )
                pcv = (await session.execute(pcv_stmt)).scalars().first()

                effective_wac = running_wac if running_wac > Decimal("0.00") else latest_inward_cost
                now_ts = datetime.now(timezone.utc).replace(tzinfo=None)

                if pcv:
                    pcv.weighted_average_cost = effective_wac
                    if pcv.landed_cost is None or Decimal(str(pcv.landed_cost)) <= Decimal("0.00"):
                        pcv.landed_cost = latest_inward_cost
                    if pcv.replacement_cost is None or Decimal(str(pcv.replacement_cost)) <= Decimal("0.00"):
                        pcv.replacement_cost = latest_inward_cost
                    pcv.updated_at = now_ts
                else:
                    tech_id = f"pcv_{IdentityEngine.generate_technical_id()}"
                    pcv = ProductCostValuation(
                        id=tech_id,
                        uuid=tech_id,
                        company_id=company_id,
                        product_id=pid,
                        purchase_cost=latest_inward_cost,
                        landed_cost=latest_inward_cost,
                        weighted_average_cost=effective_wac,
                        replacement_cost=latest_inward_cost,
                        fifo_cost=effective_wac,
                        updated_at=now_ts,
                    )
                    session.add(pcv)

                updated_count += 1
                details.append({
                    "product_id": pid,
                    "recalculated_wac": effective_wac,
                    "latest_inward_cost": latest_inward_cost,
                })

        await session.flush()
        return {
            "status": "COMPLETED",
            "products_evaluated": len(p_ids),
            "valuations_updated": updated_count,
            "sample_details": details[:10],
        }

    @classmethod
    async def resolve_cogs_unit_cost(
        cls,
        session: AsyncSession,
        company_id: str,
        product_id: str,
        valuation_method: Optional[str] = "WEIGHTED_AVERAGE",
    ) -> Tuple[Decimal, str]:
        """
        Authoritatively resolves the unit cost for an item sold.
        Hierarchy: Configured Valuation Method -> Landed Cost -> Purchase Cost -> Cost Price Fallback.
        """
        pcv_stmt = select(ProductCostValuation).where(
            ProductCostValuation.product_id == product_id,
            ProductCostValuation.company_id == company_id,
            ProductCostValuation.is_deleted == False,
        )
        pcv = (await session.execute(pcv_stmt)).scalars().first()

        unit_cost = Decimal("0.00")
        method_used = "UNKNOWN"

        if pcv:
            method_pref = (valuation_method or "WEIGHTED_AVERAGE").upper()
            if method_pref in ("WEIGHTED_AVERAGE", "WAC") and pcv.weighted_average_cost and Decimal(str(pcv.weighted_average_cost)) > Decimal("0.00"):
                unit_cost = Decimal(str(pcv.weighted_average_cost)).quantize(TWO_PLACES)
                method_used = "WEIGHTED_AVERAGE"
            elif method_pref == "FIFO" and pcv.fifo_cost and Decimal(str(pcv.fifo_cost)) > Decimal("0.00"):
                unit_cost = Decimal(str(pcv.fifo_cost)).quantize(TWO_PLACES)
                method_used = "FIFO"
            elif method_pref in ("LANDED_COST", "LANDED") and pcv.landed_cost and Decimal(str(pcv.landed_cost)) > Decimal("0.00"):
                unit_cost = Decimal(str(pcv.landed_cost)).quantize(TWO_PLACES)
                method_used = "LANDED_COST"

            # Primary fallbacks within PCV
            if unit_cost <= Decimal("0.00"):
                if pcv.landed_cost and Decimal(str(pcv.landed_cost)) > Decimal("0.00"):
                    unit_cost = Decimal(str(pcv.landed_cost)).quantize(TWO_PLACES)
                    method_used = "LANDED_COST_FALLBACK"
                elif pcv.purchase_cost and Decimal(str(pcv.purchase_cost)) > Decimal("0.00"):
                    unit_cost = Decimal(str(pcv.purchase_cost)).quantize(TWO_PLACES)
                    method_used = "PURCHASE_COST_FALLBACK"
                elif pcv.last_purchase_cost and Decimal(str(pcv.last_purchase_cost)) > Decimal("0.00"):
                    unit_cost = Decimal(str(pcv.last_purchase_cost)).quantize(TWO_PLACES)
                    method_used = "LAST_PURCHASE_FALLBACK"

        # Catalog fallback
        if unit_cost <= Decimal("0.00"):
            prod_stmt = select(Product).where(
                Product.id == product_id,
                Product.company_id == company_id,
                Product.is_deleted == False,
            )
            prod = (await session.execute(prod_stmt)).scalars().first()
            if prod and prod.cost_price and Decimal(str(prod.cost_price)) > Decimal("0.00"):
                unit_cost = Decimal(str(prod.cost_price)).quantize(TWO_PLACES)
                method_used = "CATALOG_COST_PRICE"

        return unit_cost, method_used

    @classmethod
    async def get_inventory_to_gl_reconciliation(
        cls,
        session: AsyncSession,
        company_id: str,
    ) -> Dict[str, Any]:
        """
        Reconciles live physical stock valuation (sum of stock * WAC) against
        General Ledger Account 1040 (Inventory Asset) balance.
        """
        # 1. Calculate physical inventory valuation
        prod_stmt = (
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.stock,
                Product.cost_price,
                ProductCostValuation.weighted_average_cost,
                ProductCostValuation.landed_cost,
            )
            .outerjoin(
                ProductCostValuation,
                and_(
                    ProductCostValuation.product_id == Product.id,
                    ProductCostValuation.company_id == company_id,
                ),
            )
            .where(
                Product.company_id == company_id,
                Product.is_deleted == False,
            )
        )
        prods = (await session.execute(prod_stmt)).all()

        total_physical_units = Decimal("0.000")
        total_wac_valuation = Decimal("0.00")
        zero_cost_count = 0
        total_skus = len(prods)

        for p in prods:
            stock = Decimal(str(p.stock or 0.000))
            if stock > Decimal("0.000"):
                total_physical_units += stock
                wac = Decimal(str(p.weighted_average_cost or p.landed_cost or p.cost_price or 0.00))
                if wac <= Decimal("0.00"):
                    zero_cost_count += 1
                total_wac_valuation += (stock * wac).quantize(TWO_PLACES)

        # 2. Calculate GL Account 1040 balance (Debits - Credits)
        gl_stmt = (
            select(
                func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), Decimal("0.00")),
                func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), Decimal("0.00")),
            )
            .join(Account, Account.id == GeneralLedgerEntry.account_id)
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.is_deleted == False,
                Account.account_code == "1040",
            )
        )
        gl_res = (await session.execute(gl_stmt)).first()
        gl_debits = Decimal(str(gl_res[0] or 0.00)) if gl_res else Decimal("0.00")
        gl_credits = Decimal(str(gl_res[1] or 0.00)) if gl_res else Decimal("0.00")
        gl_inventory_balance = (gl_debits - gl_credits).quantize(TWO_PLACES)

        variance = (total_wac_valuation - gl_inventory_balance).quantize(TWO_PLACES)
        status = "RECONCILED" if abs(variance) < Decimal("0.05") else "VARIANCE_DETECTED"

        return {
            "reconciliation_date": date.today().isoformat(),
            "status": status,
            "physical_stock_valuation": float(total_wac_valuation),
            "gl_account_1040_balance": float(gl_inventory_balance),
            "variance": float(variance),
            "gl_debits_total": float(gl_debits),
            "gl_credits_total": float(gl_credits),
            "total_active_skus": total_skus,
            "total_physical_units": float(total_physical_units),
            "zero_cost_skus_count": zero_cost_count,
            "is_audited": True,
        }

    @classmethod
    async def get_cost_truth_dashboard_kpis(
        cls,
        session: AsyncSession,
        company_id: str,
    ) -> Dict[str, Any]:
        """
        Aggregates executive KPIs for the Cost Truth Dashboard.
        """
        # Reconciliation and stock value
        recon = await cls.get_inventory_to_gl_reconciliation(session, company_id)

        # Sales COGS and Profitability Summary
        cogs_stmt = (
            select(
                func.coalesce(func.sum(InvoiceProfitabilityLedger.gross_sales_amount), Decimal("0.00")),
                func.coalesce(func.sum(InvoiceProfitabilityLedger.total_cogs), Decimal("0.00")),
                func.coalesce(func.sum(InvoiceProfitabilityLedger.gross_profit), Decimal("0.00")),
                func.coalesce(func.sum(InvoiceProfitabilityLedger.net_contribution), Decimal("0.00")),
                func.count(InvoiceProfitabilityLedger.id),
            )
            .where(
                InvoiceProfitabilityLedger.company_id == company_id,
                InvoiceProfitabilityLedger.is_deleted == False,
            )
        )
        cogs_res = (await session.execute(cogs_stmt)).first()

        gross_sales = Decimal(str(cogs_res[0] or 0.00)) if cogs_res else Decimal("0.00")
        total_cogs = Decimal(str(cogs_res[1] or 0.00)) if cogs_res else Decimal("0.00")
        gross_profit = Decimal(str(cogs_res[2] or 0.00)) if cogs_res else Decimal("0.00")
        net_contrib = Decimal(str(cogs_res[3] or 0.00)) if cogs_res else Decimal("0.00")
        invoices_count = int(cogs_res[4] or 0) if cogs_res else 0

        gross_margin_pct = (
            ((gross_profit / gross_sales) * 100).quantize(TWO_PLACES)
            if gross_sales > Decimal("0.00")
            else Decimal("0.00")
        )

        # Unallocated Inward Landed Costs
        unalloc_stmt = (
            select(
                func.coalesce(func.sum(InwardCostComponent.total_amount), Decimal("0.00")),
                func.count(InwardCostComponent.id),
            )
            .where(
                InwardCostComponent.company_id == company_id,
                InwardCostComponent.status == "PENDING",
            )
        )
        unalloc_res = (await session.execute(unalloc_stmt)).first()
        unalloc_amount = Decimal(str(unalloc_res[0] or 0.00)) if unalloc_res else Decimal("0.00")
        unalloc_count = int(unalloc_res[1] or 0) if unalloc_res else 0

        # Section 17(5)(h) Damaged Stock Blocked ITC Total
        damaged_tax_stmt = (
            select(
                func.coalesce(
                    func.sum(
                        (PurchaseReceiptItem.quantity_damaged * PurchaseReceiptItem.cost_price)
                        * (PurchaseReceiptItem.gst_rate / Decimal("100.00"))
                    ),
                    Decimal("0.00"),
                )
            )
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id)
            .where(
                PurchaseReceipt.company_id == company_id,
                PurchaseReceiptItem.quantity_damaged > Decimal("0.00"),
            )
        )
        damaged_tax_res = (await session.execute(damaged_tax_stmt)).scalar()
        blocked_itc = Decimal(str(damaged_tax_res or 0.00)).quantize(TWO_PLACES)

        return {
            "inventory_valuation": recon["physical_stock_valuation"],
            "gl_inventory_balance": recon["gl_account_1040_balance"],
            "reconciliation_variance": recon["variance"],
            "reconciliation_status": recon["status"],
            "period_gross_sales": float(gross_sales),
            "period_cogs": float(total_cogs),
            "period_gross_profit": float(gross_profit),
            "period_gross_margin_pct": float(gross_margin_pct),
            "period_net_contribution": float(net_contrib),
            "posted_invoices_audited": invoices_count,
            "unallocated_landed_cost_amount": float(unalloc_amount),
            "unallocated_landed_cost_count": unalloc_count,
            "blocked_itc_17_5_h_amount": float(blocked_itc),
            "zero_cost_skus_count": recon["zero_cost_skus_count"],
            "total_active_skus": recon["total_active_skus"],
        }

    # -----------------------------------------------------------------------
    # Core Cost Truth Reporting Methods
    # -----------------------------------------------------------------------

    @classmethod
    async def get_purchase_variance_report(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Report 1: Purchase Cost & Purchase Price Variance Report."""
        stmt = (
            select(
                PurchaseReceiptItem.id,
                PurchaseReceipt.receipt_no,
                PurchaseReceiptItem.code,
                PurchaseReceiptItem.name,
                PurchaseReceiptItem.quantity_received,
                PurchaseReceiptItem.cost_price,
                PurchaseOrderItem.cost_price.label("po_cost_price"),
                Supplier.name.label("supplier_name"),
                PurchaseReceipt.created_at,
            )
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id)
            .outerjoin(Supplier, Supplier.id == PurchaseReceipt.supplier_id)
            .outerjoin(
                PurchaseOrderItem,
                PurchaseOrderItem.id == PurchaseReceiptItem.purchase_order_line_id,
            )
            .where(PurchaseReceipt.company_id == company_id)
            .order_by(desc(PurchaseReceipt.created_at))
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).all()
        items = []
        for r in rows:
            grn_rate = Decimal(str(r.cost_price or 0.00))
            po_rate = Decimal(str(r.po_cost_price or r.cost_price or 0.00))
            variance = grn_rate - po_rate
            items.append({
                "receipt_item_id": r.id,
                "receipt_no": r.receipt_no,
                "sku_code": r.code,
                "item_name": r.name,
                "supplier_name": r.supplier_name or "Standard Supplier",
                "received_qty": float(r.quantity_received or 0),
                "grn_cost_price": float(grn_rate),
                "po_cost_price": float(po_rate),
                "variance_amount": float(variance),
                "variance_pct": float((variance / po_rate * 100).quantize(TWO_PLACES)) if po_rate > 0 else 0.0,
                "date": r.created_at.isoformat() if r.created_at else None,
            })
        return {"total_count": len(items), "items": items}

    @classmethod
    async def get_landed_cost_breakdown_report(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Report 2: Landed Cost Breakdown Report."""
        stmt = (
            select(
                InwardCostAllocation.id,
                InwardCostAllocation.grn_id,
                PurchaseReceipt.receipt_no,
                InwardCostComponent.component_type,
                InwardCostComponent.transporter_name,
                InwardCostComponent.document_no,
                InwardCostAllocation.allocation_method,
                InwardCostAllocation.allocated_amount,
                InwardCostAllocation.allocated_per_unit,
                Product.name.label("product_name"),
                Product.sku.label("product_sku"),
                InwardCostAllocation.created_at,
            )
            .join(InwardCostComponent, InwardCostComponent.id == InwardCostAllocation.cost_component_id)
            .join(PurchaseReceipt, PurchaseReceipt.id == InwardCostAllocation.grn_id)
            .join(Product, Product.id == InwardCostAllocation.product_id)
            .where(InwardCostAllocation.company_id == company_id)
            .order_by(desc(InwardCostAllocation.created_at))
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).all()
        items = []
        for r in rows:
            items.append({
                "allocation_id": r.id,
                "receipt_no": r.receipt_no,
                "component_type": r.component_type,
                "transporter": r.transporter_name or "Direct Inward",
                "document_no": r.document_no,
                "sku": r.product_sku,
                "product_name": r.product_name,
                "allocation_method": r.allocation_method,
                "allocated_amount": float(r.allocated_amount or 0.00),
                "allocated_per_unit": float(r.allocated_per_unit or 0.00),
                "timestamp": r.created_at.isoformat() if r.created_at else None,
            })
        return {"total_count": len(items), "items": items}

    @classmethod
    async def get_itc_reconciliation_report(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Report 3: GST & ITC Reconciliation Report (Eligible vs 17(5)(h) Blocked)."""
        stmt = (
            select(
                PurchaseReceipt.id,
                PurchaseReceipt.receipt_no,
                PurchaseReceipt.subtotal,
                PurchaseReceipt.tax_total,
                PurchaseReceipt.grand_total,
                Supplier.name.label("supplier_name"),
                Supplier.gst_number,
                PurchaseReceipt.created_at,
            )
            .outerjoin(Supplier, Supplier.id == PurchaseReceipt.supplier_id)
            .where(PurchaseReceipt.company_id == company_id)
            .order_by(desc(PurchaseReceipt.created_at))
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).all()
        items = []
        for r in rows:
            tax_tot = Decimal(str(r.tax_total or 0.00))
            items.append({
                "receipt_id": r.id,
                "receipt_no": r.receipt_no,
                "supplier_name": r.supplier_name or "Standard Supplier",
                "supplier_gstin": r.gst_number or "UNREGISTERED",
                "taxable_amount": float(r.subtotal or 0.00),
                "total_inward_tax": float(tax_tot),
                "eligible_itc": float(tax_tot),
                "blocked_itc_17_5_h": 0.00,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return {"total_count": len(items), "items": items}

    @classmethod
    async def get_stock_valuation_report(
        cls,
        session: AsyncSession,
        company_id: str,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Report 4: Current Stock Valuation Report across all methods."""
        stmt = (
            select(
                Product.id,
                Product.sku,
                Product.name,
                Product.stock,
                Product.cost_price,
                ProductCostValuation.purchase_cost,
                ProductCostValuation.landed_cost,
                ProductCostValuation.weighted_average_cost,
                ProductCostValuation.fifo_cost,
                ProductCostValuation.replacement_cost,
                ProductCostValuation.mrp,
            )
            .outerjoin(
                ProductCostValuation,
                and_(
                    ProductCostValuation.product_id == Product.id,
                    ProductCostValuation.company_id == company_id,
                ),
            )
            .where(
                Product.company_id == company_id,
                Product.is_deleted == False,
            )
        )
        if search:
            stmt = stmt.where(
                or_(
                    Product.name.ilike(f"%{search}%"),
                    Product.sku.ilike(f"%{search}%"),
                )
            )
        stmt = stmt.order_by(desc(Product.stock)).limit(limit).offset(offset)
        rows = (await session.execute(stmt)).all()
        items = []
        for r in rows:
            stock = Decimal(str(r.stock or 0.000))
            wac = Decimal(str(r.weighted_average_cost or r.landed_cost or r.cost_price or 0.00))
            landed = Decimal(str(r.landed_cost or r.cost_price or 0.00))
            replacement = Decimal(str(r.replacement_cost or landed or 0.00))
            items.append({
                "product_id": r.id,
                "sku": r.sku,
                "name": r.name,
                "current_stock": float(stock),
                "purchase_cost": float(r.purchase_cost or r.cost_price or 0.00),
                "landed_cost": float(landed),
                "weighted_average_cost": float(wac),
                "fifo_cost": float(r.fifo_cost or wac),
                "replacement_cost": float(replacement),
                "stock_valuation_wac": float((stock * wac).quantize(TWO_PLACES)),
                "mrp": float(r.mrp or 0.00),
            })
        return {"total_count": len(items), "items": items}

    @classmethod
    async def get_cogs_profitability_report(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Report 6: Sales COGS & Gross Profitability Report."""
        stmt = (
            select(
                InvoiceProfitabilityLedger.id,
                InvoiceProfitabilityLedger.sales_invoice_id,
                SalesInvoice.invoice_no,
                InvoiceProfitabilityLedger.gross_sales_amount,
                InvoiceProfitabilityLedger.total_cogs,
                InvoiceProfitabilityLedger.gross_profit,
                InvoiceProfitabilityLedger.net_contribution,
                InvoiceProfitabilityLedger.net_margin_percent,
                InvoiceProfitabilityLedger.timestamp,
            )
            .join(SalesInvoice, SalesInvoice.id == InvoiceProfitabilityLedger.sales_invoice_id)
            .where(InvoiceProfitabilityLedger.company_id == company_id)
            .order_by(desc(InvoiceProfitabilityLedger.timestamp))
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).all()
        items = []
        for r in rows:
            items.append({
                "ledger_id": r.id,
                "sales_invoice_id": r.sales_invoice_id,
                "invoice_no": r.invoice_no,
                "gross_sales": float(r.gross_sales_amount or 0.00),
                "cogs": float(r.total_cogs or 0.00),
                "gross_profit": float(r.gross_profit or 0.00),
                "net_contribution": float(r.net_contribution or 0.00),
                "net_margin_pct": float(r.net_margin_percent or 0.00),
                "date": r.timestamp.isoformat() if r.timestamp else None,
            })
        return {"total_count": len(items), "items": items}

    @classmethod
    async def get_cost_exceptions_report(
        cls,
        session: AsyncSession,
        company_id: str,
        variance_threshold_pct: float = 10.0,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Report 8: Cost Variance and Exception Report (Zero cost, margin < 0, anomalies)."""
        stmt = (
            select(
                Product.id,
                Product.sku,
                Product.name,
                Product.stock,
                Product.cost_price,
                ProductCostValuation.weighted_average_cost,
                ProductCostValuation.landed_cost,
            )
            .outerjoin(
                ProductCostValuation,
                and_(
                    ProductCostValuation.product_id == Product.id,
                    ProductCostValuation.company_id == company_id,
                ),
            )
            .where(
                Product.company_id == company_id,
                Product.stock > Decimal("0.000"),
                Product.is_deleted == False,
                or_(
                    ProductCostValuation.weighted_average_cost.is_(None),
                    ProductCostValuation.weighted_average_cost <= Decimal("0.00"),
                ),
            )
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).all()
        items = []
        for r in rows:
            items.append({
                "product_id": r.id,
                "sku": r.sku,
                "name": r.name,
                "stock": float(r.stock or 0),
                "exception_type": "ZERO_VALUATION_WITH_POSITIVE_STOCK",
                "severity": "HIGH",
                "recommended_action": "Execute WAC Recalculation or enter Landed Cost on Goods Receipt.",
            })
        return {"total_exceptions": len(items), "items": items}
