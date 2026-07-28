"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.1.0
Created      : 2026-07-21
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

accounting.py — REST API endpoints for General Ledger, Double-Entry Vouchers, Financial Statements,
Bank Accounts, Cost Centers, TDS Entries, AP/AR Ageing Reports, and Financial Year Locking.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, get_tenant_context, TenantContext, require_permission
from app.services.accounting import AccountingService, JournalVoucher, JournalEntry
from app.schemas.accounting import (
    ChartOfAccountsCreate, ChartOfAccountsResponse,
    JournalVoucherCreate, JournalVoucherResponse,
    TrialBalanceResponse, ProfitLossResponse, BalanceSheetResponse,
    BankAccountCreate, BankAccountResponse,
    CostCenterCreate, CostCenterResponse,
    TdsEntryCreate, TdsEntryResponse,
    AgeingReportResponse,
)

router = APIRouter(prefix="/accounting", tags=["General Ledger & Financial Accounting"])


@router.get("/settings")
async def get_accounting_settings():
    """Returns current Accounting Module status and operational mode."""
    from app.core.config import settings
    mode = getattr(settings, "ACCOUNTING_MODE", "DISABLED").upper()
    return {
        "accounting_mode": mode,
        "is_enabled": mode != "DISABLED",
        "description": "SMRITI Retail OS Standalone Platform. Accounting is a plug-in module."
    }


@router.get("/accounts", response_model=List[ChartOfAccountsResponse])
async def list_chart_of_accounts(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Retrieves Chart of Accounts (COA) for the tenant."""
    service = AccountingService(db, tenant)
    await service.seed_chart_of_accounts()
    accounts = await service.repo.get_all_accounts()
    return accounts


@router.post("/accounts", response_model=ChartOfAccountsResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: ChartOfAccountsCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """Creates a custom chart of account entry."""
    service = AccountingService(db, tenant)
    existing = await service.repo.get_account_by_code(payload.account_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Account code '{payload.account_code}' already exists.")

    import uuid
    from app.models.accounting import ChartOfAccounts
    account = ChartOfAccounts(
        id=f"COA-{payload.account_code}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant.tenant_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        account_code=payload.account_code,
        account_name=payload.account_name,
        account_type=payload.account_type,
        balance_type=payload.balance_type,
        parent_id=payload.parent_id,
        currency=payload.currency,
        description=payload.description
    )
    created = await service.repo.create_account(account)
    await db.commit()
    return created


@router.post("/vouchers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def post_journal_voucher(
    payload: JournalVoucherCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Posts a double-entry journal voucher transactionally."""
    service = AccountingService(db, tenant)
    entries = [
        JournalEntry(
            account_code=e.account_code,
            account_name=e.account_name,
            debit=e.debit,
            credit=e.credit,
            narration=e.narration,
            cost_center=e.cost_center,
            project=e.project
        ) for e in payload.entries
    ]
    voucher = JournalVoucher(
        ref_document_type=payload.ref_document_type,
        ref_document_id=payload.ref_document_id,
        ref_document_no=payload.ref_document_no,
        entries=entries,
        narration=payload.narration,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id
    )
    voucher_id = await service.post_journal(voucher)
    return {"id": voucher_id, "message": "Journal Voucher posted successfully.", "is_balanced": True}


# ---------------------------------------------------------------------------
# Bank Account Endpoints (Task B-1 / B-2)
# ---------------------------------------------------------------------------

@router.get("/bank-accounts", response_model=List[BankAccountResponse])
async def list_bank_accounts(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Lists company bank accounts."""
    service = AccountingService(db, tenant)
    return await service.list_bank_accounts()


@router.post("/bank-accounts", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    payload: BankAccountCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Registers a new bank account."""
    service = AccountingService(db, tenant)
    res = await service.create_bank_account(payload.model_dump())
    await db.commit()
    return res


# ---------------------------------------------------------------------------
# Cost Center Endpoints (Task B-6)
# ---------------------------------------------------------------------------

@router.get("/cost-centers", response_model=List[CostCenterResponse])
async def list_cost_centers(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Lists cost centers."""
    service = AccountingService(db, tenant)
    return await service.list_cost_centers()


@router.post("/cost-centers", response_model=CostCenterResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    payload: CostCenterCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Creates a new cost center."""
    service = AccountingService(db, tenant)
    res = await service.create_cost_center(payload.model_dump())
    await db.commit()
    return res


# ---------------------------------------------------------------------------
# TDS Entry Endpoints (Task B-5)
# ---------------------------------------------------------------------------

@router.get("/tds", response_model=List[TdsEntryResponse])
async def list_tds_entries(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Lists Tax Deducted at Source (TDS) entries."""
    service = AccountingService(db, tenant)
    return await service.list_tds_entries()


@router.post("/tds", response_model=TdsEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_tds_entry(
    payload: TdsEntryCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Registers a TDS deduction entry."""
    service = AccountingService(db, tenant)
    res = await service.create_tds_entry(payload.model_dump())
    await db.commit()
    return res


# ---------------------------------------------------------------------------
# Financial Statements & Ageing Reports (Task B-7, B-8)
# ---------------------------------------------------------------------------

@router.get("/reports/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    as_of_date: Optional[str] = Query(None, description="ISO date format YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Generates Trial Balance report."""
    service = AccountingService(db, tenant)
    return await service.get_trial_balance(as_of_date=as_of_date)


@router.get("/reports/profit-loss", response_model=ProfitLossResponse)
async def get_profit_and_loss(
    start_date: Optional[str] = Query(None, description="Start Date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End Date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Generates Profit & Loss (Income Statement) report."""
    service = AccountingService(db, tenant)
    return await service.get_profit_and_loss(start_date=start_date, end_date=end_date)


@router.get("/reports/balance-sheet", response_model=BalanceSheetResponse)
async def get_balance_sheet(
    as_of_date: Optional[str] = Query(None, description="As Of Date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Generates Balance Sheet report (Assets = Liabilities + Equity)."""
    service = AccountingService(db, tenant)
    return await service.get_balance_sheet(as_of_date=as_of_date)


@router.get("/reports/ap-ageing", response_model=AgeingReportResponse)
async def get_ap_ageing_report(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Generates Accounts Payable (AP) Ageing report."""
    service = AccountingService(db, tenant)
    return await service.get_ap_ageing_report()


@router.get("/reports/ar-ageing", response_model=AgeingReportResponse)
async def get_ar_ageing_report(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Generates Accounts Receivable (AR) Ageing report."""
    service = AccountingService(db, tenant)
    return await service.get_ar_ageing_report()
