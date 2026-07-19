"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-17
Modified     : 2026-07-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.user_assignment import (
    UserCompanyAssignment,
    UserBranchAssignment,
    UserStoreAssignment,
)
from .base import BaseRepository
from ..api.deps import TenantContext


class UserCompanyAssignmentRepository(BaseRepository[UserCompanyAssignment]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(UserCompanyAssignment, db, tenant_ctx)

    async def list_by_user(self, user_id: str) -> List[UserCompanyAssignment]:
        stmt = select(UserCompanyAssignment).filter(
            UserCompanyAssignment.user_id == user_id,
            UserCompanyAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_user_and_company(self, user_id: str, company_id: str) -> Optional[UserCompanyAssignment]:
        stmt = select(UserCompanyAssignment).filter(
            UserCompanyAssignment.user_id == user_id,
            UserCompanyAssignment.company_id == company_id,
            UserCompanyAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()


class UserBranchAssignmentRepository(BaseRepository[UserBranchAssignment]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(UserBranchAssignment, db, tenant_ctx)

    async def list_by_user(self, user_id: str) -> List[UserBranchAssignment]:
        stmt = select(UserBranchAssignment).filter(
            UserBranchAssignment.user_id == user_id,
            UserBranchAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_user_and_branch(self, user_id: str, branch_id: str) -> Optional[UserBranchAssignment]:
        stmt = select(UserBranchAssignment).filter(
            UserBranchAssignment.user_id == user_id,
            UserBranchAssignment.branch_id == branch_id,
            UserBranchAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()


class UserStoreAssignmentRepository(BaseRepository[UserStoreAssignment]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(UserStoreAssignment, db, tenant_ctx)

    async def list_by_user(self, user_id: str) -> List[UserStoreAssignment]:
        stmt = select(UserStoreAssignment).filter(
            UserStoreAssignment.user_id == user_id,
            UserStoreAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_user_and_store(self, user_id: str, store_id: str) -> Optional[UserStoreAssignment]:
        stmt = select(UserStoreAssignment).filter(
            UserStoreAssignment.user_id == user_id,
            UserStoreAssignment.store_id == store_id,
            UserStoreAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()
