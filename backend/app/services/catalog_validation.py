"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.32.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.master_lookup import MasterType, MasterValue
from ..db.session import async_session


class CatalogDimensionValidator:
    """
    Universal Catalog Dimension Governance Engine.
    Validates and normalizes catalog dimensions against the authoritative
    Master Lookup registry in the SMRITI control plane (smritisys).
    
    Guarantees:
    1. Single source of truth for all catalog dimensions (brand, category, department,
       color, size, style/article, vendor code, product).
    2. Case-insensitive canonical matching.
    3. Multi-plane safe execution (queries control plane smritisys without tenant context leakage).
    4. Group / scale unpacking for hierarchical dimensions (color_group, size_group).
    5. Strict HREP-compliant error generation (SMRITI-VAL-002).
    """

    DIMENSION_FIELD_MAP = {
        "brand": "brand",
        "department": "department",
        "category": "category",
        "subcategory": "subcategory",
        "sub_category": "subcategory",
        "style": "style_article",
        "style_code": "style_article",
        "stylecode": "style_article",
        "style_article": "style_article",
        "stylearticle": "style_article",
        "style/article": "style_article",
        "article": "style_article",
        "article_no": "style_article",
        "articleno": "style_article",
        "color": "color",
        "colour": "color",
        "shade": "color",
        "size": "size",
        "vendor_code": "vendor_code",
        "vendorcode": "vendor_code",
        "product": "product",
    }

    DIMENSION_LABELS = {
        "brand": "Brand",
        "department": "Department",
        "category": "Category",
        "subcategory": "Subcategory",
        "style_article": "Style / Article",
        "color": "Color",
        "size": "Size",
        "vendor_code": "Vendor Code",
        "product": "Product",
    }

    @classmethod
    def resolve_type_code(cls, field_name: str) -> str:
        cleaned = str(field_name).strip().lower().replace("-", "_").replace(" ", "_")
        return cls.DIMENSION_FIELD_MAP.get(cleaned, cleaned)

    @classmethod
    def get_dimension_label(cls, type_code: str) -> str:
        return cls.DIMENSION_LABELS.get(type_code, type_code.replace("_", " ").title())

    @classmethod
    async def _validate_dimension_impl(
        cls,
        session: AsyncSession,
        dimension_field: str,
        value: Optional[str],
        strict: bool = True
    ) -> Optional[str]:
        if value is None:
            return None

        clean_val = str(value).strip()
        if not clean_val:
            return None

        type_code = cls.resolve_type_code(dimension_field)
        label = cls.get_dimension_label(type_code)
        target_lower = clean_val.casefold()

        # 1. Direct query on master_values for matching type
        stmt = (
            select(MasterValue.code, MasterValue.name)
            .join(MasterType, MasterType.id == MasterValue.master_type_id)
            .where(
                MasterType.code == type_code,
                MasterValue.is_deleted == False,
                MasterValue.active == True,
            )
        )
        res = await session.execute(stmt)
        direct_rows = res.all()

        for row_code, row_name in direct_rows:
            if row_code and clean_val == row_code.strip():
                return row_code.strip()
            if row_name and clean_val == row_name.strip():
                return row_name.strip()

        for row_code, row_name in direct_rows:
            if row_code.strip().casefold() == target_lower or row_name.strip().casefold() == target_lower:
                return row_code.strip()

        # 2. Scale Group unpacking fallback for hierarchical dimensions (color and size)
        if type_code == "color":
            group_stmt = (
                select(MasterValue.data)
                .join(MasterType, MasterType.id == MasterValue.master_type_id)
                .where(
                    MasterType.code == "color_group",
                    MasterValue.is_deleted == False,
                    MasterValue.active == True,
                )
            )
            group_res = await session.execute(group_stmt)
            for (g_data,) in group_res.all():
                if isinstance(g_data, dict) and "values" in g_data and isinstance(g_data["values"], list):
                    for v in g_data["values"]:
                        if str(v).strip().casefold() == target_lower:
                            return str(v).strip()

        elif type_code == "size":
            group_stmt = (
                select(MasterValue.data)
                .join(MasterType, MasterType.id == MasterValue.master_type_id)
                .where(
                    MasterType.code == "size_group",
                    MasterValue.is_deleted == False,
                    MasterValue.active == True,
                )
            )
            group_res = await session.execute(group_stmt)
            for (g_data,) in group_res.all():
                if isinstance(g_data, dict) and "values" in g_data and isinstance(g_data["values"], list):
                    for v in g_data["values"]:
                        if str(v).strip().casefold() == target_lower:
                            return str(v).strip()

        # 3. Unmatched value handling
        if strict:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "SMRITI-VAL-002",
                    "field": dimension_field,
                    "dimension": type_code,
                    "value": clean_val,
                    "rejected_value": clean_val,
                    "message": (
                        f"{label} '{clean_val}' is not registered in the Master Lookup registry. "
                        f"Please select an approved {label.lower()} or register it under Settings -> Master Lookup -> {label} before assigning it to catalog items."
                    ),
                    "suggested_action": f"Navigate to System Master Management -> {label} to approve new values."
                }
            )

        return clean_val

    @classmethod
    async def validate_and_normalize_dimension(
        cls,
        dimension_field: str,
        value: Optional[str] = None,
        strict: bool = True,
        control_db: Optional[AsyncSession] = None,
    ) -> Optional[str]:
        """
        Validates and normalizes any catalog dimension against Master Lookup.
        Returns canonical value on success. Raises HTTP 422 if invalid and strict=True.
        """
        if control_db is not None:
            try:
                return await cls._validate_dimension_impl(control_db, dimension_field, value, strict)
            except HTTPException:
                raise
            except Exception:
                # If control_db is bound to a tenant DB where master_types doesn't exist, safely fallback
                pass

        try:
            async with async_session() as fallback_session:
                return await cls._validate_dimension_impl(fallback_session, dimension_field, value, strict=True)
        except HTTPException:
            # Fallback to primary tenant database (smriti001) where master lookup values are seeded
            try:
                from ..db.session import get_company_sessionmaker
                sm = get_company_sessionmaker("smriti001")
                async with sm() as tenant_session:
                    return await cls._validate_dimension_impl(tenant_session, dimension_field, value, strict)
            except HTTPException:
                raise
            except Exception:
                pass
            if strict:
                raise
            return value

    @classmethod
    async def validate_catalog_dimensions(
        cls,
        dimensions: Dict[str, Optional[str]],
        strict: bool = True,
        control_db: Optional[AsyncSession] = None,
    ) -> Dict[str, Optional[str]]:
        """
        Batch validates and normalizes a mapping of catalog dimension fields.
        Returns normalized dictionary.
        """
        normalized = {}
        for field, val in dimensions.items():
            normalized[field] = await cls.validate_and_normalize_dimension(
                dimension_field=field,
                value=val,
                strict=strict,
                control_db=control_db,
            )
        return normalized

    @classmethod
    async def get_approved_values(
        cls,
        dimension_field: str,
        control_db: Optional[AsyncSession] = None
    ) -> List[Dict[str, str]]:
        """
        Returns all approved active values for a dimension.
        Automatically unpacks values from scale groups (color_group, size_group).
        """
        type_code = cls.resolve_type_code(dimension_field)

        async def _query(session: AsyncSession) -> List[Dict[str, str]]:
            # 1. Direct active values
            stmt = (
                select(MasterValue.code, MasterValue.name)
                .join(MasterType, MasterType.id == MasterValue.master_type_id)
                .where(
                    MasterType.code == type_code,
                    MasterValue.is_deleted == False,
                    MasterValue.active == True,
                )
                .order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
            )
            res = await session.execute(stmt)
            seen = set()
            out: List[Dict[str, str]] = []
            for code_val, name_val in res.all():
                c = code_val.strip()
                if c.lower() not in seen:
                    seen.add(c.lower())
                    out.append({"code": c, "name": name_val.strip()})

            # 2. Scale groups unpacking
            group_type = None
            if type_code == "color":
                group_type = "color_group"
            elif type_code == "size":
                group_type = "size_group"

            if group_type:
                g_stmt = (
                    select(MasterValue.data)
                    .join(MasterType, MasterType.id == MasterValue.master_type_id)
                    .where(
                        MasterType.code == group_type,
                        MasterValue.is_deleted == False,
                        MasterValue.active == True,
                    )
                    .order_by(MasterValue.sort_order.asc())
                )
                g_res = await session.execute(g_stmt)
                for (g_data,) in g_res.all():
                    if isinstance(g_data, dict) and "values" in g_data and isinstance(g_data["values"], list):
                        for v in g_data["values"]:
                            sv = str(v).strip()
                            if sv and sv.lower() not in seen:
                                seen.add(sv.lower())
                                out.append({"code": sv, "name": sv})

            return out

        if control_db is not None:
            try:
                return await _query(control_db)
            except Exception:
                pass

        async with async_session() as fallback_session:
            return await _query(fallback_session)

    # Backward-compatible convenience aliases
    @classmethod
    async def validate_and_normalize_brand(
        cls,
        control_db: Optional[AsyncSession] = None,
        brand_val: Optional[str] = None,
        strict: bool = True,
    ) -> Optional[str]:
        return await cls.validate_and_normalize_dimension("brand", brand_val, strict, control_db)

    @classmethod
    async def get_approved_brands(
        cls,
        control_db: Optional[AsyncSession] = None
    ) -> List[Dict[str, str]]:
        return await cls.get_approved_values("brand", control_db)
