"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.1
Created      : 2026-07-11
Modified     : 2026-11-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, func
from ..models.sales import SalesInvoice
from .base import BaseRepository
from ..api.deps import TenantContext

from sqlalchemy.orm import selectinload


class SalesInvoiceRepository(BaseRepository[SalesInvoice]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(SalesInvoice, db, tenant_ctx)

    async def get(self, id: str) -> Optional[SalesInvoice]:
        stmt = select(SalesInvoice).options(selectinload(SalesInvoice.items)).filter(or_(SalesInvoice.id == id, SalesInvoice.invoice_no == id))
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[SalesInvoice]:
        stmt = select(SalesInvoice).options(selectinload(SalesInvoice.items))
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.order_by(SalesInvoice.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self,
        invoice_no: Optional[str] = None,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[SalesInvoice]:
        """
        Search sales invoices by invoice number, customer, status, and date range under tenant context.
        Transparently includes soft-deleted records when 'Cancelled' or 'Voided' status is queried.
        """
        stmt = select(SalesInvoice).options(selectinload(SalesInvoice.items))
        stmt = self._apply_tenant_filter(stmt)

        # Status normalization & soft-delete filter handling
        statuses = [s.strip().upper() for s in status.split(",") if s.strip()] if status else []
        is_cancelled_queried = any(s in ("CANCELLED", "VOIDED") for s in statuses)

        if is_cancelled_queried:
            # When looking for cancelled/voided invoices, include soft-deleted records with status Cancelled/Voided
            if len(statuses) == 1 and statuses[0] in ("CANCELLED", "VOIDED"):
                stmt = stmt.filter(
                    or_(
                        func.upper(SalesInvoice.status) == statuses[0],
                        and_(SalesInvoice.is_deleted == True, func.upper(SalesInvoice.status) == statuses[0]),
                    )
                )
            else:
                stmt = stmt.filter(
                    or_(
                        SalesInvoice.is_deleted == False,
                        func.upper(SalesInvoice.status).in_(statuses),
                    )
                )
                stmt = stmt.filter(func.upper(SalesInvoice.status).in_(statuses))
        else:
            stmt = stmt.filter(SalesInvoice.is_deleted == False)
            if statuses:
                stmt = stmt.filter(func.upper(SalesInvoice.status).in_(statuses))

        if invoice_no:
            stmt = stmt.filter(SalesInvoice.invoice_no.ilike(f"%{invoice_no}%"))
        if customer_id:
            stmt = stmt.filter(SalesInvoice.customer_id == customer_id)
        if date_from:
            stmt = stmt.filter(SalesInvoice.date >= date_from)
        if date_to:
            stmt = stmt.filter(SalesInvoice.date <= date_to)

        stmt = stmt.order_by(SalesInvoice.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
