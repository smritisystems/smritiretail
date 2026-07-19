"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_permission
from ...models.auth import User
from ...models.security import SMRITIRole, SMRITIPermission, SMRITIPolicy
from ...schemas.security import (
    SMRITIMenuResponse,
    SMRITIRoleResponse,
    SMRITIRoleCreate,
    SMRITIPermissionResponse,
    SMRITIPolicyResponse,
    SecurityCheckRequest,
    SecurityCheckResponse
)
from ...services.security import SecurityService

router = APIRouter()


@router.get("/menus", response_model=List[SMRITIMenuResponse])
async def get_dynamic_menus(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve dynamically visible menus for the currently authenticated user.
    """
    service = SecurityService(db)
    menus = await service.get_visible_menus(current_user.id)
    return menus


@router.post("/check", response_model=SecurityCheckResponse)
async def check_user_permission(
    req: SecurityCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify if the currently authenticated user is authorized for a specific permission code.
    """
    service = SecurityService(db)
    allowed = await service.verify_user_permission(current_user.id, req.permission)
    return {
        "allowed": allowed,
        "reason": None if allowed else f"User does not have active permission '{req.permission}' mapped."
    }


@router.get("/permissions", response_model=List[SMRITIPermissionResponse])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("SECURITY.VIEW_SETTINGS"))
):
    """
    List all registered security permissions. Scoped to SECURITY.VIEW_SETTINGS permission.
    """
    stmt = select(SMRITIPermission).where(SMRITIPermission.is_deleted == False)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/roles", response_model=List[SMRITIRoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("SECURITY.VIEW_SETTINGS"))
):
    """
    List all defined SMRITI Roles. Scoped to SECURITY.VIEW_SETTINGS permission.
    """
    stmt = select(SMRITIRole).where(SMRITIRole.is_deleted == False)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/policies", response_model=List[SMRITIPolicyResponse])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("SECURITY.VIEW_SETTINGS"))
):
    """
    List all security policies. Scoped to SECURITY.VIEW_SETTINGS permission.
    """
    stmt = select(SMRITIPolicy).where(SMRITIPolicy.is_deleted == False)
    res = await db.execute(stmt)
    return list(res.scalars().all())
