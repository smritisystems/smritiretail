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
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.platform import DocumentNumberSeries


class NumberingService:
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


# Module-level singleton
numbering_service = NumberingService()
