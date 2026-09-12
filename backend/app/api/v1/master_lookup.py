"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
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
from sqlalchemy.orm import selectinload

from ...api.deps import get_company_db, get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.master_lookup import MasterType, MasterValue
from ...models.size_groups import SizeGroup, SizeGroupValue
from ...schemas.master_lookup import (
    MasterTypeCreate, MasterTypeResponse,
    MasterValueCreate, MasterValueUpdate, MasterValueResponse
)
from ...services.size_groups import normalize_size_group_payload

router = APIRouter()

# Schema validation cache
validator_cache = {}


def _is_sysadmin(current_user: User) -> bool:
    return current_user.role == UserRole.SYSADMIN


def _require_company_context(current_user: User) -> str:
    company_id = getattr(current_user, "company_id", None)
    if not company_id:
        raise HTTPException(status_code=403, detail="Active company context is required for lookup administration.")
    return company_id


def _scope_value_query(query, current_user: User, *, for_mutation: bool = False):
    if _is_sysadmin(current_user):
        return query

    company_id = _require_company_context(current_user)
    query = query.where(MasterValue.company_id == company_id)

    branch_id = getattr(current_user, "branch_id", None)
    if for_mutation and branch_id:
        query = query.where(
            (MasterValue.branch_id.is_(None)) | (MasterValue.branch_id == branch_id)
        )
    elif branch_id:
        query = query.where(
            (MasterValue.branch_id.is_(None)) | (MasterValue.branch_id == branch_id)
        )
    return query


def _assign_single_vendor_owner(item: MasterValue, vendor_code: str) -> None:
    """Assign an Article / Style once; ownership cannot be transferred implicitly."""
    normalized_code = vendor_code.strip().upper()
    if item.vendor_code and item.vendor_code != normalized_code:
        raise HTTPException(
            status_code=409,
            detail="Article / Style is already assigned to another vendor and cannot be reassigned.",
        )
    item.vendor_code = normalized_code


def _serialize_size_group(group: SizeGroup) -> dict:
    values = []
    for value in sorted(group.values, key=lambda item: (item.sort_order or 0, item.value or "")):
        if not value.is_deleted and value.is_active:
            values.append(value.value)
    return {
        "id": group.id,
        "code": group.code,
        "name": group.name,
        "category": group.category or "GENERAL",
        "dimension": group.dimension or "size",
        "values": values,
        "is_active": group.is_active,
        "company_id": group.company_id,
        "branch_id": group.branch_id,
    }


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
    vendorCode: str | None = None,  # noqa: N803
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
        MasterValue.is_deleted.is_(False),
    )
    company_id = getattr(current_user, "company_id", None)
    branch_id = getattr(current_user, "branch_id", None)
    if company_id:
        q = q.where((MasterValue.company_id == company_id) | MasterValue.company_id.is_(None))
    if branch_id:
        q = q.where((MasterValue.branch_id == branch_id) | MasterValue.branch_id.is_(None))
    if activeOnly:
        q = q.where(MasterValue.active.is_(True))
    if vendorCode:
        q = q.where(MasterValue.vendor_code == vendorCode.strip().upper())

    q = q.order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
    res = await db.execute(q)
    return list(res.scalars().all())


