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
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, TenantContext
from ...services.analytical_intelligence_service import AnalyticalIntelligenceService

router = APIRouter()


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
