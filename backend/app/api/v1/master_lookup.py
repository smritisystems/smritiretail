"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-07-14
 * Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Any, cast, Optional, Dict
from uuid import UUID
from datetime import datetime, timezone
import jsonschema  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ...api.deps import get_company_db, get_db, get_current_user, require_role
from ...core.logging import logger
from ...models.auth import User, UserRole
from ...models.master_lookup import MasterType, MasterValue
from ...models.attributes import VariantTemplate
from ...models.inventory import Product
from ...models.item_master import Item
from ...models.sales import SalesOrder, SalesOrderItem
from ...models.size_groups import SizeGroup, SizeGroupValue
from ...schemas.master_lookup import (
    MasterTypeCreate, MasterTypeResponse,
    MasterValueCreate, MasterValueUpdate, MasterValueResponse
)
from ...services.size_groups import normalize_size_group_payload
from ...services.compliance_audit import ComplianceAuditService
from ...services.master_lookup_import_service import (
    extract_vendor_article_codes_from_po_pdf_bytes,
)

router = APIRouter()


@router.post(
    "/lookup/style_article/import-from-po-pdf",
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def import_style_article_from_po_pdf(
    file: UploadFile = File(...),
    vendorCode: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a PO PDF, parse article/style tokens from text, and persist them as style_article lookup values."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF purchase order file.")

    raw = await file.read()
    try:
        codes = extract_vendor_article_codes_from_po_pdf_bytes(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to parse the purchase-order PDF text.") from exc

    if not codes:
        raise HTTPException(status_code=400, detail="No vendor article/style codes were detected in the purchase-order PDF.")

    type_code = "style_article"
    q_type = select(MasterType).where(MasterType.code == type_code)
    res_type = await db.execute(q_type)
    master_type = res_type.scalar_one_or_none()
    if not master_type:
        raise HTTPException(status_code=404, detail=f"Master type with code '{type_code}' not found.")

    if vendorCode:
        vendor_code = vendorCode.strip().upper()
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
    else:
        vendor_code = None

    company_id = getattr(current_user, "company_id", None)
    branch_id = getattr(current_user, "branch_id", None)
    created = []
    for code in codes:
        # Uniqueness is scoped like the existing create endpoint.
        q_val = select(MasterValue).where(
            MasterValue.master_type_id == master_type.id,
            MasterValue.code == code,
            MasterValue.is_deleted.is_(False),
        )
        if not _is_sysadmin(current_user):
            company_id_ctx = _require_company_context(current_user)
            q_val = q_val.where(MasterValue.company_id == company_id_ctx)
            q_val = q_val.where((MasterValue.branch_id.is_(None)) | (MasterValue.branch_id == branch_id))
        else:
            q_val = q_val.where(MasterValue.company_id == company_id)
            q_val = q_val.where(MasterValue.branch_id == branch_id)

        existing = await db.execute(q_val)
        if existing.scalar_one_or_none():
            continue

        item = MasterValue(
            master_type_id=master_type.id,
            company_id=company_id,
            branch_id=branch_id,
            code=code,
            name=code,
            vendor_code=vendor_code,
            parent_value_id=None,
            data={},
            active=True,
            sort_order=0,
            is_deleted=False,
        )
        db.add(item)
        await db.flush()
        await _audit_master_value_change(
            db,
            current_user,
            "CREATE",
            type_code,
            str(item.id),
            f"Imported {type_code} lookup value '{item.code}' from PO PDF.",
            after={
                "code": item.code,
                "name": item.name,
                "active": item.active,
                "sort_order": item.sort_order,
                "vendor_code": item.vendor_code,
                "data": item.data,
            },
        )
        created.append(item.code)

    await db.commit()
    return {"created": created, "source": file.filename, "vendorCode": vendor_code}


async def _audit_master_value_change(
    db: AsyncSession,
    current_user: User,
    action: str,
    type_code: str,
    value_id: str,
    summary: str,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    company_id = str(getattr(current_user, "company_id", None) or "GLOBAL")
    branch_id = str(getattr(current_user, "branch_id", None) or "BR-001")
    role = getattr(current_user.role, "value", current_user.role)
    await ComplianceAuditService.record_audit_event(
        session=db,
        company_id=company_id,
        branch_id=branch_id,
        event_type=f"MASTER_LOOKUP_{action}",
        entity_name=f"master_lookup:{type_code}",
        entity_id=str(value_id),
        action_summary=summary,
        actor_user_id=str(current_user.id),
        actor_role=str(role),
        before_state=before,
        after_state=after,
    )

# Schema validation cache
validator_cache = {}

async def _master_value_reference_reason(
    db: AsyncSession,
    item: MasterValue,
    type_code: str,
) -> str | None:
    """Return a deletion blocker when a lookup value is referenced by live data."""
    child = await db.scalar(
        select(MasterValue.id).where(
            MasterValue.parent_value_id == item.id,
            MasterValue.is_deleted.is_(False),
        ).limit(1)
    )
    if child:
        return "child lookup values"

    if type_code == "style_article":
        template = await db.scalar(
            select(VariantTemplate.id).where(
                VariantTemplate.master_value_id == item.id,
                VariantTemplate.is_deleted.is_(False),
            ).limit(1)
        )
        if template:
            return "variant templates"

        product = await db.scalar(
            select(Product.id).where(
                Product.style_code == item.code,
                Product.is_deleted.is_(False),
            ).limit(1)
        )
        if product:
            return "products"

        sales_item = await db.scalar(
            select(SalesOrderItem.id).where(
                or_(
                    SalesOrderItem.article_no == item.code,
                    SalesOrderItem.vendor_style == item.code,
                )
            ).limit(1)
        )
        if sales_item:
            return "sales order items"

    if type_code == "vendor_code":
        template = await db.scalar(
            select(VariantTemplate.id).where(
                VariantTemplate.vendor_code == item.code,
                VariantTemplate.is_deleted.is_(False),
            ).limit(1)
        )
        if template:
            return "variant templates"

        product = await db.scalar(
            select(Product.id).where(
                Product.vendor_code == item.code,
                Product.is_deleted.is_(False),
            ).limit(1)
        )
        if product:
            return "products"

        article = await db.scalar(
            select(MasterValue.id).where(
                MasterValue.vendor_code == item.code,
                MasterValue.is_deleted.is_(False),
            ).limit(1)
        )
        if article:
            return "style/article values"

        sales_order = await db.scalar(
            select(SalesOrder.id).where(SalesOrder.vendor_code == item.code).limit(1)
        )
        if sales_order:
            return "sales orders"

    return None


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


def _assign_single_vendor_owner(item: MasterValue, vendor_code: str, *, allow_reassign: bool = False) -> None:
    """Assign an Article / Style once; ownership cannot be transferred implicitly."""
    normalized_code = vendor_code.strip().upper()
    if item.vendor_code and item.vendor_code != normalized_code and not allow_reassign:
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
    includeUnassigned: bool = False,  # noqa: N803
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
        vc = vendorCode.strip().upper()
        if includeUnassigned:
            q = q.where(or_(MasterValue.vendor_code == vc, MasterValue.vendor_code.is_(None)))
        else:
            q = q.where(MasterValue.vendor_code == vc)

    q = q.order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
    res = await db.execute(q)
    direct_values = list(res.scalars().all())
    if direct_values:
        return direct_values

    # Fallback to scale group unpacking if direct values are empty
    group_type_code = None
    if type_code == "color":
        group_type_code = "color_group"
    elif type_code == "size":
        group_type_code = "size_group"

    if group_type_code:
        import uuid as _uuid_mod
        q_grp_type = select(MasterType).where(MasterType.code == group_type_code)
        res_grp_type = await db.execute(q_grp_type)
        grp_type = res_grp_type.scalar_one_or_none()
        if grp_type:
            q_grp = select(MasterValue).where(
                MasterValue.master_type_id == grp_type.id,
                MasterValue.is_deleted.is_(False),
                MasterValue.active.is_(True),
            )
            if company_id:
                q_grp = q_grp.where((MasterValue.company_id == company_id) | MasterValue.company_id.is_(None))
            if branch_id:
                q_grp = q_grp.where((MasterValue.branch_id == branch_id) | MasterValue.branch_id.is_(None))
            q_grp = q_grp.order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
            res_grp = await db.execute(q_grp)
            grp_rows = res_grp.scalars().all()

            seen_codes = set()
            synthetic_values: List[MasterValue] = []
            sort_idx = 1
            for grp in grp_rows:
                if isinstance(grp.data, dict) and "values" in grp.data and isinstance(grp.data["values"], list):
                    for v in grp.data["values"]:
                        v_str = str(v).strip()
                        if v_str and v_str.lower() not in seen_codes:
                            seen_codes.add(v_str.lower())
                            synthetic_id = _uuid_mod.uuid5(_uuid_mod.NAMESPACE_DNS, f"{master_type.id}:{v_str}")
                            synthetic_values.append(
                                MasterValue(
                                    id=synthetic_id,
                                    master_type_id=master_type.id,
                                    code=v_str,
                                    name=v_str,
                                    company_id=grp.company_id,
                                    branch_id=grp.branch_id,
                                    vendor_code=grp.vendor_code,
                                    data={},
                                    active=True,
                                    sort_order=sort_idx,
                                    updated_at=grp.updated_at,
                                )
                            )
                            sort_idx += 1
            if synthetic_values:
                return synthetic_values

    return []


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
    await db.flush()
    await _audit_master_value_change(
        db,
        current_user,
        "CREATE",
        type_code,
        str(item.id),
        f"Created {type_code} lookup value '{item.code}'.",
        after={
            "code": item.code,
            "name": item.name,
            "active": item.active,
            "sort_order": item.sort_order,
            "vendor_code": item.vendor_code,
            "data": item.data,
        },
    )
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

    before_state = {
        "code": item.code,
        "name": item.name,
        "active": item.active,
        "sort_order": item.sort_order,
        "vendor_code": item.vendor_code,
        "data": item.data,
    }

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
        _assign_single_vendor_owner(
            item,
            vendor_code,
            allow_reassign=_is_sysadmin(current_user),
        )
    if payload.parent_value_id is not None:
        setattr(item, "parent_value_id", payload.parent_value_id)
    if payload.active is not None:
        setattr(item, "active", payload.active)
    if payload.sort_order is not None:
        setattr(item, "sort_order", payload.sort_order)

    setattr(item, "updated_at", datetime.now(timezone.utc))
    await _audit_master_value_change(
        db,
        current_user,
        "UPDATE",
        type_code,
        str(item.id),
        f"Updated {type_code} lookup value '{item.code}'.",
        before=before_state,
        after={
            "code": item.code,
            "name": item.name,
            "active": item.active,
            "sort_order": item.sort_order,
            "vendor_code": item.vendor_code,
            "data": item.data,
        },
    )
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

    before_state = {
        "code": item.code,
        "name": item.name,
        "active": item.active,
        "sort_order": item.sort_order,
        "vendor_code": item.vendor_code,
        "data": item.data,
    }

    reference_reason = await _master_value_reference_reason(db, item, type_code)
    if reference_reason:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot delete {type_code} '{item.code}': it is linked to live "
                f"{reference_reason}. Remove or retire those links first."
            ),
        )

    setattr(item, "is_deleted", True)
    setattr(item, "deleted_at", datetime.now(timezone.utc))
    setattr(item, "deleted_by", current_user.username)
    await _audit_master_value_change(
        db,
        current_user,
        "DELETE",
        type_code,
        str(item.id),
        f"Retired {type_code} lookup value '{item.code}'.",
        before=before_state,
        after={"is_deleted": True, "active": False},
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if "master value" in str(exc).lower() or "master_value" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot delete {type_code} '{item.code}': it is linked to live records. "
                    "Remove or retire those links first."
                ),
            ) from exc
        raise
    return {"success": True, "deletedId": str(id)}


