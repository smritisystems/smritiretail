"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.analytics import AnalyticsDailySalesFact
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inventory import Product, StockMovement
from ..models.payment_ledger import PaymentTransaction


def _quantize_currency(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class AnalyticalIntelligenceService:
    """
    SMRITI Downstream Analytical Intelligence & Aggregation Engine (Section 11).
    Computes materialized daily sales facts, profit margins, and trend rollups
    without mutating or locking operational transactional tables.
    """

    @classmethod
    async def compute_and_store_daily_aggregates(
        cls,
        session: AsyncSession,
        company_id: str,
        target_date: date,
        branch_id: Optional[str] = None
    ) -> AnalyticsDailySalesFact:
        """
        Aggregates confirmed sales invoices and cost of goods sold for a specific date,
        and atomically upserts the daily sales fact record.
        """
        # 1. Query Confirmed Invoices for Target Date
        inv_stmt = select(
            func.coalesce(func.sum(SalesInvoice.grand_total), 0.0).label("total_rev"),
            func.count(SalesInvoice.id).label("inv_count"),
            func.coalesce(func.sum(SalesInvoice.tax_total), 0.0).label("total_tax")
        ).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.date == target_date,
            func.upper(SalesInvoice.status).in_(["CONFIRMED", "POSTED", "DRAFT", "PAID", "COMPLETED"]),
            SalesInvoice.is_deleted == False
        )
        if branch_id:
            inv_stmt = inv_stmt.where(SalesInvoice.branch_id == branch_id)

        inv_row = (await session.execute(inv_stmt)).one()
        total_rev = _quantize_currency(inv_row.total_rev)
        inv_count = int(inv_row.inv_count)
        total_tax = _quantize_currency(inv_row.total_tax)
        total_discount = Decimal("0.00")

        # 2. Payment Modes Breakdown
        pay_stmt = select(
            PaymentTransaction.tender_type,
            func.coalesce(func.sum(PaymentTransaction.amount), 0.0)
        ).where(
            PaymentTransaction.company_id == company_id,
            func.date(PaymentTransaction.created_at) == target_date,
            PaymentTransaction.status.in_(["COMPLETED", "SETTLED", "SUCCESS"]),
            PaymentTransaction.is_deleted == False
        ).group_by(PaymentTransaction.tender_type)
        if branch_id:
            pay_stmt = pay_stmt.where(PaymentTransaction.branch_id == branch_id)

        pay_rows = (await session.execute(pay_stmt)).all()
        cash_rev = Decimal("0.00")
        digital_rev = Decimal("0.00")
        credit_rev = Decimal("0.00")
        for mode, amt in pay_rows:
            mode_upper = (mode or "").upper()
            amt_dec = _quantize_currency(amt)
            if mode_upper == "CASH":
                cash_rev += amt_dec
            elif mode_upper in ["CREDIT", "DUE", "CREDIT_MEMO"]:
                credit_rev += amt_dec
            else:
                digital_rev += amt_dec

        # If payment ledger has no separate records, fallback to invoice total
        if cash_rev == 0 and digital_rev == 0 and credit_rev == 0 and total_rev > 0:
            cash_rev = total_rev

        # 3. Estimated Cost of Goods Sold (COGS) & Gross Margin
        cogs_stmt = select(
            func.coalesce(func.sum(SalesInvoiceItem.quantity * func.coalesce(Product.cost_price, 0.0)), 0.0)
        ).select_from(SalesInvoiceItem).join(
            SalesInvoice, SalesInvoiceItem.invoice_id == SalesInvoice.id
        ).outerjoin(
            Product, SalesInvoiceItem.product_id == Product.id
        ).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.date == target_date,
            func.upper(SalesInvoice.status).in_(["CONFIRMED", "POSTED", "DRAFT", "PAID", "COMPLETED"]),
            SalesInvoice.is_deleted == False
        )
        if branch_id:
            cogs_stmt = cogs_stmt.where(SalesInvoice.branch_id == branch_id)

        est_cogs = _quantize_currency((await session.execute(cogs_stmt)).scalar() or 0.0)
        net_revenue = total_rev - total_tax
        gross_margin = _quantize_currency(net_revenue - est_cogs)
        if net_revenue > Decimal("0.00"):
            gross_margin_pct = _quantize_currency((gross_margin / net_revenue) * Decimal("100.00"))
        else:
            gross_margin_pct = Decimal("0.00")

        # 4. Check for existing Fact Record to Upsert
        fact_stmt = select(AnalyticsDailySalesFact).where(
            AnalyticsDailySalesFact.company_id == company_id,
            AnalyticsDailySalesFact.fact_date == target_date
        )
        if branch_id:
            fact_stmt = fact_stmt.where(AnalyticsDailySalesFact.branch_id == branch_id)

        fact = (await session.execute(fact_stmt)).scalar_one_or_none()
        if not fact:
            fact = AnalyticsDailySalesFact(
                id=f"fact_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id or "BR-001",
                fact_date=target_date,
                total_revenue=total_rev,
                invoice_count=inv_count,
                total_tax_amount=total_tax,
                total_discount_amount=total_discount,
                cash_revenue=cash_rev,
                digital_revenue=digital_rev,
                credit_revenue=credit_rev,
                estimated_cost_amount=est_cogs,
                gross_margin_amount=gross_margin,
                gross_margin_percent=gross_margin_pct,
                computed_at=datetime.now(timezone.utc),
                is_active=True,
                is_deleted=False
            )
            session.add(fact)
        else:
            fact.total_revenue = total_rev
            fact.invoice_count = inv_count
            fact.total_tax_amount = total_tax
            fact.total_discount_amount = total_discount
            fact.cash_revenue = cash_rev
            fact.digital_revenue = digital_rev
            fact.credit_revenue = credit_rev
            fact.estimated_cost_amount = est_cogs
            fact.gross_margin_amount = gross_margin
            fact.gross_margin_percent = gross_margin_pct
            fact.computed_at = datetime.now(timezone.utc)

        await session.flush()
        return fact

    @classmethod
    async def get_daily_sales_trends(
        cls,
        session: AsyncSession,
        company_id: str,
        start_date: date,
        end_date: date,
        branch_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetches pre-aggregated daily sales facts for high-speed analytical dashboards."""
        stmt = select(AnalyticsDailySalesFact).where(
            AnalyticsDailySalesFact.company_id == company_id,
            AnalyticsDailySalesFact.fact_date >= start_date,
            AnalyticsDailySalesFact.fact_date <= end_date,
            AnalyticsDailySalesFact.is_deleted == False
        ).order_by(AnalyticsDailySalesFact.fact_date.asc())

        if branch_id:
            stmt = stmt.where(AnalyticsDailySalesFact.branch_id == branch_id)

        facts = (await session.execute(stmt)).scalars().all()
        return [
            {
                "fact_date": f.fact_date.isoformat(),
                "total_revenue": float(f.total_revenue),
                "invoice_count": f.invoice_count,
                "total_tax_amount": float(f.total_tax_amount),
                "total_discount_amount": float(f.total_discount_amount),
                "cash_revenue": float(f.cash_revenue),
                "digital_revenue": float(f.digital_revenue),
                "credit_revenue": float(f.credit_revenue),
                "gross_margin_amount": float(f.gross_margin_amount),
                "gross_margin_percent": float(f.gross_margin_percent),
                "computed_at": f.computed_at.isoformat() if f.computed_at else None
            }
            for f in facts
        ]

    @classmethod
    async def get_category_profitability_rollups(
        cls,
        session: AsyncSession,
        company_id: str,
        lookback_days: int = 30
    ) -> List[Dict[str, Any]]:
        """Rolls up category sales revenue, estimated costs, and gross profit margins."""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        stmt = select(
            Product.category.label("category"),
            func.coalesce(func.sum(SalesInvoiceItem.quantity), 0.0).label("units_sold"),
            func.coalesce(func.sum(SalesInvoiceItem.total_amount), 0.0).label("taxable_sales"),
            func.coalesce(func.sum(SalesInvoiceItem.quantity * func.coalesce(Product.cost_price, 0.0)), 0.0).label("total_cogs")
        ).select_from(SalesInvoiceItem).join(
            SalesInvoice, SalesInvoiceItem.invoice_id == SalesInvoice.id
        ).outerjoin(
            Product, SalesInvoiceItem.product_id == Product.id
        ).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.created_at >= cutoff_date,
            SalesInvoice.is_deleted == False
        ).group_by(Product.category)

        rows = (await session.execute(stmt)).all()
        results = []
        for cat, units, sales, cogs in rows:
            cat_name = cat or "GENERAL"
            sales_dec = _quantize_currency(sales)
            cogs_dec = _quantize_currency(cogs)
            margin_dec = _quantize_currency(sales_dec - cogs_dec)
            margin_pct = _quantize_currency((margin_dec / sales_dec) * Decimal("100.00")) if sales_dec > Decimal("0.00") else Decimal("0.00")
            results.append({
                "category": cat_name,
                "units_sold": float(units),
                "taxable_sales": float(sales_dec),
                "total_cogs": float(cogs_dec),
                "gross_margin_amount": float(margin_dec),
                "gross_margin_percent": float(margin_pct)
            })

        return sorted(results, key=lambda x: x["taxable_sales"], reverse=True)
