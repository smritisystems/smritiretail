"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_permission
from app.core.validation import (
    PlatformValidationEngine,
    ValidationPolicy,
    get_validation_engine,
)
from app.models.auth import User

router = APIRouter()


@router.get(
    "/validation-policies/{entity_type}",
    response_model=ValidationPolicy,
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
async def get_validation_policy(
    entity_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    engine: PlatformValidationEngine = Depends(get_validation_engine),
):
    """Retrieve effective field validation and conditional rule policies for an entity type."""
    tenant_id = current_user.tenant_id or current_user.company_id
    return await engine.get_effective_policy(db, entity_type, tenant_id)


@router.put(
    "/validation-policies/{entity_type}",
    response_model=ValidationPolicy,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
async def update_validation_policy(
    entity_type: str,
    payload: ValidationPolicy,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    engine: PlatformValidationEngine = Depends(get_validation_engine),
):
    """Update tenant-scoped validation policy and invalidate the in-memory policy cache."""
    tenant_id = current_user.tenant_id or current_user.company_id
    payload.tenant_id = tenant_id
    payload.entity_type = entity_type

    engine.cache.set(f"{entity_type}:{tenant_id}", payload)
    return payload


@router.post(
    "/validation-policies/{entity_type}/reset",
    response_model=ValidationPolicy,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
async def reset_validation_policy(
    entity_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    engine: PlatformValidationEngine = Depends(get_validation_engine),
):
    """Reset entity validation policy to default platform settings."""
    tenant_id = current_user.tenant_id or current_user.company_id
    engine.invalidate_policy_cache(entity_type, tenant_id)
    return await engine.get_effective_policy(db, entity_type, tenant_id)
