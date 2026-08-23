"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.17.1 (Phase 1 — POS Checkout)
* Created    : 2026-07-11
* Modified   : 2026-08-17
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import uuid
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.pos import CashRegister, Shift, ShiftCashTransaction
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inventory import Product, StockMovement
from ..api.deps import TenantContext
from ..repositories.pos import CashRegisterRepository, ShiftRepository
from ..schemas.pos import (
    CashRegisterCreate, ShiftOpen, ShiftClose,
    ShiftCashInRequest, ShiftCashDropRequest, ShiftTillExpenseRequest,
    POSCheckoutRequest,
)



class POSService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    # ──────────────────────────────────────────────────────────────
    # Cash Register
    # ──────────────────────────────────────────────────────────────

    async def create_register(self, req: CashRegisterCreate) -> CashRegister:
        reg = CashRegister(
            id=req.id, name=req.name, code=req.code, notes=req.notes,
            is_active=True, is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(reg)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A cash register with this ID or code already exists. "
                       "Please use a different register code.",
            )
        await self.db.refresh(reg)
        return reg

    async def list_registers(self) -> list[CashRegister]:
        res = await self.db.execute(
            select(CashRegister).where(
                CashRegister.company_id == self.tenant.company_id,
                CashRegister.branch_id  == self.tenant.branch_id,
                CashRegister.is_deleted == False,
            )
        )
        return res.scalars().all()

    async def get_register(self, register_id: str) -> CashRegister:
        repo = CashRegisterRepository(self.db, self.tenant)
        reg = await repo.get(register_id)
        if not reg:
            raise HTTPException(status_code=404, detail="Cash register not found.")
        return reg

    # ──────────────────────────────────────────────────────────────
    # POS Profile CRUD  (frontend POSProfile ↔ CashRegister)
    # ──────────────────────────────────────────────────────────────

    async def create_profile(self, req: "POSProfileCreate") -> CashRegister:  # type: ignore[name-defined]
        """Create a CashRegister from the frontend POS profile form."""
        import uuid as _uuid
        # Auto-derive a short code from the name if not provided
        code = f"REG-{_uuid.uuid4().hex[:6].upper()}"
        reg = CashRegister(
            id=f"PROF-{_uuid.uuid4().hex[:8].upper()}",
            name=req.name,
            code=code,
            notes=req.notes,
            cashier=req.cashier,
            warehouse=req.warehouse,
            is_locked=False,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(reg)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A profile with this name already exists. Please use a different name.",
            )
        await self.db.refresh(reg)
        return reg

    async def clone_register(self, register_id: str) -> CashRegister:
        """Clone a CashRegister — copies all fields with a new ID and code."""
        import uuid as _uuid
        src = await self.get_register(register_id)
        clone = CashRegister(
            id=f"PROF-{_uuid.uuid4().hex[:8].upper()}",
            name=f"{src.name} (Copy)",
            code=f"REG-{_uuid.uuid4().hex[:6].upper()}",
            notes=src.notes,
            cashier=src.cashier,
            warehouse=src.warehouse,
            is_locked=False,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(clone)
        await self.db.commit()
        await self.db.refresh(clone)
        return clone

    async def archive_register(self, register_id: str) -> CashRegister:
        """Soft-delete a CashRegister (archive). Sets is_deleted=True, is_active=False."""
        from datetime import datetime, timezone
        reg = await self.get_register(register_id)
        reg.is_deleted = True
        reg.is_active = False
        reg.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(reg)
        return reg

    async def toggle_lock_register(self, register_id: str) -> CashRegister:
        """Flip the is_locked state of a CashRegister."""
        reg = await self.get_register(register_id)
        reg.is_locked = not reg.is_locked
        await self.db.commit()
        await self.db.refresh(reg)
        return reg

    async def list_shifts(self) -> list:
        """List all shifts for this tenant (supports App.tsx shifts state)."""
        shift_repo = ShiftRepository(self.db, self.tenant)
        return await shift_repo.get_all_recent(limit=100)

    # ──────────────────────────────────────────────────────────────
    # Shift — open
    # ──────────────────────────────────────────────────────────────

    async def get_shift(self, shift_id: str, for_update: bool = False) -> Shift:
        stmt = select(Shift).where(
            Shift.id == shift_id,
            Shift.company_id == self.tenant.company_id,
            Shift.branch_id == self.tenant.branch_id,
            Shift.is_deleted == False,
        )
        if for_update:
            stmt = stmt.with_for_update()
        res = await self.db.execute(stmt)
        shift = res.scalars().first()
        if not shift:
            raise HTTPException(status_code=404, detail=f"Shift {shift_id} not found.")
        return shift

    async def open_shift(self, req: ShiftOpen, cashier_id: str) -> Shift:
        """
        Open a new shift on a register with row lock concurrency control.
        """
        await self.get_register(req.register_id)

        # Concurrency guard: Lock check for any open shift on this register
        active_stmt = select(Shift).where(
            Shift.register_id == req.register_id,
            Shift.company_id == self.tenant.company_id,
            Shift.branch_id == self.tenant.branch_id,
            Shift.status == "OPEN",
            Shift.is_deleted == False,
        ).with_for_update()
        active_shift = (await self.db.execute(active_stmt)).scalars().first()
        if active_shift:
            raise HTTPException(
                status_code=400,
                detail="This register already has an open shift. Please close the current shift before opening a new one.",
            )

        if req.opening_balance < Decimal("0.00"):
            raise HTTPException(
                status_code=400,
                detail="Opening balance cannot be negative.",
            )

        shift = Shift(
            id=req.id,
            register_id=req.register_id,
            cashier_id=cashier_id,
            status="OPEN",
            opened_at=datetime.now(timezone.utc),
            opening_balance=req.opening_balance,
            cash_sales_total=Decimal("0.00"),
            card_sales_total=Decimal("0.00"),
            upi_sales_total=Decimal("0.00"),
            total_sales=Decimal("0.00"),
            total_invoices="0",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(shift)
        try:
            await self.db.commit()
        except IntegrityError as e:
            await self.db.rollback()
            # Prefer structured constraint identification over fragile error-string parsing.
            # asyncpg / psycopg2 both expose the constraint name via diag or pgcode.
            # PG unique_violation code = '23505'
            is_unique_violation = False
            constraint_name: Optional[str] = None

            orig = getattr(e, "orig", None)
            if orig is not None:
                # asyncpg: orig has .sqlstate or .constraint_name
                pgcode = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)
                if pgcode == "23505":
                    is_unique_violation = True
                # psycopg2 wraps constraint name in diag
                diag = getattr(orig, "diag", None)
                if diag is not None:
                    constraint_name = getattr(diag, "constraint_name", None)
                # asyncpg provides constraint_name directly
                if constraint_name is None:
                    constraint_name = getattr(orig, "constraint_name", None)

            # Fallback: parse constraint name from the error string if driver did not expose it
            if constraint_name is None:
                err_str = str(orig or e).lower()
                if "uq_shifts_active_per_register" in err_str:
                    constraint_name = "uq_shifts_active_per_register"
                elif is_unique_violation and "register_id" in err_str:
                    constraint_name = "uq_shifts_active_per_register"

            if constraint_name == "uq_shifts_active_per_register":
                raise HTTPException(
                    status_code=400,
                    detail="This register already has an open shift. Please close the current shift before opening a new one.",
                )
            raise HTTPException(
                status_code=400,
                detail="A shift with this ID already exists.",
            )
        await self.db.refresh(shift)
        return shift

    # ──────────────────────────────────────────────────────────────
    # Mid-Shift Cash Movements (Cash In, Cash Drop & Till Expense)
    # ──────────────────────────────────────────────────────────────

    async def record_cash_in(
        self,
        shift_id: str,
        req: ShiftCashInRequest,
        requesting_user_id: str,
        requesting_user_role: Optional[str] = None
    ) -> ShiftCashTransaction:
        """
        Record a mid-shift cash injection (till float increase) from vault/safe into drawer.
        Automatically posts a balanced double-entry Journal Voucher:
            Debit: Cash in Hand (1010)
            Credit: Bank / Safe Account (1020 / custom)
        Includes row-level locking (SELECT FOR UPDATE) and payload-bound idempotency deduplication.
        """
        if req.amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Cash In amount must be strictly greater than zero.")

        # Concurrency row-level lock on shift
        shift = await self.get_shift(shift_id, for_update=True)
        if shift.status != "OPEN":
            raise HTTPException(status_code=400, detail="Cannot record cash in on a closed shift.")

        # Idempotency deduplication check with full request fingerprint equivalence validation
        if req.idempotency_key:
            existing_sct = (await self.db.execute(
                select(ShiftCashTransaction).where(
                    ShiftCashTransaction.shift_id == shift_id,
                    ShiftCashTransaction.idempotency_key == req.idempotency_key,
                    ShiftCashTransaction.company_id == self.tenant.company_id,
                    ShiftCashTransaction.is_deleted == False,
                )
            )).scalars().first()
            if existing_sct:
                if (
                    existing_sct.amount != req.amount.quantize(Decimal("0.01"))
                    or existing_sct.transaction_type != "CASH_IN"
                    or existing_sct.reason != req.reason
                    or (req.source_account_id and existing_sct.account_id != req.source_account_id)
                ):
                    raise HTTPException(
                        status_code=409,
                        detail=f"Idempotency key '{req.idempotency_key}' collision: request fingerprint differs from previous request."
                    )
                return existing_sct

        # Strict service-level authorization check: only managers/admins may override default source accounts
        if req.source_account_id and requesting_user_role not in ("MANAGER", "SYSADMIN", "SUPERADMIN"):
            raise HTTPException(
                status_code=403,
                detail="Manager authorization required to specify custom GL source account overrides."
            )

        # ── Cash In Source Balance Policy ──────────────────────────────────────────
        # SMRITI POS Treasury Float Policy (ADR-POS-001):
        #   Cash In is a manager-authorized treasury float injection from a bank or
        #   vault account (e.g. Account 1020 — Bank, or a configured safe account).
        #   Source-account balance validation is deliberately NOT enforced here because:
        #     (a) Treasury float operations are pre-authorized at the manager level
        #         (enforced above via RBAC guard on requesting_user_role).
        #     (b) Source-account liquidity is governed by the accounting department
        #         through the Chart of Accounts and General Ledger, not the POS terminal.
        #     (c) Blocking a float injection due to a transient GL balance discrepancy
        #         would prevent legitimate operations at the point of sale.
        #
        #   The double-entry GL posting (Debit 1010 / Credit source account) creates
        #   the accounting record. Any resulting negative source balance is visible in
        #   the GL trial balance and must be resolved by the accounting team, not the POS.
        #
        #   If a future business requirement mandates source-balance validation,
        #   implement it as a separate manager-override approval workflow, not
        #   an inline POS guard.
        # ──────────────────────────────────────────────────────────────────────────

        from .unified_accounting_ledger_service import UnifiedAccountingLedgerService
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            self.db, self.tenant.company_id, self.tenant.branch_id
        )

        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(self.db, self.tenant.company_id, "1010")

        if req.source_account_id:
            acc_source = await UnifiedAccountingLedgerService.get_account_by_id(self.db, self.tenant.company_id, req.source_account_id)
            if not acc_source:
                raise HTTPException(status_code=400, detail=f"Source account {req.source_account_id} not found.")
            if not acc_source.is_active or acc_source.is_deleted:
                raise HTTPException(status_code=400, detail=f"Source account {req.source_account_id} is inactive or disabled.")
            if acc_source.is_group:
                raise HTTPException(status_code=400, detail=f"Source account {req.source_account_id} is a parent group account, not a posting ledger.")
            if acc_source.account_type != "ASSET":
                raise HTTPException(status_code=400, detail=f"Source account must be an Asset/Bank/Vault account, got {acc_source.account_type}.")
            if acc_source.id == acc_cash.id:
                raise HTTPException(status_code=400, detail="Source account cannot be the Cash in Hand drawer account.")
        else:
            acc_source = await UnifiedAccountingLedgerService.get_account_by_code(self.db, self.tenant.company_id, "1020")

        effective_idempotency_key = req.idempotency_key or f"auto-in-{uuid.uuid4().hex[:12]}"
        sct_id = f"sct-in-{uuid.uuid4().hex[:8]}"
        sct = ShiftCashTransaction(
            id=sct_id,
            uuid=str(uuid.uuid4()),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            shift_id=shift.id,
            transaction_type="CASH_IN",
            amount=req.amount.quantize(Decimal("0.01")),
            account_id=acc_source.id,
            reason=req.reason,
            performed_by=requesting_user_id,
            created_by=requesting_user_id,
            receipt_ref=req.receipt_ref,
            idempotency_key=effective_idempotency_key,
        )
        try:
            self.db.add(sct)
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            if req.idempotency_key:
                res = await self.db.execute(
                    select(ShiftCashTransaction).where(
                        ShiftCashTransaction.shift_id == shift_id,
                        ShiftCashTransaction.idempotency_key == req.idempotency_key,
                        ShiftCashTransaction.company_id == self.tenant.company_id,
                    )
                )
                existing = res.scalars().first()
                if existing:
                    if (
                        existing.amount != req.amount.quantize(Decimal("0.01"))
                        or existing.transaction_type != "CASH_IN"
                        or existing.reason != req.reason
                        or (req.source_account_id and existing.account_id != req.source_account_id)
                    ):
                        raise HTTPException(
                            status_code=409,
                            detail=f"Idempotency key '{req.idempotency_key}' collision: request fingerprint differs from previous request."
                        )
                    return existing
            raise HTTPException(status_code=400, detail="Database integrity error during cash movement insertion.")

        lines = [
            {
                "account_id": acc_cash.id,
                "debit_amount": req.amount.quantize(Decimal("0.01")),
                "credit_amount": Decimal("0.00"),
                "remarks": f"Mid-shift cash in to Register {shift.register_id} Shift {shift.id}: {req.reason}"
            },
            {
                "account_id": acc_source.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": req.amount.quantize(Decimal("0.01")),
                "remarks": f"Cash vault transfer to register {shift.register_id}"
            }
        ]

        voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=self.db,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            voucher_type="CASH_IN",
            voucher_date=datetime.now(timezone.utc).date(),
            lines=lines,
            reference_doc_type="POS_CASH_IN",
            reference_doc_id=sct.id,
            reference_doc_no=f"IN-{shift.id[:8]}",
            narration=f"POS Cash In - {req.reason}",
            created_by=requesting_user_id
        )

        sct.gl_voucher_id = voucher.id
        sct.gl_voucher_no = voucher.voucher_no

        shift.cash_in_total = (Decimal(str(shift.cash_in_total or 0.00)) + req.amount).quantize(Decimal("0.01"))
        shift.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(sct)
        return sct

    async def record_cash_drop(
        self,
        shift_id: str,
        req: ShiftCashDropRequest,
        requesting_user_id: str,
        requesting_user_role: Optional[str] = None
    ) -> ShiftCashTransaction:
        """
        Record a mid-shift cash drop (till skim) from drawer to safe/bank.
        Automatically posts a balanced double-entry Journal Voucher:
            Debit: Bank / Safe Account (1020 / custom)
            Credit: Cash in Hand (1010)
        Includes row-level locking (SELECT FOR UPDATE) and payload-bound idempotency deduplication.
        """
        if req.amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Cash drop amount must be strictly greater than zero.")

        # Concurrency row-level lock on shift
        shift = await self.get_shift(shift_id, for_update=True)
        if shift.status != "OPEN":
            raise HTTPException(status_code=400, detail="Cannot record a cash drop on a closed shift.")

        # Idempotency deduplication check with full request fingerprint equivalence validation
        if req.idempotency_key:
            existing_sct = (await self.db.execute(
                select(ShiftCashTransaction).where(
                    ShiftCashTransaction.shift_id == shift_id,
                    ShiftCashTransaction.idempotency_key == req.idempotency_key,
                    ShiftCashTransaction.company_id == self.tenant.company_id,
                    ShiftCashTransaction.is_deleted == False,
                )
            )).scalars().first()
            if existing_sct:
                if (
                    existing_sct.amount != req.amount.quantize(Decimal("0.01"))
                    or existing_sct.transaction_type != "CASH_DROP"
                    or existing_sct.reason != req.reason
                    or (req.target_account_id and existing_sct.account_id != req.target_account_id)
                ):
                    raise HTTPException(
                        status_code=409,
                        detail=f"Idempotency key '{req.idempotency_key}' collision: request fingerprint differs from previous request."
                    )
                return existing_sct

        # Strict service-level authorization check: only managers/admins may override default target accounts
        if req.target_account_id and requesting_user_role not in ("MANAGER", "SYSADMIN", "SUPERADMIN"):
            raise HTTPException(
                status_code=403,
                detail="Manager authorization required to specify custom GL target account overrides."
            )

        # Check available cash in drawer under row lock
        invoices_res = await self.db.execute(
            select(func.coalesce(func.sum(SalesInvoice.grand_total), 0)).where(
                SalesInvoice.shift_id == shift_id,
                SalesInvoice.payment_mode == "CASH",
                SalesInvoice.is_deleted == False,
            )
        )
        cash_sales = Decimal(str(invoices_res.scalar() or 0.00))
        available_cash = (
            shift.opening_balance +
            cash_sales +
            Decimal(str(shift.cash_in_total or 0.00)) -
            Decimal(str(shift.cash_drops_total or 0.00)) -
            Decimal(str(shift.till_expenses_total or 0.00))
        )
        if req.amount > available_cash:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient cash in drawer ({available_cash:.2f}) for requested amount ({req.amount:.2f})."
            )

        from .unified_accounting_ledger_service import UnifiedAccountingLedgerService
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            self.db, self.tenant.company_id, self.tenant.branch_id
        )

        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(self.db, self.tenant.company_id, "1010")

        if req.target_account_id:
            acc_target = await UnifiedAccountingLedgerService.get_account_by_id(self.db, self.tenant.company_id, req.target_account_id)
            if not acc_target:
                raise HTTPException(status_code=400, detail=f"Target account {req.target_account_id} not found.")
            if not acc_target.is_active or acc_target.is_deleted:
                raise HTTPException(status_code=400, detail=f"Target account {req.target_account_id} is inactive or disabled.")
            if acc_target.is_group:
                raise HTTPException(status_code=400, detail=f"Target account {req.target_account_id} is a parent group account, not a posting ledger.")
            if acc_target.account_type != "ASSET":
                raise HTTPException(status_code=400, detail=f"Target account must be an Asset/Bank/Vault account, got {acc_target.account_type}.")
            if acc_target.id == acc_cash.id:
                raise HTTPException(status_code=400, detail="Target account cannot be the Cash in Hand drawer account.")
        else:
            acc_target = await UnifiedAccountingLedgerService.get_account_by_code(self.db, self.tenant.company_id, "1020")

        effective_idempotency_key = req.idempotency_key or f"auto-drop-{uuid.uuid4().hex[:12]}"
        sct_id = f"sct-drop-{uuid.uuid4().hex[:8]}"
        sct = ShiftCashTransaction(
            id=sct_id,
            uuid=str(uuid.uuid4()),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            shift_id=shift.id,
            transaction_type="CASH_DROP",
            amount=req.amount.quantize(Decimal("0.01")),
            account_id=acc_target.id,
            reason=req.reason,
            performed_by=requesting_user_id,
            created_by=requesting_user_id,
            receipt_ref=req.receipt_ref,
            idempotency_key=effective_idempotency_key,
        )
        try:
            self.db.add(sct)
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            if req.idempotency_key:
                res = await self.db.execute(
                    select(ShiftCashTransaction).where(
                        ShiftCashTransaction.shift_id == shift_id,
                        ShiftCashTransaction.idempotency_key == req.idempotency_key,
                        ShiftCashTransaction.company_id == self.tenant.company_id,
                    )
                )
                existing = res.scalars().first()
                if existing:
                    if (
                        existing.amount != req.amount.quantize(Decimal("0.01"))
                        or existing.transaction_type != "CASH_DROP"
                        or existing.reason != req.reason
                        or (req.target_account_id and existing.account_id != req.target_account_id)
                    ):
                        raise HTTPException(
                            status_code=409,
                            detail=f"Idempotency key '{req.idempotency_key}' collision: request fingerprint differs from previous request."
                        )
                    return existing
            raise HTTPException(status_code=400, detail="Database integrity error during cash movement insertion.")

        lines = [
            {
                "account_id": acc_target.id,
                "debit_amount": req.amount.quantize(Decimal("0.01")),
                "credit_amount": Decimal("0.00"),
                "remarks": f"Mid-shift cash drop from Register {shift.register_id} Shift {shift.id}: {req.reason}"
            },
            {
                "account_id": acc_cash.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": req.amount.quantize(Decimal("0.01")),
                "remarks": f"Cash drawer transfer on Register {shift.register_id}"
            }
        ]

        voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=self.db,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            voucher_type="CASH_DROP",
            voucher_date=datetime.now(timezone.utc).date(),
            lines=lines,
            reference_doc_type="POS_CASH_DROP",
            reference_doc_id=sct.id,
            reference_doc_no=f"DROP-{shift.id[:8]}",
            narration=f"POS Cash Drop - {req.reason}",
            created_by=requesting_user_id
        )

        sct.gl_voucher_id = voucher.id
        sct.gl_voucher_no = voucher.voucher_no

        shift.cash_drops_total = (Decimal(str(shift.cash_drops_total or 0.00)) + req.amount).quantize(Decimal("0.01"))
        shift.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(sct)
        return sct

    async def record_till_expense(
        self,
        shift_id: str,
        req: ShiftTillExpenseRequest,
        requesting_user_id: str,
        requesting_user_role: Optional[str] = None
    ) -> ShiftCashTransaction:
        """
        Record a mid-shift petty expense payout from drawer.
        Automatically posts a balanced double-entry Journal Voucher:
            Debit: Expense Account (5000 / custom)
            Credit: Cash in Hand (1010)
        Includes row-level locking (SELECT FOR UPDATE) and payload-bound idempotency deduplication.
        """
        if req.amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Till expense amount must be strictly greater than zero.")

        # Concurrency row-level lock on shift
        shift = await self.get_shift(shift_id, for_update=True)
        if shift.status != "OPEN":
            raise HTTPException(status_code=400, detail="Cannot record till expense on a closed shift.")

        # Idempotency deduplication check with full request fingerprint equivalence validation
        if req.idempotency_key:
            existing_sct = (await self.db.execute(
                select(ShiftCashTransaction).where(
                    ShiftCashTransaction.shift_id == shift_id,
                    ShiftCashTransaction.idempotency_key == req.idempotency_key,
                    ShiftCashTransaction.company_id == self.tenant.company_id,
                    ShiftCashTransaction.is_deleted == False,
                )
            )).scalars().first()
            if existing_sct:
                if (
                    existing_sct.amount != req.amount.quantize(Decimal("0.01"))
                    or existing_sct.transaction_type != "TILL_EXPENSE"
                    or existing_sct.reason != req.reason
                    or (req.expense_account_id and existing_sct.account_id != req.expense_account_id)
                ):
                    raise HTTPException(
                        status_code=409,
                        detail=f"Idempotency key '{req.idempotency_key}' collision: request fingerprint differs from previous request."
                    )
                return existing_sct

        # Strict service-level authorization check: only managers/admins may override default expense accounts
        if req.expense_account_id and requesting_user_role not in ("MANAGER", "SYSADMIN", "SUPERADMIN"):
            raise HTTPException(
                status_code=403,
                detail="Manager authorization required to specify custom GL expense account overrides."
            )

        # Check available cash in drawer under row lock
        invoices_res = await self.db.execute(
            select(func.coalesce(func.sum(SalesInvoice.grand_total), 0)).where(
                SalesInvoice.shift_id == shift_id,
                SalesInvoice.payment_mode == "CASH",
                SalesInvoice.is_deleted == False,
            )
        )
        cash_sales = Decimal(str(invoices_res.scalar() or 0.00))
        available_cash = (
            shift.opening_balance +
            cash_sales +
            Decimal(str(shift.cash_in_total or 0.00)) -
            Decimal(str(shift.cash_drops_total or 0.00)) -
            Decimal(str(shift.till_expenses_total or 0.00))
        )
        if req.amount > available_cash:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient cash in drawer ({available_cash:.2f}) for requested amount ({req.amount:.2f})."
            )

        from .unified_accounting_ledger_service import UnifiedAccountingLedgerService
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            self.db, self.tenant.company_id, self.tenant.branch_id
        )

        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(self.db, self.tenant.company_id, "1010")

        if req.expense_account_id:
            acc_exp = await UnifiedAccountingLedgerService.get_account_by_id(self.db, self.tenant.company_id, req.expense_account_id)
            if not acc_exp:
                raise HTTPException(status_code=400, detail=f"Expense account {req.expense_account_id} not found.")
            if not acc_exp.is_active or acc_exp.is_deleted:
                raise HTTPException(status_code=400, detail=f"Expense account {req.expense_account_id} is inactive or disabled.")
            if acc_exp.is_group:
                raise HTTPException(status_code=400, detail=f"Expense account {req.expense_account_id} is a parent group account, not a posting ledger.")
            if acc_exp.account_type != "EXPENSE" and not acc_exp.account_code.startswith("5"):
                raise HTTPException(status_code=400, detail=f"Expense account must be of type EXPENSE, got {acc_exp.account_type}.")
        else:
            acc_exp = await UnifiedAccountingLedgerService.get_account_by_code(self.db, self.tenant.company_id, "5000")

        effective_idempotency_key = req.idempotency_key or f"auto-exp-{uuid.uuid4().hex[:12]}"
        sct_id = f"sct-exp-{uuid.uuid4().hex[:8]}"
        sct = ShiftCashTransaction(
            id=sct_id,
            uuid=str(uuid.uuid4()),
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            shift_id=shift.id,
            transaction_type="TILL_EXPENSE",
            amount=req.amount.quantize(Decimal("0.01")),
            account_id=acc_exp.id,
            reason=req.reason,
            receipt_ref=req.receipt_ref,
            performed_by=requesting_user_id,
            created_by=requesting_user_id,
            idempotency_key=effective_idempotency_key,
        )
        try:
            self.db.add(sct)
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            if req.idempotency_key:
                res = await self.db.execute(
                    select(ShiftCashTransaction).where(
                        ShiftCashTransaction.shift_id == shift_id,
                        ShiftCashTransaction.idempotency_key == req.idempotency_key,
                        ShiftCashTransaction.company_id == self.tenant.company_id,
                    )
                )
                existing = res.scalars().first()
                if existing:
                    if (
                        existing.amount != req.amount.quantize(Decimal("0.01"))
                        or existing.transaction_type != "TILL_EXPENSE"
                        or existing.reason != req.reason
                        or (req.expense_account_id and existing.account_id != req.expense_account_id)
                    ):
                        raise HTTPException(
                            status_code=409,
                            detail=f"Idempotency key '{req.idempotency_key}' collision: request fingerprint differs from previous request."
                        )
                    return existing
            raise HTTPException(status_code=400, detail="Database integrity error during cash movement insertion.")

        lines = [
            {
                "account_id": acc_exp.id,
                "debit_amount": req.amount.quantize(Decimal("0.01")),
                "credit_amount": Decimal("0.00"),
                "remarks": f"Mid-shift till expense from Register {shift.register_id} Shift {shift.id}: {req.reason}"
            },
            {
                "account_id": acc_cash.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": req.amount.quantize(Decimal("0.01")),
                "remarks": f"Cash drawer payout on Register {shift.register_id}"
            }
        ]

        voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=self.db,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            voucher_type="TILL_EXPENSE",
            voucher_date=datetime.now(timezone.utc).date(),
            lines=lines,
            reference_doc_type="POS_TILL_EXPENSE",
            reference_doc_id=sct.id,
            reference_doc_no=f"EXP-{shift.id[:8]}",
            narration=f"POS Till Expense - {req.reason}",
            created_by=requesting_user_id
        )

        sct.gl_voucher_id = voucher.id
        sct.gl_voucher_no = voucher.voucher_no

        shift.till_expenses_total = (Decimal(str(shift.till_expenses_total or 0.00)) + req.amount).quantize(Decimal("0.01"))
        shift.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(sct)
        return sct

    # ──────────────────────────────────────────────────────────────
    # Shift — close
    # ──────────────────────────────────────────────────────────────

    async def close_shift(
        self,
        shift_id: str,
        req: ShiftClose,
        requesting_user_id: str,
        requesting_user_role: Optional[str] = None
    ) -> Shift:
        """
        Close a shift with pessimistic row locking and payload-bound idempotency protection.
        """
        shift = await self.get_shift(shift_id, for_update=True)
        if shift.status == "CLOSED":
            if req.idempotency_key:
                if req.closing_balance is not None and shift.closing_balance is not None:
                    if req.closing_balance.quantize(Decimal("0.01")) != shift.closing_balance:
                        raise HTTPException(
                            status_code=409,
                            detail="Idempotency key collision: closing payload differs from previously closed shift."
                        )
                if req.closing_notes and shift.closing_notes and req.closing_notes != shift.closing_notes:
                    raise HTTPException(
                        status_code=409,
                        detail="Idempotency key collision: closing notes differ from previously closed shift."
                    )
                return shift
            raise HTTPException(
                status_code=400,
                detail="This shift has already been closed.",
            )

        # Operational Authorization Check:
        # Only the cashier who opened the shift, or a MANAGER/SYSADMIN/SUPERADMIN can close it
        if requesting_user_id != shift.cashier_id and requesting_user_role not in ("MANAGER", "SYSADMIN", "SUPERADMIN"):
            raise HTTPException(
                status_code=403,
                detail="Cashiers are only permitted to close their own shifts. Manager authorization required to close another cashier's shift."
            )

        # Aggregate invoices linked to this shift
        invoices_res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.shift_id   == shift_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoices = invoices_res.scalars().all()

        cash_total = Decimal("0.00")
        card_total = Decimal("0.00")
        upi_total  = Decimal("0.00")
        total      = Decimal("0.00")

        for inv in invoices:
            gt = Decimal(str(inv.grand_total)) if inv.grand_total else Decimal("0.00")
            mode = (inv.payment_mode or "CASH").upper()
            if mode == "CASH":
                cash_total += gt
            elif mode == "CARD":
                card_total += gt
            elif mode == "UPI":
                upi_total += gt
            total += gt

        # Handle closing balance and physical denomination count
        if req.denominations is not None:
            counted_balance = req.denominations.calculate_total()
            shift.denominations = req.denominations.model_dump(mode="json")
            closing_balance = counted_balance
        elif req.closing_balance is not None:
            closing_balance = Decimal(str(req.closing_balance)).quantize(Decimal("0.01"))
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either closing_balance or physical denomination breakdown."
            )

        # Net expected cash in register:
        # Expected = Opening + Cash Sales + Cash In - Cash Drops - Till Expenses
        expected = (
            shift.opening_balance +
            cash_total +
            Decimal(str(shift.cash_in_total or 0.00)) -
            Decimal(str(shift.cash_drops_total or 0.00)) -
            Decimal(str(shift.till_expenses_total or 0.00))
        ).quantize(Decimal("0.01"))

        variance = (closing_balance - expected).quantize(Decimal("0.01"))

        shift.status           = "CLOSED"
        shift.closed_at        = datetime.now(timezone.utc)
        shift.cash_sales_total = cash_total.quantize(Decimal("0.01"))
        shift.card_sales_total = card_total.quantize(Decimal("0.01"))
        shift.upi_sales_total  = upi_total.quantize(Decimal("0.01"))
        shift.total_sales      = total.quantize(Decimal("0.01"))
        shift.total_invoices   = str(len(invoices))
        shift.closing_balance  = closing_balance
        shift.expected_cash    = expected
        shift.variance         = variance
        shift.closing_notes    = req.closing_notes
        shift.modified_at      = datetime.now(timezone.utc)

        await self.db.flush()

        # Trigger automated double-entry GL balancing voucher for shift close variance
        from .unified_accounting_ledger_service import UnifiedAccountingLedgerService
        await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            shift_id=shift.id,
            branch_id=self.tenant.branch_id,
            created_by=requesting_user_id
        )

        await self.db.commit()
        await self.db.refresh(shift)
        return shift


    # ──────────────────────────────────────────────────────────────
    # Shift — queries
    # ──────────────────────────────────────────────────────────────

    async def list_shifts(self, register_id: str | None = None) -> list[Shift]:
        q = select(Shift).where(
            Shift.company_id == self.tenant.company_id,
            Shift.branch_id  == self.tenant.branch_id,
            Shift.is_deleted == False,
        )
        if register_id:
            q = q.where(Shift.register_id == register_id)
        res = await self.db.execute(q)
        return res.scalars().all()

    async def get_shift(self, shift_id: str, for_update: bool = False) -> Shift:
        stmt = select(Shift).where(
            Shift.id == shift_id,
            Shift.company_id == self.tenant.company_id,
            Shift.branch_id == self.tenant.branch_id,
            Shift.is_deleted == False,
        )
        if for_update:
            stmt = stmt.with_for_update()
        res = await self.db.execute(stmt)
        shift = res.scalars().first()
        if not shift:
            raise HTTPException(status_code=404, detail=f"Shift {shift_id} not found.")
        return shift

    async def get_active_shift(self, register_id: str) -> Shift:
        """Get the currently open shift for a register."""
        repo = ShiftRepository(self.db, self.tenant)
        shift = await repo.get_active_shift(register_id)
        if not shift:
            raise HTTPException(
                status_code=404,
                detail="No open shift found for this register. "
                       "Please open a shift before processing sales.",
            )
        return shift

    async def get_z_report(self, shift_id: str) -> dict:
        """
        Generate authoritative Z-Report data for a shift, including sales breakdown,
        cash drops, till expenses, physical denomination counts, cash tender reconciliation,
        and linked General Ledger balancing voucher.
        """
        shift = await self.get_shift(shift_id)

        # Look up linked GL journal voucher if any
        from ..models.accounting import JournalVoucher
        stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == self.tenant.company_id,
            JournalVoucher.reference_doc_type == "POS_SHIFT",
            JournalVoucher.reference_doc_id == shift.id,
            JournalVoucher.is_deleted == False
        )
        voucher = (await self.db.execute(stmt)).scalar_one_or_none()

        # Fetch cash movements
        sct_stmt = select(ShiftCashTransaction).where(
            ShiftCashTransaction.shift_id == shift.id,
            ShiftCashTransaction.company_id == self.tenant.company_id,
            ShiftCashTransaction.is_deleted == False
        ).order_by(ShiftCashTransaction.created_at.asc())
        cash_movements = (await self.db.execute(sct_stmt)).scalars().all()

        return {
            "shift_id": shift.id,
            "register_id": shift.register_id,
            "cashier_id": shift.cashier_id,
            "status": shift.status,
            "opened_at": shift.opened_at,
            "closed_at": shift.closed_at,
            "opening_balance": shift.opening_balance,
            "cash_sales_total": shift.cash_sales_total,
            "card_sales_total": shift.card_sales_total,
            "upi_sales_total": shift.upi_sales_total,
            "total_sales": shift.total_sales,
            "total_invoices": int(shift.total_invoices or 0),
            "cash_drops_total": shift.cash_drops_total or Decimal("0.00"),
            "till_expenses_total": shift.till_expenses_total or Decimal("0.00"),
            "cash_in_total": shift.cash_in_total or Decimal("0.00"),
            "expected_cash": shift.expected_cash or shift.opening_balance,
            "closing_balance": shift.closing_balance or Decimal("0.00"),
            "variance": shift.variance or Decimal("0.00"),
            "denominations": shift.denominations,
            "closing_notes": shift.closing_notes,
            "gl_voucher_id": voucher.id if voucher else None,
            "gl_voucher_no": voucher.voucher_no if voucher else None,
            "company_id": shift.company_id,
            "branch_id": shift.branch_id,
            "cash_movements": [
                {
                    "id": m.id,
                    "shift_id": m.shift_id,
                    "transaction_type": m.transaction_type,
                    "amount": m.amount,
                    "account_id": m.account_id,
                    "reason": m.reason,
                    "performed_by": m.performed_by,
                    "gl_voucher_id": m.gl_voucher_id,
                    "gl_voucher_no": m.gl_voucher_no,
                    "receipt_ref": m.receipt_ref,
                    "created_at": m.created_at
                }
                for m in cash_movements
            ]
        }



    # ───────────────────────────────────────────────────────────────
    # POS Checkout  (Phase 1 — replaces Express in-memory bills[])
    # ───────────────────────────────────────────────────────────────

    async def pos_checkout(self, req: POSCheckoutRequest) -> dict:
        """
        Process a POS sale:
        1. Validate shift is OPEN and belongs to this tenant.
        2. Idempotency: if invoice_no already exists, return it (cached=True).
        3. Deduct stock and record StockMovement for each tracked product.
        4. Persist SalesInvoice with shift_id set.
        5. Handle race-condition duplicate via IntegrityError catch.

        Returns {"invoice": SalesInvoice, "shift": Shift, "cached": bool}
        """
        # 1. Validate shift with pessimistic row locking to prevent race with shift close
        shift = await self.get_shift(req.shift_id, for_update=True)
        if shift.status != "OPEN":
            raise HTTPException(
                status_code=400,
                detail="The shift is not open. Please open a shift before processing sales.",
            )

        # 2. Idempotency check (pre-insert)
        existing_res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.invoice_no == req.invoice_no,
                SalesInvoice.company_id == self.tenant.company_id,
                SalesInvoice.is_deleted == False,
            )
        )
        if (existing_inv := existing_res.scalars().first()):
            return {"invoice": existing_inv, "shift": shift, "cached": True}

        # 3. Compute totals and build item records
        tax_total   = Decimal("0.00")
        grand_total = Decimal("0.00")
        invoice_id  = uuid.uuid4().hex[:8]
        db_items:   list[SalesInvoiceItem] = []
        movements:  list[StockMovement]    = []

        for item in req.items:
            qty   = item.quantity
            price = item.price
            gst   = item.gst_rate

            item_tax   = (qty * price * gst / Decimal("100.00")).quantize(Decimal("0.0001"))
            item_total = (qty * price + item_tax).quantize(Decimal("0.01"))
            tax_total   += item_tax
            grand_total += item_total

            db_items.append(SalesInvoiceItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=qty,
                price=price,
                hsn_code=item.hsn_code,
                gst_rate=gst,
                tax_amount=item_tax,
                total_amount=item_total,
            ))

            # Stock deduction
            prod_res = await self.db.execute(
                select(Product).where(
                    Product.id         == item.product_id,
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id  == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = prod_res.scalars().first()
            if product and product.tracking_mode != "No-stock":
                if product.stock < int(qty):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for '{item.name}'. "
                               f"Available: {product.stock}, requested: {int(qty)}.",
                    )
                product.modified_at = datetime.now(timezone.utc)
                self.db.add(product)

                movement_id = (
                    f"SM-{int(datetime.now(timezone.utc).timestamp())}-"
                    f"{uuid.uuid4().hex[:6]}"
                )
                movements.append(StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-qty,
                    movement_type="OUT",
                    reference_doc_type="POS Invoice",
                    reference_doc_id=invoice_id,
                    warehouse="Default Warehouse",
                    unit_cost=product.cost_price or product.price,
                    remarks=f"POS sale: {req.invoice_no}",
                    source_module="POS",
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                ))

        # 4. Apply bill-level discount
        if req.bill_discount_val and req.bill_discount_val > 0:
            if req.bill_discount_type == "percent":
                discount = (
                    grand_total * req.bill_discount_val / Decimal("100")
                ).quantize(Decimal("0.01"))
            else:
                discount = req.bill_discount_val
            grand_total = max(Decimal("0.00"), grand_total - discount)

        # 5. Persist invoice
        from datetime import date as _date
        invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=req.invoice_no,
            date=_date.today(),
            customer_id=req.customer_id,
            shift_id=req.shift_id,
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=grand_total.quantize(Decimal("0.01")),
            payment_mode=req.payment_mode.upper(),
            status="Submitted",
            items=db_items,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(invoice)
        for m in movements:
            self.db.add(m)

        # Record Transactional Outbox event atomically within same DB transaction
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "POS_SALE_COMPLETED",
                "invoice_no": req.invoice_no,
                "grand_total": str(grand_total),
                "company_code": self.tenant.company_id,
                "item_count": len(db_items)
            },
            causation_id=req.invoice_no
        )

        try:
            await self.db.commit()
        except IntegrityError:
            # Race condition: concurrent request with same invoice_no committed first
            await self.db.rollback()
            race_res = await self.db.execute(
                select(SalesInvoice).where(
                    SalesInvoice.invoice_no == req.invoice_no,
                    SalesInvoice.company_id == self.tenant.company_id,
                    SalesInvoice.is_deleted == False,
                )
            )
            race_inv = race_res.scalars().first()
            if race_inv:
                return {"invoice": race_inv, "shift": shift, "cached": True}
            raise HTTPException(
                status_code=400,
                detail="A billing conflict occurred. Please try again.",
            )

        await self.db.refresh(invoice)
        await self.db.refresh(shift)
        return {"invoice": invoice, "shift": shift, "cached": False}

