"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.8
Created      : 2026-10-30
Modified     : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""Strict resolution of Item Master taxonomy values against control-plane lookups."""

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.master_lookup import MasterType, MasterValue


PRODUCT_TAXONOMY_LOOKUPS = {
    "brand": "brand",
    "category": "category",
    "product_type": "product_type",
    "gender": "gender",
    "department": "department",
    "heel_type": "heel_type",
    "upper_material": "upper_material",
    "outsole_material": "outsole_material",
    "sub_category": "subcategory",
    "subcategory": "subcategory",
}

PRODUCT_ATTRIBUTE_LOOKUP_FIELDS = {
    "brand": "brand",
    "category": "category",
    "product_type": "product_type",
    "gender": "gender",
    "department": "department",
    "heel_type": "heel_type",
    "heelType": "heel_type",
    "upper_material": "upper_material",
    "upperMaterial": "upper_material",
    "outsole_material": "outsole_material",
    "outsoleMaterial": "outsole_material",
    "sub_category": "sub_category",
    "subcategory": "sub_category",
    "subCategory": "sub_category",
}


async def resolve_product_taxonomy_value(
    db: AsyncSession,
    dimension: str,
    value: str,
) -> str:
    lookup_code = PRODUCT_TAXONOMY_LOOKUPS.get(dimension)
    if lookup_code is None:
        raise ValueError(f"Unsupported product taxonomy dimension: {dimension}")

    normalized_value = value.strip()
    if not normalized_value:
        raise HTTPException(status_code=422, detail=f"{dimension} cannot be blank.")

    type_result = await db.execute(
        select(MasterType.id).where(MasterType.code == lookup_code)
    )
    master_type_id = type_result.scalar_one_or_none()
    if master_type_id is None:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Required Master Registry lookup type '{lookup_code}' is not configured. "
                "Configure it before adding this value to Item Master; direct entry is not allowed."
            ),
        )

    value_result = await db.execute(
        select(MasterValue).where(
            MasterValue.master_type_id == master_type_id,
            MasterValue.active.is_(True),
            or_(MasterValue.is_deleted.is_(False), MasterValue.is_deleted.is_(None)),
            or_(
                func.lower(func.trim(MasterValue.code)) == normalized_value.lower(),
                func.lower(func.trim(MasterValue.name)) == normalized_value.lower(),
            ),
        )
    )
    matches = list(value_result.scalars().all())
    exact_name_matches = [
        item for item in matches
        if item.name.strip() == normalized_value
    ]
    code_matches = [
        item for item in matches
        if item.code.strip().casefold() == normalized_value.casefold()
    ]
    candidates = exact_name_matches or code_matches or matches

    if not candidates:
        raise HTTPException(
            status_code=422,
            detail=(
                f"{dimension} '{normalized_value}' is not an active Master Registry value. "
                f"Add and approve it under lookup type '{lookup_code}' in Master Registry first; "
                "direct Item Master entry is not allowed."
            ),
        )
    if len(candidates) != 1:
        raise HTTPException(
            status_code=409,
            detail=f"{dimension} '{normalized_value}' matches multiple active Master Lookup values.",
        )

    canonical_name = candidates[0].name.strip()
    if not canonical_name or len(canonical_name) > 100:
        raise HTTPException(
            status_code=503,
            detail=f"Master Lookup value for '{lookup_code}' has an invalid canonical name.",
        )
    return canonical_name


async def resolve_product_attribute_lookup_values(
    db: AsyncSession,
    attributes: dict,
) -> dict:
    """Resolve controlled Item Master attributes to active Master Registry labels."""
    resolved_attributes = dict(attributes or {})
    for attribute_key, dimension in PRODUCT_ATTRIBUTE_LOOKUP_FIELDS.items():
        value = resolved_attributes.get(attribute_key)
        if value is None or not str(value).strip():
            continue
        resolved_attributes[attribute_key] = await resolve_product_taxonomy_value(
            db, dimension, str(value)
        )
    return resolved_attributes
