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

from datetime import datetime, timezone
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, require_permission
from ...models.auth import User
from ...models.master_lookup import MasterValue
from ...repositories.master_lookup import LookupRepository
from ...services.master_lookup import LookupService
import uuid
from ...models.master_lookup import MasterType
from ...schemas.master_lookup import (
    MasterTypeCreate,
    MasterTypeResponse,
    MasterValueCreate,
    MasterValueUpdate,
    MasterValueReplace,
    MasterValueResponse,
    MasterValueHistoryResponse,
    BulkActivateRequest,
    BulkDeleteRequest,
    BulkReorderRequest,
    AIDuplicateReport,
)

router = APIRouter()


@router.post(
    "/master-lookups/types",
    response_model=MasterTypeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
@router.post(
    "/lookup-types",
    response_model=MasterTypeResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_lookup_type(
    payload: MasterTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new master lookup type."""
    repo = LookupRepository(db)
    existing = await repo.get_type_by_code(payload.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Master lookup type '{payload.code}' already exists."
        )
    mtype = MasterType(
        id=uuid.uuid4(),
        code=payload.code,
        label=payload.label,
        category_type=payload.category_type or "SYSTEM",
        is_system=payload.is_system if payload.is_system is not None else True,
        field_schema=payload.field_schema,
        ui_schema=payload.ui_schema,
        used_in_modules=payload.used_in_modules,
        depends_on=payload.depends_on,
        version=payload.version or 1,
        evidence_level=payload.evidence_level or "D",
        created_by=current_user.id
    )
    return await repo.create_type(mtype)


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
    tenant_id = getattr(current_user, "tenant_id", None) or getattr(current_user, "company_id", None)
    return await service.search_values(type_code, active_only=active_only, tenant_id=tenant_id)


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
    tenant_id = getattr(current_user, "tenant_id", None) or getattr(current_user, "company_id", None)
    return await service.create_value(type_code, payload, tenant_id=tenant_id)


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
    val = await service.repo.get_value_by_id(value_id)
    if val and getattr(val, "is_system", False):
        if payload.name is not None:
            raise HTTPException(
                status_code=403,
                detail={
                    "title": "Cannot Edit System Value",
                    "explanation": f"'{val.name}' is a SMRITI standard value. Code and name cannot be changed.",
                    "suggested_action": "You can change sort_order or active status only.",
                    "reference_id": "SMRITI-VAL-021"
                }
            )
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
    type_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate a lookup value (protecting system codes)."""
    service = LookupService(db)
    return await service.deactivate_value(str(value_id))


@router.patch("/lookup/{type_code}/values/{id}/toggle-active")
async def toggle_lookup_value_active(
    type_code: str,
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate/reactivate a master value (works for system AND tenant values)."""
    q = select(MasterValue).where(
        MasterValue.id == id,
        MasterValue.is_deleted.is_(False)
    )
    res = await db.execute(q)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Value not found.")
    setattr(item, "active", not item.active)
    setattr(item, "updated_at", datetime.now(timezone.utc))
    await db.commit()
    return {"id": str(id), "active": item.active, "name": item.name}


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


@router.post(
    "/master-lookups/values/bulk-activate",
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
async def bulk_activate_lookup_values(
    payload: BulkActivateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk activate or deactivate multiple master values."""
    service = LookupService(db)
    return await service.bulk_set_active(payload.value_ids, payload.active)


@router.post(
    "/master-lookups/values/bulk-delete",
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
async def bulk_delete_lookup_values(
    payload: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk soft-delete multiple master values."""
    service = LookupService(db)
    return await service.bulk_soft_delete(payload.value_ids, deleted_by=current_user.id)


@router.post(
    "/master-lookups/values/bulk-reorder",
    dependencies=[Depends(require_permission("SETTINGS.MANAGE"))],
)
async def bulk_reorder_lookup_values(
    payload: BulkReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk update sort_order for lookup values."""
    service = LookupService(db)
    items_dict = [item.model_dump() for item in payload.items]
    return await service.bulk_reorder(items_dict)


@router.get(
    "/master-lookups/values/{type_code}/ai-duplicates",
    response_model=AIDuplicateReport,
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
async def ai_detect_duplicate_lookups(
    type_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI duplicate detection for lookup values under a given type."""
    service = LookupService(db)
    return await service.ai_detect_duplicates(type_code)


@router.get(
    "/master-lookups/values/{value_id}/check-usage",
    dependencies=[Depends(require_permission("SETTINGS.VIEW"))],
)
async def check_lookup_value_usage(
    value_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check transaction and master entity dependencies before deletion (SMRITI spec)."""
    service = LookupService(db)
    return await service.check_usage(str(value_id))


