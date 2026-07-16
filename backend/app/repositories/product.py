"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from sqlalchemy import cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.inventory import Product
from .base import BaseRepository
from ..api.deps import TenantContext

class ProductRepository(BaseRepository[Product]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Product, db, tenant_ctx)

    async def get_by_barcode(self, barcode: str) -> Optional[Product]:
        """
        Fetch product details matching barcode.
        """
        stmt = select(Product).filter(Product.barcode == barcode, Product.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search(
        self, q: Optional[str] = None, category: Optional[str] = None,
        skip: int = 0, limit: int = 50
    ) -> List[Product]:
        """
        Search products with optional query on name/code/barcode/attributes and category match.
        """
        stmt = select(Product).filter(Product.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        if q:
            stmt = stmt.filter(
                (Product.name.ilike(f"%{q}%")) |
                (Product.code.ilike(f"%{q}%")) |
                (Product.barcode.ilike(f"%{q}%")) |
                (cast(Product.attributes, String).ilike(f"%{q}%"))
            )
        if category:
            stmt = stmt.filter(Product.category == category)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

