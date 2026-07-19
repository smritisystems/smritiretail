"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.sales import SalesInvoice
from .base import BaseRepository
from ..api.deps import TenantContext

class SalesInvoiceRepository(BaseRepository[SalesInvoice]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(SalesInvoice, db, tenant_ctx)

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[SalesInvoice]:
        from sqlalchemy.orm import selectinload
        stmt = select(SalesInvoice).filter(SalesInvoice.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.options(selectinload(SalesInvoice.items))
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self, invoice_no: Optional[str] = None, customer_id: Optional[str] = None,
        status: Optional[str] = None, date_from: Optional[date] = None, date_to: Optional[date] = None,
        skip: int = 0, limit: int = 50
    ) -> List[SalesInvoice]:
        """
        Search sales invoices by invoice number, customer, status, and date range under tenant context.
        """
        stmt = select(SalesInvoice).filter(SalesInvoice.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        if invoice_no:
            stmt = stmt.filter(SalesInvoice.invoice_no.ilike(f"%{invoice_no}%"))
        if customer_id:
            stmt = stmt.filter(SalesInvoice.customer_id == customer_id)
        if status:
            stmt = stmt.filter(SalesInvoice.status == status)
        if date_from:
            stmt = stmt.filter(SalesInvoice.date >= date_from)
        if date_to:
            stmt = stmt.filter(SalesInvoice.date <= date_to)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
