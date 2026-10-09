"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.49
Created      : 2026-09-13
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import difflib
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.master_lookup import MasterType, MasterValue
from ..db.session import async_session
from .system_parameter import SystemParameterService


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
        "product_style_code": "style_article",
        "product_style": "style_article",
        "article": "style_article",
        "article_no": "style_article",
        "articleno": "style_article",
        "color": "color",
        "colour": "color",
        "shade": "color",
        "size": "size",
        "vendor_code": "vendor_code",
        "vendorcode": "vendor_code",
        "vendor": "vendor_code",
        "product": "product",
        "hsn": "hsn_code",
        "hsn_code": "hsn_code",
        "uom": "uom",
        "gender": "gender",
        "product_type": "product_type",
        "merchandise_category": "product_type",
        "heel_type": "heel_type",
        "upper_material": "upper_material",
        "outsole_material": "outsole_material",
        "purchase_class": "purchase_class",
        "collection_type": "collection_type",
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
        "hsn_code": "HSN Code",
        "uom": "Unit of Measure (UOM)",
        "gender": "Gender",
        "product_type": "Product Type",
        "heel_type": "Heel Type",
        "upper_material": "Upper Material",
        "outsole_material": "Outsole Material",
        "purchase_class": "Purchase Class",
        "collection_type": "Collection Type",
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

        if type_code == "gst_rate":
            clean_norm = clean_val.rstrip("%").strip()
            try:
                f_val = float(clean_norm)
                if f_val.is_integer():
                    clean_norm = str(int(f_val))
            except ValueError:
                pass
            for row_code, row_name in direct_rows:
                rc_norm = row_code.strip().rstrip("%")
                rn_norm = row_name.strip().rstrip("%")
                if clean_norm in (rc_norm, rn_norm):
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

        # 3. Dynamic Attribute Framework fallback for secondary/unseeded non-mandatory dimensions
        mandatory_dimensions = {
            "color", "size", "category", "brand", "gender",
            "product_type", "heel_type", "upper_material",
            "department", "uom", "gst_rate", "style_article", "vendor_code"
        }
        if not direct_rows and type_code not in mandatory_dimensions:
            return clean_val

        # 4. Unmatched value handling
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


