"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-17
Modified     : 2026-07-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.auth import User, UserRole
from ..models.tenant import Company, Branch
from ..models.inventory import Store
from ..models.user_assignment import (
    UserCompanyAssignment,
    UserBranchAssignment,
    UserStoreAssignment,
)
from ..repositories.user_assignment import (
    UserCompanyAssignmentRepository,
    UserBranchAssignmentRepository,
    UserStoreAssignmentRepository,
)
from ..schemas.user_assignment import (
    UserCompanyAssignmentCreate,
    UserBranchAssignmentCreate,
    UserStoreAssignmentCreate,
)


class UserAssignmentService:
    def __init__(self, db: AsyncSession, current_user: User):
        self.db = db
        self.current_user = current_user
        self.company_repo = UserCompanyAssignmentRepository(db)
        self.branch_repo = UserBranchAssignmentRepository(db)
        self.store_repo = UserStoreAssignmentRepository(db)

    async def _assert_user_exists(self, user_id: str) -> User:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)
        )
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="Target user not found")
        return user

    async def _assert_company_exists(self, company_id: str) -> Company:
        company = await self.db.get(Company, company_id)
        if not company or company.is_deleted:
            raise HTTPException(status_code=404, detail="Company not found")
        return company

    async def _assert_branch_exists(self, branch_id: str) -> Branch:
        branch = await self.db.get(Branch, branch_id)
        if not branch or branch.is_deleted:
            raise HTTPException(status_code=404, detail="Branch not found")
        return branch

    async def _assert_store_exists(self, store_id: str) -> Store:
        store = await self.db.get(Store, store_id)
        if not store or store.is_deleted:
            raise HTTPException(status_code=404, detail="Store not found")
        return store

    def _assert_admin_or_manager(self) -> None:
        if self.current_user.role not in [UserRole.SYSADMIN, UserRole.MANAGER]:
            raise HTTPException(status_code=403, detail="Only SYSADMIN or MANAGER can manage user assignments.")

    def _assert_same_company_for_manager(self, company_id: str) -> None:
        if self.current_user.role == UserRole.MANAGER and self.current_user.company_id != company_id:
            raise HTTPException(
                status_code=403,
                detail="MANAGER users may only manage assignments for their own company.",
            )

    async def _clear_default_company(self, user_id: str) -> None:
        stmt = select(UserCompanyAssignment).filter(
            UserCompanyAssignment.user_id == user_id,
            UserCompanyAssignment.is_default == True,
            UserCompanyAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        existing_default = result.scalars().first()
        if existing_default:
            existing_default.is_default = False
            self.db.add(existing_default)

    async def _clear_default_branch(self, user_id: str, company_id: str) -> None:
        stmt = select(UserBranchAssignment).filter(
            UserBranchAssignment.user_id == user_id,
            UserBranchAssignment.company_id == company_id,
            UserBranchAssignment.is_default == True,
            UserBranchAssignment.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        existing_default = result.scalars().first()
        if existing_default:
            existing_default.is_default = False
            self.db.add(existing_default)

    async def assign_company(self, user_id: str, req: UserCompanyAssignmentCreate) -> UserCompanyAssignment:
        self._assert_admin_or_manager()
        await self._assert_user_exists(user_id)
        company = await self._assert_company_exists(req.company_id)
        self._assert_same_company_for_manager(company.id)

        existing = await self.company_repo.get_by_user_and_company(user_id, company.id)
        if existing:
            raise HTTPException(status_code=400, detail="User already has this company assignment.")

        if req.is_default:
            await self._clear_default_company(user_id)

        assignment = UserCompanyAssignment(
            user_id=user_id,
            company_id=company.id,
            branch_id=None,
            is_default=req.is_default,
            created_by=self.current_user.username,
            updated_by=self.current_user.username,
            is_active=True,
            is_deleted=False,
        )
        try:
            self.db.add(assignment)
            await self.db.commit()
            await self.db.refresh(assignment)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Failed to create company assignment.")
        return assignment

    async def assign_branch(self, user_id: str, req: UserBranchAssignmentCreate) -> UserBranchAssignment:
        self._assert_admin_or_manager()
        await self._assert_user_exists(user_id)
        branch = await self._assert_branch_exists(req.branch_id)
        self._assert_same_company_for_manager(branch.company_id)

        existing = await self.branch_repo.get_by_user_and_branch(user_id, branch.id)
        if existing:
            raise HTTPException(status_code=400, detail="User already has this branch assignment.")

        if req.is_default:
            await self._clear_default_branch(user_id, branch.company_id)

        assignment = UserBranchAssignment(
            user_id=user_id,
            company_id=branch.company_id,
            branch_id=branch.id,
            is_default=req.is_default,
            created_by=self.current_user.username,
            updated_by=self.current_user.username,
            is_active=True,
            is_deleted=False,
        )
        try:
            self.db.add(assignment)
            await self.db.commit()
            await self.db.refresh(assignment)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Failed to create branch assignment.")
        return assignment

    async def assign_store(self, user_id: str, req: UserStoreAssignmentCreate) -> UserStoreAssignment:
        self._assert_admin_or_manager()
        await self._assert_user_exists(user_id)
        store = await self._assert_store_exists(req.store_id)
        self._assert_same_company_for_manager(store.company_id)

        existing = await self.store_repo.get_by_user_and_store(user_id, store.id)
        if existing:
            raise HTTPException(status_code=400, detail="User already has this store assignment.")

        assignment = UserStoreAssignment(
            user_id=user_id,
            company_id=store.company_id,
            branch_id=store.branch_id,
            store_id=store.id,
            created_by=self.current_user.username,
            updated_by=self.current_user.username,
            is_active=True,
            is_deleted=False,
        )
        try:
            self.db.add(assignment)
            await self.db.commit()
            await self.db.refresh(assignment)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Failed to create store assignment.")
        return assignment

    async def _assert_manager_can_access_user(self, target_user: User) -> None:
        if self.current_user.role == UserRole.MANAGER:
            if target_user.company_id != self.current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="MANAGER users may only access assignments for users in their own company.",
                )

    async def list_assignments(self, user_id: str) -> dict:
        target_user = await self._assert_user_exists(user_id)
        await self._assert_manager_can_access_user(target_user)
        company_assignments = await self.company_repo.list_by_user(user_id)
        branch_assignments = await self.branch_repo.list_by_user(user_id)
        store_assignments = await self.store_repo.list_by_user(user_id)
        return {
            "user_id": user_id,
            "company_assignments": company_assignments,
            "branch_assignments": branch_assignments,
            "store_assignments": store_assignments,
        }

    async def remove_company_assignment(self, user_id: str, assignment_id: str) -> None:
        self._assert_admin_or_manager()
        assignment = await self.company_repo.get(assignment_id)
        if not assignment or assignment.user_id != user_id:
            raise HTTPException(status_code=404, detail="Company assignment not found.")
        await self.company_repo.soft_delete(assignment, deleted_by=self.current_user.username)

    async def remove_branch_assignment(self, user_id: str, assignment_id: str) -> None:
        self._assert_admin_or_manager()
        assignment = await self.branch_repo.get(assignment_id)
        if not assignment or assignment.user_id != user_id:
            raise HTTPException(status_code=404, detail="Branch assignment not found.")
        await self.branch_repo.soft_delete(assignment, deleted_by=self.current_user.username)

    async def remove_store_assignment(self, user_id: str, assignment_id: str) -> None:
        self._assert_admin_or_manager()
        assignment = await self.store_repo.get(assignment_id)
        if not assignment or assignment.user_id != user_id:
            raise HTTPException(status_code=404, detail="Store assignment not found.")
        await self.store_repo.soft_delete(assignment, deleted_by=self.current_user.username)
