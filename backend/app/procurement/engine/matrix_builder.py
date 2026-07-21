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

from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import ProcurementRFQ, VendorQuotation, VendorQuotationItem, Supplier
from app.api.deps import TenantContext


class MatrixBuilder:
    """
    Side-by-Side Vendor Quotation Matrix Builder.
    Constructs a clean, structured JSON grid comparing line prices, lead times, and totals across submitted quotes.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def build_matrix(self, rfq_id: str) -> Dict[str, Any]:
        rfq_stmt = select(ProcurementRFQ).where(
            ProcurementRFQ.id == rfq_id,
            ProcurementRFQ.company_id == self.tenant.company_id,
            ProcurementRFQ.is_deleted == False
        )
        rfq = (await self.db.execute(rfq_stmt)).scalars().first()
        if not rfq:
            return {}

        # Fetch active latest quotes
        quote_stmt = select(VendorQuotation).where(
            VendorQuotation.rfq_id == rfq_id,
            VendorQuotation.status.in_(["Submitted", "Evaluated", "Awarded"]),
            VendorQuotation.is_deleted == False
        )
        quotes = list((await self.db.execute(quote_stmt)).scalars().all())

        vendor_columns = []
        for q in quotes:
            sup_stmt = select(Supplier).where(Supplier.id == q.supplier_id)
            sup = (await self.db.execute(sup_stmt)).scalars().first()
            vendor_columns.append({
                "quotation_id": q.id,
                "quotation_code": q.quotation_code,
                "version_number": q.version_number,
                "supplier_id": q.supplier_id,
                "supplier_name": sup.name if sup else "Unknown",
                "total_value": float(q.total_quote_value),
                "lead_time_days": q.offered_lead_time_days,
                "score": float(q.score) if q.score is not None else None,
                "rank": q.rank
            })

        return {
            "rfq_id": rfq.id,
            "rfq_code": rfq.rfq_code,
            "title": rfq.title,
            "evaluation_profile": rfq.evaluation_profile,
            "vendor_quotes": vendor_columns
        }
