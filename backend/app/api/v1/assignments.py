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

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import UserRole, User
from ...schemas.user_assignment import (
    UserAssignmentListResponse,
    UserCompanyAssignmentCreate,
    UserBranchAssignmentCreate,
    UserStoreAssignmentCreate,
    UserCompanyAssignmentResponse,
    UserBranchAssignmentResponse,
    UserStoreAssignmentResponse,
)
from ...services.user_assignment import UserAssignmentService

router = APIRouter()


@router.get(
    "/user-assignments/{user_id}",
    response_model=UserAssignmentListResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_user_assignments(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    return await service.list_assignments(user_id)


@router.post(
    "/user-assignments/{user_id}/companies",
    response_model=UserCompanyAssignmentResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def assign_user_company(
    user_id: str,
    req: UserCompanyAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    return await service.assign_company(user_id, req)


@router.post(
    "/user-assignments/{user_id}/branches",
    response_model=UserBranchAssignmentResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def assign_user_branch(
    user_id: str,
    req: UserBranchAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    return await service.assign_branch(user_id, req)


@router.post(
    "/user-assignments/{user_id}/stores",
    response_model=UserStoreAssignmentResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def assign_user_store(
    user_id: str,
    req: UserStoreAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    return await service.assign_store(user_id, req)


@router.delete(
    "/user-assignments/{user_id}/companies/{assignment_id}",
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def remove_user_company_assignment(
    user_id: str,
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    await service.remove_company_assignment(user_id, assignment_id)
    return {"success": True}


@router.delete(
    "/user-assignments/{user_id}/branches/{assignment_id}",
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def remove_user_branch_assignment(
    user_id: str,
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    await service.remove_branch_assignment(user_id, assignment_id)
    return {"success": True}


@router.delete(
    "/user-assignments/{user_id}/stores/{assignment_id}",
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def remove_user_store_assignment(
    user_id: str,
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserAssignmentService(db, current_user)
    await service.remove_store_assignment(user_id, assignment_id)
    return {"success": True}
