"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

NumberingService -- Centralized document numbering for SMRITI Retail OS.

Usage:
    from app.services.numbering import NumberingService
    numbering = NumberingService()
    doc_no = await numbering.next("INV", "2026", session, branch_id="MUM", branch_code="MUM")
    # -> "INV-2026-000047"

All modules must use this service. No module generates its own document numbers.
"""

from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.platform import DocumentNumberSeries
from ..models.numbering import DocumentSeries, NumberingAuditLog


class NumberingService:
    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db

    """
    Atomic, branch-scoped document number generator.

    Key design decisions:
    - Uses SELECT ... FOR UPDATE to prevent race conditions under concurrent requests.
    - Auto-creates a series row if none exists (idempotent bootstrap).
    - Format string is configurable per series (stored in DB, not code).
    - Fiscal year is passed by caller; no implicit date logic here.
    """

    # Default format templates per prefix (used on auto-creation only)
    DEFAULT_FORMATS: dict[str, str] = {
        "INV":  "{PREFIX}-{FY}-{SEQ:06d}",   # INV-2026-000001
        "CT":   "{PREFIX}-{FY}-{SEQ:06d}",   # CT-2026-000001   (Consignment Transfer)
        "CSR":  "{PREFIX}-{FY}-{SEQ:06d}",   # CSR-2026-000001  (Consignment Sale Report)
        "CS":   "{PREFIX}-{FY}-{SEQ:06d}",   # CS-2026-000001   (Consignment Settlement)
        "CR":   "{PREFIX}-{FY}-{SEQ:06d}",   # CR-2026-000001   (Consignment Return)
        "PO":   "{PREFIX}-{FY}-{SEQ:06d}",   # PO-2026-000001   (Purchase Order)
        "SO":   "{PREFIX}-{FY}-{SEQ:06d}",   # SO-2026-000001   (Sales Order)
        "GRN":  "{PREFIX}-{FY}-{SEQ:06d}",   # GRN-2026-000001  (Goods Receipt)
        "CN":   "{PREFIX}-{FY}-{SEQ:06d}",   # CN-2026-000001   (Credit Note)
        "DN":   "{PREFIX}-{FY}-{SEQ:06d}",   # DN-2026-000001   (Debit Note)
        "SQ":   "{PREFIX}-{FY}-{SEQ:06d}",   # SQ-2026-000001   (Sales Quotation)
    }
    DEFAULT_FORMAT_FALLBACK = "{PREFIX}-{FY}-{SEQ:06d}"

    def _series_id(self, prefix: str, fiscal_year: str, branch_id: Optional[str]) -> str:
        """Deterministic ID for a DocumentNumberSeries row."""
        branch_part = branch_id or "GLOBAL"
        return f"NS-{prefix}-{fiscal_year}-{branch_part}"

    def _render(self, fmt: str, prefix: str, fiscal_year: str,
                branch_code: Optional[str], seq: int) -> str:
        """Render a format string with available placeholders."""
        fy_short = fiscal_year[-2:] if len(fiscal_year) >= 4 else fiscal_year
        return fmt.format(
            PREFIX=prefix,
            FY=fiscal_year,
            FY_SHORT=fy_short,
            BRANCH=branch_code or "",
            SEQ=seq,
        )

    async def next(
        self,
        prefix: str,
        fiscal_year: str,
        session: AsyncSession,
        *,
        branch_id: Optional[str] = None,
        branch_code: Optional[str] = None,
        company_id: Optional[str] = None,
    ) -> str:
        """
        Generate the next document number atomically.

        Args:
            prefix:      Document type code (INV, CT, CSR ...)
            fiscal_year: 4-digit year string (2026, 2027 ...)
            session:     Active async SQLAlchemy session (caller manages transaction)
            branch_id:   Branch FK (for scoping, optional)
            branch_code: Branch short code for format rendering (optional)
            company_id:  Company FK (for multi-tenant scoping, optional)

        Returns:
            Formatted document number string e.g. "INV-2026-000047"

        Raises:
            RuntimeError: If the series is locked (is_locked=True)
        """
        series_id = self._series_id(prefix, fiscal_year, branch_id)

        # Fetch with row-level lock to prevent concurrent duplicates
        result = await session.execute(
            select(DocumentNumberSeries)
            .where(DocumentNumberSeries.id == series_id)
            .with_for_update()
        )
        series = result.scalar_one_or_none()

        if series is None:
            # Auto-bootstrap: create series on first use
            fmt = self.DEFAULT_FORMATS.get(prefix, self.DEFAULT_FORMAT_FALLBACK)
            series = DocumentNumberSeries(
                id=series_id,
                prefix=prefix,
                fiscal_year=fiscal_year,
                branch_code=branch_code,
                branch_id=branch_id,
                company_id=company_id,
                last_seq=0,
                pad_length=6,
                format_str=fmt,
                description=f"Auto-created series for {prefix} / {fiscal_year}",
            )
            session.add(series)
            await session.flush()  # get row in DB before update

        if series.is_locked:
            raise RuntimeError(
                f"Document series '{prefix}/{fiscal_year}' is locked. "
                "Contact system administrator."
            )

        # Atomic increment
        new_seq = series.last_seq + 1
        series.last_seq = new_seq
        series.modified_at = datetime.now(timezone.utc)
        await session.flush()

        return self._render(series.format_str, prefix, fiscal_year, branch_code, new_seq)

    async def preview_next(
        self,
        prefix: str,
        fiscal_year: str,
        session: AsyncSession,
        *,
        branch_id: Optional[str] = None,
        branch_code: Optional[str] = None,
    ) -> str:
        """
        Preview what the next number would be WITHOUT incrementing.
        Safe to call without a transaction lock.
        """
        series_id = self._series_id(prefix, fiscal_year, branch_id)
        result = await session.execute(
            select(DocumentNumberSeries).where(DocumentNumberSeries.id == series_id)
        )
        series = result.scalar_one_or_none()
        next_seq = (series.last_seq + 1) if series else 1
        fmt = (series.format_str if series else
               self.DEFAULT_FORMATS.get(prefix, self.DEFAULT_FORMAT_FALLBACK))
        return self._render(fmt, prefix, fiscal_year, branch_code, next_seq)

    async def reset(
        self,
        prefix: str,
        fiscal_year: str,
        session: AsyncSession,
        *,
        branch_id: Optional[str] = None,
        new_start: int = 0,
    ) -> None:
        """
        Reset a series counter. Requires series to NOT be locked.
        Use for fiscal year rollover or test setup only.
        """
        series_id = self._series_id(prefix, fiscal_year, branch_id)
        result = await session.execute(
            select(DocumentNumberSeries)
            .where(DocumentNumberSeries.id == series_id)
            .with_for_update()
        )
        series = result.scalar_one_or_none()
        if series and not series.is_locked:
            series.last_seq = new_start
            series.modified_at = datetime.now(timezone.utc)
            await session.flush()

    async def get_series(self, company_code: str, document_type: str) -> Optional[DocumentSeries]:
        q = (
            select(DocumentSeries)
            .where(
                DocumentSeries.company_code == company_code,
                DocumentSeries.document_type == document_type,
                DocumentSeries.is_deleted == False,
            )
        )
        res = await self.db.execute(q)
        return res.scalars().first()

    async def create_series(self, data, creator: str, commit: bool = True) -> DocumentSeries:
        new_id = f"SER-{uuid.uuid4().hex[:8]}"
        series = DocumentSeries(
            id=new_id,
            name=data.name,
            document_type=data.documentType,
            module=data.module,
            prefix=data.prefix,
            suffix=data.suffix,
            running_length=data.runningLength,
            reset_rule=data.resetRule,
            current_number=data.currentNumber,
            last_reset_key=None,
            financial_year=data.financialYear,
            company_code=data.companyCode,
            mode=data.mode,
            description=data.description,
            is_active=True,
            is_deleted=False,
            created_by=creator,
            updated_by=creator,
        )
        self.db.add(series)
        
        # Write to audit log
        log = NumberingAuditLog(
            id=f"NAL-{uuid.uuid4().hex[:8]}",
            series_id=series.id,
            series_name=series.name,
            action="CREATE",
            document_no="",
            old_value="",
            new_value="0",
            details=f"Initialized document series config for {series.document_type}",
            operator=creator
        )
        self.db.add(log)
        
        if commit:
            await self.db.commit()
        else:
            await self.db.flush()
        await self.db.refresh(series)
        return series

    async def allocate_voucher_number(self, series_id: str, branch: str, fy: str, username: str) -> str:
        """
        Allocate next voucher sequence number atomically using FOR UPDATE lock on DocumentSeries.
        """
        # Execute FOR UPDATE query to lock this row in transaction
        q = select(DocumentSeries).where(DocumentSeries.id == series_id, DocumentSeries.is_deleted == False).with_for_update()
        res = await self.db.execute(q)
        series = res.scalars().first()
        if not series:
            raise HTTPException(status_code=404, detail="Document series configuration not found.")

        # Determine current date/keys for resets
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = str(now.month).zfill(2)
        current_day = str(now.day).zfill(2)

        current_key = "Never"
        if series.reset_rule == "Daily":
            current_key = f"{current_year}-{current_month}-{current_day}"
        elif series.reset_rule == "Monthly":
            current_key = f"{current_year}-{current_month}"
        elif series.reset_rule == "Financial Year":
            fy_year = current_year if now.month >= 4 else current_year - 1
            current_key = f"{fy_year}-{fy_year + 1}"
        elif series.reset_rule == "Calendar Year":
            current_key = str(current_year)

        # Trigger reset sequence if reset key changes
        if series.reset_rule != "Never":
            if not series.last_reset_key:
                series.last_reset_key = current_key
            elif series.last_reset_key != current_key:
                series.last_reset_key = current_key
                series.current_number = 0

        old_num = series.current_number
        next_num = old_num + 1
        series.current_number = next_num

        # Zero-pad number sequence
        formatted_num = str(next_num).zfill(series.running_length or 6)

        # Token replacement inside prefix
        pfx = series.prefix or ""
        pfx = pfx.replace("{FY}", fy)
        pfx = pfx.replace("{Branch}", branch)
        pfx = pfx.replace("{Store}", branch)
        pfx = pfx.replace("{Month}", current_month)
        pfx = pfx.replace("{Year}", str(current_year))
        pfx = pfx.replace("{Date}", current_day)
        pfx = pfx.replace("{User}", username)
        pfx = pfx.replace("{Module}", series.module or "")

        # Token replacement inside suffix
        sfx = series.suffix or ""
        sfx = sfx.replace("{FY}", fy)
        sfx = sfx.replace("{Branch}", branch)
        sfx = sfx.replace("{Store}", branch)
        sfx = sfx.replace("{Month}", current_month)
        sfx = sfx.replace("{Year}", str(current_year))
        sfx = sfx.replace("{Date}", current_day)
        sfx = sfx.replace("{User}", username)
        sfx = sfx.replace("{Module}", series.module or "")

        allocated_no = f"{pfx}{formatted_num}{sfx}"

        # Write to audit ledger
        log = NumberingAuditLog(
            id=f"NAL-{uuid.uuid4().hex[:8]}",
            series_id=series.id,
            series_name=series.name,
            action="ALLOCATE",
            document_no=allocated_no,
            old_value=str(old_num),
            new_value=str(next_num),
            details=f"Allocated serial sequence atomically for {series.document_type}",
            operator=username
        )
        self.db.add(log)
        
        await self.db.commit()
        return allocated_no


# Module-level singleton
numbering_service = NumberingService()
