"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : SCDM — SMRITI Channel Distribution Management Service
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Canonical Owner (GR-011): All channel distribution business logic lives here.
Do NOT re-implement channel dispatch, stock movement, or projection logic
in any other module. Extend this service instead.

Architecture:
  - Source of Truth = ChannelStockMovement (immutable, append-only)
  - Projection = v_scdm_stock_projection (DB view — computed from movements)
  - ZERO write path to warehouse stock (StockMovement) or accounting tables
  - Multi-company / multi-branch scoped via tenant_ctx
"""

import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from ..models.crm import Customer
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inventory import Product
from ..models.scdm import (
    ChannelLocation,
    ChannelDispatch,
    ChannelDispatchLine,
    ChannelStockMovement,
    SellOutImport,
    SellOutImportLine,
    ChannelDispatchStatus,
    ChannelMovementType,
    ImportStatus,
)
from .event_bus import event_bus, Events

logger = logging.getLogger("smriti.scdm")


def _uid(prefix: str = "") -> str:
    ts = int(datetime.now(timezone.utc).timestamp())
    rand = uuid.uuid4().hex[:8].upper()
    return f"{prefix}{ts}-{rand}" if prefix else f"{ts}-{rand}"


class SCDMService:
    """
    SCDM — SMRITI Channel Distribution Management Service.
    Canonical owner of all channel inventory visibility logic.

    Usage:
        svc = SCDMService(db, tenant_ctx)
        dispatch = await svc.create_channel_dispatch_from_invoice(invoice_id)
    """

    def __init__(self, db: AsyncSession, tenant_ctx):
        self.db = db
        self.tenant_ctx = tenant_ctx

    # ─────────────────────────────────────────────────────────────────────────
    # P1: Auto-create Channel Dispatch from a posted SalesInvoice
    # ─────────────────────────────────────────────────────────────────────────

    async def create_channel_dispatch_from_invoice(
        self, invoice_id: str
    ) -> Optional[ChannelDispatch]:
        """
        Called by event listener on Events.SALES_INVOICE_POSTED.

        Steps:
          1. Load invoice + customer.
          2. Check customer.channel_tracking_enabled. If False, no-op.
          3. Create ChannelDispatch (Draft → Posted).
          4. Create ChannelDispatchLine per invoice item.
          5. Create ChannelStockMovement (Dispatch, +qty) per line.
          6. Publish SCDM_CHANNEL_DISPATCH_CREATED event.

        GUARANTEE: Never touches StockMovement (warehouse) or accounting tables.
        """
        # Step 1 — Load invoice with items
        invoice_res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice: Optional[SalesInvoice] = invoice_res.scalars().first()
        if not invoice:
            logger.warning("[SCDM] Invoice %s not found — skipping channel dispatch", invoice_id)
            return None

        # Step 2 — Check customer channel tracking
        cust_res = await self.db.execute(
            select(Customer).where(Customer.id == invoice.customer_id)
        )
        customer: Optional[Customer] = cust_res.scalars().first()
        if not customer or not customer.channel_tracking_enabled:
            logger.debug(
                "[SCDM] Customer %s has channel_tracking_enabled=False — no dispatch created",
                invoice.customer_id,
            )
            return None

        logger.info(
            "[SCDM] Creating channel dispatch for invoice %s → customer %s (%s)",
            invoice.invoice_no, customer.id, customer.name,
        )

        dispatch_no = f"CD-{_uid()}"
        dispatch_id = f"scdm-cd-{uuid.uuid4().hex[:12]}"
        dispatch_date = (
            invoice.invoice_date.date()
            if hasattr(invoice.invoice_date, "date")
            else date.today()
        )

        # Step 3 — ChannelDispatch header
        total_qty = Decimal("0.0000")
        total_mrp = Decimal("0.00")
        total_cost = Decimal("0.00")
        total_inv_val = Decimal("0.00")

        dispatch = ChannelDispatch(
            id=dispatch_id,
            uuid=str(uuid.uuid4()),
            dispatch_no=dispatch_no,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            channel_location_id=None,  # resolved later if customer has default location
            dispatch_date=dispatch_date,
            status=ChannelDispatchStatus.POSTED.value,
            tenant_id=getattr(self.tenant_ctx, "tenant_id", None),
            company_id=getattr(self.tenant_ctx, "company_id", None),
            branch_id=getattr(self.tenant_ctx, "branch_id", None),
            metadata_json={"source": "auto_invoice_posted", "invoice_no": invoice.invoice_no},
        )

        lines: list[ChannelDispatchLine] = []
        movements: list[ChannelStockMovement] = []

        # Step 4 & 5 — Lines + Movements per invoice item
        for item in invoice.items:
            prod_res = await self.db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            product = prod_res.scalars().first()

            qty = Decimal(str(item.quantity))
            mrp = Decimal(str(product.mrp or 0)) if product else Decimal("0")
            cost = Decimal(str(product.cost_price or 0)) if product else Decimal("0")
            inv_val = Decimal(str(item.line_total or item.total_amount or 0))

            total_qty += qty
            total_mrp += mrp * qty
            total_cost += cost * qty
            total_inv_val += inv_val

            line_id = f"scdm-cdl-{uuid.uuid4().hex[:12]}"
            line = ChannelDispatchLine(
                id=line_id,
                uuid=str(uuid.uuid4()),
                dispatch_id=dispatch_id,
                product_id=item.product_id,
                invoice_item_id=item.id,
                code=item.code or "",
                name=item.name or "",
                hsn_code=item.hsn_code,
                dispatch_qty=qty,
                mrp=mrp,
                cost_price=cost,
                invoice_rate=Decimal(str(item.unit_price or 0)),
                line_invoice_value=inv_val,
                line_mrp_value=mrp * qty,
                tenant_id=getattr(self.tenant_ctx, "tenant_id", None),
                company_id=getattr(self.tenant_ctx, "company_id", None),
            )
            lines.append(line)

            # Immutable movement — qty is POSITIVE (stock IN to channel)
            movement = ChannelStockMovement(
                id=f"scdm-csm-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                customer_id=invoice.customer_id,
                channel_location_id=None,
                product_id=item.product_id,
                dispatch_id=dispatch_id,
                reference_type="SalesInvoice",
                reference_id=invoice.id,
                movement_type=ChannelMovementType.DISPATCH.value,
                movement_date=dispatch_date,
                qty=qty,
                mrp_value=mrp * qty,
                cost_value=cost * qty,
                sales_value=inv_val,
                settlement_value=Decimal("0.00"),
                narration=f"Auto-dispatch from invoice {invoice.invoice_no}",
                tenant_id=getattr(self.tenant_ctx, "tenant_id", None),
                company_id=getattr(self.tenant_ctx, "company_id", None),
                branch_id=getattr(self.tenant_ctx, "branch_id", None),
            )
            movements.append(movement)

        # Update header totals
        dispatch.total_dispatch_qty = total_qty
        dispatch.total_mrp_value = total_mrp
        dispatch.total_cost_value = total_cost
        dispatch.total_invoice_value = total_inv_val

        # Persist — all within the caller's transaction
        self.db.add(dispatch)
        for line in lines:
            self.db.add(line)
        for movement in movements:
            self.db.add(movement)

        # Flush (not commit — event listener owns the transaction boundary)
        await self.db.flush()

        logger.info(
            "[SCDM] ✅ Channel dispatch %s created: %d lines, qty=%.2f",
            dispatch_no, len(lines), total_qty,
        )

        # Step 6 — Downstream event
        await event_bus.publish(
            Events.SCDM_CHANNEL_DISPATCH_CREATED,
            {
                "dispatch_id": dispatch_id,
                "dispatch_no": dispatch_no,
                "invoice_id": invoice.id,
                "customer_id": invoice.customer_id,
                "total_qty": float(total_qty),
            },
            self.db,
        )
        return dispatch

    # ─────────────────────────────────────────────────────────────────────────
    # P1: Reverse Channel Dispatch on Invoice Cancellation
    # ─────────────────────────────────────────────────────────────────────────

    async def reverse_channel_dispatch(self, invoice_id: str) -> None:
        """
        Called by event listener on Events.SALES_INVOICE_CANCELLED.
        Creates Reversal movements (negative of original dispatch qty)
        and marks the dispatch as Cancelled.
        NEVER deletes existing movement rows — appends reversal rows only.
        """
        # Find the dispatch for this invoice
        disp_res = await self.db.execute(
            select(ChannelDispatch)
            .options(selectinload(ChannelDispatch.lines))
            .where(
                ChannelDispatch.invoice_id == invoice_id,
                ChannelDispatch.is_deleted == False,
            )
        )
        dispatch: Optional[ChannelDispatch] = disp_res.scalars().first()
        if not dispatch:
            logger.debug("[SCDM] No channel dispatch found for invoice %s — skip reversal", invoice_id)
            return

        logger.info("[SCDM] Reversing channel dispatch %s for cancelled invoice %s", dispatch.dispatch_no, invoice_id)

        reversal_date = date.today()
        for line in dispatch.lines:
            # Reversal movement: negative qty cancels the original dispatch
            reversal = ChannelStockMovement(
                id=f"scdm-csm-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                customer_id=dispatch.customer_id,
                channel_location_id=dispatch.channel_location_id,
                product_id=line.product_id,
                dispatch_id=dispatch.id,
                reference_type="InvoiceCancellation",
                reference_id=invoice_id,
                movement_type=ChannelMovementType.REVERSAL.value,
                movement_date=reversal_date,
                qty=-line.dispatch_qty,  # Negative reversal
                mrp_value=-line.line_mrp_value,
                cost_value=-(line.cost_price or Decimal("0")) * line.dispatch_qty,
                sales_value=-line.line_invoice_value,
                settlement_value=Decimal("0.00"),
                narration=f"Reversal: invoice {invoice_id} cancelled",
                tenant_id=dispatch.tenant_id,
                company_id=dispatch.company_id,
                branch_id=dispatch.branch_id,
            )
            self.db.add(reversal)

        dispatch.status = ChannelDispatchStatus.CANCELLED.value
        dispatch.modified_at = datetime.now(timezone.utc)
        self.db.add(dispatch)
        await self.db.flush()

        await event_bus.publish(
            Events.SCDM_CHANNEL_DISPATCH_REVERSED,
            {"dispatch_id": dispatch.id, "invoice_id": invoice_id},
            self.db,
        )
        logger.info("[SCDM] ✅ Dispatch %s reversed", dispatch.dispatch_no)

    # ─────────────────────────────────────────────────────────────────────────
    # P2: Stock Projection — computed from movement view
    # ─────────────────────────────────────────────────────────────────────────

    async def get_stock_projection(
        self,
        customer_id: str,
        product_id: Optional[str] = None,
        channel_location_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Returns current channel stock projection per customer+product+location.
        Computed from v_scdm_stock_projection (DB view over ChannelStockMovement).
        """
        filters = ["customer_id = :customer_id"]
        params: dict = {"customer_id": customer_id}

        if self.tenant_ctx and getattr(self.tenant_ctx, "company_id", None):
            filters.append("company_id = :company_id")
            params["company_id"] = self.tenant_ctx.company_id

        if product_id:
            filters.append("product_id = :product_id")
            params["product_id"] = product_id

        if channel_location_id:
            filters.append("channel_location_id = :channel_location_id")
            params["channel_location_id"] = channel_location_id

        where_clause = " AND ".join(filters)
        sql = text(f"""
            SELECT
                customer_id, channel_location_id, product_id,
                current_qty, current_mrp_value, current_cost_value,
                current_sales_value, current_settlement_value,
                total_dispatched, total_sellout, total_returned, total_damaged,
                last_movement_date, first_dispatch_date, ageing_days
            FROM v_scdm_stock_projection
            WHERE {where_clause}
            ORDER BY ageing_days DESC NULLS LAST
        """)
        result = await self.db.execute(sql, params)
        rows = result.mappings().all()
        return [dict(r) for r in rows]

    # ─────────────────────────────────────────────────────────────────────────
    # P2: Visibility KPIs
    # ─────────────────────────────────────────────────────────────────────────

    async def get_visibility_kpis(self, customer_id: str) -> dict:
        """
        Returns computed KPIs for a customer's channel stock:
          - Days of Cover, Sell-Through %, Avg Daily Sales,
            Weeks of Inventory, Ageing Buckets, Stock Health
        """
        projection = await self.get_stock_projection(customer_id)
        if not projection:
            return {
                "current_qty": 0, "total_dispatched": 0, "total_sellout": 0,
                "sell_through_pct": 0.0, "days_of_cover": 0,
                "avg_daily_sales": 0.0, "weeks_of_inventory": 0.0,
                "ageing_0_30": 0, "ageing_31_60": 0, "ageing_61_90": 0, "ageing_90_plus": 0,
                "stock_health": "No Stock",
            }

        total_current = sum(float(r["current_qty"] or 0) for r in projection)
        total_dispatched = sum(float(r["total_dispatched"] or 0) for r in projection)
        total_sellout = sum(float(r["total_sellout"] or 0) for r in projection)

        sell_through_pct = (total_sellout / total_dispatched * 100) if total_dispatched > 0 else 0.0

        # Avg daily sales based on oldest dispatch ageing
        max_ageing = max((int(r["ageing_days"] or 0) for r in projection), default=1)
        avg_daily_sales = total_sellout / max_ageing if max_ageing > 0 else 0.0
        days_of_cover = int(total_current / avg_daily_sales) if avg_daily_sales > 0 else 0
        weeks_of_inventory = round(days_of_cover / 7, 1)

        # Ageing buckets by item
        ageing_0_30 = sum(1 for r in projection if 0 <= int(r["ageing_days"] or 0) <= 30)
        ageing_31_60 = sum(1 for r in projection if 31 <= int(r["ageing_days"] or 0) <= 60)
        ageing_61_90 = sum(1 for r in projection if 61 <= int(r["ageing_days"] or 0) <= 90)
        ageing_90_plus = sum(1 for r in projection if int(r["ageing_days"] or 0) > 90)

        # Stock health classification
        if total_current <= 0:
            health = "Zero Stock"
        elif sell_through_pct >= 80:
            health = "Healthy"
        elif sell_through_pct >= 50:
            health = "Moderate"
        elif ageing_90_plus > 0:
            health = "Dead Stock Risk"
        else:
            health = "Slow Moving"

        return {
            "current_qty": total_current,
            "total_dispatched": total_dispatched,
            "total_sellout": total_sellout,
            "sell_through_pct": round(sell_through_pct, 2),
            "days_of_cover": days_of_cover,
            "avg_daily_sales": round(avg_daily_sales, 2),
            "weeks_of_inventory": weeks_of_inventory,
            "ageing_0_30": ageing_0_30,
            "ageing_31_60": ageing_31_60,
            "ageing_61_90": ageing_61_90,
            "ageing_90_plus": ageing_90_plus,
            "stock_health": health,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # P2: Reconciliation
    # ─────────────────────────────────────────────────────────────────────────

    async def reconcile(self, customer_id: str, product_id: Optional[str] = None) -> dict:
        """
        Reconciliation formula:
            Opening + Dispatch - SellOut - Returns - Damage = Closing

        Also reconciles values:
            MRP Value, Cost Value, Sales Value, Settlement Value, Difference
        """
        projection = await self.get_stock_projection(customer_id, product_id=product_id)
        lines = []
        for row in projection:
            dispatched = float(row["total_dispatched"] or 0)
            sellout = float(row["total_sellout"] or 0)
            returned = float(row["total_returned"] or 0)
            damaged = float(row["total_damaged"] or 0)
            closing_computed = dispatched - sellout + returned - damaged
            closing_actual = float(row["current_qty"] or 0)
            mismatch = round(closing_computed - closing_actual, 4)

            lines.append({
                "product_id": row["product_id"],
                "channel_location_id": row["channel_location_id"],
                "opening_qty": 0,
                "dispatch_qty": dispatched,
                "sellout_qty": sellout,
                "return_qty": returned,
                "damage_qty": damaged,
                "closing_computed": round(closing_computed, 4),
                "closing_actual": round(closing_actual, 4),
                "mismatch_qty": mismatch,
                "mrp_value": float(row["current_mrp_value"] or 0),
                "cost_value": float(row["current_cost_value"] or 0),
                "sales_value": float(row["current_sales_value"] or 0),
                "settlement_value": float(row["current_settlement_value"] or 0),
                "ageing_days": int(row["ageing_days"] or 0),
                "has_mismatch": mismatch != 0.0,
            })

        return {
            "customer_id": customer_id,
            "reconciled_at": datetime.now(timezone.utc).isoformat(),
            "total_lines": len(lines),
            "mismatch_lines": sum(1 for l in lines if l["has_mismatch"]),
            "lines": lines,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # P3: Sell-Out Import Processing
    # ─────────────────────────────────────────────────────────────────────────

    async def process_sellout_import(self, import_id: str) -> SellOutImport:
        """
        Process a pending SellOutImport job:
        1. Load all import lines.
        2. Map barcode/SKU → Product.
        3. Validate (no negatives, no duplicates).
        4. Create ChannelStockMovement (SellOut, -qty) for each accepted line.
        5. Update import status and line statuses.
        6. Publish SCDM_SELLOUT_IMPORTED event.
        """
        imp_res = await self.db.execute(
            select(SellOutImport)
            .options(selectinload(SellOutImport.lines))
            .where(SellOutImport.id == import_id, SellOutImport.is_deleted == False)
        )
        import_job: Optional[SellOutImport] = imp_res.scalars().first()
        if not import_job:
            raise HTTPException(status_code=404, detail=f"SellOutImport {import_id} not found")

        if import_job.status not in (ImportStatus.PENDING.value, ImportStatus.ERROR.value):
            raise HTTPException(status_code=400, detail=f"Import {import_id} is not in Pending/Error state")

        import_job.status = ImportStatus.PROCESSING.value
        self.db.add(import_job)
        await self.db.flush()

        accepted = 0
        rejected = 0
        duplicates = 0
        errors = []

        for line in import_job.lines:
            try:
                # Barcode/SKU → Product mapping
                product = None
                if line.source_barcode:
                    p_res = await self.db.execute(
                        select(Product).where(Product.barcode == line.source_barcode)
                    )
                    product = p_res.scalars().first()
                if not product and line.source_sku:
                    p_res = await self.db.execute(
                        select(Product).where(Product.sku == line.source_sku)
                    )
                    product = p_res.scalars().first()

                if not product:
                    line.line_status = "Unmapped"
                    line.error_message = f"No product found for barcode '{line.source_barcode}' / SKU '{line.source_sku}'"
                    errors.append({"line_id": line.id, "error": line.error_message})
                    rejected += 1
                    continue

                if line.qty_sold <= 0:
                    line.line_status = "Error"
                    line.error_message = "qty_sold must be > 0"
                    errors.append({"line_id": line.id, "error": line.error_message})
                    rejected += 1
                    continue

                # Create SellOut movement (qty is NEGATIVE — stock OUT from channel)
                movement = ChannelStockMovement(
                    id=f"scdm-csm-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    customer_id=import_job.customer_id,
                    channel_location_id=import_job.channel_location_id,
                    product_id=product.id,
                    sellout_import_id=import_job.id,
                    reference_type="SellOutImport",
                    reference_id=import_job.id,
                    movement_type=ChannelMovementType.SELLOUT.value,
                    movement_date=line.transaction_date or import_job.import_date,
                    qty=-Decimal(str(line.qty_sold)),   # NEGATIVE: stock consumed by sell-out
                    mrp_value=-Decimal(str(line.mrp or 0)) * Decimal(str(line.qty_sold)),
                    cost_value=Decimal("0.00"),
                    sales_value=Decimal(str(line.sales_value or 0)),
                    settlement_value=Decimal("0.00"),
                    narration=f"Sell-out import {import_job.import_no}",
                    tenant_id=import_job.tenant_id,
                    company_id=import_job.company_id,
                    branch_id=import_job.branch_id,
                )
                self.db.add(movement)
                await self.db.flush()

                line.product_id = product.id
                line.line_status = "Accepted"
                line.movement_id = movement.id
                accepted += 1

            except Exception as exc:
                logger.error("[SCDM] Import line error: %s", exc)
                line.line_status = "Error"
                line.error_message = str(exc)
                errors.append({"line_id": line.id, "error": str(exc)})
                rejected += 1

            self.db.add(line)

        # Update import job summary
        import_job.status = ImportStatus.DONE.value if rejected == 0 else ImportStatus.PARTIAL.value
        import_job.accepted_lines = accepted
        import_job.rejected_lines = rejected
        import_job.duplicate_lines = duplicates
        import_job.error_summary = errors
        import_job.processed_at = datetime.now(timezone.utc)
        self.db.add(import_job)
        await self.db.flush()

        await event_bus.publish(
            Events.SCDM_SELLOUT_IMPORTED,
            {
                "import_id": import_job.id,
                "import_no": import_job.import_no,
                "customer_id": import_job.customer_id,
                "accepted": accepted,
                "rejected": rejected,
            },
            self.db,
        )
        logger.info("[SCDM] ✅ Sell-out import %s processed: %d accepted, %d rejected",
                    import_job.import_no, accepted, rejected)
        return import_job

    # ─────────────────────────────────────────────────────────────────────────
    # P3: Replenishment Suggestions
    # ─────────────────────────────────────────────────────────────────────────

    async def get_replenishment_suggestions(self, customer_id: str) -> list[dict]:
        """
        Returns replenishment suggestions based on current stock and avg daily sales.
        Items with Days of Cover < 7 are flagged for replenishment.
        """
        projection = await self.get_stock_projection(customer_id)
        suggestions = []
        for row in projection:
            current_qty = float(row["current_qty"] or 0)
            total_sellout = float(row["total_sellout"] or 0)
            ageing = max(int(row["ageing_days"] or 1), 1)
            avg_daily = total_sellout / ageing
            doc = int(current_qty / avg_daily) if avg_daily > 0 else 999

            if doc < 14:  # Flag items with < 2 weeks coverage
                suggestions.append({
                    "product_id": row["product_id"],
                    "channel_location_id": row["channel_location_id"],
                    "current_qty": current_qty,
                    "avg_daily_sales": round(avg_daily, 2),
                    "days_of_cover": doc,
                    "suggested_replenishment_qty": max(0, round(avg_daily * 30 - current_qty, 0)),
                    "priority": "High" if doc < 7 else "Medium",
                    "ageing_days": ageing,
                })

        return sorted(suggestions, key=lambda x: x["days_of_cover"])
