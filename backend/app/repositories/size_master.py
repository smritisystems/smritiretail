"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.5.0
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
from ..models.size_master import SizeScale, SizeValue, SizeConversion
from .base import BaseRepository
from ..api.deps import TenantContext


class SizeMasterRepository(BaseRepository[SizeScale]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(SizeScale, db, tenant_ctx)

    async def get(self, id: str) -> Optional[SizeScale]:
        stmt = (
            select(SizeScale)
            .options(
                selectinload(SizeScale.size_values).selectinload(SizeValue.conversions)
            )
            .filter(SizeScale.id == id, SizeScale.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_by_code(self, code: str) -> Optional[SizeScale]:
        stmt = (
            select(SizeScale)
            .options(
                selectinload(SizeScale.size_values).selectinload(SizeValue.conversions)
            )
            .filter(SizeScale.code == code, SizeScale.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[SizeScale]:
        stmt = (
            select(SizeScale)
            .options(
                selectinload(SizeScale.size_values).selectinload(SizeValue.conversions)
            )
            .filter(SizeScale.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt).offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def search(
        self,
        q: str,
        scale_type_id: Optional[str] = None,
        gender_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[SizeScale]:
        search_pattern = f"%{q}%"
        stmt = (
            select(SizeScale)
            .outerjoin(SizeScale.size_values)
            .options(
                selectinload(SizeScale.size_values).selectinload(SizeValue.conversions)
            )
            .filter(
                SizeScale.is_deleted == False,
                or_(
                    SizeScale.code.ilike(search_pattern),
                    SizeScale.name.ilike(search_pattern),
                    SizeValue.display_size.ilike(search_pattern),
                ),
            )
        )
        if scale_type_id:
            stmt = stmt.filter(SizeScale.scale_type_id == scale_type_id)
        if gender_id:
            stmt = stmt.filter(SizeScale.gender_id == gender_id)

        stmt = self._apply_tenant_filter(stmt).distinct().offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())
