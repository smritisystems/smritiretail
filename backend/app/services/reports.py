"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.23.0
* Created    : 2026-07-11
* Modified   : 2026-08-15
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import date, datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ..models.inventory import Product
from ..models.sales import SalesInvoice
from ..models.purchase import Supplier, PurchaseOrder, PurchaseReceipt
from ..models.supplier_payment import SupplierPayment
from ..models.report_schedule import ReportSchedule
from ..models.crm import Customer
from ..models.loyalty import LoyaltyMember, LoyaltyPointsLedger
from ..models.promotions import PromotionCampaign, PromotionRedemption
from ..models.commission import CommissionParticipant, CommissionLedger
from ..models.fulfillment import PackingSlip, Dispatch
from ..models.profitability import InvoiceProfitabilityLedger, ProductCostValuation
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

    async def stock_valuation(self) -> StockValuationReport:
        stmt = select(Product).where(
            Product.is_deleted == False,
            Product.is_active == True,
        )
        if self.tenant and self.tenant.company_id:
            stmt = stmt.where(
                (Product.company_id == self.tenant.company_id) | (Product.company_id.is_(None)) | (Product.company_id == "COMP-001")
            )
        stmt = stmt.order_by(Product.name)
        res = await self.db.execute(stmt)
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

    async def daily_sales(self, report_date: Optional[date] = None) -> DailySalesSummary:
        stmt = select(SalesInvoice).where(
            SalesInvoice.is_deleted == False,
        )
        if report_date:
            stmt = stmt.where(SalesInvoice.date == report_date)

        if self.tenant and self.tenant.company_id:
            stmt = stmt.where(
                (SalesInvoice.company_id == self.tenant.company_id) | (SalesInvoice.company_id.is_(None)) | (SalesInvoice.company_id == "COMP-001")
            )

        if self.tenant and self.tenant.branch_id:
            branch_aliases = [self.tenant.branch_id, "MAIN", "BR-MAIN-001", "BR-001", "DEFAULT"]
            stmt = stmt.where(
                (SalesInvoice.branch_id.in_(branch_aliases)) | (SalesInvoice.branch_id.is_(None))
            )

        res = await self.db.execute(stmt)
        invoices = res.scalars().all()

        total_sales = Decimal("0.00")
        cash_sales = Decimal("0.00")
        card_sales = Decimal("0.00")
        upi_sales = Decimal("0.00")
        credit_sales = Decimal("0.00")

        for inv in invoices:
            net = Decimal(str(getattr(inv, "net_amount", None) or getattr(inv, "total_amount", None) or getattr(inv, "grand_total", None) or "0"))
            total_sales += net

            pm = (inv.payment_mode or "").upper()
            if "CASH" in pm:
                cash_sales += net
            elif "CARD" in pm:
                card_sales += net
            elif "UPI" in pm:
                upi_sales += net
            elif "CREDIT" in pm:
                credit_sales += net
            else:
                cash_sales += net

        return DailySalesSummary(
            report_date=report_date or date.today(),
            total_invoices=len(invoices),
            total_sales=total_sales,
            cash_sales=cash_sales,
            card_sales=card_sales,
            upi_sales=upi_sales,
            credit_sales=credit_sales,
            shift_breakdown=[],
        )

    async def supplier_ledger(self, supplier_id: str) -> SupplierLedger:
        sup_res = await self.db.execute(
            select(Supplier).where(
                Supplier.id         == supplier_id,
                Supplier.company_id == self.tenant.company_id,
            )
        )
        supplier = sup_res.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        po_res = await self.db.execute(
            select(PurchaseReceipt).where(
                PurchaseReceipt.supplier_id == supplier_id,
                PurchaseReceipt.company_id  == self.tenant.company_id,
            )
        )
        receipts = po_res.scalars().all()

        pay_res = await self.db.execute(
            select(SupplierPayment).where(
                SupplierPayment.supplier_id == supplier_id,
                SupplierPayment.company_id  == self.tenant.company_id,
            )
        )
        payments = pay_res.scalars().all()

        entries = []
        for r in receipts:
            amt = float(getattr(r, "total_amount", None) or getattr(r, "grand_total", 0.0) or 0.0)
            entries.append({
                "date": str(getattr(r, "receipt_date", None) or getattr(r, "created_at", "")),
                "type": "PURCHASE",
                "reference": getattr(r, "receipt_number", None) or getattr(r, "receipt_no", "") or r.id,
                "debit": amt,
                "credit": 0.0,
            })
        for p in payments:
            amt = float(getattr(p, "amount", 0.0) or 0.0)
            entries.append({
                "date": str(getattr(p, "payment_date", None) or getattr(p, "created_at", "")),
                "type": "PAYMENT",
                "reference": getattr(p, "payment_number", None) or getattr(p, "payment_no", "") or p.id,
                "debit": 0.0,
                "credit": amt,
            })

        entries.sort(key=lambda x: x["date"])

        running_balance = Decimal("0.00")
        total_purchased = Decimal("0.00")
        total_paid = Decimal("0.00")
        typed_entries = []
        for e in entries:
            deb = Decimal(str(e["debit"]))
            cred = Decimal(str(e["credit"]))
            total_purchased += deb
            total_paid += cred
            running_balance += deb - cred
            typed_entries.append(SupplierLedgerEntry(
                entry_type=e["type"],
                date=e["date"],
                reference=e["reference"],
                amount=deb if deb > 0 else cred,
                balance_after=running_balance,
            ))

        return SupplierLedger(
            supplier_id=supplier.id,
            supplier_name=supplier.name,
            opening_balance=Decimal("0.00"),
            total_purchased=total_purchased,
            total_paid=total_paid,
            closing_balance=running_balance,
            entries=typed_entries,
        )

    async def purchase_summary(self, from_date: Optional[date] = None, to_date: Optional[date] = None) -> List[PurchaseSummaryLine]:
        sup_res = await self.db.execute(
            select(Supplier).where(
                Supplier.company_id == self.tenant.company_id,
                Supplier.is_deleted == False,
            )
        )
        suppliers = sup_res.scalars().all()
        result = []
        for sup in suppliers:
            po_res = await self.db.execute(
                select(PurchaseOrder).where(
                    PurchaseOrder.supplier_id == sup.id,
                    PurchaseOrder.company_id == self.tenant.company_id,
                    PurchaseOrder.is_deleted == False,
                )
            )
            pos = po_res.scalars().all()

            grn_res = await self.db.execute(
                select(PurchaseReceipt).where(
                    PurchaseReceipt.supplier_id == sup.id,
                    PurchaseReceipt.company_id == self.tenant.company_id,
                    PurchaseReceipt.is_deleted == False,
                )
            )
            grns = grn_res.scalars().all()

            total_ordered = sum((getattr(p, "total_amount", None) or getattr(p, "grand_total", Decimal("0.00")) or Decimal("0.00")) for p in pos)
            total_received = sum((getattr(g, "total_amount", None) or getattr(g, "grand_total", Decimal("0.00")) or Decimal("0.00")) for g in grns)

            result.append(PurchaseSummaryLine(
                supplier_id=sup.id,
                supplier_name=sup.name,
                po_count=len(pos),
                grn_count=len(grns),
                total_ordered=Decimal(str(total_ordered)),
                total_received=Decimal(str(total_received)),
                outstanding=Decimal(str(sup.outstanding or "0.00")),
            ))
        return result


    # ──────────────────────────────────────────────────────────────
    # 5. Profitability Waterfall Report
    # ──────────────────────────────────────────────────────────────
    async def profitability_report(self, cost_basis: str = "WAC") -> Dict[str, Any]:
        res = await self.db.execute(select(InvoiceProfitabilityLedger))
        ledgers = res.scalars().all()
        total_gross = sum(float(l.gross_sales_amount or 0) for l in ledgers)
        total_cogs = sum(float(l.total_cogs or 0) for l in ledgers)
        total_net_contrib = sum(float(l.net_contribution or 0) for l in ledgers)

        return {
            "cost_basis_selected": cost_basis,
            "total_invoices_analyzed": len(ledgers),
            "total_gross_sales": total_gross,
            "total_cogs": total_cogs,
            "total_net_contribution": total_net_contrib,
            "net_margin_percent": (total_net_contrib / total_gross * 100.0) if total_gross > 0 else 0.0,
            "ledgers": ledgers
        }

    # ──────────────────────────────────────────────────────────────
    # 6. Report Schedules
    # ──────────────────────────────────────────────────────────────
    async def list_schedules(self) -> List[ReportSchedule]:
        res = await self.db.execute(
            select(ReportSchedule).where(
                ReportSchedule.company_id == self.tenant.company_id,
                ReportSchedule.is_deleted == False,
            ).order_by(ReportSchedule.created_at.desc())
        )
        return res.scalars().all()

    async def create_schedule(self, payload: Any, created_by_id: str) -> ReportSchedule:
        import uuid
        cron_expr = getattr(payload, "cron_expression", None)
        if not cron_expr and getattr(payload, "frequency", None):
            freq = payload.frequency.upper()
            exec_time = getattr(payload, "execution_time", "08:00") or "08:00"
            try:
                hour, minute = exec_time.split(":")
                hour_i = int(hour)
                min_i = int(minute)
            except Exception:
                hour_i, min_i = 8, 0
            if freq == "DAILY":
                cron_expr = f"{min_i} {hour_i} * * *"
            elif freq == "WEEKLY":
                cron_expr = f"{min_i} {hour_i} * * 1"
            elif freq == "MONTHLY":
                cron_expr = f"{min_i} {hour_i} 1 * *"

        sched = ReportSchedule(
            id=f"SCH-{uuid.uuid4().hex[:12].upper()}",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            report_id=payload.report_id,
            report_name=payload.report_name,
            frequency=payload.frequency,
            execution_time=getattr(payload, "execution_time", "08:00"),
            delivery_format=payload.delivery_format,
            delivery_channel=payload.delivery_channel,
            delivery_target=payload.delivery_target,
            cron_expression=cron_expr,
            created_by_id=created_by_id,
        )
        self.db.add(sched)
        await self.db.commit()
        await self.db.refresh(sched)
        return sched

    async def delete_schedule(self, schedule_id: str) -> None:
        res = await self.db.execute(
            select(ReportSchedule).where(
                ReportSchedule.id == schedule_id,
                ReportSchedule.company_id == self.tenant.company_id,
            )
        )
        sched = res.scalar_one_or_none()
        if not sched:
            raise HTTPException(status_code=404, detail="Report schedule not found")
        sched.is_deleted = True
        sched.is_active = False
        self.db.add(sched)
        await self.db.commit()

