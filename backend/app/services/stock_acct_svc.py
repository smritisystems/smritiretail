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

import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, func, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.inventory import StockMovement, Product, Warehouse
from ..models.accounting import Account, JournalVoucher, GeneralLedgerEntry
from ..schemas.stock_acct import (
    StockMovementRecordRequest,
    StockMovementResponse,
    StockDriftItem,
    StockBalanceRebuildResponse,
    JournalVoucherCreateRequest,
    JournalVoucherResponse,
    StockReconciliationReport,
    GlReconciliationReport,
    FinancialReconciliationReport,
)

INFLOW_MOVEMENT_TYPES = {"IN", "INWARD_GRN", "ADJUSTMENT_IN", "TRANSFER_IN", "RETURN_INWARD"}
OUTFLOW_MOVEMENT_TYPES = {"OUT", "OUTWARD_SALE", "ADJUSTMENT_OUT", "TRANSFER_OUT", "RETURN_OUTWARD"}


class StockAccountingBoundaryService:
    """
    Authoritative Stock and Accounting Boundaries Service (P1.3).
    Guarantees immutable stock movement auditing, dynamic balance rebuilds,
    strict double-entry ledger invariants, and automated reconciliation jobs.
    """

    @classmethod
    async def record_stock_movement(
        cls,
        session: AsyncSession,
        company_id: str,
        req: StockMovementRecordRequest,
        user_id: Optional[str] = None,
    ) -> StockMovement:
        """
        Atomically records an authoritative immutable stock movement and updates materialized on-hand stock.
        """
        if req.quantity <= 0:
            raise ValueError("Stock movement quantity must be strictly positive.")

        m_type = req.movement_type.upper()
        if m_type not in INFLOW_MOVEMENT_TYPES and m_type not in OUTFLOW_MOVEMENT_TYPES:
            raise ValueError(f"Invalid stock movement type '{req.movement_type}'.")

        # Resolve Product
        stmt = select(Product).where(Product.id == req.product_id)
        product = (await session.execute(stmt)).scalars().first()
        if not product:
            # Check by SKU
            stmt_sku = select(Product).where(Product.sku == req.product_id)
            product = (await session.execute(stmt_sku)).scalars().first()

        if not product:
            raise ValueError(f"Product '{req.product_id}' not found.")

        # Check if warehouse_id is valid FK
        wh_id = None
        if req.warehouse_id:
            stmt_wh = select(Warehouse.id).where(Warehouse.id == req.warehouse_id)
            wh_match = (await session.execute(stmt_wh)).scalars().first()
            if wh_match:
                wh_id = wh_match

        # Create immutable movement record
        movement = StockMovement(
            id=f"sm_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or "SKU-UNKNOWN",
            quantity=Decimal(str(req.quantity)),
            movement_type=m_type,
            reference_doc_type=req.reference_doc_type,
            reference_doc_id=req.reference_doc_id,
            warehouse_id=wh_id,
            warehouse=req.warehouse or req.warehouse_id,
            bin=req.bin,
            batch=req.batch,
            serial=req.serial,
            unit_cost=Decimal(str(req.unit_cost or product.cost_price or 0.00)),
            remarks=req.remarks,
            user=user_id,
            source_module=req.source_module or "INVENTORY",
        )
        session.add(movement)

        # Update materialized product stock
        delta = int(req.quantity) if m_type in INFLOW_MOVEMENT_TYPES else -int(req.quantity)
        current_stock = int(product.stock or 0)
        product.stock = current_stock + delta

        await session.commit()
        return movement

    @classmethod
    async def rebuild_materialized_balances_from_movements(
        cls,
        session: AsyncSession,
        company_id: str,
        fix_drift: bool = False,
    ) -> StockBalanceRebuildResponse:
        """
        Calculates authoritative on-hand stock for every product by summing all immutable stock_movements.
        Compares computed balances against materialized product.stock to detect and optionally rectify drift.
        """
        # Fetch all products
        stmt_p = select(Product)
        products = (await session.execute(stmt_p)).scalars().all()

        drift_items = []
        clean_count = 0
        drift_count = 0

        for p in products:
            # Sum movements
            stmt_m = select(StockMovement).where(StockMovement.product_id == p.id)
            movements = (await session.execute(stmt_m)).scalars().all()

            computed_qty = Decimal("0.00")
            for m in movements:
                m_type = m.movement_type.upper()
                if m_type in INFLOW_MOVEMENT_TYPES:
                    computed_qty += Decimal(str(m.quantity))
                elif m_type in OUTFLOW_MOVEMENT_TYPES:
                    computed_qty -= Decimal(str(m.quantity))

            materialized_qty = Decimal(str(p.stock or 0))
            drift = materialized_qty - computed_qty
            has_drift = abs(drift) > Decimal("0.001")

            if has_drift:
                drift_count += 1
                status = "OVERSTATED" if drift > 0 else "UNDERSTATED"
                if fix_drift:
                    p.stock = int(computed_qty)
            else:
                clean_count += 1
                status = "BALANCED"

            drift_items.append(
                StockDriftItem(
                    product_id=p.id,
                    sku=p.sku or "UNKNOWN",
                    product_name=p.name,
                    materialized_on_hand=float(materialized_qty),
                    computed_from_movements=float(computed_qty),
                    drift_quantity=float(drift),
                    has_drift=has_drift,
                    status=status,
                )
            )

        if fix_drift and drift_count > 0:
            await session.commit()

        return StockBalanceRebuildResponse(
            company_id=company_id,
            total_products_checked=len(products),
            balanced_products_count=clean_count,
            drift_products_count=drift_count,
            items=drift_items,
            reconciliation_status="CLEAN" if drift_count == 0 else "DRIFT_DETECTED",
        )

    @classmethod
    async def post_balanced_journal_voucher(
        cls,
        session: AsyncSession,
        company_id: str,
        req: JournalVoucherCreateRequest,
        created_by: Optional[str] = None,
    ) -> JournalVoucherResponse:
        """
        Enforces strict double-entry equality invariant (Total Debits == Total Credits).
        Rejects unbalanced financial vouchers with a fail-closed error.
        """
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for line in req.entries:
            d = Decimal(str(line.debit_amount))
            c = Decimal(str(line.credit_amount))
            if d < 0 or c < 0:
                raise ValueError("Journal entry amounts cannot be negative.")
            total_debit += d
            total_credit += c

        diff = abs(total_debit - total_credit)
        if diff > Decimal("0.001"):
            raise ValueError(
                f"Double-entry balance violation: Total Debits ({float(total_debit):.2f}) != Total Credits ({float(total_credit):.2f}). Out of balance by {float(diff):.2f}."
            )

        v_no = req.voucher_no or f"JV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        voucher = JournalVoucher(
            id=f"jv_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            voucher_no=v_no,
            voucher_type=req.voucher_type,
            voucher_date=datetime.strptime(req.voucher_date, "%Y-%m-%d").date() if req.voucher_date else date.today(),
            posting_date=datetime.now(timezone.utc),
            reference_doc_type=req.reference_doc_type,
            reference_doc_id=req.reference_doc_id,
            reference_doc_no=req.reference_doc_no,
            narration=req.narration,
            currency="INR",
            exchange_rate=Decimal("1.000000"),
            total_foreign_debit=total_debit,
            total_foreign_credit=total_credit,
            total_debit=total_debit,
            total_credit=total_credit,
            is_posted=True,
            created_by=created_by,
        )
        session.add(voucher)
        await session.flush()

        for line in req.entries:
            # Resolve or create Account
            stmt_acc = select(Account).where(
                Account.account_code == line.account_code,
            )
            account = (await session.execute(stmt_acc)).scalars().first()
            if not account:
                # Auto-provision system account if not found
                account = Account(
                    id=f"acc_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    account_code=line.account_code,
                    account_name=line.account_name or line.account_code,
                    account_type="EXPENSE" if line.debit_amount > 0 else "REVENUE",
                    root_type="EXPENSE" if line.debit_amount > 0 else "INCOME",
                    is_group=False,
                    currency="INR",
                    is_active=True,
                    is_system=False,
                )
                session.add(account)
                await session.flush()

            gl_entry = GeneralLedgerEntry(
                id=f"gle_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                voucher_id=voucher.id,
                account_id=account.id,
                party_id=line.party_id,
                entry_date=voucher.voucher_date,
                posting_date=voucher.posting_date,
                debit_amount=Decimal(str(line.debit_amount)),
                credit_amount=Decimal(str(line.credit_amount)),
                currency="INR",
                foreign_currency="INR",
                exchange_rate=Decimal("1.000000"),
                foreign_debit_amount=Decimal(str(line.debit_amount)),
                foreign_credit_amount=Decimal(str(line.credit_amount)),
                reference_doc_type=req.reference_doc_type,
                reference_doc_id=req.reference_doc_id,
                remarks=line.remarks,
            )
            session.add(gl_entry)

        await session.commit()
        return JournalVoucherResponse(
            voucher_id=voucher.id,
            voucher_no=voucher.voucher_no,
            voucher_type=voucher.voucher_type,
            total_debit=float(total_debit),
            total_credit=float(total_credit),
            is_balanced=True,
            is_posted=True,
            entries_count=len(req.entries),
            message=f"Journal voucher '{voucher.voucher_no}' posted successfully with balanced double-entry GL lines.",
        )

    @classmethod
    async def run_stock_reconciliation(
        cls,
        session: AsyncSession,
        company_id: str,
    ) -> StockReconciliationReport:
        """Audits complete stock movement ledger vs current on-hand stock."""
        rebuild_res = await cls.rebuild_materialized_balances_from_movements(session, company_id, fix_drift=False)
        total_mov = (await session.execute(select(func.count(StockMovement.id)))).scalar() or 0

        drift_items = [item for item in rebuild_res.items if item.has_drift]

        return StockReconciliationReport(
            company_id=company_id,
            audit_timestamp=datetime.now(timezone.utc).isoformat(),
            total_movements_logged=total_mov,
            total_products_audited=rebuild_res.total_products_checked,
            clean_products=rebuild_res.balanced_products_count,
            drift_products=rebuild_res.drift_products_count,
            drift_items=drift_items,
            is_healthy=len(drift_items) == 0,
        )

    @classmethod
    async def run_gl_reconciliation(
        cls,
        session: AsyncSession,
        company_id: str,
    ) -> GlReconciliationReport:
        """Audits trial balance equality and per-voucher balance invariants."""
        # 1. Total GL debits vs credits
        stmt_tot = select(
            func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), 0),
            func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), 0),
        )
        tot_deb, tot_cred = (await session.execute(stmt_tot)).first() or (0, 0)
        tot_deb_dec = Decimal(str(tot_deb))
        tot_cred_dec = Decimal(str(tot_cred))
        tb_drift = abs(tot_deb_dec - tot_cred_dec)

        # 2. Check each voucher
        stmt_vouchers = select(JournalVoucher).options(selectinload(JournalVoucher.entries))
        vouchers = (await session.execute(stmt_vouchers)).scalars().all()

        unbalanced_ids = []
        for v in vouchers:
            v_deb = sum(Decimal(str(e.debit_amount)) for e in v.entries)
            v_cred = sum(Decimal(str(e.credit_amount)) for e in v.entries)
            if abs(v_deb - v_cred) > Decimal("0.001"):
                unbalanced_ids.append(v.id)

        is_healthy = tb_drift <= Decimal("0.001") and len(unbalanced_ids) == 0

        return GlReconciliationReport(
            company_id=company_id,
            audit_timestamp=datetime.now(timezone.utc).isoformat(),
            total_vouchers_checked=len(vouchers),
            unbalanced_vouchers_count=len(unbalanced_ids),
            total_gl_debits=float(tot_deb_dec),
            total_gl_credits=float(tot_cred_dec),
            trial_balance_drift=float(tb_drift),
            is_trial_balance_equal=tb_drift <= Decimal("0.001"),
            unbalanced_voucher_ids=unbalanced_ids,
            is_healthy=is_healthy,
        )

    @classmethod
    async def run_financial_reconciliation(
        cls,
        session: AsyncSession,
        company_id: str,
    ) -> FinancialReconciliationReport:
        """Comprehensive multi-ledger reconciliation combining Stock, General Ledger, and Trial Balance checks."""
        stock_rep = await cls.run_stock_reconciliation(session, company_id)
        gl_rep = await cls.run_gl_reconciliation(session, company_id)

        overall_healthy = stock_rep.is_healthy and gl_rep.is_healthy
        return FinancialReconciliationReport(
            company_id=company_id,
            audit_timestamp=datetime.now(timezone.utc).isoformat(),
            stock_status=stock_rep,
            gl_status=gl_rep,
            overall_health="HEALTHY" if overall_healthy else "DRIFT_DETECTED",
        )
