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

    async def daily_sales(self, report_date: date) -> DailySalesSummary:
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.date       == report_date,
                SalesInvoice.company_id == self.tenant.company_id,
                SalesInvoice.branch_id  == self.tenant.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoices = res.scalars().all()

        total_gross = Decimal("0.00")
        total_discount = Decimal("0.00")
        total_net = Decimal("0.00")
        modes: Dict[str, Decimal] = {}

        for inv in invoices:
            gross = Decimal(str(inv.total_amount or "0"))
            disc  = Decimal(str(inv.discount_amount or "0"))
            net   = Decimal(str(inv.net_amount or "0"))

            total_gross    += gross
            total_discount += disc
            total_net      += net

            pm = inv.payment_mode or "UNSPECIFIED"
            modes[pm] = modes.get(pm, Decimal("0.00")) + net

        return DailySalesSummary(
            report_date=report_date.isoformat(),
            invoice_count=len(invoices),
            total_gross=total_gross,
            total_discount=total_discount,
            total_net=total_net,
            by_payment_mode={k: float(v) for k, v in modes.items()},
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
            entries.append({
                "date": str(r.receipt_date or r.created_at),
                "type": "GRN",
                "reference": r.receipt_number,
                "debit": float(r.total_amount or 0.0),
                "credit": 0.0,
            })
        for p in payments:
            entries.append({
                "date": str(p.payment_date or p.created_at),
                "type": "PAYMENT",
                "reference": p.payment_number,
                "debit": 0.0,
                "credit": float(p.amount or 0.0),
            })

        entries.sort(key=lambda x: x["date"])

        running_balance = Decimal("0.00")
        typed_entries = []
        for e in entries:
            running_balance += Decimal(str(e["debit"])) - Decimal(str(e["credit"]))
            typed_entries.append(SupplierLedgerEntry(
                date=e["date"],
                type=e["type"],
                reference=e["reference"],
                debit=Decimal(str(e["debit"])),
                credit=Decimal(str(e["credit"])),
                running_balance=running_balance,
            ))

        return SupplierLedger(
            supplier_id=supplier.id,
            supplier_name=supplier.name,
            opening_balance=Decimal("0.00"),
            closing_balance=running_balance,
            entries=typed_entries,
        )

    async def purchase_summary(self, from_date: Optional[date] = None, to_date: Optional[date] = None) -> List[PurchaseSummaryLine]:
        sup_res = await self.db.execute(
            select(Supplier).where(Supplier.company_id == self.tenant.company_id)
        )
        suppliers = sup_res.scalars().all()
        result = []
        for sup in suppliers:
            result.append(PurchaseSummaryLine(
                supplier_id=sup.id,
                supplier_code=sup.code or sup.id,
                supplier_name=sup.name,
                po_count=0,
                grn_count=0,
                total_ordered=Decimal("0.00"),
                total_received=Decimal("0.00"),
                outstanding_balance=Decimal(str(sup.outstanding or "0.00")),
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
        sched = ReportSchedule(
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            report_id=payload.report_id,
            report_name=payload.report_name,
            frequency=payload.frequency,
            delivery_format=payload.delivery_format,
            delivery_channel=payload.delivery_channel,
            delivery_target=payload.delivery_target,
            cron_expression=payload.cron_expression,
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
        await self.db.commit()
