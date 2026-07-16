"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from typing import Generic, TypeVar

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..api.deps import TenantContext
from ..db.base import BaseEntity

ModelType = TypeVar("ModelType", bound=BaseEntity)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: type[ModelType], db: AsyncSession, tenant_ctx: TenantContext | None = None):
        self.model = model
        self.db = db
        self.tenant_ctx = tenant_ctx

    def _apply_tenant_filter(self, stmt):
        if self.tenant_ctx:
            if hasattr(self.model, "company_id"):
                stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
            if hasattr(self.model, "branch_id"):
                stmt = stmt.filter(self.model.branch_id == self.tenant_ctx.branch_id)
        return stmt

    async def get(self, id: str) -> ModelType | None:
        stmt = select(self.model).filter(self.model.id == id)
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[ModelType]:
        stmt = select(self.model)
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: ModelType) -> ModelType:
        if self.tenant_ctx:
            if hasattr(obj_in, "company_id") and obj_in.company_id is None:
                obj_in.company_id = self.tenant_ctx.company_id
            if hasattr(obj_in, "branch_id") and obj_in.branch_id is None:
                obj_in.branch_id = self.tenant_ctx.branch_id
        self.db.add(obj_in)
        await self.db.commit()
        await self.db.refresh(obj_in)
        return obj_in

    async def update(self, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        if hasattr(db_obj, "modified_at"):
            db_obj.modified_at = datetime.utcnow()
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def soft_delete(self, db_obj: ModelType, deleted_by: str | None = None) -> ModelType:
        if hasattr(db_obj, "is_deleted"):
            db_obj.is_deleted = True
            db_obj.deleted_at = datetime.utcnow()
            db_obj.deleted_by = deleted_by
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.model)
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

