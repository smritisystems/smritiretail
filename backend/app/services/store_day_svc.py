"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.122.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

EOD Phase 3 - Store Business-Day Service
========================================
Implements store-day open / close / lock lifecycle and the cross-shift
EOD aggregation API.

Design constraints:
  - No shadow aggregation tables. All totals computed at query time from
    authoritative ledger tables (shifts, shift_cash_transactions, sales,
    compliance_immutable_audit_logs, pos_offline_sync_queue, approval_requests).
  - Store-day close is blocked while any cashier shift at the branch is OPEN or
    a closed shift for the business date is still unassigned.
  - Pending approvals or offline sync also block close unless force=True.
  - Null actor_user_id renders as "Unknown / not recorded" -- never invent identity.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, date, time, timedelta
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.pos import StoreBusinessDay, StoreDayShiftAssignment, Shift
from ..models.approval import ApprovalRequest
from ..models.audit import ComplianceImmutableAuditLog
from ..api.deps import TenantContext
from ..services.compliance_audit import ComplianceAuditService


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _business_date_for_timestamp(value: datetime) -> date:
    timestamp = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(ZoneInfo("Asia/Kolkata")).date()


def _business_day_utc_range(business_date: date) -> tuple[datetime, datetime]:
    business_timezone = ZoneInfo("Asia/Kolkata")
    start = datetime.combine(business_date, time.min, tzinfo=business_timezone).astimezone(timezone.utc)
    end = datetime.combine(business_date + timedelta(days=1), time.min, tzinfo=business_timezone).astimezone(timezone.utc)
    return start, end


def _dec(val) -> Decimal:
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val))


