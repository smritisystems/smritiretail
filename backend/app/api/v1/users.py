"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserListResponse, PasswordChange,
    StaffUserCreate, StaffUserUpdate, StaffUserResponse, StaffUserListResponse
)
from ...services.user import UserService, to_staff_response

router = APIRouter()


# ---------------------------------------------------------------------------
# Staff & User Management (MANAGER+ allowed, Cashier can read/update own)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=StaffUserResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_staff_user(
    req: StaffUserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new staff user profile.
    """
    service = UserService(db)
    return await service.create_staff_user(req)


@router.get(
    "/",
    response_model=StaffUserListResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_staff_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    List all staff user accounts with filters.
    """
    service = UserService(db)
    total, staff_list = await service.list_staff(
        skip=skip, limit=limit, role_filter=role, status_filter=status, search=search
    )
    return StaffUserListResponse(total=total, users=staff_list)


@router.get(
    "/{user_id}",
    response_model=StaffUserResponse,
)
async def get_staff_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve user profile by ID.
    SYSADMIN / MANAGER may retrieve any. Cashiers can only view themselves.
    """
    if current_user.role not in [UserRole.SYSADMIN, UserRole.MANAGER] and current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view another user's profile.",
        )
    service = UserService(db)
    user = await service.get_user(user_id)
    return to_staff_response(user)


@router.patch(
    "/{user_id}",
    response_model=StaffUserResponse,
)
async def update_staff_user(
    user_id: str,
    req: StaffUserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update staff user profile.
    Field-level security validation is processed inside the user service.
    """
    service = UserService(db)
    return await service.update_staff_user(user_id, req, current_user)


@router.delete(
    "/{user_id}",
    status_code=200,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def deactivate_staff_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft delete / Deactivate a staff profile.
    """
    service = UserService(db)
    await service.deactivate_staff(user_id, current_user.id)
    return {"success": True, "deletedId": user_id, "status": "Inactive"}


@router.put(
    "/{user_id}/preferences",
    response_model=StaffUserResponse,
)
async def update_preferences(
    user_id: str,
    preferences: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update operator self layout/theme preferences.
    """
    if current_user.role not in [UserRole.SYSADMIN, UserRole.MANAGER] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access Denied: You cannot modify preferences of other operators.")
    service = UserService(db)
    return await service.update_preferences(user_id, preferences)


@router.put(
    "/{user_id}/notifications",
    response_model=StaffUserResponse,
)
async def update_notifications(
    user_id: str,
    notificationSettings: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update operator self notifications alert preferences.
    """
    if current_user.role not in [UserRole.SYSADMIN, UserRole.MANAGER] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access Denied: You cannot modify notification settings of other operators.")
    service = UserService(db)
    return await service.update_notifications(user_id, notificationSettings)


@router.put(
    "/{user_id}/photo",
    response_model=StaffUserResponse,
)
async def update_photo(
    user_id: str,
    photo: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update operator profile picture.
    """
    if current_user.role not in [UserRole.SYSADMIN, UserRole.MANAGER] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access Denied: You cannot upload photos for other operators.")
    service = UserService(db)
    return await service.update_photo(user_id, photo)


# ---------------------------------------------------------------------------
# Self-service password change
# ---------------------------------------------------------------------------

@router.patch(
    "/me/password",
    status_code=200,
)
async def change_password(
    req: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change your own password.
    """
    service = UserService(db)
    await service.change_password(current_user.id, req)
    return {"message": "Your password has been updated successfully."}
