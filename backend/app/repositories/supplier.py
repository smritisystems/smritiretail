"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.4.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from ..models.purchase import (
    Supplier,
    SupplierTaxProfile,
    SupplierComplianceProfile,
    SupplierPaymentProfile,
    SupplierCreditProfile,
    SupplierBankDetails,
    SupplierAddress,
    SupplierContact,
)
from .base import BaseRepository
from ..api.deps import TenantContext


class SupplierRepository(BaseRepository[Supplier]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Supplier, db, tenant_ctx)

    async def get(self, id: str) -> Optional[Supplier]:
        stmt = (
            select(Supplier)
            .options(
                selectinload(Supplier.tax_profile),
                selectinload(Supplier.compliance_profile),
                selectinload(Supplier.payment_profile),
                selectinload(Supplier.credit_profile),
                selectinload(Supplier.bank_details),
                selectinload(Supplier.addresses),
                selectinload(Supplier.contacts),
            )
            .filter(Supplier.id == id, Supplier.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_by_code(self, code: str) -> Optional[Supplier]:
        stmt = (
            select(Supplier)
            .options(
                selectinload(Supplier.tax_profile),
                selectinload(Supplier.compliance_profile),
                selectinload(Supplier.payment_profile),
                selectinload(Supplier.credit_profile),
                selectinload(Supplier.bank_details),
                selectinload(Supplier.addresses),
                selectinload(Supplier.contacts),
            )
            .filter(Supplier.code == code, Supplier.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Supplier]:
        stmt = (
            select(Supplier)
            .options(
                selectinload(Supplier.tax_profile),
                selectinload(Supplier.compliance_profile),
                selectinload(Supplier.payment_profile),
                selectinload(Supplier.credit_profile),
                selectinload(Supplier.bank_details),
                selectinload(Supplier.addresses),
                selectinload(Supplier.contacts),
            )
            .filter(Supplier.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt).offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def search(self, q: str, supplier_type_id: Optional[str] = None, skip: int = 0, limit: int = 50) -> List[Supplier]:
        """
        Procurement Search Engine prioritizing:
        1. Code
        2. GSTIN
        3. Mobile
        4. Trade Name
        5. Supplier Name
        6. Contact Person Name
        7. PAN
        """
        search_pattern = f"%{q}%"
        stmt = (
            select(Supplier)
            .outerjoin(Supplier.tax_profile)
            .outerjoin(Supplier.contacts)
            .options(
                selectinload(Supplier.tax_profile),
                selectinload(Supplier.compliance_profile),
                selectinload(Supplier.payment_profile),
                selectinload(Supplier.credit_profile),
                selectinload(Supplier.bank_details),
                selectinload(Supplier.addresses),
                selectinload(Supplier.contacts),
            )
            .filter(
                Supplier.is_deleted == False,
                or_(
                    Supplier.code.ilike(search_pattern),
                    Supplier.name.ilike(search_pattern),
                    Supplier.trade_name.ilike(search_pattern),
                    Supplier.mobile.ilike(search_pattern),
                    Supplier.gst_number.ilike(search_pattern),
                    SupplierTaxProfile.gstin.ilike(search_pattern),
                    SupplierTaxProfile.pan_number.ilike(search_pattern),
                    SupplierContact.name.ilike(search_pattern),
                ),
            )
        )
        if supplier_type_id:
            stmt = stmt.filter(Supplier.supplier_type_id == supplier_type_id)

        stmt = self._apply_tenant_filter(stmt).distinct().offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())
