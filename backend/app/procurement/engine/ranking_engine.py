"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.9.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.purchase import VendorQuotation
from app.api.deps import TenantContext


class RankingEngine:
    """
    Ranks vendor quotations based on their computed evaluation score.
    Higher score gets better rank (Rank 1 is the best).
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def rank_quotations(self, quotations: List[VendorQuotation]) -> List[VendorQuotation]:
        if not quotations:
            return []

        # Sort by score descending. If scores are equal, sort by total_quote_value ascending
        sorted_quotes = sorted(
            quotations,
            key=lambda q: (float(q.score) if q.score is not None else 0.0, -float(q.total_quote_value)),
            reverse=True
        )

        for i, q in enumerate(sorted_quotes, start=1):
            q.rank = i
            self.db.add(q)

        return sorted_quotes
