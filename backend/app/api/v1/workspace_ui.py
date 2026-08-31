"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_company_db, get_current_user
from ...models.auth import User
from ...schemas.ui_registry import (
    WorkspaceTemplateResponse,
    WorkspaceResolutionResponse,
    ResolvedNavNode,
    DesignTokensResponse,
    CompleteScreenPackageResponse,
)
from ...services.workspace_ui_svc import WorkspaceUIRegistryService

router = APIRouter(prefix="/ui", tags=["Workspace, Menu & UI Experience Registry"])


@router.get("/templates", response_model=List[WorkspaceTemplateResponse])
async def list_workspace_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all standard industry workspace templates (SUPERMARKET, APPAREL, WMS, etc.).
    """
    return await WorkspaceUIRegistryService.get_workspace_templates(db)


@router.get("/workspaces/resolve", response_model=WorkspaceResolutionResponse)
async def resolve_workspace_layout(
    template_code: Optional[str] = Query(None, description="Optional workspace template code"),
    db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolve complete workspace configuration for current user persona and tenant capability state.
    """
    return await WorkspaceUIRegistryService.resolve_user_workspace(
        db=db,
        company_db=company_db,
        user=current_user,
        template_code=template_code,
    )


@router.get("/navigation/resolved", response_model=List[ResolvedNavNode])
async def get_resolved_navigation(
    db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """
    Produce the authoritative navigation tree for the current user.
    Enforces role permissions and active tenant capability gating with parent-child cascade pruning.
    """
    return await WorkspaceUIRegistryService.resolve_navigation_tree(
        db=db,
        company_db=company_db,
        user=current_user,
    )


@router.get("/themes/tokens", response_model=DesignTokensResponse)
async def get_theme_design_tokens(
    theme_id: Optional[str] = Query(None, description="Theme ID"),
    variant: str = Query("dark", description="Variant name: light, dark, high_contrast"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolve CSS design tokens (colors, typography, radii, shadows) from smritisys control plane.
    """
    return await WorkspaceUIRegistryService.get_design_tokens(
        db=db,
        theme_id=theme_id,
        variant_name=variant,
    )


@router.get("/screens/{screen_code}/complete", response_model=CompleteScreenPackageResponse)
async def get_complete_screen_package(
    screen_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch comprehensive screen definition package: layout metadata, fields, actions, and icons.
    """
    pkg = await WorkspaceUIRegistryService.get_screen_package(db, screen_code)
    if not pkg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screen definition '{screen_code}' not found.",
        )
    return pkg
