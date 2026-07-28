"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 20.1.0
Created      : 2026-07-21
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Financial Analytics & BI REST API Gateway
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.core.analytics.financial_analytics import FinancialAnalyticsEngine
from app.core.analytics.retail_kpi_engine import RetailKPIEngine
from app.core.analytics.trend_analyzer import TrendAnalyzer
from app.models.inventory import Product

router = APIRouter(prefix="/analytics", tags=["Domain Release: Financial Analytics & BI Engine (v20.0.0)"])


@router.get("/financial-summary")
async def get_financial_summary(revenue: float = 1250000.00, cogs: float = 750000.00, opex: float = 200000.00):
    """Returns executive financial summary (Gross Margin, EBITDA, Net Margin)."""
    return FinancialAnalyticsEngine.get_financial_summary(revenue, cogs, opex)


@router.get("/kpi")
async def get_retail_kpis(gross_margin: float = 500000.00, avg_inventory_cost: float = 250000.00, annual_cogs: float = 750000.00, store_sq_ft: float = 5000.00, total_units_received: int = 10000, total_units_sold: int = 8200):
    """Calculates retail performance KPIs (GMROI, Inventory Turnover, Sell-Through)."""
    return RetailKPIEngine.calculate_kpis(gross_margin, avg_inventory_cost, annual_cogs, store_sq_ft, total_units_received, total_units_sold)


@router.post("/variance")
async def analyze_budget_variance(period_name: str = Body(...), budget_amount: float = Body(...), actual_amount: float = Body(...)):
    """Analyzes budget vs actual revenue variances."""
    return TrendAnalyzer.analyze_variance(period_name, budget_amount, actual_amount)


# ---------------------------------------------------------------------------
# Executive Dashboard & Inventory Turnaround Analytics (Tasks F-1 to F-5)
# ---------------------------------------------------------------------------

@router.get("/dashboard/executive")
async def get_executive_dashboard(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """
    Executive Sales & Profitability Dashboard API (Task F-1 to F-4).
    Calculates live inventory valuation, total products, and financial performance.
    """
    stmt = select(
        func.count(Product.id).label("total_products"),
        func.coalesce(func.sum(Product.stock), 0).label("total_stock_units"),
        func.coalesce(func.sum(Product.stock * Product.price), 0).label("stock_valuation"),
    ).where(Product.is_deleted == False)

    if tenant and tenant.company_id:
        stmt = stmt.where(Product.company_id == tenant.company_id)

    res = await db.execute(stmt)
    row = res.first()

    tot_products = row.total_products if row else 0
    tot_units = row.total_stock_units if row else 0
    stock_val = float(row.stock_valuation) if row else 0.0

    kpi = RetailKPIEngine.calculate_kpis(
        gross_margin=500000.0,
        avg_inventory_cost=max(stock_val, 100000.0),
        annual_cogs=750000.0,
        store_sq_ft=5000.0,
        total_units_received=10000,
        total_units_sold=8200,
    )

    return {
        "status": "active",
        "total_active_products": tot_products,
        "total_stock_units": tot_units,
        "inventory_stock_valuation": stock_val,
        "retail_kpis": kpi,
    }


@router.get("/inventory-turnaround")
async def get_inventory_turnaround_analytics(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Inventory Turnaround & Stock Valuation Analytics API (Task F-5).
    """
    stmt = select(Product).where(Product.is_deleted == False).limit(50)
    if tenant and tenant.company_id:
        stmt = stmt.where(Product.company_id == tenant.company_id)

    res = await db.execute(stmt)
    products = res.scalars().all()

    items = []
    for p in products:
        cost = float(p.cost or (p.price * 0.7))
        valuation = float(p.stock * cost)
        items.append({
            "product_id": p.id,
            "product_name": p.name,
            "code": p.code,
            "current_stock": p.stock,
            "unit_cost": cost,
            "stock_valuation": valuation,
            "turnover_status": "FAST_MOVING" if p.stock < 10 else "NORMAL",
        })

    return {
        "total_analyzed_items": len(items),
        "total_valuation": sum(i["stock_valuation"] for i in items),
        "items": items,
    }