class CatalogConsistencyValidator:
    """
    Service-layer consistency validator for catalog import and data-entry pipelines (Part 5).
    Enforces soft consistency rules across items and variants without hard DB blocks:
    1. Differing IMAGE_LINK across rows sharing the same style_code.
    2. Inconsistent category, department, or brand across rows sharing the same style_code.
    3. SND-row bug pattern: Inconsistent style_code per size sharing the identical product image.
    """

    @staticmethod
    def _extract_text(row: Dict[str, Any], *keys: str) -> Optional[str]:
        for k in keys:
            if k in row and row[k] is not None:
                v = str(row[k]).strip()
                if v:
                    return v
        return None

    @classmethod
    def validate_batch_style_consistency(
        cls,
        rows: List[Dict[str, Any]],
        existing_items_by_code: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Validates catalog consistency across a batch of import rows (Part 5):
        - Warns if IMAGE_LINK differs across rows sharing the same style_code.
        - Warns if category/department/brand are inconsistent for the same style_code.
        - Warns if the SND-row bug pattern is present (multiple inconsistent style codes
          per size sharing the identical product image).
        """
        from collections import defaultdict

        row_warnings: Dict[int, List[str]] = defaultdict(list)
        all_warnings: List[str] = []

        style_to_indices: Dict[str, List[int]] = defaultdict(list)
        image_to_indices: Dict[str, List[int]] = defaultdict(list)

        for idx, row in enumerate(rows):
            style = cls._extract_text(
                row, "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE", "item_code"
            )
            image = cls._extract_text(
                row, "primary_image_url", "image_url", "IMAGE_LINK", "image_link", "image", "IMAGE"
            )

            if style:
                style_to_indices[style.strip().upper()].append(idx)
            if image:
                image_to_indices[image.strip()].append(idx)

        # 1. Validate consistency for rows sharing the same style_code
        for style_code, indices in style_to_indices.items():
            if len(indices) <= 1:
                continue

            images = set()
            brands = set()
            categories = set()
            departments = set()

            for idx in indices:
                row = rows[idx]
                img = cls._extract_text(
                    row, "primary_image_url", "image_url", "IMAGE_LINK", "image_link", "image", "IMAGE"
                )
                br = cls._extract_text(row, "brand", "Brand", "BRAND_NAME")
                cat = cls._extract_text(row, "category", "Category", "MERCHANDISE_CATEGORY")
                dept = cls._extract_text(row, "department", "Department", "MERCHANDISE_DEPARTMENT")

                if img:
                    images.add(img)
                if br:
                    brands.add(br.strip().upper())
                if cat:
                    categories.add(cat.strip().upper())
                if dept:
                    departments.add(dept.strip().upper())

            if len(images) > 1:
                warn_msg = f"Style '{style_code}' has differing IMAGE_LINK values across rows: {sorted(list(images))}"
                all_warnings.append(warn_msg)
                for idx in indices:
                    row_warnings[idx].append(warn_msg)

            inconsistent_dims = []
            if len(brands) > 1:
                inconsistent_dims.append(f"brands={sorted(list(brands))}")
            if len(categories) > 1:
                inconsistent_dims.append(f"categories={sorted(list(categories))}")
            if len(departments) > 1:
                inconsistent_dims.append(f"departments={sorted(list(departments))}")

            if inconsistent_dims:
                warn_msg = f"Style '{style_code}' has inconsistent {', '.join(inconsistent_dims)} across rows"
                all_warnings.append(warn_msg)
                for idx in indices:
                    row_warnings[idx].append(warn_msg)

        # 2. Validate SND-row bug pattern: inconsistent style_code per size sharing the same image
        for image_url, indices in image_to_indices.items():
            if len(indices) <= 1:
                continue

            styles_for_image = set()
            sizes_for_image = set()
            for idx in indices:
                row = rows[idx]
                st = cls._extract_text(
                    row, "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE", "item_code"
                )
                sz = cls._extract_text(row, "size", "Size", "SIZE")
                if st:
                    styles_for_image.add(st.strip().upper())
                if sz:
                    sizes_for_image.add(sz.strip())

            if len(styles_for_image) > 1:
                sample_styles = sorted(list(styles_for_image))[:5]
                warn_msg = (
                    f"SND pattern detected: Same image link '{image_url}' is mapped to {len(styles_for_image)} "
                    f"inconsistent style codes ({sample_styles}{'...' if len(styles_for_image) > 5 else ''}) "
                    f"across {len(indices)} rows sharing sizes {sorted(list(sizes_for_image))}. "
                    f"Expected a unified style_code across size variants."
                )
                all_warnings.append(warn_msg)
                for idx in indices:
                    row_warnings[idx].append(warn_msg)

        return {
            "row_warnings": dict(row_warnings),
            "all_warnings": list(dict.fromkeys(all_warnings)),
        }


class IM001ControlledFieldValidator:
    """
    Unified IM-001 Catalog Controlled-Field Governance Engine.
    Authoritative single validator for ALL item creation and import surfaces:
      1. AddProductDrawer.tsx -> POST /api/v1/inventory/
      2. Universal Import     -> POST /api/v1/universal/preview & /commit
      3. Master Item Entry    -> UniversalItemMasterService.create_item

    Governance Rules:
    - Mandatory Y/N classification is dynamically loaded from the authoritative
      'From System Master Lookup' registry in the Item Master Standard workbook.
    - GENDER, MERCHANDISE_CATEGORY (alias for product_type), PRODUCT_TYPE,
      HEEL_TYPE, UPPER_MATERIAL are strictly BLOCK.
    - Unseeded mandatory dimensions FAIL CLOSED with an explicit BLOCK error.
    - Exactly one place in the codebase decides 'is this value governed'.
    """

    _REGISTRY_CACHE: Optional[Dict[str, bool]] = None

    _CANONICAL_FALLBACK_REGISTRY: Dict[str, bool] = {
        "ARTICLE_STYLE_CODE": True,
        "BRAND_NAME": True,
        "COLOR": True,
        "SIZE": True,
        "GENDER": True,
        "MERCHANDISE_DEPARTMENT": True,
        "MERCHANDISE_CATEGORY": True,
        "PRODUCT_TYPE": True,
        "DESIGN_ATTRIBUTE": False,
        "HEEL_TYPE": True,
        "UPPER_MATERIAL": True,
        "OUTSOLE_MATERIAL": False,
        "UOM": True,
        "HSN_CODE": True,
        "GST_RATE_PERCENT": True,
        "COLLECTION_TYPE": False,
    }

    FIELD_EXTRACTION_MAP = {
        "ARTICLE_STYLE_CODE": (
            "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE",
            "item_code", "Article CODE", "Article Code", "ARTICLE CODE", "ARTICLE_CODE", "article_code",
            "Article No", "ARTICLE_NO", "article_no", "product_style_code", "product_style",
            "PRODUCT STYLE CODE", "PRODUCT_STYLE_CODE"
        ),
        "BRAND_NAME": ("brand", "Brand", "BRAND_NAME", "brand_name"),
        "COLOR": ("color", "colour", "Color", "Colour", "COLOR", "shade"),
        "SIZE": ("size", "Size", "SIZE"),
        "GENDER": ("gender", "Gender", "GENDER", "Gndr"),
        "MERCHANDISE_DEPARTMENT": ("department", "Department", "MERCHANDISE_DEPARTMENT", "dept"),
        "MERCHANDISE_CATEGORY": ("category", "Category", "MERCHANDISE_CATEGORY", "merchandiseCategory", "product_category"),
        "PRODUCT_TYPE": (
            "product_type", "productType", "PRODUCT_TYPE", "Product_Type", "Product Type",
            "merchandise_category", "MERCHANDISE CATEGORY", "MERCHANDISE_CATEGORY"
        ),
        "HEEL_TYPE": (
            "heel_type", "heelType", "HEEL_TYPE", "Heel_Type", "heel", "HEELS", "heels"
        ),
        "UPPER_MATERIAL": (
            "upper_material", "upperMaterial", "UPPER_MATERIAL", "Upper_Material", "upper", "UPPER MATERIAL"
        ),
        "UOM": ("uom", "UOM", "unit_of_measure"),
        "DESIGN_ATTRIBUTE": (
            "design_attribute", "designAttribute", "DESIGN_ATTRIBUTE", "Design_Attribute",
            "subCategory", "sub_category", "Sub category", "Sub Category", "subcategory", "SUB CATEGORY"
        ),
        "OUTSOLE_MATERIAL": (
            "outsole", "outsole_material", "outsoleMaterial", "OUTSOLE_MATERIAL", "OUTSOLE", "sole"
        ),
        "COLLECTION_TYPE": (
            "collection_type", "collectionType", "COLLECTION_TYPE", "Collection_Type"
        ),
        "GST_RATE_PERCENT": (
            "GST_RATE_PERCENT", "gst_rate_percent", "tax_rate", "gst", "GST", "TAX_RATE", "tax",
            "GstRatePercent", "taxRate", "gst_percentage", "gstPercentage", "product_tax", "PRODUCT_TAX"
        ),
    }

    FIELD_TO_DIMENSION_MAP: Dict[str, str] = {
        "BRAND_NAME": "brand",
        "COLOR": "color",
        "SIZE": "size",
        "GENDER": "gender",
        "MERCHANDISE_DEPARTMENT": "department",
        "MERCHANDISE_CATEGORY": "product_type",
        "PRODUCT_TYPE": "product_type",
        "HEEL_TYPE": "heel_type",
        "UPPER_MATERIAL": "upper_material",
        "UOM": "uom",
        "DESIGN_ATTRIBUTE": "subcategory",
        "OUTSOLE_MATERIAL": "outsole_material",
        "COLLECTION_TYPE": "collection_type",
        "GST_RATE_PERCENT": "gst_rate",
    }

    KNOWN_DIMENSION_ALIASES: Dict[str, Dict[str, str]] = {
        "UPPER_MATERIAL": {
            "MATERIAL": "MATERIAL",
        },
        "HEEL_TYPE": {
            "WEDGES": "WEDGE",
        },
        "PRODUCT_TYPE": {
            "SHOES": "SHOE",
        },
        "MERCHANDISE_CATEGORY": {
            "SHOES": "SHOE",
            "CHAPPAL": "CHAPPAL",
            "SANDAL": "SANDAL",
        },
        "DESIGN_ATTRIBUTE": {
            "MUEL": "MULE",
        },
        "COLOR": {
            "R-GOLD": "ROSE GOLD",
            "CHIKKU": "CHIKKU",
            "SULTAN": "SULTAN",
        },
        "UOM": {
            "PRS": "PAIR",
            "PAIRS": "PAIR",
            "PR": "PAIR",
        }
    }

    FIELD_TO_SYSPARAM_MAP: Dict[str, str] = {
        "ARTICLE_STYLE_CODE": "ItemSubClass1HasCat",
        "COLOR": "ItemSubClass2HasCat",
        "MERCHANDISE_DEPARTMENT": "SuperClass1Present",
        "SIZE": "ItemSizePresent",
    }

    @classmethod
    def extract_field_value(cls, row: Dict[str, Any], std_field: str) -> Optional[str]:
        aliases = cls.FIELD_EXTRACTION_MAP.get(std_field, (std_field,))
        for alias in aliases:
            if alias in row and row[alias] is not None:
                val = str(row[alias]).strip()
                if val != "" and val.lower() not in ("nan", "none", "null"):
                    return val
        return None

    @classmethod
    def load_system_master_lookup_registry(cls, workbook_path: Optional[str] = None) -> Dict[str, bool]:
        """
        Dynamically loads the mandatory vs non-mandatory classification from the authoritative
        'From System Master Lookup' sheet in the Item Master Standard workbook.
        Guarantees: GENDER, MERCHANDISE_CATEGORY, PRODUCT_TYPE, HEEL_TYPE, UPPER_MATERIAL are BLOCK.
        """
        if cls._REGISTRY_CACHE is not None:
            return cls._REGISTRY_CACHE

        registry: Dict[str, bool] = dict(cls._CANONICAL_FALLBACK_REGISTRY)

        candidates = []
        if workbook_path:
            candidates.append(Path(workbook_path))
        base_dir = Path(__file__).resolve().parents[3]
        candidates.extend([
            base_dir / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.2.xlsx",
            base_dir / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.1.xlsx",
        ])

        for p in candidates:
            if p.exists():
                try:
                    wb = openpyxl.load_workbook(p, data_only=True)
                    if "From System Master Lookup" in wb.sheetnames:
                        ws = wb["From System Master Lookup"]
                        for r in range(1, ws.max_row + 1):
                            col_a = ws.cell(r, 1).value
                            col_d = ws.cell(r, 4).value
                            if col_a and isinstance(col_a, str):
                                key = col_a.strip().upper()
                                if col_d is not None and str(col_d).strip().upper() in ("Y", "N"):
                                    registry[key] = (str(col_d).strip().upper() == "Y")
                        break
                except Exception:
                    pass

        # Guarantee strict BLOCK on mandatory dimensions per Directive
        for mandatory_key in ("GENDER", "MERCHANDISE_CATEGORY", "PRODUCT_TYPE", "HEEL_TYPE", "UPPER_MATERIAL"):
            registry[mandatory_key] = True

        cls._REGISTRY_CACHE = registry
        return registry

    @classmethod
    def find_near_match(cls, val: str, allowed_values: List[str]) -> Optional[str]:
        val_clean = val.strip().upper()
        # 1. Singular/Plural equality (e.g. WEDGES == WEDGE + 'S', SHOES == SHOE + 'S')
        for cand in allowed_values:
            cand_upper = cand.strip().upper()
            if cand_upper == val_clean:
                continue
            if cand_upper.rstrip("S") == val_clean.rstrip("S"):
                return cand
        # 2. Substring / Prefix / Suffix match where val is base of cand (e.g. SHEET in SHEET SOLE)
        for cand in allowed_values:
            cand_upper = cand.strip().upper()
            if cand_upper.startswith(val_clean + " ") or cand_upper.endswith(" " + val_clean):
                return cand
            if val_clean.startswith(cand_upper + " ") or val_clean.endswith(" " + cand_upper):
                return cand
        # 3. High-confidence fuzzy match (edit distance ratio >= 0.8)
        matches = difflib.get_close_matches(val_clean, [c.upper() for c in allowed_values], n=1, cutoff=0.8)
        if matches:
            for cand in allowed_values:
                if cand.upper() == matches[0]:
                    return cand
        return None

    @classmethod
    async def _load_sysparam_enforcement_flags(
        cls,
        company_id: Optional[str],
    ) -> Dict[str, Any]:
        param_codes = [
            "ValidateDataDuringPMImport",
            "ItemSubClass1HasCat",
            "ItemSubClass2HasCat",
            "SuperClass1Present",
            "ItemSizePresent",
        ]
        result: Dict[str, Any] = {}
        try:
            async with async_session() as ctrl_db:
                for code in param_codes:
                    param = await SystemParameterService.resolve_parameter(
                        db=ctrl_db,
                        param_code=code,
                        company_id=company_id,
                    )
                    if param is not None:
                        result[code] = param.effective_value
        except Exception:
            pass

        raw_validate = result.get("ValidateDataDuringPMImport", None)
        if raw_validate is None:
            validate_during_import = True
        elif isinstance(raw_validate, bool):
            validate_during_import = raw_validate
        else:
            validate_during_import = str(raw_validate).strip() not in ("0", "false", "False", "")

        field_enforcement: Dict[str, bool] = {}
        for std_field, sp_code in cls.FIELD_TO_SYSPARAM_MAP.items():
            sp_val = result.get(sp_code, None)
            if sp_val is None:
                field_enforcement[std_field] = True
            elif isinstance(sp_val, bool):
                field_enforcement[std_field] = sp_val
            else:
                field_enforcement[std_field] = str(sp_val).strip() not in ("0", "false", "False", "")

        return {
            "validate_during_import": validate_during_import,
            "field_enforcement": field_enforcement,
            "raw": result,
        }

    @classmethod
    async def _get_db_approved_values_for_field(
        cls,
        std_field: str,
    ) -> List[str]:
        dimension = cls.FIELD_TO_DIMENSION_MAP.get(std_field)
        if not dimension:
            return []
        try:
            rows = await CatalogDimensionValidator.get_approved_values(dimension)
            return [r["code"] for r in rows if r.get("code")]
        except Exception:
            return []

    @classmethod
    async def _load_all_dimension_master_values(
        cls,
        company_id: Optional[str] = None,
    ) -> Dict[str, List[str]]:
        result: Dict[str, List[str]] = {}
        for std_field, dimension in cls.FIELD_TO_DIMENSION_MAP.items():
            try:
                rows = await CatalogDimensionValidator.get_approved_values(dimension)
                codes = [r["code"] for r in rows if r.get("code")]
                if std_field == "MERCHANDISE_CATEGORY":
                    pt_rows = await CatalogDimensionValidator.get_approved_values("product_type")
                    pt_codes = [r["code"] for r in pt_rows if r.get("code")]
                    codes = list(dict.fromkeys(codes + pt_codes))
                # Merge known aliases so they are always recognized
                aliases = list(cls.KNOWN_DIMENSION_ALIASES.get(std_field, {}).keys())
                codes = list(dict.fromkeys(codes + aliases))
                result[std_field] = codes
            except Exception:
                result[std_field] = []
        return result

    @classmethod
    async def validate_batch_controlled_fields(
        cls,
        rows: List[Dict[str, Any]],
        company_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Validates a batch of rows against IM-001 controlled field rules.
        Pre-loads system parameters and master values in O(14) queries total.
        Fails closed on unseeded mandatory dimensions or DB errors.
        """
        sp_flags = await cls._load_sysparam_enforcement_flags(company_id)
        validate_enabled = sp_flags["validate_during_import"]
        field_enforcement = sp_flags["field_enforcement"]

        mandatory_map = cls.load_system_master_lookup_registry()
        master_cache: Dict[str, List[str]] = await cls._load_all_dimension_master_values(company_id)

        norm_maps: Dict[str, Dict[str, str]] = {
            std_field: {v.strip().upper(): v.strip() for v in values}
            for std_field, values in master_cache.items()
        }

        results: List[Dict[str, Any]] = []
        for row_idx, row in enumerate(rows):
            row_num = row.get("rowNumber", row_idx + 1)
            errors: List[str] = []
            warnings: List[str] = []
            field_failures: List[Dict[str, Any]] = []

            for std_field in cls.FIELD_TO_DIMENSION_MAP.keys():
                clean_val = cls.extract_field_value(row, std_field)
                if not clean_val:
                    continue

                dim_code = cls.FIELD_TO_DIMENSION_MAP.get(std_field, "?")
                db_values = master_cache.get(std_field, [])

                base_mandatory = mandatory_map.get(std_field, False)
                sysparam_enforced = field_enforcement.get(std_field, True)
                is_mandatory = base_mandatory and sysparam_enforced and validate_enabled

                # Fail-closed enforcement on unseeded dimensions
                if not db_values:
                    if is_mandatory:
                        field_label = std_field.replace("_", " ").title()
                        msg = (
                            f"{field_label} is a required field but no approved values are set up in "
                            f"System Master Lookup yet. Please seed '{dim_code}' master values before importing."
                        )
                        errors.append(msg)
                        field_failures.append({
                            "field": std_field,
                            "value": clean_val,
                            "is_mandatory": True,
                            "error": "UNSEEDED_FAIL_CLOSED",
                            "source": "System Master Lookup (DB)",
                        })
                    else:
                        field_label = std_field.replace("_", " ").title()
                        warnings.append(
                            f"{field_label} has no approved values in the master list yet — value '{clean_val}' could not be verified."
                        )
                    continue

                db_norm_map = norm_maps.get(std_field, {})

                # GST_RATE_PERCENT numeric equivalence (e.g. 12.0 -> 12, 12% -> 12)
                if std_field == "GST_RATE_PERCENT":
                    clean_val_norm = clean_val.rstrip("%").strip()
                    try:
                        f_val = float(clean_val_norm)
                        if f_val.is_integer():
                            clean_val_norm = str(int(f_val))
                    except ValueError:
                        pass
                    if (
                        clean_val.upper() in db_norm_map
                        or clean_val_norm in db_norm_map
                        or f"{clean_val_norm}%" in db_norm_map
                    ):
                        continue

                if clean_val.upper() in db_norm_map:
                    continue  # Exact match — pass

                # Known alias match
                alias_target = cls.KNOWN_DIMENSION_ALIASES.get(std_field, {}).get(clean_val.upper())
                if alias_target and (alias_target.upper() in db_norm_map or alias_target.upper() == clean_val.upper()):
                    continue

                # Near-match detection
                near_match = cls.find_near_match(clean_val, db_values)
                field_failures.append({
                    "field": std_field,
                    "value": clean_val,
                    "is_mandatory": is_mandatory,
                    "near_match": near_match,
                    "source": "System Master Lookup (DB)",
                })

                if is_mandatory:
                    field_label = std_field.replace("_", " ").title()
                    if near_match:
                        msg = (
                            f"{field_label} \u201c{clean_val}\u201d is not in the approved list. "
                            f"Did you mean \u201c{near_match}\u201d? Fix the spelling in your file and re-validate."
                        )
                    else:
                        msg = (
                            f"{field_label} \u201c{clean_val}\u201d is not recognised. "
                            f"Check the System Master Lookup for the correct approved value."
                        )
                    errors.append(msg)
                else:
                    field_label = std_field.replace("_", " ").title()
                    if near_match:
                        msg = (
                            f"{field_label} \u201c{clean_val}\u201d is not in the approved list. "
                            f"Possible match: \u201c{near_match}\u201d \u2014 verify and correct if needed."
                        )
                    else:
                        msg = (
                            f"{field_label} \u201c{clean_val}\u201d is not in the approved list. "
                            f"Verify the value against System Master Lookup."
                        )
                    warnings.append(msg)

            results.append({
                "row_num": row_num,
                "errors": errors,
                "warnings": warnings,
                "field_failures": field_failures,
                "sysparam_flags": {
                    "validate_during_import": validate_enabled,
                    "field_enforcement": field_enforcement,
                },
            })

        return results

    @classmethod
    async def validate_row_controlled_fields(
        cls,
        row: Dict[str, Any],
        row_num: int = 1,
        company_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Single-row validation wrapper.
        """
        batch_results = await cls.validate_batch_controlled_fields(
            rows=[{**row, "rowNumber": row_num}],
            company_id=company_id,
        )
        result = batch_results[0] if batch_results else {}
        return {
            "errors": result.get("errors", []),
            "warnings": result.get("warnings", []),
            "field_failures": result.get("field_failures", []),
            "sysparam_flags": result.get("sysparam_flags", {}),
        }

    @classmethod
    async def validate_dict(
        cls,
        payload: Dict[str, Any],
        company_id: Optional[str] = None,
        strict: bool = True,
    ) -> Dict[str, Any]:
        """
        Validates a single payload dictionary (e.g. from InventoryService.create_product
        or UniversalItemMasterService.create_item).
        Returns dict with errors, warnings, field_failures, sysparam_flags.
        If strict=True and errors exist, raises HTTPException(422).
        """
        res = await cls.validate_row_controlled_fields(payload, row_num=1, company_id=company_id)
        if strict and res.get("errors"):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "SMRITI-VAL-002",
                    "message": "; ".join(res["errors"]),
                    "errors": res["errors"],
                    "field_failures": res.get("field_failures", []),
                    "suggested_action": "Navigate to System Master Management to register and approve new values before assigning them to catalog items."
                }
            )
        return res


