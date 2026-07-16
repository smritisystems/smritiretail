"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.21.0
* Created    : 2026-07-11
* Modified   : 2026-07-16
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import date, datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ..models.inventory import Product
from ..models.sales import SalesInvoice
from ..models.purchase import Supplier, PurchaseOrder, PurchaseReceipt
from ..models.supplier_payment import SupplierPayment
from ..models.report_schedule import ReportSchedule
from ..api.deps import TenantContext
from ..schemas.reports import (
    StockValuationLine, StockValuationReport,
    DailySalesSummary,
    SupplierLedgerEntry, SupplierLedger,
    PurchaseSummaryLine,
)


class ReportsService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    # ──────────────────────────────────────────────────────────────
    # 1. Stock Valuation
    # ──────────────────────────────────────────────────────────────

    async def stock_valuation(self) -> StockValuationReport:
        """
        Returns current stock × cost_price for every active product in the tenant.
        """
        res = await self.db.execute(
            select(Product).where(
                Product.company_id == self.tenant.company_id,
                Product.branch_id  == self.tenant.branch_id,
                Product.is_deleted == False,
                Product.is_active  == True,
            ).order_by(Product.name)
        )
        products = res.scalars().all()

        lines = []
        total_value = Decimal("0.00")
        for p in products:
            stock      = Decimal(str(p.stock or "0"))
            cost_price = Decimal(str(p.cost_price or "0"))
            value      = (stock * cost_price).quantize(Decimal("0.01"))
            total_value += value
            lines.append(StockValuationLine(
                product_id=p.id,
                code=p.code,
                name=p.name,
                stock=stock,
                cost_price=cost_price,
                stock_value=value,
            ))

        return StockValuationReport(
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_items=len(lines),
            total_value=total_value.quantize(Decimal("0.01")),
            lines=lines,
        )

    # ──────────────────────────────────────────────────────────────
    # 2. Daily Sales Summary
    # ──────────────────────────────────────────────────────────────

    async def daily_sales(self, report_date: date) -> DailySalesSummary:
        """
        Aggregates all SalesInvoices for a given date by payment_mode.
        Also produces a per-shift breakdown.
        """
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.date       == report_date,
                SalesInvoice.company_id == self.tenant.company_id,
                SalesInvoice.branch_id  == self.tenant.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoices = res.scalars().all()

        cash_total   = Decimal("0.00")
        card_total   = Decimal("0.00")
        upi_total    = Decimal("0.00")
        credit_total = Decimal("0.00")
        grand_total  = Decimal("0.00")

        # shift_id → {total, invoices}
        shift_map: dict = {}

        for inv in invoices:
            gt   = Decimal(str(inv.grand_total or "0"))
            mode = (inv.payment_mode or "CASH").upper()
            if mode == "CASH":
                cash_total += gt
            elif mode == "CARD":
                card_total += gt
            elif mode == "UPI":
                upi_total += gt
            elif mode == "CREDIT":
                credit_total += gt
            grand_total += gt

            if inv.shift_id:
                entry = shift_map.setdefault(inv.shift_id, {"shift_id": inv.shift_id, "total": Decimal("0"), "invoices": 0})
                entry["total"]    += gt
                entry["invoices"] += 1

        breakdown = [
            {"shift_id": k, "total": float(v["total"]), "invoices": v["invoices"]}
            for k, v in shift_map.items()
        ]

        return DailySalesSummary(
            report_date=report_date,
            total_invoices=len(invoices),
            total_sales=grand_total.quantize(Decimal("0.01")),
            cash_sales=cash_total.quantize(Decimal("0.01")),
            card_sales=card_total.quantize(Decimal("0.01")),
            upi_sales=upi_total.quantize(Decimal("0.01")),
            credit_sales=credit_total.quantize(Decimal("0.01")),
            shift_breakdown=breakdown,
        )

    # ──────────────────────────────────────────────────────────────
    # 3. Supplier Ledger
    # ──────────────────────────────────────────────────────────────

    async def supplier_ledger(self, supplier_id: str) -> SupplierLedger:
        """
        Produces a chronological ledger for a supplier:
        - Every PurchaseReceipt (GRN) → PURCHASE entry (debit)
        - Every SupplierPayment      → PAYMENT entry  (credit)
        Running balance starts at 0 and ends at supplier.outstanding.
        """
        # Validate supplier belongs to this tenant
        res = await self.db.execute(
            select(Supplier).where(
                Supplier.id         == supplier_id,
                Supplier.company_id == self.tenant.company_id,
                Supplier.branch_id  == self.tenant.branch_id,
                Supplier.is_deleted == False,
            )
        )
        supplier = res.scalars().first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found.")

        # Fetch GRNs
        grn_res = await self.db.execute(
            select(PurchaseReceipt).where(
                PurchaseReceipt.supplier_id == supplier_id,
                PurchaseReceipt.is_deleted  == False,
            ).order_by(PurchaseReceipt.created_at)
        )
        grns = grn_res.scalars().all()

        # Fetch payments
        pay_res = await self.db.execute(
            select(SupplierPayment).where(
                SupplierPayment.supplier_id == supplier_id,
                SupplierPayment.is_deleted  == False,
            ).order_by(SupplierPayment.payment_date)
        )
        payments = pay_res.scalars().all()

        # Build combined chronological list
        raw: list = []
        for g in grns:
            grn_date_str = str(g.created_at.date()) if g.created_at else str(date.today())
            raw.append(("PURCHASE", grn_date_str, g.id, Decimal(str(g.grand_total or "0"))))
        for p in payments:
            raw.append(("PAYMENT", str(p.payment_date), p.reference_no or p.id, Decimal(str(p.amount or "0"))))

        raw.sort(key=lambda x: x[1])   # sort by date string

        balance = Decimal("0.00")
        total_purchased = Decimal("0.00")
        total_paid      = Decimal("0.00")
        entries = []

        for entry_type, dt, ref, amount in raw:
            if entry_type == "PURCHASE":
                balance         += amount
                total_purchased += amount
            else:
                balance     -= amount
                total_paid  += amount
            entries.append(SupplierLedgerEntry(
                entry_type=entry_type,
                date=dt,
                reference=ref,
                amount=amount.quantize(Decimal("0.01")),
                balance_after=balance.quantize(Decimal("0.01")),
            ))

        return SupplierLedger(
            supplier_id=supplier_id,
            supplier_name=supplier.name,
            opening_balance=Decimal("0.00"),
            total_purchased=total_purchased.quantize(Decimal("0.01")),
            total_paid=total_paid.quantize(Decimal("0.01")),
            closing_balance=balance.quantize(Decimal("0.01")),
            entries=entries,
        )

    # ──────────────────────────────────────────────────────────────
    # 4. Purchase Summary
    # ──────────────────────────────────────────────────────────────

    async def purchase_summary(self, from_date: date | None, to_date: date | None) -> list[PurchaseSummaryLine]:
        """
        Per-supplier summary of POs and GRNs for an optional date range.

        OPTIMISED: was O(2N) queries (N=supplier count) — now exactly 3 queries
        using GROUP BY aggregation in Postgres, regardless of supplier count.

        Query plan:
          Q1: SELECT supplier list for tenant          (1 query)
          Q2: GROUP BY po aggregate over supplier_ids  (1 query)
          Q3: GROUP BY grn aggregate over supplier_ids (1 query)
        Total: 3 queries independent of supplier count.
        """
        from sqlalchemy import func

        # Q1: Fetch all suppliers for this tenant (one query)
        sup_res = await self.db.execute(
            select(Supplier).where(
                Supplier.company_id == self.tenant.company_id,
                Supplier.branch_id  == self.tenant.branch_id,
                Supplier.is_deleted == False,
            ).order_by(Supplier.name)
        )
        suppliers = sup_res.scalars().all()
        if not suppliers:
            return []

        supplier_ids = [s.id for s in suppliers]

        # Q2: PO aggregates — one GROUP BY query for all suppliers
        po_agg_res = await self.db.execute(
            select(
                PurchaseOrder.supplier_id,
                func.count(PurchaseOrder.id).label("po_count"),
                func.coalesce(func.sum(PurchaseOrder.grand_total), 0).label("total_ordered"),
            ).where(
                PurchaseOrder.supplier_id.in_(supplier_ids),
                PurchaseOrder.is_deleted == False,
            ).group_by(PurchaseOrder.supplier_id)
        )
        po_agg = {row.supplier_id: row for row in po_agg_res}

        # Q3: GRN aggregates — one GROUP BY query for all suppliers
        grn_agg_res = await self.db.execute(
            select(
                PurchaseReceipt.supplier_id,
                func.count(PurchaseReceipt.id).label("grn_count"),
                func.coalesce(func.sum(PurchaseReceipt.grand_total), 0).label("total_received"),
            ).where(
                PurchaseReceipt.supplier_id.in_(supplier_ids),
                PurchaseReceipt.is_deleted == False,
            ).group_by(PurchaseReceipt.supplier_id)
        )
        grn_agg = {row.supplier_id: row for row in grn_agg_res}

        # Python join: O(N) in memory — no further DB calls
        lines = []
        for supplier in suppliers:
            po_row  = po_agg.get(supplier.id)
            grn_row = grn_agg.get(supplier.id)
            lines.append(PurchaseSummaryLine(
                supplier_id    = supplier.id,
                supplier_name  = supplier.name,
                po_count       = int(po_row.po_count)  if po_row  else 0,
                grn_count      = int(grn_row.grn_count) if grn_row else 0,
                total_ordered  = Decimal(str(po_row.total_ordered  if po_row  else "0")).quantize(Decimal("0.01")),
                total_received = Decimal(str(grn_row.total_received if grn_row else "0")).quantize(Decimal("0.01")),
                outstanding    = Decimal(str(supplier.outstanding or "0")).quantize(Decimal("0.01")),
            ))
        return lines

    # ─────────────────────────────────────────────────────────────────
    # Report Schedule Management
    # ─────────────────────────────────────────────────────────────────

    async def list_schedules(self) -> list[ReportSchedule]:
        """Return all active (non-deleted) schedules for the current tenant."""
        result = await self.db.execute(
            select(ReportSchedule)
            .where(
                ReportSchedule.company_id == self.tenant.company_id,
                ReportSchedule.is_deleted == False,
            )
            .order_by(ReportSchedule.created_at.desc())
        )
        return result.scalars().all()

    async def create_schedule(
        self,
        payload,
        created_by_id: str | None = None,
    ) -> ReportSchedule:
        """Persist a new report schedule for the current tenant."""
        import uuid as _uuid

        # Derive a cron expression from frequency + execution_time
        cron = _derive_cron(payload.frequency, payload.execution_time or "08:00")

        schedule = ReportSchedule(
            id               = "SCH-" + _uuid.uuid4().hex[:10].upper(),
            uuid             = str(_uuid.uuid4()),
            company_id       = self.tenant.company_id,
            branch_id        = self.tenant.branch_id,
            report_id        = payload.report_id,
            report_name      = payload.report_name,
            frequency        = payload.frequency,
            execution_time   = payload.execution_time or "08:00",
            cron_expression  = cron,
            delivery_channel = payload.delivery_channel,
            delivery_target  = payload.delivery_target,
            delivery_format  = payload.delivery_format,
            created_by_id    = created_by_id,
        )
        self.db.add(schedule)
        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    async def delete_schedule(self, schedule_id: str) -> None:
        """Soft-delete a report schedule; 404 if not found or belongs to another tenant."""
        result = await self.db.execute(
            select(ReportSchedule).where(
                ReportSchedule.id         == schedule_id,
                ReportSchedule.company_id == self.tenant.company_id,
                ReportSchedule.is_deleted == False,
            )
        )
        schedule = result.scalar_one_or_none()
        if not schedule:
            raise HTTPException(status_code=404, detail="Report schedule not found.")
        schedule.is_deleted = True
        schedule.is_active  = False
        await self.db.commit()


def _derive_cron(frequency: str, execution_time: str) -> str:
    """Derive a standard 5-field cron expression from frequency + HH:MM time."""
    try:
        hour, minute = execution_time.split(":")
        h, m = int(hour), int(minute)
    except Exception:
        h, m = 8, 0
    if frequency == "DAILY":
        return f"{m} {h} * * *"
    if frequency == "WEEKLY":
        return f"{m} {h} * * 1"   # Monday
    if frequency == "MONTHLY":
        return f"{m} {h} 1 * *"   # 1st of month
    return f"{m} {h} * * *"
