"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-15
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.models.auth import User, UserRole
from app.models.ui_control_plane import SmritiTheme, SmritiThemeVariant, SmritiWorkspaceProfile
from app.schemas.ui_control_plane import ThemeResponse, WorkspaceProfileResponse

router = APIRouter()


@router.get("/themes", response_model=List[ThemeResponse])
async def get_active_themes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch all active system themes and visual variants from smriti_themes."""
    stmt = (
        select(SmritiTheme)
        .options(selectinload(SmritiTheme.variants))
        .where(SmritiTheme.is_active == True)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/workspace-profiles", response_model=List[WorkspaceProfileResponse])
async def get_workspace_profiles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch available AWE workspace profiles from smriti_workspace_profiles."""
    stmt = select(SmritiWorkspaceProfile).where(
        SmritiWorkspaceProfile.is_active == True,
        SmritiWorkspaceProfile.is_deleted == False
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/workspace-profiles/my-profile", response_model=WorkspaceProfileResponse)
async def get_my_workspace_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resolve active AWE workspace profile for the current user persona."""
    role_str = (
        current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    ).upper()

    role_to_code = {
        "CASHIER": "PROF_CASHIER",
        "STORE_MANAGER": "PROF_STORE_MANAGER",
        "MANAGER": "PROF_STORE_MANAGER",
        "ACCOUNTANT": "PROF_ACCOUNTANT",
        "SYSADMIN": "PROF_SYSADMIN"
    }

    target_code = role_to_code.get(role_str, "PROF_SYSADMIN")

    stmt = select(SmritiWorkspaceProfile).where(
        SmritiWorkspaceProfile.code == target_code,
        SmritiWorkspaceProfile.is_active == True
    )
    profile = (await db.execute(stmt)).scalar_one_or_none()

    if not profile:
        def_stmt = select(SmritiWorkspaceProfile).where(SmritiWorkspaceProfile.is_default == True)
        profile = (await db.execute(def_stmt)).scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching workspace profile found."
        )

    return profile