@router.get(
    "/size-groups",
)
async def list_size_groups(
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """List canonical size groups and their ordered values."""
    q = select(SizeGroup).options(selectinload(SizeGroup.values)).where(SizeGroup.is_deleted.is_(False))
    company_id = getattr(current_user, "company_id", None)
    branch_id = getattr(current_user, "branch_id", None)
    if company_id:
        q = q.where((SizeGroup.company_id == company_id) | SizeGroup.company_id.is_(None))
    if branch_id:
        q = q.where((SizeGroup.branch_id == branch_id) | SizeGroup.branch_id.is_(None))
    q = q.order_by(SizeGroup.name.asc())
    result = await db.execute(q)
    return [_serialize_size_group(group) for group in result.scalars().all()]


@router.post(
    "/size-groups",
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_size_group(
    payload: dict,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Create a dedicated size group and its ordered values."""
    normalized = normalize_size_group_payload(payload)
    if not normalized["code"] or not normalized["name"]:
        raise HTTPException(status_code=400, detail="Size group code and name are required.")

    existing = await db.scalar(
        select(SizeGroup).where(
            SizeGroup.code == normalized["code"],
            SizeGroup.is_deleted.is_(False),
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Size group '{normalized['code']}' already exists.")

    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    group = SizeGroup(
        id=f"sg-{timestamp}",
        code=normalized["code"],
        name=normalized["name"],
        category=normalized["category"],
        dimension=normalized["dimension"],
        company_id=getattr(current_user, "company_id", None),
        branch_id=getattr(current_user, "branch_id", None),
        is_active=normalized["active"],
        is_deleted=False,
        created_by=current_user.username,
        updated_by=current_user.username,
    )
    db.add(group)
    await db.flush()

    for idx, value in enumerate(normalized["values"]):
        db.add(
            SizeGroupValue(
                id=f"sgv-{timestamp}-{idx}",
                size_group_id=group.id,
                value=value,
                sort_order=idx,
                is_active=True,
                is_deleted=False,
                company_id=getattr(current_user, "company_id", None),
                branch_id=getattr(current_user, "branch_id", None),
                created_by=current_user.username,
                updated_by=current_user.username,
            )
        )

    await db.commit()
    await db.refresh(group)
    return _serialize_size_group(group)


@router.put(
    "/size-groups/{group_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_size_group(
    group_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Update a size group and replace its ordered values."""
    group = await db.scalar(
        select(SizeGroup).options(selectinload(SizeGroup.values)).where(
            SizeGroup.id == group_id,
            SizeGroup.is_deleted.is_(False),
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="Size group not found.")

    normalized = normalize_size_group_payload(payload)
    group.code = normalized["code"] or group.code
    group.name = normalized["name"] or group.name
    group.category = normalized["category"]
    group.dimension = normalized["dimension"]
    group.is_active = normalized["active"]
    group.updated_by = current_user.username

    for value in list(group.values):
        value.is_deleted = True
        value.is_active = False
        value.updated_by = current_user.username

    for idx, value in enumerate(normalized["values"]):
        db.add(
            SizeGroupValue(
                id=f"sgv-{group.id}-{idx}",
                size_group_id=group.id,
                value=value,
                sort_order=idx,
                is_active=True,
                is_deleted=False,
                company_id=group.company_id,
                branch_id=group.branch_id,
                created_by=current_user.username,
                updated_by=current_user.username,
            )
        )

    await db.commit()
    await db.refresh(group)
    return _serialize_size_group(group)


@router.delete(
    "/size-groups/{group_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_size_group(
    group_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a size group and its values."""
    group = await db.scalar(
        select(SizeGroup).options(selectinload(SizeGroup.values)).where(
            SizeGroup.id == group_id,
            SizeGroup.is_deleted.is_(False),
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="Size group not found.")

    group.is_deleted = True
    group.is_active = False
    group.deleted_by = current_user.username
    for value in group.values:
        value.is_deleted = True
        value.is_active = False
        value.deleted_by = current_user.username

    await db.commit()
    return {"success": True, "deletedId": group_id}


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
    if type_code == "size_group":
        normalized = normalize_size_group_payload({
            "code": payload.code,
            "name": payload.name,
            "data": data,
            "active": payload.active,
            "values": data.get("values"),
            "category": data.get("category"),
            "dimension": data.get("dimension"),
            "description": data.get("description"),
        })
        data = {
            **data,
            "category": normalized["category"],
            "dimension": normalized["dimension"],
            "values": normalized["values"],
        }
        if normalized["description"]:
            data["description"] = normalized["description"]
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

    vendor_code = payload.vendorCode.strip().upper() if payload.vendorCode else None
    if vendor_code and type_code != "style_article":
        raise HTTPException(status_code=400, detail="Vendor ownership is supported only for Style / Article values.")
    if vendor_code:
        vendor_lookup_type = await db.scalar(select(MasterType).where(MasterType.code == "vendor_code"))
        vendor_query = select(MasterValue).where(
            MasterValue.master_type_id == vendor_lookup_type.id if vendor_lookup_type else False,
            MasterValue.code == vendor_code,
            MasterValue.active.is_(True),
            MasterValue.is_deleted.is_(False),
        )
        vendor_query = _scope_value_query(vendor_query, current_user)
        if not (await db.execute(vendor_query)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Vendor Code '{vendor_code}' is not an active System Lookup value.")

    # Uniqueness check for code
    q_val = select(MasterValue).where(
        MasterValue.master_type_id == master_type.id,
        MasterValue.code == payload.code,
        MasterValue.is_deleted.is_(False),
    )
    company_id = getattr(current_user, "company_id", None)
    branch_id = getattr(current_user, "branch_id", None)
    if not _is_sysadmin(current_user):
        company_id = _require_company_context(current_user)
        q_val = q_val.where(MasterValue.company_id == company_id)
        q_val = q_val.where(
            (MasterValue.branch_id.is_(None)) | (MasterValue.branch_id == branch_id)
        )
    else:
        q_val = q_val.where(MasterValue.company_id == company_id)
        q_val = q_val.where(MasterValue.branch_id == branch_id)
    res_val = await db.execute(q_val)
    if res_val.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Master value with code '{payload.code}' already exists for this type."
        )

    item = MasterValue(
        master_type_id=master_type.id,
        company_id=company_id,
        branch_id=branch_id,
        code=payload.code,
        name=payload.name,
        vendor_code=vendor_code,
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
        MasterValue.is_deleted.is_(False),
    ).with_for_update()
    q_val = _scope_value_query(q_val, current_user, for_mutation=True)
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
        if type_code == "size_group":
            normalized = normalize_size_group_payload({
                "code": item.code,
                "name": item.name,
                "data": data,
                "active": item.active,
                "values": data.get("values"),
                "category": data.get("category"),
                "dimension": data.get("dimension"),
                "description": data.get("description"),
            })
            data = {
                **data,
                "category": normalized["category"],
                "dimension": normalized["dimension"],
                "values": normalized["values"],
            }
            if normalized["description"]:
                data["description"] = normalized["description"]
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

    if payload.code is not None and payload.code != item.code:
        raise HTTPException(
            status_code=400,
            detail="Lookup codes are immutable after creation. Retire the existing value and create a new code.",
        )
    if payload.name is not None:
        setattr(item, "name", payload.name)
    if payload.vendorCode is not None:
        if type_code != "style_article":
            raise HTTPException(status_code=400, detail="Vendor ownership is supported only for Style / Article values.")
        vendor_code = payload.vendorCode.strip().upper()
        vendor_lookup_type = await db.scalar(select(MasterType).where(MasterType.code == "vendor_code"))
        vendor_query = select(MasterValue).where(
            MasterValue.master_type_id == vendor_lookup_type.id if vendor_lookup_type else False,
            MasterValue.code == vendor_code,
            MasterValue.active.is_(True),
            MasterValue.is_deleted.is_(False),
        )
        vendor_query = _scope_value_query(vendor_query, current_user)
        if not (await db.execute(vendor_query)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Vendor Code '{vendor_code}' is not an active System Lookup value.")
        _assign_single_vendor_owner(item, vendor_code)
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
        MasterValue.is_deleted.is_(False),
    )
    q_val = _scope_value_query(q_val, current_user, for_mutation=True)
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
