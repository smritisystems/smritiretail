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


    # ──────────────────────────────────────────────────────────────
    # Sprint 8a P1 Report Methods -- Shoper9 parity Tax & Compliance
    # ──────────────────────────────────────────────────────────────

    def _date_filter(self, stmt, model, from_date, to_date):
        if from_date:
            stmt = stmt.where(model.date >= from_date)
        if to_date:
            stmt = stmt.where(model.date <= to_date)
        return stmt

    def _tenant_filter(self, stmt, model):
        if self.tenant and self.tenant.company_id:
            stmt = stmt.where(
                (model.company_id == self.tenant.company_id)
                | (model.company_id.is_(None))
                | (model.company_id == "COMP-001")
            )
        if self.tenant and self.tenant.branch_id:
            aliases = [self.tenant.branch_id, "MAIN", "BR-MAIN-001", "BR-001", "DEFAULT"]
            stmt = stmt.where(
                (model.branch_id.in_(aliases)) | (model.branch_id.is_(None))
            )
        return stmt

    async def bill_wise_sales(self, from_date=None, to_date=None):
        """RPT-TAX-002 -- Shoper9 SR202400 Bill-wise Sales."""
        from ..schemas.reports import BillWiseSalesLine, BillWiseSalesReport
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False, SalesInvoice.status != "CANCELLED")
        stmt = self._tenant_filter(stmt, SalesInvoice)
        stmt = self._date_filter(stmt, SalesInvoice, from_date, to_date)
        invoices = (await self.db.execute(stmt.order_by(SalesInvoice.date))).scalars().all()
        lines, tg, td, tn, tt = [], Decimal(0), Decimal(0), Decimal(0), Decimal(0)
        for inv in invoices:
            g = Decimal(str(getattr(inv,"gross_amount",None) or getattr(inv,"total_amount",None) or getattr(inv,"grand_total","0") or "0"))
            d = Decimal(str(getattr(inv,"discount_amount",None) or getattr(inv,"discount","0") or "0"))
            n = Decimal(str(getattr(inv,"net_amount",None) or getattr(inv,"grand_total","0") or "0"))
            t = Decimal(str(getattr(inv,"tax_amount",None) or getattr(inv,"gst_amount","0") or "0"))
            tg+=g; td+=d; tn+=n; tt+=t
            lines.append(BillWiseSalesLine(invoice_id=inv.id,
                invoice_number=getattr(inv,"invoice_number",None) or inv.id,
                invoice_date=str(getattr(inv,"date","") or ""),
                customer_name=getattr(inv,"customer_name",None),
                payment_mode=getattr(inv,"payment_mode",None),
                gross_amount=g, discount=d, net_amount=n, tax_amount=t,
                items_count=len(getattr(inv,"items",None) or [])))
        return BillWiseSalesReport(from_date=str(from_date or ""), to_date=str(to_date or ""),
            generated_at=datetime.now(timezone.utc).isoformat(), total_bills=len(lines),
            total_gross=tg, total_discount=td, total_net=tn, total_tax=tt, lines=lines)

    async def item_wise_sales(self, from_date=None, to_date=None):
        """RPT-TAX-003 -- Shoper9 SR202200 Item-wise Sales."""
        from ..schemas.reports import ItemWiseSalesLine, ItemWiseSalesReport
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False, SalesInvoice.status != "CANCELLED")
        stmt = self._tenant_filter(stmt, SalesInvoice)
        stmt = self._date_filter(stmt, SalesInvoice, from_date, to_date)
        invoices = (await self.db.execute(stmt)).scalars().all()
        agg: Dict[str, dict] = {}
        for inv in invoices:
            for item in (getattr(inv,"items",None) or []):
                pid = getattr(item,"product_id",None) or "UNKNOWN"
                qty = Decimal(str(getattr(item,"quantity",0) or 0))
                net = Decimal(str(getattr(item,"net_amount",None) or getattr(item,"amount",0) or 0))
                tax = Decimal(str(getattr(item,"tax_amount",0) or 0))
                disc= Decimal(str(getattr(item,"discount_amount",0) or 0))
                if pid not in agg:
                    agg[pid]={"code":getattr(item,"product_code",""),"name":getattr(item,"product_name",pid),
                              "hsn":getattr(item,"hsn_code",None),"qty":Decimal(0),"gross":Decimal(0),
                              "disc":Decimal(0),"net":Decimal(0),"tax":Decimal(0),"rqty":Decimal(0)}
                agg[pid]["qty"]+=qty; agg[pid]["net"]+=net; agg[pid]["tax"]+=tax; agg[pid]["disc"]+=disc
        lines=[ItemWiseSalesLine(product_id=pid,product_code=d["code"],product_name=d["name"],
                hsn_code=d["hsn"],qty_sold=d["qty"],gross_amount=d["gross"],discount=d["disc"],
                net_amount=d["net"],tax_amount=d["tax"],return_qty=d["rqty"]) for pid,d in sorted(agg.items(),key=lambda x:-x[1]["net"])]
        return ItemWiseSalesReport(from_date=str(from_date or ""),to_date=str(to_date or ""),
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_items=len(lines),total_qty=sum(l.qty_sold for l in lines),
            total_net=sum(l.net_amount for l in lines),lines=lines)

    async def tax_register(self, from_date=None, to_date=None):
        """RPT-TAX-001 -- Shoper9 SR202300 Tax Register."""
        from ..schemas.reports import TaxRegisterLine, TaxRegisterReport
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False, SalesInvoice.status != "CANCELLED")
        stmt = self._tenant_filter(stmt, SalesInvoice)
        stmt = self._date_filter(stmt, SalesInvoice, from_date, to_date)
        invoices = (await self.db.execute(stmt.order_by(SalesInvoice.date))).scalars().all()
        lines,t_taxable,t_cgst,t_sgst,t_igst,t_tax = [],[Decimal(0)]*6
        t_taxable,t_cgst,t_sgst,t_igst,t_tax = Decimal(0),Decimal(0),Decimal(0),Decimal(0),Decimal(0)
        for inv in invoices:
            taxable = Decimal(str(getattr(inv,"taxable_amount",None) or getattr(inv,"net_amount",None) or getattr(inv,"grand_total","0") or "0"))
            cgst_a  = Decimal(str(getattr(inv,"cgst_amount","0") or "0"))
            sgst_a  = Decimal(str(getattr(inv,"sgst_amount","0") or "0"))
            igst_a  = Decimal(str(getattr(inv,"igst_amount","0") or "0"))
            tax_tot = cgst_a+sgst_a+igst_a or Decimal(str(getattr(inv,"tax_amount","0") or "0"))
            t_taxable+=taxable; t_cgst+=cgst_a; t_sgst+=sgst_a; t_igst+=igst_a; t_tax+=tax_tot
            lines.append(TaxRegisterLine(invoice_number=getattr(inv,"invoice_number",None) or inv.id,
                invoice_date=str(getattr(inv,"date","") or ""),customer_name=getattr(inv,"customer_name",None),
                taxable_amount=taxable,cgst_rate=Decimal("9"),cgst_amount=cgst_a,
                sgst_rate=Decimal("9"),sgst_amount=sgst_a,igst_rate=Decimal("0"),igst_amount=igst_a,
                total_tax=tax_tot,net_amount=taxable+tax_tot))
        return TaxRegisterReport(from_date=str(from_date or ""),to_date=str(to_date or ""),
            generated_at=datetime.now(timezone.utc).isoformat(),total_invoices=len(lines),
            total_taxable=t_taxable,total_cgst=t_cgst,total_sgst=t_sgst,total_igst=t_igst,
            total_tax=t_tax,lines=lines)

    async def cancelled_bills(self, from_date=None, to_date=None):
        """RPT-TAX-004 -- Shoper9 SR210200 Cancelled Bills."""
        from ..schemas.reports import CancelledBillLine, CancelledBillsReport
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False, SalesInvoice.status == "CANCELLED")
        stmt = self._tenant_filter(stmt, SalesInvoice)
        stmt = self._date_filter(stmt, SalesInvoice, from_date, to_date)
        invoices = (await self.db.execute(stmt.order_by(SalesInvoice.date))).scalars().all()
        lines, total_voided = [], Decimal(0)
        for inv in invoices:
            amt = Decimal(str(getattr(inv,"grand_total",None) or getattr(inv,"total_amount","0") or "0"))
            total_voided += amt
            lines.append(CancelledBillLine(invoice_number=getattr(inv,"invoice_number",None) or inv.id,
                invoice_date=str(getattr(inv,"date","") or ""),
                cancelled_at=str(getattr(inv,"modified_at","") or ""),
                cancelled_by=getattr(inv,"updated_by",None),
                cancel_reason=getattr(inv,"cancel_reason",None) or getattr(inv,"remarks",None),
                original_amount=amt,customer_name=getattr(inv,"customer_name",None)))
        return CancelledBillsReport(from_date=str(from_date or ""),to_date=str(to_date or ""),
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_cancelled=len(lines),total_value_voided=total_voided,lines=lines)

    async def salesperson_discount(self, from_date=None, to_date=None):
        """RPT-MIS-005 -- Shoper9 SR238400 Salesperson-wise Discount."""
        from ..schemas.reports import SalespersonDiscountLine, SalespersonDiscountReport
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False, SalesInvoice.status != "CANCELLED")
        stmt = self._tenant_filter(stmt, SalesInvoice)
        stmt = self._date_filter(stmt, SalesInvoice, from_date, to_date)
        invoices = (await self.db.execute(stmt)).scalars().all()
        agg: Dict[str, dict] = {}
        for inv in invoices:
            sp   = getattr(inv,"salesperson_name",None) or getattr(inv,"cashier_name",None) or "Unknown"
            disc = Decimal(str(getattr(inv,"discount_amount",None) or getattr(inv,"discount","0") or "0"))
            net  = Decimal(str(getattr(inv,"net_amount",None) or getattr(inv,"grand_total","0") or "0"))
            if sp not in agg:
                agg[sp]={"bills":0,"sales":Decimal(0),"disc":Decimal(0)}
            agg[sp]["bills"]+=1; agg[sp]["sales"]+=net; agg[sp]["disc"]+=disc
        lines=[]
        for name,d in sorted(agg.items(),key=lambda x:-x[1]["disc"]):
            pct=(d["disc"]/d["sales"]*100).quantize(Decimal("0.01")) if d["sales"]>0 else Decimal(0)
            lines.append(SalespersonDiscountLine(salesperson_name=name,total_bills=d["bills"],
                total_sales=d["sales"],total_discount=d["disc"],discount_pct=pct))
        return SalespersonDiscountReport(from_date=str(from_date or ""),to_date=str(to_date or ""),
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_salespersons=len(lines),total_discount=sum(l.total_discount for l in lines),lines=lines)
