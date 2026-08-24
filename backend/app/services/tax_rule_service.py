"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

GST rate resolution for invoice rendering.
Does not hardcode 5%, 18%, or 2.5%.
Does not activate footwear slab rules.
"""

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from .invoice_errors import missing


class TaxRuleService:
    """Resolves GST rate from posted line data or an injected rate master."""

    @staticmethod
    def resolve_gst_rate(
        *,
        hsn: str,
        effective_date: Optional[date],
        transaction_type: str,
        stored_rate: Any = None,
        rate_master: Any = None,
    ) -> Decimal:
        if stored_rate is not None and str(stored_rate).strip() != "":
            return Decimal(str(stored_rate))

        if rate_master is not None and hasattr(rate_master, "lookup"):
            found = rate_master.lookup(
                hsn=hsn,
                effective_date=effective_date,
                transaction_type=transaction_type,
            )
            if found is not None and str(found).strip() != "":
                return Decimal(str(found))

        raise missing("MISSING_GST_RATE", "GST rate for the item")
