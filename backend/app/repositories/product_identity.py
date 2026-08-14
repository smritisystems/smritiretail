"""
Product Identity Engine repositories.
"""

from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext
from ..db.base import BaseEntity
from .base import BaseRepository
from ..models.product_identity import BarcodeProvider, IdentityRule, ProductIdentity


class BarcodeProviderRepository(BaseRepository[BarcodeProvider]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(BarcodeProvider, db, tenant_ctx)

    async def get_by_pool(self, pool_code: str) -> Optional[BarcodeProvider]:
        stmt = select(BarcodeProvider).where(
            BarcodeProvider.pool_code == pool_code,
            BarcodeProvider.is_deleted == False,
            BarcodeProvider.is_active == True,
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()


class IdentityRuleRepository(BaseRepository[IdentityRule]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(IdentityRule, db, tenant_ctx)

    async def get_by_code(self, code: str) -> Optional[IdentityRule]:
        stmt = select(IdentityRule).where(
            IdentityRule.code == code,
            IdentityRule.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()


class ProductIdentityRepository(BaseRepository[ProductIdentity]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(ProductIdentity, db, tenant_ctx)

    async def get_by_barcode(self, barcode: str) -> Optional[ProductIdentity]:
        stmt = select(ProductIdentity).where(
            ProductIdentity.barcode == barcode,
            ProductIdentity.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_by_business_key(self, business_key: str) -> Optional[ProductIdentity]:
        stmt = select(ProductIdentity).where(
            ProductIdentity.business_key == business_key,
            ProductIdentity.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_by_product(self, product_id: str, skip: int = 0, limit: int = 50) -> List[ProductIdentity]:
        stmt = select(ProductIdentity).where(
            ProductIdentity.product_id == product_id,
            ProductIdentity.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def list_active(self, skip: int = 0, limit: int = 50) -> List[ProductIdentity]:
        stmt = select(ProductIdentity).where(
            ProductIdentity.is_active == True,
            ProductIdentity.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())
