"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-14
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Any, cast
from uuid import UUID
from datetime import datetime, timezone
import jsonschema  # type: ignore
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.master_lookup import MasterType, MasterValue
from ...schemas.master_lookup import (
    MasterTypeCreate, MasterTypeResponse,
    MasterValueCreate, MasterValueUpdate, MasterValueResponse
)

router = APIRouter()

# Schema validation cache
validator_cache = {}


def get_validator(master_type_id: str, schema: dict, version: int):
    cache_key = f"{master_type_id}:{version}"
    if cache_key not in validator_cache:
        validator_cache[cache_key] = jsonschema.Draft7Validator(schema)
    return validator_cache[cache_key]


@router.get(
    "/lookup-types",
    response_model=List[MasterTypeResponse],
)
async def list_lookup_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[MasterType]:
    """
    List all master lookup types.
    """
    q = select(MasterType).order_by(MasterType.code.asc())
    res = await db.execute(q)
    return list(res.scalars().all())


@router.get(
    "/lookup-types/{code}",
    response_model=MasterTypeResponse,
)
async def get_lookup_type(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MasterType:
    """
    Get a single master lookup type details by code.
    """
    q = select(MasterType).where(MasterType.code == code)
    res = await db.execute(q)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Master type '{code}' not found."
        )
    return item


@router.post(
    "/lookup-types",
    response_model=MasterTypeResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_lookup_type(
    payload: MasterTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MasterType:
    """
    Register a new master lookup type definition.
    """
    q = select(MasterType).where(MasterType.code == payload.code)
    res = await db.execute(q)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Master type with code '{payload.code}' already exists."
        )

    item = MasterType(
        code=payload.code,
        label=payload.label,
        field_schema=payload.field_schema,
        ui_schema=payload.ui_schema,
        used_in_modules=payload.used_in_modules or [],
        depends_on=payload.depends_on,
        version=payload.version or 1,
        evidence_level=payload.evidence_level or 'D',
        created_by=current_user.username
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get(
    "/lookup/{type_code}/values",
    response_model=List[MasterValueResponse],
)
async def list_lookup_values(
    type_code: str,
    activeOnly: bool = False,  # noqa: N803
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[MasterValue]:
    """
    List all master values for a given master lookup type.
    """
    q_type = select(MasterType).where(MasterType.code == type_code)
    res_type = await db.execute(q_type)
    master_type = res_type.scalar_one_or_none()
    if not master_type:
        raise HTTPException(
            status_code=404,
            detail=f"Master type with code '{type_code}' not found."
        )

    q = select(MasterValue).where(
        MasterValue.master_type_id == master_type.id,
        MasterValue.is_deleted.is_(False)
    )
    if activeOnly:
        q = q.where(MasterValue.active.is_(True))

    q = q.order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
    res = await db.execute(q)
    return list(res.scalars().all())


@router.post(
    "/lookup/{type_code}/values",
    response_model=MasterValueResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_lookup_value(
    type_code: str,
    payload: MasterValueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MasterValue:
    """
    Create a new master value record.
    """
    q_type = select(MasterType).where(MasterType.code == type_code)
    res_type = await db.execute(q_type)
    master_type = res_type.scalar_one_or_none()
    if not master_type:
        raise HTTPException(
            status_code=404,
            detail=f"Master type with code '{type_code}' not found."
        )

    # Validate JSON Data Payload
    data = payload.data or {}
    try:
        validator = get_validator(
            str(master_type.id),
            cast(dict, master_type.field_schema),
            int(master_type.version)
        )
        validator.validate(data)
    except jsonschema.ValidationError as err:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed: {err.message}"
        ) from err

    # Uniqueness check for code
    q_val = select(MasterValue).where(
        MasterValue.master_type_id == master_type.id,
        MasterValue.code == payload.code,
        MasterValue.is_deleted.is_(False)
    )
    res_val = await db.execute(q_val)
    if res_val.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Master value with code '{payload.code}' already exists for this type."
        )

    item = MasterValue(
        master_type_id=master_type.id,
        code=payload.code,
        name=payload.name,
        parent_value_id=payload.parent_value_id,
        data=data,
        active=payload.active if payload.active is not None else True,
        sort_order=payload.sort_order or 0,
        is_deleted=False
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put(
    "/lookup/{type_code}/values/{id}",
    response_model=MasterValueResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_lookup_value(
    type_code: str,
    id: UUID,
    payload: MasterValueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MasterValue:
    """
    Update a master value record details.
    """
    q_type = select(MasterType).where(MasterType.code == type_code)
    res_type = await db.execute(q_type)
    master_type = res_type.scalar_one_or_none()
    if not master_type:
        raise HTTPException(
            status_code=404,
            detail=f"Master type with code '{type_code}' not found."
        )

    q_val = select(MasterValue).where(
        MasterValue.id == id,
        MasterValue.master_type_id == master_type.id,
        MasterValue.is_deleted.is_(False)
    )
    res_val = await db.execute(q_val)
    item = res_val.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Master value not found or matched."
        )

    # Validate JSON Data Payload if updated
    if payload.data is not None:
        data = payload.data
        try:
            validator = get_validator(
                str(master_type.id),
                cast(dict, master_type.field_schema),
                int(master_type.version)
            )
            validator.validate(data)
        except jsonschema.ValidationError as err:
            raise HTTPException(
                status_code=400,
                detail=f"Validation failed: {err.message}"
            ) from err
        setattr(item, "data", data)

    if payload.code is not None:
        setattr(item, "code", payload.code)
    if payload.name is not None:
        setattr(item, "name", payload.name)
    if payload.parent_value_id is not None:
        setattr(item, "parent_value_id", payload.parent_value_id)
    if payload.active is not None:
        setattr(item, "active", payload.active)
    if payload.sort_order is not None:
        setattr(item, "sort_order", payload.sort_order)

    setattr(item, "updated_at", datetime.now(timezone.utc))
    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/lookup/{type_code}/values/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_lookup_value(
    type_code: str,
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Soft-delete/Retire a master value record.
    """
    q_type = select(MasterType).where(MasterType.code == type_code)
    res_type = await db.execute(q_type)
    master_type = res_type.scalar_one_or_none()
    if not master_type:
        raise HTTPException(
            status_code=404,
            detail=f"Master type with code '{type_code}' not found."
        )

    q_val = select(MasterValue).where(
        MasterValue.id == id,
        MasterValue.master_type_id == master_type.id,
        MasterValue.is_deleted.is_(False)
    )
    res_val = await db.execute(q_val)
    item = res_val.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Master value not found or matched."
        )

    setattr(item, "is_deleted", True)
    setattr(item, "deleted_at", datetime.now(timezone.utc))
    setattr(item, "deleted_by", current_user.username)
    await db.commit()
    return {"success": True, "deletedId": str(id)}
