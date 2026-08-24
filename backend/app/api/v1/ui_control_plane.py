"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-15
Modified     : 2026-08-24
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
from app.models.ui_control_plane import (
    SmritiTheme, SmritiThemeVariant, SmritiWorkspaceProfile,
    ScreenDefinition, FieldDefinition, ActionDefinition, IconRegistry,
)
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


@router.get("/screens", summary="Screen Definitions")
async def get_screen_definitions(
    module_code: str = None,
    capability_code: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns screen layout definitions from smritisys.screen_definitions.
    Optional filters: module_code, capability_code.
    Control Plane defines WHAT; application renders HOW.
    """
    stmt = select(ScreenDefinition).where(
        ScreenDefinition.is_active == True,
        ScreenDefinition.is_deleted == False,
    )
    if module_code:
        stmt = stmt.where(ScreenDefinition.module_code == module_code.upper())
    if capability_code:
        stmt = stmt.where(ScreenDefinition.capability_code == capability_code.upper())
    result = await db.execute(stmt)
    screens = result.scalars().all()
    return {
        "count": len(screens),
        "screens": [
            {
                "id": s.id, "code": s.code, "version": s.version, "name": s.name,
                "module_code": s.module_code, "workspace_code": s.workspace_code,
                "screen_type": s.screen_type, "persona_mode": s.persona_mode,
                "capability_code": s.capability_code, "route_path": s.route_path,
                "icon_key": s.icon_key, "searchable": s.searchable,
                "exportable": s.exportable, "printable": s.printable,
                "pagination_default": s.pagination_default,
                "layout_config": s.layout_config, "status": s.status,
            }
            for s in screens
        ],
    }


@router.get("/fields", summary="Field Definitions")
async def get_field_definitions(
    field_type: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns field metadata definitions from smritisys.field_definitions.
    Optional filter: field_type.
    """
    stmt = select(FieldDefinition).where(
        FieldDefinition.is_active == True,
        FieldDefinition.is_deleted == False,
    )
    if field_type:
        stmt = stmt.where(FieldDefinition.field_type == field_type.upper())
    result = await db.execute(stmt)
    fields = result.scalars().all()
    return {
        "count": len(fields),
        "fields": [
            {
                "id": f.id, "code": f.code, "name": f.name, "label_key": f.label_key,
                "field_type": f.field_type, "data_type": f.data_type,
                "is_required": f.is_required, "is_readonly": f.is_readonly,
                "is_searchable": f.is_searchable, "is_sortable": f.is_sortable,
                "is_filterable": f.is_filterable, "is_exportable": f.is_exportable,
                "is_hidden": f.is_hidden, "validation_rules": f.validation_rules,
                "options_source": f.options_source, "options_static": f.options_static,
                "max_length": f.max_length, "status": f.status,
            }
            for f in fields
        ],
    }


@router.get("/actions", summary="Action Definitions")
async def get_action_definitions(
    screen_code: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns action (button/link) definitions from smritisys.action_definitions.
    Optional filter: screen_code.
    """
    stmt = select(ActionDefinition).where(
        ActionDefinition.is_active == True,
        ActionDefinition.is_deleted == False,
    )
    if screen_code:
        stmt = stmt.where(ActionDefinition.screen_code == screen_code)
    stmt = stmt.order_by(ActionDefinition.order_index)
    result = await db.execute(stmt)
    actions = result.scalars().all()
    return {
        "count": len(actions),
        "actions": [
            {
                "id": a.id, "code": a.code, "name": a.name, "label_key": a.label_key,
                "action_type": a.action_type, "screen_code": a.screen_code,
                "placement": a.placement, "icon_key": a.icon_key,
                "variant": a.variant, "order_index": a.order_index,
                "required_capability": a.required_capability,
                "required_roles": a.required_roles,
                "confirmation_required": a.confirmation_required,
                "target_route": a.target_route, "api_endpoint": a.api_endpoint,
                "api_method": a.api_method, "workflow_action": a.workflow_action,
                "status": a.status,
            }
            for a in actions
        ],
    }


@router.get("/icons", summary="Icon Registry")
async def get_icon_registry(
    module_scope: str = None,
    icon_category: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns platform icon catalogue from smritisys.icon_registry.
    Optional filters: module_scope, icon_category.
    Decouples icon key references from application source code.
    """
    stmt = select(IconRegistry).where(IconRegistry.is_active == True)
    if module_scope:
        stmt = stmt.where(IconRegistry.module_scope == module_scope.upper())
    if icon_category:
        stmt = stmt.where(IconRegistry.icon_category == icon_category.upper())
    result = await db.execute(stmt)
    icons = result.scalars().all()
    return {
        "count": len(icons),
        "icons": [
            {
                "id": i.id, "key": i.key, "name": i.name,
                "icon_pack": i.icon_pack, "icon_identifier": i.icon_identifier,
                "icon_category": i.icon_category, "module_scope": i.module_scope,
                "aliases": i.aliases, "tags": i.tags, "status": i.status,
            }
            for i in icons
        ],
    }
