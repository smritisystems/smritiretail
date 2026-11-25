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

from datetime import date, datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from ...api.deps import get_company_db, get_tenant_context, TenantContext
from ...services.analytics_svc import AnalyticalIntelligenceService
from ...models.sales import SalesInvoice, SalesInvoiceItem
from ...models.crm import Customer

router = APIRouter()
BUSINESS_TIMEZONE = ZoneInfo("Asia/Kolkata")


def retail_business_date(now: Optional[datetime] = None) -> date:
    instant = now or datetime.now(timezone.utc)
    return instant.astimezone(BUSINESS_TIMEZONE).date()


@router.get("/home-summary")
async def get_home_summary(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Plain-language daily summary for role-based guided home screens."""
    today = retail_business_date()

    invoice_filters = (
        SalesInvoice.company_id == tenant_ctx.company_id,
        SalesInvoice.is_deleted.is_(False),
        SalesInvoice.status.notin_(["CANCELLED", "Cancelled", "DRAFT", "Draft"]),
        SalesInvoice.date == today,
    )
    if tenant_ctx.branch_id:
        invoice_filters += (
            (SalesInvoice.branch_id == tenant_ctx.branch_id) | (SalesInvoice.branch_id.is_(None)),
        )

    totals = await db.execute(
        select(
            func.count(SalesInvoice.id),
            func.coalesce(func.sum(SalesInvoice.net_amount), 0),
            func.coalesce(func.sum(SalesInvoice.balance_amount), 0),
        ).where(*invoice_filters)
    )
    invoice_count, total_sales, outstanding = totals.one()

    items_sold = await db.execute(
        select(func.coalesce(func.sum(SalesInvoiceItem.quantity), 0))
        .join(SalesInvoice, SalesInvoiceItem.invoice_id == SalesInvoice.id)
        .where(*invoice_filters)
    )

    customer_count = await db.execute(
        select(func.count(Customer.id)).where(
            Customer.company_id == tenant_ctx.company_id,
            Customer.is_deleted.is_(False),
            Customer.created_date == today,
        )
    )

    recent = await db.execute(
        select(SalesInvoice)
        .where(*invoice_filters)
        .order_by(desc(SalesInvoice.created_at), desc(SalesInvoice.id))
        .limit(5)
    )

    recent_rows = []
    for invoice in recent.scalars().all():
        recent_rows.append({
            "id": invoice.id,
            "invoice_no": invoice.invoice_no,
            "customer_name": invoice.customer_name or "Walk-in Customer",
            "net_amount": float(invoice.net_amount or 0),
            "status": invoice.status or "Posted",
            "date": invoice.date.isoformat() if invoice.date else today.isoformat(),
        })

    return {
        "date": today.isoformat(),
        "today_sales": float(total_sales or 0),
        "bill_count": int(invoice_count or 0),
        "items_sold": float(items_sold.scalar() or 0),
        "new_customer_count": int(customer_count.scalar() or 0),
        "today_unpaid_balance": float(outstanding or 0),
        "customer_outstanding": float(outstanding or 0),
        "recent_sales": recent_rows,
    }


class RebuildAggregatesRequest(BaseModel):
    target_date: date


@router.get("/daily-sales-summary")
async def get_daily_sales_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Returns high-speed pre-aggregated daily sales metrics from the Analytics Plane.
    """
    today = datetime.now(timezone.utc).date()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    trends = await AnalyticalIntelligenceService.get_daily_sales_trends(
        session=db,
        company_id=tenant_ctx.company_id,
        start_date=s_date,
        end_date=e_date,
        branch_id=tenant_ctx.branch_id
    )
    return {
        "company_id": tenant_ctx.company_id,
        "start_date": s_date.isoformat(),
        "end_date": e_date.isoformat(),
        "facts_count": len(trends),
        "facts": trends
    }


@router.get("/category-margins")
async def get_category_margins(
    lookback_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Returns category profitability, units sold, estimated COGS, and profit margin percentages.
    """
    margins = await AnalyticalIntelligenceService.get_category_profitability_rollups(
        session=db,
        company_id=tenant_ctx.company_id,
        lookback_days=lookback_days
    )
    return {
        "company_id": tenant_ctx.company_id,
        "lookback_days": lookback_days,
        "category_count": len(margins),
        "categories": margins
    }


@router.post("/rebuild-aggregates")
async def rebuild_daily_aggregates(
    req: RebuildAggregatesRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    On-demand re-aggregation and caching of daily sales facts for a given date.
    """
    fact = await AnalyticalIntelligenceService.compute_and_store_daily_aggregates(
        session=db,
        company_id=tenant_ctx.company_id,
        target_date=req.target_date,
        branch_id=tenant_ctx.branch_id
    )
    await db.commit()
    return {
        "fact_id": fact.id,
        "fact_date": fact.fact_date.isoformat(),
        "total_revenue": float(fact.total_revenue),
        "invoice_count": fact.invoice_count,
        "gross_margin_amount": float(fact.gross_margin_amount),
        "gross_margin_percent": float(fact.gross_margin_percent)
    }


@router.post("/trigger-daemon-cycle")
async def trigger_analytics_daemon_cycle(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Manually triggers the background analytics aggregation cycle for the current tenant.
    """
    from ...services.analytics_daemon import AnalyticsDaemonService
    from ...db.session import resolve_company_database_name
    db_name = await resolve_company_database_name(tenant_ctx.company_id)
    result = await AnalyticsDaemonService.run_tenant_rollup_cycle(
        db_name=db_name,
        company_id=tenant_ctx.company_id
    )
    return result