class StoreDayService:
    """
    Manages the Store Business Day lifecycle and provides the cross-shift
    EOD aggregation report and employee activity timeline.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext) -> None:
        self.db = db
        self.tenant = tenant

    async def list_store_days(
        self,
        branch_id: str,
        business_date: date,
    ) -> list[StoreBusinessDay]:
        result = await self.db.execute(
            select(StoreBusinessDay).where(
                and_(
                    StoreBusinessDay.company_id == self.tenant.company_id,
                    StoreBusinessDay.branch_id == branch_id,
                    StoreBusinessDay.business_date == business_date,
                    StoreBusinessDay.is_deleted == False,
                )
            ).order_by(StoreBusinessDay.opened_at.desc())
        )
        return result.scalars().all()

    # -- Open -----------------------------------------------------------------

    async def open_store_day(
        self,
        branch_id: str,
        business_date: date,
        opened_by: str,
    ) -> StoreBusinessDay:
        """Open a new store business day. Raises ValueError if one is already OPEN."""
        existing = await self._get_open_day(branch_id)
        if existing:
            raise ValueError(
                f"A store business day is already OPEN for branch {branch_id} "
                f"(id={existing.id}, date={existing.business_date}). "
                "Close the current day before opening a new one."
            )
        day = StoreBusinessDay(
            id=_new_id(),
            uuid=str(uuid.uuid4()),
            company_id=self.tenant.company_id,
            branch_id=branch_id,
            business_date=business_date,
            status="OPEN",
            opened_at=_now(),
            opened_by=opened_by,
        )
        self.db.add(day)
        await self.db.flush()
        return day

    # -- Assign shift to day --------------------------------------------------

    async def assign_shift_to_day(
        self,
        store_day_id: str,
        shift_id: str,
        assigned_by: str,
    ) -> StoreDayShiftAssignment:
        """Link a closed shift to the matching open business day in the same branch."""
        day = await self._get_day_or_raise(store_day_id)
        if day.status != "OPEN":
            raise ValueError("A shift can only be assigned to an OPEN store business day.")

        shift_result = await self.db.execute(
            select(Shift).where(
                Shift.id == shift_id,
                Shift.company_id == self.tenant.company_id,
                Shift.branch_id == day.branch_id,
                Shift.is_deleted == False,
            )
        )
        shift = shift_result.scalar_one_or_none()
        if not shift:
            raise ValueError("The cashier shift was not found in this branch.")
        if shift.status != "CLOSED" or not shift.closed_at:
            raise ValueError("Only a closed cashier shift can be assigned to a Store Day.")
        if _business_date_for_timestamp(shift.closed_at) != day.business_date:
            raise ValueError(
                "The cashier shift closed on a different business date and cannot be assigned to this Store Day."
            )

        existing = await self.db.execute(
            select(StoreDayShiftAssignment).where(
                StoreDayShiftAssignment.shift_id == shift_id,
            )
        )
        existing_assignment = existing.scalar_one_or_none()
        if existing_assignment and existing_assignment.store_day_id == day.id:
            return existing_assignment
        if existing_assignment:
            raise ValueError(f"Shift {shift_id} is already assigned to a store business day.")
        assignment = StoreDayShiftAssignment(
            id=_new_id(),
            uuid=str(uuid.uuid4()),
            company_id=self.tenant.company_id,
            branch_id=day.branch_id,
            store_day_id=store_day_id,
            shift_id=shift_id,
            assigned_at=_now(),
            assigned_by=assigned_by,
        )
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    # -- Close ----------------------------------------------------------------

    async def close_store_day(
        self,
        store_day_id: str,
        closed_by: str,
        sign_off_notes: Optional[str] = None,
        force: bool = False,
    ) -> StoreBusinessDay:
        """
        Close an OPEN store business day.
        Always blocked while a cashier shift remains OPEN. Pending ApprovalRequests
        or offline sync items may be bypassed with force=True (SYSADMIN only).
        """
        day = await self._get_day_or_raise(store_day_id)
        if day.status != "OPEN":
            raise ValueError(
                f"Store day {store_day_id} is not OPEN (current status: {day.status})."
            )
        open_shifts = await self._count_open_shifts(day.branch_id)
        if open_shifts > 0:
            raise ValueError(
                f"Cannot close store day: {open_shifts} cashier shift(s) are still OPEN "
                "for this branch. Close all register shifts first."
            )
        unassigned_shifts = await self._list_unassigned_closed_shifts(day)
        if unassigned_shifts:
            raise ValueError(
                f"Cannot close store day: {len(unassigned_shifts)} closed cashier shift(s) "
                "from this business date are not included in the EOD report. Assign them first."
            )
        if not force:
            pending_approvals = await self._count_pending_approvals(day.branch_id)
            if pending_approvals > 0:
                raise ValueError(
                    f"Cannot close store day: {pending_approvals} approval request(s) "
                    "are still PENDING. Resolve all exceptions before closing."
                )
            pending_sync = await self._count_pending_sync(day.branch_id)
            if pending_sync > 0:
                raise ValueError(
                    f"Cannot close store day: {pending_sync} offline transaction(s) "
                    "are pending synchronisation. Post or discard them first."
                )
        exception_summary = await self._build_exception_summary(day)
        day.status = "CLOSED"
        day.closed_at = _now()
        day.closed_by = closed_by
        day.sign_off_notes = sign_off_notes
        day.exception_summary_json = exception_summary
        day.modified_at = _now()
        await self.db.flush()
        return day

    # -- Lock -----------------------------------------------------------------

    async def lock_store_day(
        self,
        store_day_id: str,
        locked_by: str,
    ) -> StoreBusinessDay:
        """Lock a CLOSED store business day (final manager sign-off). Cannot be reopened."""
        day = await self._get_day_or_raise(store_day_id)
        if day.status != "CLOSED":
            raise ValueError(f"Only CLOSED days can be locked (current status: {day.status}).")
        day.status = "LOCKED"
        day.locked_at = _now()
        day.locked_by = locked_by
        day.modified_at = _now()
        await self.db.flush()
        return day

    # -- EOD Aggregation Report -----------------------------------------------

    async def get_eod_report(self, store_day_id: str) -> dict:
        """
        Cross-shift EOD aggregation report. All figures computed at query time
        from authoritative ledger tables. No shadow aggregation tables used.
        """
        day = await self._get_day_or_raise(store_day_id)

        result = await self.db.execute(
            select(StoreDayShiftAssignment).where(
                StoreDayShiftAssignment.store_day_id == store_day_id
            )
        )
        assignments = result.scalars().all()
        shift_ids = [a.shift_id for a in assignments]
        unassigned_shifts = await self._list_unassigned_closed_shifts(day)

        shifts_data = []
        store_totals = {
            "total_sales": Decimal("0.00"),
            "cash_sales": Decimal("0.00"),
            "card_sales": Decimal("0.00"),
            "upi_sales":  Decimal("0.00"),
            "total_invoices": 0,
            "cash_variance": Decimal("0.00"),
            "opening_balance_total": Decimal("0.00"),
            "closing_balance_total": Decimal("0.00"),
        }
        card_variance_total = Decimal("0.00")
        card_reconciled_shifts = 0
        upi_variance_total = Decimal("0.00")
        upi_reconciled_shifts = 0

        for sid in shift_ids:
            shift_row = await self.db.execute(select(Shift).where(Shift.id == sid))
            shift = shift_row.scalar_one_or_none()
            if not shift:
                continue

            expected = (
                _dec(shift.opening_balance)
                + _dec(shift.cash_sales_total)
                + _dec(shift.cash_in_total)
                - _dec(shift.cash_drops_total)
                - _dec(shift.till_expenses_total)
            )
            variance = (
                _dec(shift.closing_balance) - expected
                if shift.closing_balance is not None else None
            )

            shifts_data.append({
                "shift_id": shift.id,
                "cashier_id": shift.cashier_id,
                "status": shift.status,
                "opened_at": shift.opened_at.isoformat() if shift.opened_at else None,
                "closed_at": shift.closed_at.isoformat() if shift.closed_at else None,
                "opening_balance": str(_dec(shift.opening_balance)),
                "closing_balance": str(_dec(shift.closing_balance)) if shift.closing_balance else None,
                "expected_cash": str(expected),
                "cash_variance": str(variance) if variance is not None else None,
                "cash_sales": str(_dec(shift.cash_sales_total)),
                "card_sales": str(_dec(shift.card_sales_total)),
                "actual_card_counted": (
                    str(_dec(shift.actual_card_counted))
                    if shift.actual_card_counted is not None else None
                ),
                "card_variance": (
                    str(_dec(shift.card_variance))
                    if shift.card_variance is not None else None
                ),
                "upi_sales": str(_dec(shift.upi_sales_total)),
                "actual_upi_counted": (
                    str(_dec(shift.actual_upi_counted))
                    if shift.actual_upi_counted is not None else None
                ),
                "upi_variance": (
                    str(_dec(shift.upi_variance))
                    if shift.upi_variance is not None else None
                ),
                "total_sales": str(_dec(shift.total_sales)),
                "total_invoices": int(shift.total_invoices or 0),
            })

            store_totals["total_sales"] += _dec(shift.total_sales)
            store_totals["cash_sales"] += _dec(shift.cash_sales_total)
            store_totals["card_sales"] += _dec(shift.card_sales_total)
            store_totals["upi_sales"] += _dec(shift.upi_sales_total)
            store_totals["total_invoices"] += int(shift.total_invoices or 0)
            store_totals["opening_balance_total"] += _dec(shift.opening_balance)
            if shift.closing_balance is not None:
                store_totals["closing_balance_total"] += _dec(shift.closing_balance)
            if variance is not None:
                store_totals["cash_variance"] += variance
            if shift.actual_card_counted is not None and shift.card_variance is not None:
                card_variance_total += _dec(shift.card_variance)
                card_reconciled_shifts += 1
            if shift.actual_upi_counted is not None and shift.upi_variance is not None:
                upi_variance_total += _dec(shift.upi_variance)
                upi_reconciled_shifts += 1

        pending_approvals = await self._count_pending_approvals(day.branch_id)
        pending_sync = await self._count_pending_sync(day.branch_id)
        open_shifts = await self._count_open_shifts(day.branch_id)
        assigned_shift_count = len(shifts_data)

        return {
            "store_day_id": day.id,
            "branch_id": day.branch_id,
            "business_date": day.business_date.isoformat(),
            "status": day.status,
            "opened_at": day.opened_at.isoformat() if day.opened_at else None,
            "closed_at": day.closed_at.isoformat() if day.closed_at else None,
            "opened_by": day.opened_by,
            "closed_by": day.closed_by,
            "sign_off_notes": day.sign_off_notes,
            "store_totals": {k: str(v) if isinstance(v, Decimal) else v
                             for k, v in store_totals.items()},
            "shifts": shifts_data,
            "unassigned_closed_shifts": [
                {
                    "shift_id": shift.id,
                    "cashier_id": shift.cashier_id,
                    "closed_at": shift.closed_at.isoformat() if shift.closed_at else None,
                    "total_sales": str(_dec(shift.total_sales)),
                }
                for shift in unassigned_shifts
            ],
            "tender_reconciliation": {
                "assigned_shifts": assigned_shift_count,
                "card_reconciled_shifts": card_reconciled_shifts,
                "card_variance": (
                    str(card_variance_total)
                    if assigned_shift_count > 0 and card_reconciled_shifts == assigned_shift_count
                    else None
                ),
                "upi_reconciled_shifts": upi_reconciled_shifts,
                "upi_variance": (
                    str(upi_variance_total)
                    if assigned_shift_count > 0 and upi_reconciled_shifts == assigned_shift_count
                    else None
                ),
            },
            "open_shifts": open_shifts,
            "pending_approvals": pending_approvals,
            "pending_offline_sync": pending_sync,
            "exception_summary": day.exception_summary_json,
        }

    # -- Employee Activity ----------------------------------------------------

    async def get_employee_activity(
        self,
        branch_id: str,
        business_date: date,
        actor_id: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> dict:
        """
        Paginated employee activity timeline from compliance_immutable_audit_logs.
        Null actor_user_id always rendered as "Unknown / not recorded".
        """
        day_start = datetime(
            business_date.year, business_date.month, business_date.day,
            0, 0, 0, tzinfo=timezone.utc
        )
        day_end = day_start + timedelta(days=1)

        filters = [
            ComplianceImmutableAuditLog.branch_id == branch_id,
            ComplianceImmutableAuditLog.timestamp >= day_start,
            ComplianceImmutableAuditLog.timestamp < day_end,
        ]
        if actor_id:
            filters.append(ComplianceImmutableAuditLog.actor_user_id == actor_id)

        total_q = await self.db.execute(
            select(func.count()).select_from(ComplianceImmutableAuditLog)
            .where(and_(*filters))
        )
        total = total_q.scalar_one()

        rows_q = await self.db.execute(
            select(ComplianceImmutableAuditLog)
            .where(and_(*filters))
            .order_by(ComplianceImmutableAuditLog.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        logs = rows_q.scalars().all()

        events = []
        for log in logs:
            serialised = ComplianceAuditService.serialize_audit_log(log)
            if not serialised.get("actor_user_id"):
                serialised["actor_username"] = "Unknown / not recorded"
                serialised["actor_user_id"] = None
            events.append(serialised)

        return {
            "branch_id": branch_id,
            "business_date": business_date.isoformat(),
            "total": total,
            "limit": limit,
            "offset": offset,
            "events": events,
        }

    # -- Internal helpers -----------------------------------------------------

    async def _get_open_day(self, branch_id: str) -> Optional[StoreBusinessDay]:
        result = await self.db.execute(
            select(StoreBusinessDay).where(
                and_(
                    StoreBusinessDay.company_id == self.tenant.company_id,
                    StoreBusinessDay.branch_id == branch_id,
                    StoreBusinessDay.status == "OPEN",
                    StoreBusinessDay.is_deleted == False,
                )
            )
        )
        return result.scalar_one_or_none()

    async def _get_day_or_raise(self, store_day_id: str) -> StoreBusinessDay:
        result = await self.db.execute(
            select(StoreBusinessDay).where(
                StoreBusinessDay.id == store_day_id,
                StoreBusinessDay.company_id == self.tenant.company_id,
                StoreBusinessDay.is_deleted == False,
            )
        )
        day = result.scalar_one_or_none()
        if not day:
            raise ValueError(f"Store business day {store_day_id} not found.")
        return day

    async def _count_pending_approvals(self, branch_id: str) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(ApprovalRequest).where(
                and_(
                    ApprovalRequest.branch_id == branch_id,
                    ApprovalRequest.status == "PENDING",
                )
            )
        )
        return result.scalar_one() or 0

    async def _count_open_shifts(self, branch_id: str) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Shift).where(
                and_(
                    Shift.company_id == self.tenant.company_id,
                    Shift.branch_id == branch_id,
                    Shift.status == "OPEN",
                    Shift.is_deleted == False,
                )
            )
        )
        return result.scalar_one() or 0

    async def _list_unassigned_closed_shifts(self, day: StoreBusinessDay) -> list[Shift]:
        start, end = _business_day_utc_range(day.business_date)
        result = await self.db.execute(
            select(Shift)
            .outerjoin(
                StoreDayShiftAssignment,
                StoreDayShiftAssignment.shift_id == Shift.id,
            )
            .where(
                and_(
                    Shift.company_id == self.tenant.company_id,
                    Shift.branch_id == day.branch_id,
                    Shift.status == "CLOSED",
                    Shift.closed_at >= start,
                    Shift.closed_at < end,
                    Shift.is_deleted == False,
                    StoreDayShiftAssignment.id.is_(None),
                )
            )
            .order_by(Shift.closed_at)
        )
        return result.scalars().all()

    async def _count_pending_sync(self, branch_id: str) -> int:
        try:
            from ..models.sync import POSOfflineSyncQueue
            result = await self.db.execute(
                select(func.count()).select_from(POSOfflineSyncQueue).where(
                    and_(
                        POSOfflineSyncQueue.branch_id == branch_id,
                        POSOfflineSyncQueue.sync_status == "PENDING",
                    )
                )
            )
            return result.scalar_one() or 0
        except Exception:
            return 0

    async def _build_exception_summary(self, day: StoreBusinessDay) -> dict:
        """Snapshot exception counts at closing time (read-only historical record)."""
        return {
            "snapshotted_at": _now().isoformat(),
            "pending_approvals_at_close": await self._count_pending_approvals(day.branch_id),
            "pending_offline_sync_at_close": await self._count_pending_sync(day.branch_id),
        }
