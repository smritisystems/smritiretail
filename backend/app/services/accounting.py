"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

AccountingService -- Financial posting stub for SMRITI Retail OS.

Architecture:
  v3.27.0: Stub -- logs posting intent to audit trail. Returns mock voucher ID.
            All modules call this service with real journal entry data.
  v3.30.x: Full double-entry General Ledger implementation replaces the stub.
            Zero module code changes required -- interface is stable.

Every module that touches money MUST call accounting_service.post_journal().
Never hardcode ledger logic inside business modules.
"""

import logging
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("smriti.accounting")


# ---------------------------------------------------------------------------
# Data classes (stable interface -- v3.30.x GL will use these unchanged)
# ---------------------------------------------------------------------------

@dataclass
class JournalEntry:
    """A single debit or credit line in a journal voucher."""
    account_code:  str            # Chart of accounts code (e.g. "4000-SALES")
    account_name:  str            # Human-readable name
    debit:         Decimal = Decimal("0.00")
    credit:        Decimal = Decimal("0.00")
    narration:     Optional[str] = None
    cost_center:   Optional[str] = None
    project:       Optional[str] = None

    def __post_init__(self):
        if self.debit < 0 or self.credit < 0:
            raise ValueError("Debit and credit amounts must be non-negative.")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("A journal entry line cannot have both debit and credit.")


@dataclass
class JournalVoucher:
    """A complete balanced journal voucher."""
    ref_document_type: str
    ref_document_id:   str
    ref_document_no:   str
    entries:           list[JournalEntry] = field(default_factory=list)
    narration:         Optional[str] = None
    voucher_date:      Optional[str] = None   # ISO date string
    company_id:        Optional[str] = None
    branch_id:         Optional[str] = None

    @property
    def total_debit(self) -> Decimal:
        return sum(e.debit for e in self.entries)

    @property
    def total_credit(self) -> Decimal:
        return sum(e.credit for e in self.entries)

    @property
    def is_balanced(self) -> bool:
        return self.total_debit == self.total_credit


# ---------------------------------------------------------------------------
# Standard account codes (seed values, configurable in v3.30.x)
# ---------------------------------------------------------------------------

class Accounts:
    SALES_REVENUE          = "4000-SALES"
    SALES_RETURNS          = "4010-SALES-RETURNS"
    ACCOUNTS_RECEIVABLE    = "1200-AR"
    CASH                   = "1100-CASH"
    BANK                   = "1110-BANK"
    GST_OUTPUT_CGST        = "2210-GST-CGST"
    GST_OUTPUT_SGST        = "2220-GST-SGST"
    GST_OUTPUT_IGST        = "2230-GST-IGST"
    INVENTORY              = "1300-INVENTORY"
    COGS                   = "5000-COGS"
    CONSIGNMENT_STOCK      = "1310-CONSIGNMENT"
    MT_LISTING_FEES        = "6100-MT-LISTING"
    MT_MARKETING_SUPPORT   = "6110-MT-MARKETING"
    ACCOUNTS_PAYABLE       = "2100-AP"
    PURCHASE               = "5100-PURCHASE"


class AccountingService:
    """
    Financial posting service.

    v3.27.0: STUB -- logs entries, validates balance, returns mock voucher ID.
    v3.30.x: FULL GL -- writes to general_ledger table, supports trial balance,
             P&L, Balance Sheet, reversals, and period locking.

    Usage:
        voucher = JournalVoucher(
            ref_document_type="SalesInvoice",
            ref_document_id="INV-2026-000001",
            ref_document_no="INV-2026-000001",
            entries=[
                JournalEntry("1200-AR", "Accounts Receivable", debit=Decimal("11800")),
                JournalEntry("4000-SALES", "Sales Revenue", credit=Decimal("10000")),
                JournalEntry("2210-GST-CGST", "CGST Payable", credit=Decimal("900")),
                JournalEntry("2220-GST-SGST", "SGST Payable", credit=Decimal("900")),
            ],
        )
        voucher_id = await accounting_service.post_journal(voucher, session)
    """

    async def post_journal(
        self,
        voucher: JournalVoucher,
        session: AsyncSession,
    ) -> str:
        """
        Post a journal voucher.

        v3.27.0: validates balance, logs to application logger, returns mock ID.
        v3.30.x: writes to general_ledger table.

        Returns:
            Voucher ID string (mock in v3.27.0, real FK in v3.30.x)

        Raises:
            ValueError: If the voucher is unbalanced.
        """
        if not voucher.is_balanced:
            raise ValueError(
                f"[SMRITI-ACC-001] Unbalanced journal voucher for "
                f"{voucher.ref_document_type} '{voucher.ref_document_no}'. "
                f"Debit={voucher.total_debit}, Credit={voucher.total_credit}"
            )

        voucher_id = f"JV-STUB-{uuid.uuid4().hex[:8].upper()}"
        logger.info(
            "AccountingService [STUB] | VoucherID=%s | Doc=%s %s | "
            "Debit=%.2f Credit=%.2f | Entries=%d",
            voucher_id,
            voucher.ref_document_type,
            voucher.ref_document_no,
            voucher.total_debit,
            voucher.total_credit,
            len(voucher.entries),
        )
        for entry in voucher.entries:
            logger.debug(
                "  [%s] %s | Dr=%.2f Cr=%.2f",
                entry.account_code, entry.account_name,
                entry.debit, entry.credit,
            )
        # v3.30.x: replace above with DB insert into general_ledger table
        return voucher_id

    async def preview_journal(self, voucher: JournalVoucher) -> dict:
        """
        Return a preview of the journal entries without posting.
        Used by UI to show proposed accounting impact before user confirms.
        """
        return {
            "voucher_id": None,
            "is_balanced": voucher.is_balanced,
            "total_debit": str(voucher.total_debit),
            "total_credit": str(voucher.total_credit),
            "entries": [
                {
                    "account_code": e.account_code,
                    "account_name": e.account_name,
                    "debit": str(e.debit),
                    "credit": str(e.credit),
                    "narration": e.narration,
                }
                for e in voucher.entries
            ],
        }

    async def reverse_journal(
        self,
        original_voucher_id: str,
        reason: str,
        session: AsyncSession,
    ) -> str:
        """
        Create a reversal voucher for a previously posted voucher.
        v3.27.0: STUB -- logs only.
        v3.30.x: writes mirror entries with negative amounts.
        """
        reversal_id = f"JV-REV-{uuid.uuid4().hex[:8].upper()}"
        logger.info(
            "AccountingService [STUB] Reversal | ReversalID=%s | OriginalID=%s | Reason=%s",
            reversal_id, original_voucher_id, reason,
        )
        return reversal_id


# Module-level singleton
accounting_service = AccountingService()
