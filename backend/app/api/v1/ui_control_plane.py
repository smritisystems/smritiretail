"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.db.session import get_db
from app.models.ui_control_plane import SmritiTheme, SmritiThemeVariant, SmritiWorkspaceProfile
from app.schemas.ui_control_plane import ThemeResponse, WorkspaceProfileResponse
from app.api.v1.auth import get_current_user

router = APIRouter()

@router.get("/themes", response_model=List[ThemeResponse])
def get_active_themes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch all active system themes and visual variants from smriti_themes."""
    themes = db.query(SmritiTheme).options(joinedload(SmritiTheme.variants)).filter(SmritiTheme.is_active == True).all()
    return themes


@router.get("/workspace-profiles", response_model=List[WorkspaceProfileResponse])
def get_workspace_profiles(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch available AWE workspace profiles from smriti_workspace_profiles."""
    profiles = db.query(SmritiWorkspaceProfile).filter(SmritiWorkspaceProfile.is_active == True, SmritiWorkspaceProfile.is_deleted == False).all()
    return profiles


@router.get("/workspace-profiles/my-profile", response_model=WorkspaceProfileResponse)
def get_my_workspace_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolve active AWE workspace profile for the current user persona."""
    user_role = current_user.get("role", "SYSADMIN").upper()

    role_to_code = {
        "CASHIER": "PROF_CASHIER",
        "STORE_MANAGER": "PROF_STORE_MANAGER",
        "ACCOUNTANT": "PROF_ACCOUNTANT",
        "SYSADMIN": "PROF_SYSADMIN"
    }

    target_code = role_to_code.get(user_role, "PROF_SYSADMIN")

    profile = db.query(SmritiWorkspaceProfile).filter(
        SmritiWorkspaceProfile.code == target_code,
        SmritiWorkspaceProfile.is_active == True
    ).first()

    if not profile:
        profile = db.query(SmritiWorkspaceProfile).filter(SmritiWorkspaceProfile.is_default == True).first()

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching workspace profile found.")

    return profile
