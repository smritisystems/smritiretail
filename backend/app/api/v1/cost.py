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
Classification: API Router / Cost Management & Cost Truth Engine
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...services.cost_engine import CostManagementEngine
from ...models.auth import User

router = APIRouter(tags=["Cost Management & Cost Truth Engine"])


@router.get("/dashboard")
async def get_cost_truth_dashboard(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns executive KPIs for the Cost Truth Dashboard.
    Provides live Inventory Valuation, Period Sales, COGS, Gross Profit/Margin,
    Unallocated Landed Cost totals, Section 17(5)(h) blocked ITC, and reconciliation status.
    """
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMRITI-COST-400: Active company scope is required for Cost Truth Engine.",
        )

    kpis = await CostManagementEngine.get_cost_truth_dashboard_kpis(
        session=db, company_id=company_id
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": kpis}


@router.get("/reconciliation")
async def get_inventory_to_gl_reconciliation(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Live Inventory-to-General-Ledger Reconciliation.
    Compares live physical stock valuation (sum of stock * WAC) against
    General Ledger Account 1040 (Inventory Asset) balance.
    """
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMRITI-COST-400: Active company scope is required for Cost Truth Engine.",
        )

    recon = await CostManagementEngine.get_inventory_to_gl_reconciliation(
        session=db, company_id=company_id
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": recon}


@router.get("/reports/purchase-variance")
async def get_purchase_variance_report(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report 1: Purchase Cost & Purchase Price Variance Report."""
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    report = await CostManagementEngine.get_purchase_variance_report(
        session=db, company_id=company_id, limit=limit, offset=offset
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": report}


@router.get("/reports/landed-breakdown")
async def get_landed_cost_breakdown_report(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report 2: Landed Cost Breakdown Report."""
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    report = await CostManagementEngine.get_landed_cost_breakdown_report(
        session=db, company_id=company_id, limit=limit, offset=offset
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": report}


@router.get("/reports/itc-reconciliation")
async def get_itc_reconciliation_report(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report 3: GST & ITC Reconciliation Report."""
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    report = await CostManagementEngine.get_itc_reconciliation_report(
        session=db, company_id=company_id, limit=limit, offset=offset
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": report}


@router.get("/reports/stock-valuation")
async def get_stock_valuation_report(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report 4: Current Stock Valuation Report across all methods."""
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    report = await CostManagementEngine.get_stock_valuation_report(
        session=db, company_id=company_id, search=search, limit=limit, offset=offset
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": report}


@router.get("/reports/cogs-profitability")
async def get_cogs_profitability_report(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report 6: Sales COGS & Gross Profitability Report."""
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    report = await CostManagementEngine.get_cogs_profitability_report(
        session=db, company_id=company_id, limit=limit, offset=offset
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": report}


@router.get("/reports/exceptions")
async def get_cost_exceptions_report(
    variance_threshold: float = Query(10.0, ge=1.0, le=100.0),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report 8: Cost Variance and Exception Report."""
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    report = await CostManagementEngine.get_cost_exceptions_report(
        session=db,
        company_id=company_id,
        variance_threshold_pct=variance_threshold,
        limit=limit,
        offset=offset,
    )
    return {"status": "SUCCESS", "company_id": company_id, "data": report}


@router.post("/recalculate-wac-backfill")
async def recalculate_wac_backfill(
    product_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Recalculates rolling WAC from historical stock movements.
    Does not modify historical sales invoices or GL entries.
    Brings ProductCostValuation into strict alignment with movement history.
    """
    company_id = tenant.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Company scope required.")

    result = await CostManagementEngine.recalculate_historical_wac_for_company(
        session=db, company_id=company_id, product_id=product_id
    )
    await db.commit()
    return {"status": "SUCCESS", "company_id": company_id, "data": result}
