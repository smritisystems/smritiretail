"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import traceback
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.stock_acct_svc import StockAccountingBoundaryService
from ...schemas.stock_acct import (
    StockMovementRecordRequest,
    StockMovementResponse,
    StockBalanceRebuildResponse,
    JournalVoucherCreateRequest,
    JournalVoucherResponse,
    StockReconciliationReport,
    GlReconciliationReport,
    FinancialReconciliationReport,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
    return comp_id, user_id


@router.post("/stock-movements", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED, summary="Record Authoritative Stock Movement")
async def record_stock_movement(
    req: StockMovementRecordRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Atomically records an immutable stock movement and updates materialized on-hand stock."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        movement = await StockAccountingBoundaryService.record_stock_movement(
            session=db,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
        return movement
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stock/rebuild", response_model=StockBalanceRebuildResponse, summary="Rebuild On-Hand Stock Balances")
async def rebuild_stock_balances(
    fix_drift: bool = Query(False, description="Whether to rectify detected drift automatically"),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Calculates authoritative stock from the immutable movements ledger and checks for drift."""
    try:
        company_id, _ = _extract_user_info(current_user)
        res = await StockAccountingBoundaryService.rebuild_materialized_balances_from_movements(
            session=db,
            company_id=company_id,
            fix_drift=fix_drift,
        )
        return res
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gl/post", response_model=JournalVoucherResponse, status_code=status.HTTP_201_CREATED, summary="Post Balanced Journal Voucher")
async def post_journal_voucher(
    req: JournalVoucherCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Posts a balanced double-entry Journal Voucher (Total Debits == Total Credits)."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        res = await StockAccountingBoundaryService.post_balanced_journal_voucher(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reconcile/stock", response_model=StockReconciliationReport, summary="Run Stock Reconciliation Job")
async def reconcile_stock(
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Audits entire tenant stock movement ledger against current on-hand quantities."""
    company_id, _ = _extract_user_info(current_user)
    return await StockAccountingBoundaryService.run_stock_reconciliation(db, company_id)


@router.get("/reconcile/gl", response_model=GlReconciliationReport, summary="Run General Ledger Reconciliation Job")
async def reconcile_gl(
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Audits double-entry voucher balance invariants and Trial Balance equality."""
    company_id, _ = _extract_user_info(current_user)
    return await StockAccountingBoundaryService.run_gl_reconciliation(db, company_id)


@router.get("/reconcile/financial", response_model=FinancialReconciliationReport, summary="Comprehensive Multi-Ledger Reconciliation")
async def reconcile_financial(
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Combined Stock, GL, and Trial Balance audit."""
    company_id, _ = _extract_user_info(current_user)
    return await StockAccountingBoundaryService.run_financial_reconciliation(db, company_id)
