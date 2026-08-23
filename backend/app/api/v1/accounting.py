"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import List, Optional, Any, Dict
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ...api.deps import (
    get_company_db, get_tenant_context, TenantContext,
    require_role, require_permission
)
from ...models.accounting import (
    Account, JournalVoucher, GeneralLedgerEntry,
    AccountBalanceSnapshot, FiscalYear, FiscalPeriod,
    BankStatement, BankStatementLine
)
from ...schemas.accounting import (
    AccountResponse, JournalVoucherCreate, JournalVoucherResponse,
    TrialBalanceResponse, ProfitAndLossResponse,
    BankStatementImportRequest, BankStatementResponse,
    BankReconciliationStatementResponse, FiscalYearCreate,
    FiscalPeriodLockRequest, BalanceSnapshotRequest
)
from ...services.unified_accounting_ledger_service import UnifiedAccountingLedgerService

router = APIRouter()


# ─────────────────────────── Chart of Accounts ───────────────────────────

@router.get("/chart-of-accounts", response_model=List[AccountResponse])
async def get_chart_of_accounts(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Retrieve the authoritative Chart of Accounts for the active company tenant."""
    await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(db, tenant_ctx.company_id, tenant_ctx.branch_id)
    stmt = (
        select(Account)
        .where(Account.company_id == tenant_ctx.company_id, Account.is_deleted == False)
        .order_by(Account.account_code.asc())
    )
    accounts = (await db.execute(stmt)).scalars().all()
    return [AccountResponse.model_validate(a) for a in accounts]


# ─────────────────────────── Financial Statements ───────────────────────────

@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    as_of_date: Optional[date] = Query(None, description="Cutoff date for trial balance calculations"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Retrieve the real-time balanced Trial Balance verifying debits == credits."""
    return await UnifiedAccountingLedgerService.get_trial_balance(
        session=db,
        company_id=tenant_ctx.company_id,
        as_of_date=as_of_date
    )


@router.get("/profit-and-loss", response_model=ProfitAndLossResponse)
async def get_profit_and_loss(
    from_date: Optional[date] = Query(None, description="Start date of reporting period"),
    to_date: Optional[date] = Query(None, description="End date of reporting period"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Retrieve the real-time Operating Statement (P&L) computing Net Operating Profit."""
    return await UnifiedAccountingLedgerService.get_profit_and_loss(
        session=db,
        company_id=tenant_ctx.company_id,
        from_date=from_date,
        to_date=to_date
    )


# ─────────────────────────── Journal Vouchers ───────────────────────────

@router.post("/vouchers", response_model=JournalVoucherResponse, status_code=201)
async def post_journal_voucher(
    req: JournalVoucherCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Post an authoritative balanced double-entry Journal Voucher (Debit == Credit)."""
    lines_data = [l.model_dump() for l in req.lines]
    voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        voucher_type=req.voucher_type,
        voucher_date=req.voucher_date,
        lines=lines_data,
        reference_doc_type=req.reference_doc_type,
        reference_doc_id=req.reference_doc_id,
        reference_doc_no=req.reference_doc_no,
        narration=req.narration,
        created_by="system"
    )
    await db.commit()
    return JournalVoucherResponse.model_validate(voucher)



@router.get("/vouchers", response_model=List[JournalVoucherResponse])
async def list_journal_vouchers(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List recent journal vouchers for the company tenant."""
    stmt = (
        select(JournalVoucher)
        .where(JournalVoucher.company_id == tenant_ctx.company_id, JournalVoucher.is_deleted == False)
        .order_by(JournalVoucher.voucher_date.desc(), JournalVoucher.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    vouchers = (await db.execute(stmt)).scalars().all()
    return [JournalVoucherResponse.model_validate(v) for v in vouchers]


# ─────────────────────────── Bank Reconciliation Statement (BRS) ───────────────────────────

@router.post("/bank-statements", response_model=BankStatementResponse, status_code=201)
async def import_bank_statement(
    req: BankStatementImportRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Import a bank statement with transaction lines for two-way matching."""
    lines_data = [l.model_dump() for l in req.lines]
    stmt = await UnifiedAccountingLedgerService.import_bank_statement(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        bank_account_id=req.bank_account_id,
        statement_no=req.statement_no,
        from_date=req.from_date,
        to_date=req.to_date,
        opening_balance=req.opening_balance,
        closing_balance=req.closing_balance,
        lines=lines_data,
        statement_date=req.statement_date
    )
    await db.commit()
    return BankStatementResponse.model_validate(stmt)


@router.post("/bank-statements/{statement_id}/auto-reconcile")
async def auto_reconcile_bank_statement(
    statement_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Execute automated two-way matching between bank statement lines and GL entries."""
    res = await UnifiedAccountingLedgerService.auto_reconcile_bank_statement(
        session=db,
        company_id=tenant_ctx.company_id,
        statement_id=statement_id
    )
    await db.commit()
    return res


@router.get("/bank-reconciliation", response_model=BankReconciliationStatementResponse)
async def get_bank_reconciliation_statement(
    bank_account_id: str = Query(..., description="Target bank account ID"),
    as_of_date: Optional[date] = Query(None, description="Reconciliation cutoff date"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Generate the Bank Reconciliation Statement (BRS) comparing Book vs Bank balances."""
    return await UnifiedAccountingLedgerService.get_bank_reconciliation_statement(
        session=db,
        company_id=tenant_ctx.company_id,
        bank_account_id=bank_account_id,
        as_of_date=as_of_date
    )


# ─────────────────────────── Fiscal Periods & Snapshots ───────────────────────────

@router.post("/fiscal-years", status_code=201)
async def create_fiscal_year(
    req: FiscalYearCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Initialize a Financial Year and generate 12 monthly Fiscal Periods."""
    fy = await UnifiedAccountingLedgerService.create_fiscal_year_with_periods(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        start_date=req.start_date,
        end_date=req.end_date,
        code=req.code
    )
    await db.commit()
    return {
        "fiscal_year_id": fy.id,
        "financial_year_code": fy.financial_year_code,
        "start_date": fy.start_date.isoformat(),
        "end_date": fy.end_date.isoformat()
    }


@router.post("/fiscal-periods/{period_id}/lock")
async def lock_fiscal_period(
    period_id: str,
    req: FiscalPeriodLockRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Lock or soft-close an accounting period to prevent backdated entries."""
    fp = await UnifiedAccountingLedgerService.lock_fiscal_period(
        session=db,
        company_id=tenant_ctx.company_id,
        period_id=period_id,
        lock_status=req.lock_status,
        closed_by=req.closed_by or "admin"
    )
    await db.commit()

    return {
        "period_id": fp.id,
        "period_name": fp.period_name,
        "status": fp.status,
        "closed_at": fp.closed_at.isoformat() if fp.closed_at else None
    }


@router.post("/balance-snapshots")
async def generate_balance_snapshots(
    req: BalanceSnapshotRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Calculate and persist closing balance snapshots as of a target date."""
    snapshots = await UnifiedAccountingLedgerService.generate_period_balance_snapshot(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        period_date=req.period_date
    )
    await db.commit()
    return {
        "period_date": req.period_date.isoformat(),
        "snapshots_generated": len(snapshots)
    }
