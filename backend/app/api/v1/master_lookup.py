"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, require_permission
from ...models.auth import User
from ...repositories.master_lookup import LookupRepository
from ...services.master_lookup import LookupService
from ...schemas.master_lookup import (
    MasterTypeResponse,
    MasterValueCreate,
    MasterValueUpdate,
    MasterValueReplace,
    MasterValueResponse,
    MasterValueHistoryResponse
)

router = APIRouter()


@router.get(
    "/master-lookups/types",
    response_model=List[MasterTypeResponse],
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
@router.get(
    "/lookup-types",
    response_model=List[MasterTypeResponse],
    include_in_schema=False,
)
async def list_lookup_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered master lookup types."""
    repo = LookupRepository(db)
    types = await repo.get_all_types()
    return types


@router.get(
    "/master-lookups/types/{code}",
    response_model=MasterTypeResponse,
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
@router.get(
    "/lookup-types/{code}",
    response_model=MasterTypeResponse,
    include_in_schema=False,
)
async def get_lookup_type(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific master lookup type by code."""
    repo = LookupRepository(db)
    mtype = await repo.get_type_by_code(code)
    if not mtype:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Master lookup type '{code}' not found."
        )
    return mtype


@router.get(
    "/master-lookups/values/{type_code}",
    response_model=List[MasterValueResponse],
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
@router.get(
    "/lookup/{type_code}/values",
    response_model=List[MasterValueResponse],
    include_in_schema=False,
)
async def list_lookup_values(
    type_code: str,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List lookup values for a given category."""
    service = LookupService(db)
    return await service.search_values(type_code, active_only=active_only)


@router.get(
    "/master-lookups/values/{type_code}/{id_or_code}",
    response_model=MasterValueResponse,
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
async def get_lookup_value(
    type_code: str,
    id_or_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single lookup value by UUID or Code."""
    service = LookupService(db)
    return await service.get_value(id_or_code, type_code=type_code)


@router.post(
    "/master-lookups/values/{type_code}",
    response_model=MasterValueResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
@router.post(
    "/lookup/{type_code}/values",
    response_model=MasterValueResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_lookup_value(
    type_code: str,
    payload: MasterValueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new lookup value in a given category."""
    service = LookupService(db)
    return await service.create_value(type_code, payload)


@router.patch(
    "/master-lookups/values/{value_id}",
    response_model=MasterValueResponse,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
@router.put(
    "/lookup/{type_code}/values/{value_id}",
    response_model=MasterValueResponse,
    include_in_schema=False,
)
async def update_lookup_value(
    value_id: UUID,
    payload: MasterValueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update editable properties of a lookup value."""
    service = LookupService(db)
    return await service.update_value(str(value_id), payload)


@router.post(
    "/master-lookups/values/{value_id}/replace",
    response_model=MasterValueResponse,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
async def replace_lookup_value(
    value_id: UUID,
    payload: MasterValueReplace,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute atomic replacement versioning for a lookup value."""
    service = LookupService(db)
    return await service.replace_value(str(value_id), payload)


@router.delete(
    "/master-lookups/values/{value_id}",
    response_model=MasterValueResponse,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
@router.delete(
    "/lookup/{type_code}/values/{value_id}",
    response_model=MasterValueResponse,
    include_in_schema=False,
)
async def deactivate_lookup_value(
    value_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate a lookup value (protecting system codes)."""
    service = LookupService(db)
    return await service.deactivate_value(str(value_id))


@router.get(
    "/master-lookups/values/{value_id}/history",
    response_model=List[MasterValueHistoryResponse],
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
async def get_lookup_value_history(
    value_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve audit history trail for versioned replacements."""
    service = LookupService(db)
    return await service.get_audit_history(str(value_id))