@router.get(
    "/lookup/{type_code}/values/{id}/audit",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Get Master Lookup Item Audit History",
)
async def get_lookup_value_audit(
    type_code: str,
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Returns the immutable compliance audit history for a specific master lookup item.
    Enables managers to verify who changed code, name, description, active status, or sort order.
    """
    company_id = getattr(current_user, "company_id", None)
    include_all = company_id is None or company_id == "GLOBAL"
    logs = await ComplianceAuditService.search_audit_logs(
        session=db,
        company_id=company_id or "GLOBAL",
        entity_name=f"master_lookup:{type_code}",
        entity_id=str(id),
        limit=50,
        include_all_companies=include_all,
    )
    return {
        "company_id": company_id or "GLOBAL",
        "entity_name": f"master_lookup:{type_code}",
        "entity_id": str(id),
        "count": len(logs),
        "logs": logs,
    }


@router.get(
    "/lookup/{type_code}/audit",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Get Master Lookup Type Audit History",
)
async def get_lookup_type_audit(
    type_code: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Returns the immutable compliance audit history for all items under a master lookup type.
    """
    company_id = getattr(current_user, "company_id", None)
    include_all = company_id is None or company_id == "GLOBAL"
    logs = await ComplianceAuditService.search_audit_logs(
        session=db,
        company_id=company_id or "GLOBAL",
        entity_name=f"master_lookup:{type_code}",
        limit=min(limit, 200),
        include_all_companies=include_all,
    )
    return {
        "company_id": company_id or "GLOBAL",
        "entity_name": f"master_lookup:{type_code}",
        "count": len(logs),
        "logs": logs,
    }


# ---------------------------------------------------------------------------
# Master Lookup Entity Adapter (for UniversalBrowseEngine / F2 Lookup Registry)
# ---------------------------------------------------------------------------
@router.get("/master/{entity_type}", summary="Universal Master Lookup Browse Adapter")
@router.get("/master/{entity_type}/", summary="Universal Master Lookup Browse Adapter")
async def list_master_entities(
    entity_type: str,
    q: Optional[str] = Query(None, description="Search filter string across code, name, and attributes"),
    page_size: int = Query(200, ge=1, le=1000),
    page: int = Query(1, ge=1),
    control_db: AsyncSession = Depends(get_db),
    tenant_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Universal Master Entity Browse Adapter for F2 Lookup Architecture v2.
    Serves /api/v1/master/{entity_type} queries (e.g. articles, brands, colors, sizes,
    departments, categories, fabrics, fits, sections, seasons, classifications).
    Integrates authoritative MasterValue lookup records from control plane (smritisys)
    with live catalog entities from the operational tenant plane (smritiXXX).
    """
    clean_type = entity_type.strip().lower()
    type_code_map = {
        "articles": "style_article",
        "article": "style_article",
        "styles": "style_article",
        "style": "style_article",
        "brands": "brand",
        "brand": "brand",
        "colors": "color",
        "color": "color",
        "sizes": "size",
        "size": "size",
        "departments": "department",
        "department": "department",
        "sections": "section",
        "section": "section",
        "fabrics": "fabric",
        "fabric": "fabric",
        "fits": "fit",
        "fit": "fit",
        "categories": "category",
        "category": "category",
        "seasons": "season",
        "season": "season",
        "classifications": "classification",
        "classification": "classification",
    }
    type_code = type_code_map.get(clean_type, clean_type)

    rows: List[Dict[str, Any]] = []
    seen_codes: set = set()

    # 1. Authoritative lookup values from control plane
    res_type = await control_db.execute(select(MasterType).where(MasterType.code == type_code))
    master_type = res_type.scalar_one_or_none()
    if master_type:
        mv_stmt = select(MasterValue).where(
            MasterValue.master_type_id == master_type.id,
            MasterValue.is_deleted == False,
            MasterValue.active == True,
        )
        if q and q.strip():
            st = f"%{q.strip()}%"
            mv_stmt = mv_stmt.where(
                or_(
                    MasterValue.code.ilike(st),
                    MasterValue.name.ilike(st),
                    MasterValue.vendor_code.ilike(st),
                )
            )
        mv_stmt = mv_stmt.order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
        mv_res = await control_db.execute(mv_stmt)
        master_values = mv_res.scalars().all()
        for mv in master_values:
            code = mv.code
            if code not in seen_codes:
                seen_codes.add(code)
                data = mv.data if isinstance(mv.data, dict) else {}
                rows.append({
                    "code": code,
                    "name": mv.name,
                    "category": data.get("category", ""),
                    "brand": data.get("brand", ""),
                    "season": data.get("season", "ALL"),
                    "mrp": float(data.get("mrp", 0.0) or 0.0),
                    "shade": data.get("shade", ""),
                    "hex": data.get("hex", "#808080"),
                    "group": data.get("group", ""),
                    "scale": data.get("scale", ""),
                    "standard": data.get("standard", ""),
                    "sortOrder": mv.sort_order or 0,
                    "division": data.get("division", ""),
                    "description": data.get("description", mv.name),
                    "origin": data.get("origin", "Domestic"),
                    "tier": data.get("tier", "Standard"),
                    "status": "Active" if mv.active else "Inactive",
                    "targetAudience": data.get("targetAudience", ""),
                    "deptCode": data.get("deptCode", ""),
                    "composition": data.get("composition", ""),
                    "weave": data.get("weave", ""),
                    "gsm": data.get("gsm", 0),
                    "cutType": data.get("cutType", ""),
                    "parent_code": data.get("parent_code", ""),
                })

    # 2. Live operational catalog data enrichment from tenant plane
    try:
        if type_code == "style_article":
            item_stmt = select(Item).where(Item.is_deleted == False)
            if q and q.strip():
                st = f"%{q.strip()}%"
                item_stmt = item_stmt.where(
                    or_(
                        Item.item_code.ilike(st),
                        Item.item_name.ilike(st),
                        Item.style_code.ilike(st),
                        Item.category.ilike(st),
                        Item.brand.ilike(st),
                    )
                )
            item_stmt = item_stmt.order_by(Item.item_name.asc()).limit(500)
            items_res = await tenant_db.execute(item_stmt)
            db_items = items_res.scalars().all()
            for it in db_items:
                code = it.style_code or it.item_code
                if code and code not in seen_codes:
                    seen_codes.add(code)
                    rows.append({
                        "code": code,
                        "name": it.item_name or code,
                        "category": it.category or "",
                        "brand": it.brand or "",
                        "season": "ALL",
                        "mrp": float(it.mrp or 0.0),
                        "shade": it.color or "",
                        "hex": "#808080",
                        "group": "",
                        "scale": it.size or "",
                        "standard": "",
                        "sortOrder": 0,
                        "division": it.department or "",
                        "description": it.item_name or code,
                        "origin": "",
                        "tier": "Standard",
                        "status": "Active" if it.status == "ACTIVE" else it.status,
                        "targetAudience": "",
                        "deptCode": it.department or "",
                        "composition": "",
                        "weave": "",
                        "gsm": 0,
                        "cutType": "",
                        "parent_code": it.category_code or "",
                    })

            # Also check Product for style_code
            prod_stmt = select(Product).where(Product.style_code.isnot(None), Product.is_deleted == False)
            if q and q.strip():
                st = f"%{q.strip()}%"
                prod_stmt = prod_stmt.where(
                    or_(
                        Product.style_code.ilike(st),
                        Product.name.ilike(st),
                        Product.category.ilike(st),
                    )
                )
            prod_stmt = prod_stmt.limit(200)
            prod_res = await tenant_db.execute(prod_stmt)
            for pr in prod_res.scalars().all():
                if pr.style_code and pr.style_code not in seen_codes:
                    seen_codes.add(pr.style_code)
                    rows.append({
                        "code": pr.style_code,
                        "name": pr.name or pr.style_code,
                        "category": pr.category or "",
                        "brand": pr.brand or "",
                        "season": "ALL",
                        "mrp": float(pr.mrp or 0.0),
                        "shade": pr.color or "",
                        "hex": "#808080",
                        "group": "",
                        "scale": pr.size or "",
                        "standard": "",
                        "sortOrder": 0,
                        "division": "",
                        "description": pr.name or pr.style_code,
                        "origin": "",
                        "tier": "Standard",
                        "status": "Active",
                        "targetAudience": "",
                        "deptCode": "",
                        "composition": "",
                        "weave": "",
                        "gsm": 0,
                        "cutType": "",
                        "parent_code": "",
                    })

        elif type_code == "brand":
            b_stmt = select(Item.brand).where(Item.brand.isnot(None), Item.is_deleted == False).distinct()
            if q and q.strip():
                b_stmt = b_stmt.where(Item.brand.ilike(f"%{q.strip()}%"))
            b_res = await tenant_db.execute(b_stmt)
            for b in b_res.scalars().all():
                if b and b.strip() and b.strip() not in seen_codes:
                    seen_codes.add(b.strip())
                    rows.append({
                        "code": b.strip().upper().replace(" ", "_"),
                        "name": b.strip(),
                        "origin": "Domestic",
                        "tier": "Standard",
                        "status": "Active",
                    })
            # Also check Product.brand
            p_b_stmt = select(Product.brand).where(Product.brand.isnot(None), Product.is_deleted == False).distinct()
            if q and q.strip():
                p_b_stmt = p_b_stmt.where(Product.brand.ilike(f"%{q.strip()}%"))
            p_b_res = await tenant_db.execute(p_b_stmt)
            for b in p_b_res.scalars().all():
                if b and b.strip() and b.strip() not in seen_codes:
                    seen_codes.add(b.strip())
                    rows.append({
                        "code": b.strip().upper().replace(" ", "_"),
                        "name": b.strip(),
                        "origin": "Domestic",
                        "tier": "Standard",
                        "status": "Active",
                    })

        elif type_code == "color":
            # Check Item.color and Product.color
            c_stmt = select(Item.color).where(Item.color.isnot(None), Item.is_deleted == False).distinct()
            if q and q.strip():
                c_stmt = c_stmt.where(Item.color.ilike(f"%{q.strip()}%"))
            c_res = await tenant_db.execute(c_stmt)
            for c in c_res.scalars().all():
                if c and c.strip() and c.strip() not in seen_codes:
                    seen_codes.add(c.strip())
                    rows.append({
                        "code": c.strip().upper(),
                        "name": c.strip(),
                        "shade": c.strip(),
                        "hex": "#808080",
                        "group": "Standard",
                        "status": "Active",
                    })
            p_c_stmt = select(Product.color).where(Product.color.isnot(None), Product.is_deleted == False).distinct()
            if q and q.strip():
                p_c_stmt = p_c_stmt.where(Product.color.ilike(f"%{q.strip()}%"))
            p_c_res = await tenant_db.execute(p_c_stmt)
            for c in p_c_res.scalars().all():
                if c and c.strip() and c.strip() not in seen_codes:
                    seen_codes.add(c.strip())
                    rows.append({
                        "code": c.strip().upper(),
                        "name": c.strip(),
                        "shade": c.strip(),
                        "hex": "#808080",
                        "group": "Standard",
                        "status": "Active",
                    })

        elif type_code == "size":
            # Check Item.size and Product.size
            s_stmt = select(Item.size).where(Item.size.isnot(None), Item.is_deleted == False).distinct()
            if q and q.strip():
                s_stmt = s_stmt.where(Item.size.ilike(f"%{q.strip()}%"))
            s_res = await tenant_db.execute(s_stmt)
            for s in s_res.scalars().all():
                if s and s.strip() and s.strip() not in seen_codes:
                    seen_codes.add(s.strip())
                    rows.append({
                        "code": s.strip().upper(),
                        "name": s.strip(),
                        "scale": "Standard",
                        "standard": "UK/IND",
                        "sortOrder": 0,
                        "status": "Active",
                    })
            p_s_stmt = select(Product.size).where(Product.size.isnot(None), Product.is_deleted == False).distinct()
            if q and q.strip():
                p_s_stmt = p_s_stmt.where(Product.size.ilike(f"%{q.strip()}%"))
            p_s_res = await tenant_db.execute(p_s_stmt)
            for s in p_s_res.scalars().all():
                if s and s.strip() and s.strip() not in seen_codes:
                    seen_codes.add(s.strip())
                    rows.append({
                        "code": s.strip().upper(),
                        "name": s.strip(),
                        "scale": "Standard",
                        "standard": "UK/IND",
                        "sortOrder": 0,
                        "status": "Active",
                    })

        elif type_code == "category":
            cat_stmt = select(Item.category).where(Item.category.isnot(None), Item.is_deleted == False).distinct()
            if q and q.strip():
                cat_stmt = cat_stmt.where(Item.category.ilike(f"%{q.strip()}%"))
            cat_res = await tenant_db.execute(cat_stmt)
            for cat in cat_res.scalars().all():
                if cat and cat.strip() and cat.strip() not in seen_codes:
                    seen_codes.add(cat.strip())
                    rows.append({
                        "code": cat.strip().upper().replace(" ", "_"),
                        "name": cat.strip(),
                        "parent_code": "",
                        "description": cat.strip(),
                        "status": "Active",
                    })
            p_cat_stmt = select(Product.category).where(Product.category.isnot(None), Product.is_deleted == False).distinct()
            if q and q.strip():
                p_cat_stmt = p_cat_stmt.where(Product.category.ilike(f"%{q.strip()}%"))
            p_cat_res = await tenant_db.execute(p_cat_stmt)
            for cat in p_cat_res.scalars().all():
                if cat and cat.strip() and cat.strip() not in seen_codes:
                    seen_codes.add(cat.strip())
                    rows.append({
                        "code": cat.strip().upper().replace(" ", "_"),
                        "name": cat.strip(),
                        "parent_code": "",
                        "description": cat.strip(),
                        "status": "Active",
                    })

        elif type_code == "department":
            dept_stmt = select(Item.department).where(Item.department.isnot(None), Item.is_deleted == False).distinct()
            if q and q.strip():
                dept_stmt = dept_stmt.where(Item.department.ilike(f"%{q.strip()}%"))
            dept_res = await tenant_db.execute(dept_stmt)
            for dept in dept_res.scalars().all():
                if dept and dept.strip() and dept.strip() not in seen_codes:
                    seen_codes.add(dept.strip())
                    rows.append({
                        "code": dept.strip().upper().replace(" ", "_"),
                        "name": dept.strip(),
                        "division": "General",
                        "description": dept.strip(),
                        "status": "Active",
                    })
            if not rows:
                fallback_depts = [
                    ("LADIES_FTW", "Ladies Footwear", "Footwear"),
                    ("GENTS_FTW", "Gents Footwear", "Footwear"),
                    ("KIDS_FTW", "Kids Footwear", "Footwear"),
                    ("APPAREL", "Apparel & Garments", "Fashion"),
                    ("GENERAL", "General Merchandise", "Retail"),
                ]
                for code, name, div in fallback_depts:
                    if code not in seen_codes:
                        if not q or q.strip().lower() in name.lower() or q.strip().lower() in code.lower():
                            seen_codes.add(code)
                            rows.append({
                                "code": code,
                                "name": name,
                                "division": div,
                                "description": name,
                                "status": "Active",
                            })
    except Exception as exc:
        logger.warning(f"[MasterLookup] Notice during live catalog enrichment for {type_code}: {exc}")

    # Pagination & Contract Response
    offset = (page - 1) * page_size
    paged_items = rows[offset:offset + page_size]
    return {
        "items": paged_items,
        "total": len(rows),
        "page": page,
        "page_size": page_size,
        "has_next": (offset + page_size) < len(rows),
    }


# ============================================================================
# F2 UNIVERSAL LOOKUP ADAPTER ENDPOINTS (Contract Version 2.0.0)
# ============================================================================

@router.get("/uom", response_model=None)
@router.get("/uoms", response_model=None)
async def list_uoms_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    """F2 Universal Lookup adapter for Units of Measure (UOM)."""
    standard_uoms = [
        {"code": "PRS", "name": "Pairs (Footwear)", "type": "Footwear", "decimalPlaces": 0},
        {"code": "PCS", "name": "Pieces (Units)", "type": "Quantity", "decimalPlaces": 0},
        {"code": "BOX", "name": "Box / Carton", "type": "Packaging", "decimalPlaces": 0},
        {"code": "SET", "name": "Set (Multi-Piece)", "type": "Assembly", "decimalPlaces": 0},
        {"code": "KGS", "name": "Kilograms", "type": "Weight", "decimalPlaces": 3},
        {"code": "MTR", "name": "Meters", "type": "Length", "decimalPlaces": 2},
        {"code": "DOZ", "name": "Dozen (12 Pcs)", "type": "Pack", "decimalPlaces": 0},
        {"code": "PKT", "name": "Packet", "type": "Packaging", "decimalPlaces": 0},
        {"code": "ROLL", "name": "Roll", "type": "Length", "decimalPlaces": 0},
    ]
    if q and q.strip():
        term = q.strip().lower()
        standard_uoms = [u for u in standard_uoms if term in u["code"].lower() or term in u["name"].lower()]
    return standard_uoms[:limit]


@router.get("/hsn-codes", response_model=None)
async def list_hsn_codes_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    """F2 Universal Lookup adapter for HSN / SAC Codes & GST Rates."""
    standard_hsn = [
        {"code": "64041990", "desc": "Footwear with outer soles of rubber/plastics (Standard)", "gstPct": 12.0},
        {"code": "64029990", "desc": "Other footwear with outer soles of rubber (Economy)", "gstPct": 12.0},
        {"code": "64039990", "desc": "Footwear with outer soles of leather / composition leather", "gstPct": 18.0},
        {"code": "61091000", "desc": "T-shirts, singlets and other vests, knitted or crocheted, of cotton", "gstPct": 5.0},
        {"code": "62034200", "desc": "Men's or boys' trousers, bib and brace overalls, of cotton", "gstPct": 12.0},
        {"code": "62046200", "desc": "Women's or girls' trousers, bib and brace overalls, of cotton", "gstPct": 12.0},
        {"code": "42022100", "desc": "Handbags with outer surface of leather or composition leather", "gstPct": 18.0},
        {"code": "61159500", "desc": "Socks and other hosiery, knitted or crocheted, of cotton", "gstPct": 5.0},
        {"code": "85171300", "desc": "Smartphones / Handheld Electronic Devices", "gstPct": 18.0},
        {"code": "19053100", "desc": "Sweet biscuits, waffles and wafers", "gstPct": 18.0},
    ]
    if q and q.strip():
        term = q.strip().lower()
        standard_hsn = [h for h in standard_hsn if term in h["code"].lower() or term in h["desc"].lower()]
    return standard_hsn[:limit]


@router.get("/terms", response_model=None)
async def list_terms_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    """F2 Universal Lookup adapter for Commercial & Payment Terms."""
    standard_terms = [
        {"code": "NET30", "name": "Net 30 Days Credit", "creditDays": 30, "interestPct": 18.0},
        {"code": "NET15", "name": "Net 15 Days Credit", "creditDays": 15, "interestPct": 18.0},
        {"code": "NET45", "name": "Net 45 Days Credit", "creditDays": 45, "interestPct": 21.0},
        {"code": "NET60", "name": "Net 60 Days Credit", "creditDays": 60, "interestPct": 24.0},
        {"code": "COD", "name": "Cash on Delivery", "creditDays": 0, "interestPct": 0.0},
        {"code": "IMMEDIATE", "name": "Immediate Payment", "creditDays": 0, "interestPct": 0.0},
        {"code": "ADV50", "name": "50% Advance, Balance on Delivery", "creditDays": 7, "interestPct": 12.0},
        {"code": "PDC30", "name": "Post Dated Cheque 30 Days", "creditDays": 30, "interestPct": 15.0},
    ]
    if q and q.strip():
        term = q.strip().lower()
        standard_terms = [t for t in standard_terms if term in t["code"].lower() or term in t["name"].lower()]
    return standard_terms[:limit]


@router.get("/schemes", response_model=None)
async def list_schemes_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    """F2 Universal Lookup adapter for Promotional Schemes & Offers."""
    standard_schemes = [
        {"code": "FESTIVE10", "name": "Festive Flat 10% Discount", "type": "Percentage", "value": "10%", "validity": "Active"},
        {"code": "SEASON20", "name": "End of Season Flat 20% Off", "type": "Percentage", "value": "20%", "validity": "Active"},
        {"code": "BOGO_FTW", "name": "Buy 1 Get 1 on Footwear", "type": "BOGO", "value": "100% on 2nd", "validity": "Active"},
        {"code": "BULK500", "name": "Flat ₹500 Off on Orders > ₹5000", "type": "Flat Amount", "value": "₹500", "validity": "Active"},
        {"code": "LOYALTY5", "name": "Elite Loyalty Member 5% Rebate", "type": "Loyalty Tier", "value": "5%", "validity": "Active"},
    ]
    if q and q.strip():
        term = q.strip().lower()
        standard_schemes = [s for s in standard_schemes if term in s["code"].lower() or term in s["name"].lower()]
    return standard_schemes[:limit]


@router.get("/stores", response_model=None)
async def list_stores_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    control_db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """F2 Universal Lookup adapter for Chain Stores & Branches."""
    from ...models.tenant import Branch
    rows = []
    try:
        stmt = select(Branch).where(Branch.is_active == True)
        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(or_(Branch.name.ilike(term), Branch.code.ilike(term)))
        res = await control_db.execute(stmt)
        for b in res.scalars().all():
            rows.append({
                "code": b.code or b.id,
                "name": b.name,
                "city": getattr(b, "city", None) or "Mumbai",
                "state": getattr(b, "state", None) or "Maharashtra",
            })
    except Exception as exc:
        logger.warning(f"[MasterLookup] Notice reading stores/branches: {exc}")

    if not rows:
        fallback_stores = [
            {"code": "BR-MAIN-001", "name": "SMRITI Flagship Retail Terminal", "city": "Mumbai", "state": "Maharashtra"},
            {"code": "BR-NORTH-002", "name": "SMRITI North Regional Store", "city": "Delhi", "state": "Delhi"},
            {"code": "BR-SOUTH-003", "name": "SMRITI Fashion Galleria", "city": "Bengaluru", "state": "Karnataka"},
        ]
        if q and q.strip():
            term = q.strip().lower()
            fallback_stores = [s for s in fallback_stores if term in s["code"].lower() or term in s["name"].lower()]
        rows = fallback_stores
    return rows[:limit]


@router.get("/item-barcodes", response_model=None)
async def list_item_barcodes_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    tenant_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """F2 Universal Lookup adapter for Item Barcodes & Stock Numbers."""
    rows = []
    try:
        stmt = select(Product).where(Product.barcode.isnot(None), Product.is_deleted == False)
        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Product.barcode.ilike(term),
                    Product.code.ilike(term),
                    Product.name.ilike(term),
                    Product.sku.ilike(term),
                )
            )
        stmt = stmt.limit(limit)
        res = await tenant_db.execute(stmt)
        for p in res.scalars().all():
            rows.append({
                "barcode": p.barcode,
                "sku": p.sku or p.code,
                "name": p.name,
                "id": p.id,
            })
    except Exception as exc:
        logger.warning(f"[MasterLookup] Notice reading item barcodes: {exc}")
    return rows


