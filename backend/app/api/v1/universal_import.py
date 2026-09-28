"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.20.0
Created      : 2026-08-25
Modified     : 2026-09-28 (Wire IM-001 through System Parameters and System Master Lookup)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import difflib
import hashlib
import json
import uuid
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import openpyxl
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
from ...models.audit import ComplianceImmutableAuditLog
from ...models.item_master import Item, ItemVariant, ItemBarcode, ItemWarehouseLocation
from ...models.pricing import PriceBook, PriceBookEntry
from ...models.purchase import Supplier
from ...models.inventory import Product, Warehouse
from ...schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate
from ...schemas.stock_acct import StockMovementRecordRequest
from ...schemas.sales import SalesReturnCreate, SalesReturnItemCreate
from ...schemas.pricing import PriceBookEntryCreateRequest
from ...services.pricing_engine import PricingEngine
from ...services.item_master_svc import UniversalItemMasterService
from ...services.purchase import PurchaseService
from ...services.stock_acct_svc import StockAccountingBoundaryService
from ...services.sales import SalesService
from ...services.catalog_validation import CatalogConsistencyValidator, CatalogDimensionValidator
from ...services.system_parameter import SystemParameterService
from ...db.session import async_session

router = APIRouter()


class ImportPreviewRequest(BaseModel):
    target: str = Field(..., min_length=1)
    rows: List[Dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class ImportCommitRequest(ImportPreviewRequest):
    idempotency_key: str = Field(..., min_length=8, max_length=150)
    price_book_id: Optional[str] = None
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    receipt_no: Optional[str] = None
    reason: Optional[str] = None
    original_invoice_id: Optional[str] = None
    return_no: Optional[str] = None
    price_mode: Optional[str] = "DO_NOT_CREATE"  # DO_NOT_CREATE, CREATE_AS_DRAFT, CREATE_LIVE_RETAIL
    existing_match_mode: Optional[str] = "SKIP"  # SKIP, UPDATE_METADATA_AND_PRICE, FAIL_ON_EXISTING


def _text(row: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _candidate_payload(item: Item, variant: Optional[ItemVariant] = None) -> Dict[str, Any]:
    return {
        "item_id": item.id,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "variant_id": variant.id if variant else None,
        "variant_sku": variant.variant_sku if variant else None,
        "variant_name": variant.variant_name if variant else None,
        "brand": item.brand,
        "attributes": (variant.attributes_json if variant else item.attributes_json) or {},
        "mrp": float((variant.mrp if variant else item.mrp) or 0),
        "selling_price": float((variant.selling_price if variant else item.selling_price) or 0),
    }


async def _resolve_row(db: AsyncSession, row: Dict[str, Any]) -> Dict[str, Any]:
    barcode = _text(row, "barcode", "Barcode", "ean", "upc")
    sku = _text(row, "sku", "SKU", "variant_sku")
    item_code = _text(row, "item_code", "itemCode", "Item Code")
    style = _text(row, "styleArticle", "style", "article", "Style / Article")
    size = _text(row, "size", "Size")
    color = _text(row, "color", "colour", "Color", "Colour")
    brand = _text(row, "brand", "Brand")

    if barcode:
        match = await UniversalItemMasterService.lookup_by_barcode(db, barcode)
        if match:
            return {"status": "MATCHED", "match_type": "BARCODE", "match": match}

    if sku or item_code:
        code = sku or item_code
        item = await UniversalItemMasterService.get_item_by_code(db, code)
        if item:
            return {"status": "MATCHED", "match_type": "SKU" if sku else "ITEM_CODE", "match": _candidate_payload(item)}

        variant_stmt = (
            select(ItemVariant)
            .join(ItemVariant.item)
            .where(ItemVariant.variant_sku == code.upper(), ItemVariant.is_deleted == False)
            .options(selectinload(ItemVariant.item))
        )
        variant = (await db.execute(variant_stmt)).scalar_one_or_none()
        if variant and variant.item:
            return {"status": "MATCHED", "match_type": "VARIANT_SKU", "match": _candidate_payload(variant.item, variant)}

    if style and size and color:
        candidates_stmt = (
            select(ItemVariant)
            .join(ItemVariant.item)
            .where(
                ItemVariant.is_deleted == False,
                ItemVariant.attributes_json["size"].as_string() == size,
                ItemVariant.attributes_json["color"].as_string() == color,
                Item.attributes_json["style"].as_string() == style,
            )
            .options(selectinload(ItemVariant.item))
        )
        candidates = (await db.execute(candidates_stmt)).scalars().all()
        if brand:
            candidates = [candidate for candidate in candidates if (candidate.item.brand or "").lower() == brand.lower()]
        if len(candidates) == 1:
            return {"status": "MATCHED", "match_type": "STYLE_SIZE_COLOR", "match": _candidate_payload(candidates[0].item, candidates[0])}
        if len(candidates) > 1:
            return {
                "status": "AMBIGUOUS",
                "match_type": "STYLE_SIZE_COLOR",
                "candidates": [_candidate_payload(candidate.item, candidate) for candidate in candidates[:20]],
            }

    return {"status": "NOT_FOUND"}


class IM001ControlledFieldValidator:
    """
    IM-001 Controlled Master Field Governance Engine.
    Enforces rule IM-001 ('Controlled master fields use System Master Lookup' — Action: BLOCK)
    defined in SMRITI Item Master Creation Standard v2.2 (Validation Rules).

    Resolution order (two-tier):
    1. PRIMARY — CatalogDimensionValidator.get_approved_values() against master_values in the
       control plane (smritisys) or tenant DB.  If this returns any values, they govern.
    2. FALLBACK — Workbook 'Validation Lists' sheet from
       assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx,
       mtime-cached so workbook edits take effect without a server restart.

    Enforcement level per field is governed by system parameters (from system_parameters table):
    - ValidateDataDuringPMImport: global gate (val_text '2' means full validation).
    - ItemSubClass1HasCat  → enforces ARTICLE_STYLE_CODE lookup as BLOCK.
    - ItemSubClass2HasCat  → enforces COLOR lookup as BLOCK.
    - SuperClass1Present   → enforces MERCHANDISE_DEPARTMENT lookup as BLOCK.
    - ItemSizePresent      → enforces SIZE lookup as BLOCK.
    When a system parameter gates a field as not-enforced, IM-001 downgrades that
    field from BLOCK to Advisory (warning only), regardless of the workbook flag.

    Mandatory vs Non-Mandatory base classification is dynamically extracted from the
    workbook's 'From System Master Lookup' sheet (Y = BLOCK, N = Advisory).
    System parameter enforcement flags can only downgrade, never upgrade.

    Near-match detection:
    - Case and whitespace differences are normalized automatically.
    - True value mismatches with high similarity (e.g. WEDGES vs WEDGE, SHOES vs SHOE,
      SHEET vs SHEET SOLE) are NOT silently coalesced; surfaced explicitly as
      'near-match, needs architect decision'.
    """

    _cached_mtime: Optional[float] = None
    _cached_validation_lists: Dict[str, List[str]] = {}
    _cached_normalized_lists: Dict[str, Dict[str, str]] = {}
    _cached_mandatory_map: Dict[str, bool] = {}

    STANDARD_WORKBOOK_RELATIVE_PATHS = [
        Path("assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"),
        Path("../assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"),
        Path("../../assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"),
        Path("../../../assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"),
        Path("../../../../assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"),
    ]

    FIELD_EXTRACTION_MAP = {
        "BRAND_NAME": ("brand", "Brand", "BRAND_NAME"),
        "COLOR": ("color", "colour", "Color", "Colour", "COLOR"),
        "SIZE": ("size", "Size", "SIZE"),
        "GENDER": ("gender", "Gender", "GENDER", "Gndr"),
        "MERCHANDISE_DEPARTMENT": ("department", "Department", "MERCHANDISE_DEPARTMENT"),
        "MERCHANDISE_CATEGORY": ("category", "Category", "MERCHANDISE_CATEGORY"),
        "PRODUCT_TYPE": (
            "product_type", "productType", "PRODUCT_TYPE", "Product_Type", "Product Type"
        ),
        "HEEL_TYPE": (
            "heel_type", "heelType", "HEEL_TYPE", "Heel_Type", "heel", "HEELS"
        ),
        "UPPER_MATERIAL": (
            "upper_material", "upperMaterial", "UPPER_MATERIAL", "Upper_Material", "upper", "UPPER MATERIAL"
        ),
        "UOM": ("uom", "UOM", "unit_of_measure"),
        "DESIGN_ATTRIBUTE": (
            "design_attribute", "designAttribute", "DESIGN_ATTRIBUTE", "Design_Attribute",
            "sub_category", "Sub category", "Sub Category"
        ),
        "OUTSOLE_MATERIAL": (
            "outsole", "outsole_material", "outsoleMaterial", "OUTSOLE_MATERIAL", "OUTSOLE", "sole"
        ),
        "COLLECTION_TYPE": (
            "collection_type", "collectionType", "COLLECTION_TYPE", "Collection_Type", "ITEM DESCRIPTION"
        ),
    }

    # Maps each standard field name to the CatalogDimensionValidator dimension code
    # so DB-resident approved values can be fetched as the primary source.
    FIELD_TO_DIMENSION_MAP: Dict[str, str] = {
        "BRAND_NAME": "brand",
        "COLOR": "color",
        "SIZE": "size",
        "GENDER": "gender",
        "MERCHANDISE_DEPARTMENT": "department",
        "MERCHANDISE_CATEGORY": "category",
        "PRODUCT_TYPE": "product_type",
        "HEEL_TYPE": "heel_type",
        "UPPER_MATERIAL": "upper_material",
        "UOM": "uom",
        "DESIGN_ATTRIBUTE": "subcategory",
        "OUTSOLE_MATERIAL": "outsole_material",
        "COLLECTION_TYPE": "collection_type",
    }

    # Maps each standard field to the system parameter that controls whether it is
    # enforced as a lookup (True = BLOCK, False = downgrade to Advisory).
    # Fields not in this map use the workbook mandatory flag directly.
    FIELD_TO_SYSPARAM_MAP: Dict[str, str] = {
        "ARTICLE_STYLE_CODE": "ItemSubClass1HasCat",
        "COLOR": "ItemSubClass2HasCat",
        "MERCHANDISE_DEPARTMENT": "SuperClass1Present",
        "SIZE": "ItemSizePresent",
    }

    @classmethod
    def _find_standard_workbook(cls) -> Optional[Path]:
        import os
        custom_env = os.environ.get("SMRITI_ITEM_MASTER_STANDARD_PATH")
        if custom_env and Path(custom_env).is_file():
            return Path(custom_env)

        try:
            repo_root = Path(__file__).resolve().parents[4]
            cand = repo_root / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"
            if cand.is_file():
                return cand
        except Exception:
            pass

        for rel in cls.STANDARD_WORKBOOK_RELATIVE_PATHS:
            if rel.is_file():
                return rel.resolve()

        return None

    @classmethod
    def load_standard_lists(cls) -> Tuple[Dict[str, List[str]], Dict[str, Dict[str, str]], Dict[str, bool]]:
        wb_path = cls._find_standard_workbook()
        if not wb_path or not wb_path.is_file():
            return cls._cached_validation_lists, cls._cached_normalized_lists, cls._cached_mandatory_map

        current_mtime = wb_path.stat().st_mtime
        if cls._cached_mtime == current_mtime and cls._cached_validation_lists:
            return cls._cached_validation_lists, cls._cached_normalized_lists, cls._cached_mandatory_map

        import openpyxl
        wb = openpyxl.load_workbook(wb_path, data_only=True)

        mandatory_map: Dict[str, bool] = {}
        if "From System Master Lookup" in wb.sheetnames:
            ws_lookup = wb["From System Master Lookup"]
            for row in ws_lookup.iter_rows(values_only=True):
                if row and row[0]:
                    field_name = str(row[0]).strip().upper()
                    is_mand = False
                    for c in row[1:]:
                        if c is not None and str(c).strip().upper() in ("Y", "N"):
                            is_mand = (str(c).strip().upper() == "Y")
                            break
                    mandatory_map[field_name] = is_mand

        validation_lists: Dict[str, List[str]] = {}
        normalized_lists: Dict[str, Dict[str, str]] = {}
        if "Validation Lists" in wb.sheetnames:
            ws_vl = wb["Validation Lists"]
            for col in ws_vl.iter_cols(values_only=True):
                header = str(col[0]).strip() if col[0] is not None else None
                if header:
                    header_key = header.strip().upper()
                    items = [str(c).strip() for c in col[1:] if c is not None and str(c).strip()]
                    validation_lists[header_key] = items
                    normalized_lists[header_key] = {item.upper(): item for item in items}

        cls._cached_mtime = current_mtime
        cls._cached_validation_lists = validation_lists
        cls._cached_normalized_lists = normalized_lists
        cls._cached_mandatory_map = mandatory_map

        return validation_lists, normalized_lists, mandatory_map

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
        """
        Reads system parameters from the control plane that govern whether each
        catalog dimension field is enforced as a lookup BLOCK or downgraded to Advisory.
        
        Returns a dict with:
          - 'validate_during_import': bool  (ValidateDataDuringPMImport gate)
          - 'field_enforcement': Dict[str, bool]  field_name -> True=BLOCK, False=Advisory
        """
        param_codes = [
            "ValidateDataDuringPMImport",
            "ItemSubClass1HasCat",   # style lookup
            "ItemSubClass2HasCat",   # color/shade lookup
            "SuperClass1Present",    # department lookup
            "ItemSizePresent",       # size lookup
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
            # If control plane is unreachable, fall back to workbook defaults (all mandatory fields enforced)
            pass

        # ValidateDataDuringPMImport: val_text '2' = full validation, '0' or '1' = limited.
        # Treat anything that resolves to a truthy text/int (not '0') as validation enabled.
        raw_validate = result.get("ValidateDataDuringPMImport", None)
        if raw_validate is None:
            validate_during_import = True  # default: validate
        elif isinstance(raw_validate, bool):
            validate_during_import = raw_validate
        else:
            # val_text '2' means validate, '0' means skip validation
            validate_during_import = str(raw_validate).strip() not in ("0", "false", "False", "")

        # Per-field enforcement flags: if the system parameter is False (disabled), downgrade to Advisory
        field_enforcement: Dict[str, bool] = {}
        for std_field, sp_code in cls.FIELD_TO_SYSPARAM_MAP.items():
            sp_val = result.get(sp_code, None)
            if sp_val is None:
                # Parameter not found → treat field as enforced (safe default)
                field_enforcement[std_field] = True
            elif isinstance(sp_val, bool):
                field_enforcement[std_field] = sp_val
            else:
                # val_text '1' or '0'
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
        """
        Queries CatalogDimensionValidator.get_approved_values() from the control plane
        (and tenant fallback) for the dimension that backs std_field.
        Returns a list of canonical value strings, or [] if not found / DB empty.
        """
        dimension = cls.FIELD_TO_DIMENSION_MAP.get(std_field)
        if not dimension:
            return []
        try:
            rows = await CatalogDimensionValidator.get_approved_values(dimension)
            return [r["code"] for r in rows if r.get("code")]
        except Exception:
            return []

    @classmethod
    async def validate_row_controlled_fields(
        cls,
        row: Dict[str, Any],
        row_num: int,
        company_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Async version.  Resolution order:
          1. System parameters (control plane) → gate and per-field enforcement level
          2. CatalogDimensionValidator.get_approved_values() (DB master_values) → primary allowed list
          3. Workbook Validation Lists → fallback allowed list
        """
        val_lists, norm_lists, mand_map = cls.load_standard_lists()

        # Tier 1: load system parameter enforcement flags
        sp_flags = await cls._load_sysparam_enforcement_flags(company_id)
        validate_enabled = sp_flags["validate_during_import"]
        field_enforcement = sp_flags["field_enforcement"]

        errors: List[str] = []
        warnings: List[str] = []
        field_failures: List[Dict[str, Any]] = []

        for std_field, aliases in cls.FIELD_EXTRACTION_MAP.items():
            raw_val = _text(row, *aliases)
            if not raw_val:
                continue

            # Tier 2: try DB-resident approved values first
            db_values = await cls._get_db_approved_values_for_field(std_field)
            if db_values:
                # Build lookup from DB values; normalize for case-insensitive match
                db_norm_map: Dict[str, str] = {v.strip().upper(): v.strip() for v in db_values}
                effective_allowed = db_values
                effective_norm_map = db_norm_map
                source_label = "System Master Lookup"
            else:
                # Tier 3: fall back to workbook Validation Lists
                effective_allowed = val_lists.get(std_field, [])
                effective_norm_map = norm_lists.get(std_field, {})
                source_label = "Standard Validation List (workbook fallback)"

            # Case and whitespace auto-normalize:
            clean_val = raw_val.strip()
            if clean_val.upper() in effective_norm_map:
                continue  # value matched — no flag

            # No match. Determine enforcement level.
            near_match = cls.find_near_match(clean_val, effective_allowed)

            # Base mandatory flag from workbook; system parameters can only downgrade (not upgrade).
            workbook_mandatory = mand_map.get(std_field, False)
            # If system parameter explicitly sets field as non-enforced, downgrade to Advisory.
            sysparam_enforced = field_enforcement.get(std_field, True)  # default: enforce
            is_mandatory = workbook_mandatory and sysparam_enforced and validate_enabled

            failure_info = {
                "field": std_field,
                "value": clean_val,
                "is_mandatory": is_mandatory,
                "near_match": near_match,
                "source": source_label,
            }
            field_failures.append(failure_info)

            if is_mandatory:
                if near_match:
                    msg = (
                        f"IM-001: Controlled field '{std_field}' value '{clean_val}' not found in {source_label} "
                        f"(near-match to '{near_match}', needs architect decision)."
                    )
                else:
                    msg = f"IM-001: Controlled field '{std_field}' value '{clean_val}' not found in {source_label}."
                errors.append(msg)
            else:
                if near_match:
                    msg = (
                        f"IM-001 [Advisory]: Non-mandatory field '{std_field}' value '{clean_val}' not found in {source_label} "
                        f"(near-match to '{near_match}', needs architect decision)."
                    )
                else:
                    msg = f"IM-001 [Advisory]: Non-mandatory field '{std_field}' value '{clean_val}' not found in {source_label}."
                warnings.append(msg)

        return {
            "errors": errors,
            "warnings": warnings,
            "field_failures": field_failures,
            "sysparam_flags": {
                "validate_during_import": validate_enabled,
                "field_enforcement": field_enforcement,
            },
        }


@router.post("/preview", summary="Preview universal import rows")
async def preview_universal_import(
    request: ImportPreviewRequest,
    db: AsyncSession = Depends(get_company_db),
    _current_user: Any = Depends(get_current_user),
    current_user: Optional[Any] = None,
    tenant: Optional[Any] = None,
) -> Dict[str, Any]:
    """Resolve rows without creating products, changing stock, or changing prices."""
    effective_user = current_user or _current_user
    if request.target.upper().strip() == "ITEM_MASTER":
        company_id = getattr(effective_user, "company_id", None) or (effective_user.get("company_id") if isinstance(effective_user, dict) else "COMP-001")
        reconciliation_report: List[Dict[str, Any]] = []
        batch_barcodes = set()
        batch_skus = set()
        seen_styles = set()
        processed_styles = set()
        summary = {
            "total_rows": len(request.rows),
            "valid_rows": 0,
            "new_rows": 0,
            "existing_match_rows": 0,
            "existing_conflict_rows": 0,
            "duplicate_in_file_rows": 0,
            "invalid_rows": 0,
            "pricing_conflicts": 0,
            "distinct_styles": 0,
            "warning_rows": 0,
            "warnings": [],
            "status": "READY_FOR_IMPORT",
        }
        consistency_report = CatalogConsistencyValidator.validate_batch_style_consistency(request.rows)
        row_consistency_warnings = consistency_report["row_warnings"]
        all_consistency_warnings = consistency_report["all_warnings"]

        for index, row in enumerate(request.rows, start=1):
            row_num = row.get("rowNumber", index)
            barcode = _text(row, "barcode", "Barcode", "BARCODE_NO", "ean", "upc")
            sku = _text(row, "sku", "SKU", "variant_sku", "SKU_CODE", "SKU_PREVIEW")
            style = _text(row, "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE", "item_code")
            color = _text(row, "color", "colour", "Color", "Colour", "COLOR")
            size = _text(row, "size", "Size", "SIZE")
            vendor_code = _text(row, "vendor_code", "vendorCode", "VENDOR_CODE", "supplier_code", "supplierCode", "vendor")
            mrp_val = float(row.get("mrp", row.get("MRP", 0)) or 0)
            selling_val = float(row.get("sellingPrice", row.get("price", row.get("SELLING_PRICE", 0))) or 0)
            warehouse_code = _text(row, "warehouse_code", "WAREHOUSE_CODE", "warehouse_id")

            errors = []
            duplicate_in_file = False
            pricing_conflict = False

            # Supplier / Vendor Code Linkage Validation
            supplier_match = None
            if vendor_code:
                clean_vcode = vendor_code.strip().upper()
                sup_stmt = select(Supplier).where(
                    (Supplier.company_id == company_id) | (Supplier.company_id.is_(None)),
                    (func.upper(Supplier.code) == clean_vcode) | (Supplier.id == vendor_code.strip()),
                    Supplier.is_deleted == False
                )
                supplier_match = (await db.execute(sup_stmt)).scalars().first()
                if not supplier_match:
                    errors.append(f"Vendor code '{vendor_code}' does not match any registered Supplier in company {company_id}.")

            if not barcode:
                errors.append("Missing BARCODE_NO")
            elif barcode in batch_barcodes:
                duplicate_in_file = True
                errors.append(f"Duplicate barcode within file: {barcode}")

            if not sku:
                if style and color and size:
                    sku = f"{style}-{color}-{size}".upper()
                else:
                    errors.append("Missing SKU_CODE or Style/Color/Size")
            elif sku in batch_skus:
                duplicate_in_file = True
                errors.append(f"Duplicate SKU within file: {sku}")

            if selling_val > mrp_val and mrp_val > 0:
                pricing_conflict = True
                errors.append(f"SELLING_PRICE ({selling_val}) > MRP ({mrp_val})")

            # IM-001: Controlled Master Field Lookup Validation
            # Two-tier: System Master Lookup (DB) primary, Workbook fallback.
            # Enforcement level gated by system parameters from control plane.
            im001_res = await IM001ControlledFieldValidator.validate_row_controlled_fields(
                row, row_num, company_id=company_id
            )
            for err in im001_res["errors"]:
                errors.append(err)
            for warn in im001_res["warnings"]:
                row_consistency_warnings.setdefault(index - 1, []).append(warn)
                if warn not in all_consistency_warnings:
                    all_consistency_warnings.append(warn)

            # Part 6: HSN / GST Soft Validation (Human Review Flag - Warn, do not block)
            upper_mat = _text(row, "upper_material", "upperMaterial", "UPPER_MATERIAL", "Upper_Material", "upper") or ""
            row_hsn = _text(row, "hsn", "hsn_code", "HSN_CODE", "HSN") or ""
            row_tax = float(row.get("tax_rate", row.get("gst", row.get("GST_RATE_PERCENT", 18))) or 18)
            synthetic_keywords = ("synthetic", "rubber", "plastic", "pvc", "pu", "faux", "mesh", "textile", "canvas")
            if any(kw in upper_mat.lower() for kw in synthetic_keywords) and row_hsn.strip().startswith("6403"):
                hsn_msg = (
                    f"HSN/Material Mismatch Flag: Upper material '{upper_mat}' indicates synthetic/rubber/plastic "
                    f"but HSN code '{row_hsn}' belongs to chapter 6403 (leather-upper footwear). Flagged for human/CA sign-off (REQUIRES_REVIEW)."
                )
                row_consistency_warnings.setdefault(index - 1, []).append(hsn_msg)
                if hsn_msg not in all_consistency_warnings:
                    all_consistency_warnings.append(hsn_msg)

            if selling_val > 2500 and row_tax <= 5:
                gst_msg = (
                    f"GST Slab Flag: Selling price ({selling_val}) crosses Rs. 2,500 but GST tax rate is {row_tax}%. "
                    f"Flagged for human/CA sign-off (REQUIRES_REVIEW)."
                )
                row_consistency_warnings.setdefault(index - 1, []).append(gst_msg)
                if gst_msg not in all_consistency_warnings:
                    all_consistency_warnings.append(gst_msg)
            elif 0 < selling_val < 2500 and row_tax >= 18:
                gst_msg = (
                    f"GST Slab Flag: Selling price ({selling_val}) is below Rs. 2,500 but GST tax rate is {row_tax}%. "
                    f"Flagged for human/CA sign-off (REQUIRES_REVIEW)."
                )
                row_consistency_warnings.setdefault(index - 1, []).append(gst_msg)
                if gst_msg not in all_consistency_warnings:
                    all_consistency_warnings.append(gst_msg)

            # Check DB barcode
            db_bc = None
            if barcode:
                db_bc = await UniversalItemMasterService.lookup_by_barcode(db, barcode)

            # Check DB SKU
            existing_var = None
            if sku:
                existing_var = (await db.execute(
                    select(ItemVariant).where(ItemVariant.variant_sku == sku.upper(), ItemVariant.is_deleted == False)
                )).scalar_one_or_none()

            # Check DB Style
            db_item = None
            if style:
                item_stmt = select(Item).where(
                    Item.company_id == company_id,
                    Item.item_code == style,
                    Item.is_deleted == False
                )
                db_item = (await db.execute(item_stmt)).scalars().first()

            # 6-State Reconciliation Decision Hierarchy
            if duplicate_in_file:
                reconciliation_state = "DUPLICATE_IN_FILE"
                row_status = "INVALID"
                action = "BLOCK"
            elif errors:
                reconciliation_state = "INVALID"
                row_status = "INVALID"
                action = "BLOCK"
            elif db_bc:
                existing_item_code = (db_bc.get("item_code") or "").strip().upper()
                existing_variant_sku = (db_bc.get("variant_sku") or "").strip().upper()
                incoming_style = (style or "").strip().upper()
                incoming_sku = (sku or "").strip().upper()

                if (existing_variant_sku == incoming_sku) or (existing_item_code == incoming_style):
                    reconciliation_state = "EXISTING_MATCH"
                    row_status = "VALID"
                    action = "SKIP"
                else:
                    reconciliation_state = "EXISTING_CONFLICT"
                    row_status = "INVALID"
                    action = "BLOCK"
                    errors.append(
                        f"Barcode {barcode} conflicts with existing database item '{db_bc.get('item_name')}' ({existing_item_code}/{existing_variant_sku})"
                    )
            elif existing_var:
                if db_item and existing_var.item_id == db_item.id:
                    reconciliation_state = "EXISTING_MATCH"
                    row_status = "VALID"
                    action = "SKIP"
                else:
                    reconciliation_state = "EXISTING_CONFLICT"
                    row_status = "INVALID"
                    action = "BLOCK"
                    errors.append(f"SKU {sku} already exists in database under different item")
            else:
                reconciliation_state = "NEW"
                row_status = "VALID"
                if style and (style in processed_styles or db_item):
                    action = "ATTACH_VARIANT_TO_STYLE"
                else:
                    action = "CREATE_ITEM_AND_VARIANT"
                    if style:
                        processed_styles.add(style)

            if barcode:
                batch_barcodes.add(barcode)
            if sku:
                batch_skus.add(sku)
            if style:
                seen_styles.add(style)

            # Accumulate metrics
            if reconciliation_state == "NEW":
                summary["new_rows"] += 1
            elif reconciliation_state == "EXISTING_MATCH":
                summary["existing_match_rows"] += 1
            elif reconciliation_state == "EXISTING_CONFLICT":
                summary["existing_conflict_rows"] += 1
            elif reconciliation_state == "DUPLICATE_IN_FILE":
                summary["duplicate_in_file_rows"] += 1
            elif reconciliation_state == "INVALID":
                summary["invalid_rows"] += 1

            if row_status == "VALID":
                summary["valid_rows"] += 1
            if pricing_conflict:
                summary["pricing_conflicts"] += 1

            reconciliation_report.append({
                "row_number": row_num,
                "barcode": barcode,
                "sku": sku,
                "style_code": style,
                "status": row_status,
                "reconciliation_state": reconciliation_state,
                "action": action,
                "errors": errors,
                "warnings": row_consistency_warnings.get(index - 1, []),
                "color": color,
                "size": size,
                "vendor_code": supplier_match.code.upper() if supplier_match else (vendor_code or None),
                "mrp": mrp_val,
                "selling_price": selling_val,
                "warehouse_code": warehouse_code or "WH-MAIN",
            })

        summary["distinct_styles"] = len(seen_styles)
        summary["warnings"] = all_consistency_warnings
        summary["warning_rows"] = len(row_consistency_warnings)
        if summary["existing_conflict_rows"] == 0 and summary["duplicate_in_file_rows"] == 0 and summary["invalid_rows"] == 0:
            summary["status"] = "READY_FOR_IMPORT"
        else:
            summary["status"] = "VALIDATION_ISSUES_FOUND"

        return {
            "target": "ITEM_MASTER",
            "summary": summary,
            "counts": {
                "total": summary["total_rows"],
                "valid": summary["valid_rows"],
                "invalid": summary["total_rows"] - summary["valid_rows"],
                "new": summary["new_rows"],
                "existing_match": summary["existing_match_rows"],
                "existing_conflict": summary["existing_conflict_rows"],
                "duplicate_in_file": summary["duplicate_in_file_rows"],
                "pricing_conflicts": summary["pricing_conflicts"],
                "distinct_styles": summary["distinct_styles"],
                # Backward-compatibility aliases
                "duplicate_barcodes": summary["existing_conflict_rows"] + summary["duplicate_in_file_rows"],
                "duplicate_skus": summary["duplicate_in_file_rows"],
            },
            "rows": reconciliation_report,
        }

    results: List[Dict[str, Any]] = []
    purchase_items: List[PurchaseReceiptItemCreate] = []
    return_items: List[SalesReturnItemCreate] = []
    counts = {"total": len(request.rows), "matched": 0, "ambiguous": 0, "not_found": 0}

    for index, row in enumerate(request.rows, start=1):
        result = await _resolve_row(db, row)
        result["row_number"] = row.get("rowNumber", index)
        result["input"] = row
        results.append(result)
        counts[result["status"].lower()] = counts.get(result["status"].lower(), 0) + 1

    return {"target": request.target, "counts": counts, "rows": results}


@router.post("/commit", status_code=status.HTTP_200_OK, summary="Commit a universal import")
async def commit_universal_import(
    request: ImportCommitRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    """Commit the first governed target, Price Book, after server-side re-resolution."""
    target = request.target.upper().strip()
    if target not in {"PRICE_BOOK", "ITEM_MASTER", "PURCHASE_INWARD", "STOCK_ADJUSTMENT", "SALES_RETURN", "LABEL_PRINT"}:
        raise HTTPException(status_code=501, detail="This target is preview-only until its domain commit adapter is enabled.")
    if target == "PRICE_BOOK" and not request.price_book_id:
        raise HTTPException(status_code=400, detail="price_book_id is required for Price Book imports.")
    if target == "PURCHASE_INWARD" and not request.supplier_id:
        raise HTTPException(status_code=400, detail="supplier_id is required for Purchase Inward imports.")
    if target in {"STOCK_ADJUSTMENT", "SALES_RETURN"} and not request.reason:
        raise HTTPException(status_code=400, detail="reason is required for Stock Adjustment imports.")
    if target == "SALES_RETURN" and (not request.original_invoice_id or not request.return_no):
        raise HTTPException(status_code=400, detail="original_invoice_id and return_no are required for Sales Return imports.")
    company_id = getattr(current_user, "company_id", None) or (current_user.get("company_id") if isinstance(current_user, dict) else "COMP-001")
    user_id = getattr(current_user, "id", None) or getattr(current_user, "username", None) or (current_user.get("sub") if isinstance(current_user, dict) else "usr-system")
    payload_hash = hashlib.sha256(request.model_dump_json().encode("utf-8")).hexdigest()

    prior_stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.company_id == company_id,
        ComplianceImmutableAuditLog.event_type == "UNIVERSAL_IMPORT_COMMIT",
        ComplianceImmutableAuditLog.entity_id == request.idempotency_key,
        ComplianceImmutableAuditLog.payload_hash == payload_hash,
    )
    prior = (await db.execute(prior_stmt)).scalars().first()
    if prior:
        return {"success": True, "idempotent_replay": True, "idempotency_key": request.idempotency_key, "results": []}

    resolved_rows: List[Dict[str, Any]] = []
    for index, row in enumerate(request.rows, start=1):
        resolution = await _resolve_row(db, row)
        if resolution.get("status") == "AMBIGUOUS" and row.get("selected_variant_id"):
            selected_stmt = (
                select(ItemVariant)
                .join(ItemVariant.item)
                .where(
                    ItemVariant.id == str(row["selected_variant_id"]),
                    ItemVariant.is_deleted == False,
                )
                .options(selectinload(ItemVariant.item))
            )
            selected_variant = (await db.execute(selected_stmt)).scalars().first()
            if selected_variant and selected_variant.item:
                resolution = {"status": "MATCHED", "match_type": "USER_SELECTED", "match": _candidate_payload(selected_variant.item, selected_variant)}
        elif resolution.get("status") == "AMBIGUOUS" and row.get("selected_item_id"):
            selected_item = (await db.execute(select(Item).where(Item.id == str(row["selected_item_id"]), Item.is_deleted == False))).scalars().first()
            if selected_item:
                resolution = {"status": "MATCHED", "match_type": "USER_SELECTED", "match": _candidate_payload(selected_item)}
        if target == "ITEM_MASTER":
            barcode = _text(row, "barcode", "Barcode", "BARCODE_NO", "ean", "upc")
            sku = _text(row, "sku", "SKU", "variant_sku", "SKU_CODE", "SKU_PREVIEW")
            style_code = _text(row, "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE", "item_code")
            item_name = _text(row, "item_name", "itemName", "name", "ITEM_DESCRIPTION", "product_name") or style_code or sku or barcode

            if not (barcode or sku or style_code):
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "At least one identifier (Barcode, SKU, or Style Code) is required."})

            match_mode = (request.existing_match_mode or "SKIP").upper().strip()
            if match_mode == "FAIL_ON_EXISTING":
                if barcode:
                    existing_bc = (await db.execute(
                        select(ItemBarcode).where(ItemBarcode.company_id == company_id, ItemBarcode.barcode == barcode.strip().upper(), ItemBarcode.is_deleted == False)
                    )).scalars().first()
                    if existing_bc:
                        raise HTTPException(status_code=409, detail={"row_number": row.get("rowNumber", index), "message": f"Barcode '{barcode}' already exists in database."})

                if sku:
                    existing_sku = (await db.execute(
                        select(ItemVariant).where(ItemVariant.company_id == company_id, ItemVariant.variant_sku == sku.strip().upper(), ItemVariant.is_deleted == False)
                    )).scalars().first()
                    if existing_sku:
                        raise HTTPException(status_code=409, detail={"row_number": row.get("rowNumber", index), "message": f"SKU '{sku}' already exists in database."})

            vendor_code = _text(row, "vendor_code", "vendorCode", "VENDOR_CODE", "supplier_code", "supplierCode", "vendor")
            resolved_vendor_code = None
            if vendor_code:
                clean_vcode = vendor_code.strip().upper()
                sup_stmt = select(Supplier).where(
                    (Supplier.company_id == company_id) | (Supplier.company_id.is_(None)),
                    (func.upper(Supplier.code) == clean_vcode) | (Supplier.id == vendor_code.strip()),
                    Supplier.is_deleted == False
                )
                supplier_match = (await db.execute(sup_stmt)).scalars().first()
                if not supplier_match:
                    raise HTTPException(
                        status_code=422,
                        detail={"row_number": row.get("rowNumber", index), "message": f"Vendor code '{vendor_code}' does not match any registered Supplier in company {company_id}."}
                    )
                resolved_vendor_code = supplier_match.code.upper()

            resolved_rows.append({
                "row": row,
                "item_name": item_name,
                "item_code": style_code or sku or barcode,
                "style_code": style_code or sku or barcode,
                "barcode": barcode,
                "sku": sku,
                "vendor_code": resolved_vendor_code,
            })
            continue

        if target in {"PRICE_BOOK", "PURCHASE_INWARD", "STOCK_ADJUSTMENT", "SALES_RETURN", "LABEL_PRINT"} and resolution.get("status") != "MATCHED":
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "status": resolution.get("status"), "message": "Every row must resolve to one product before commit."})

        if target == "PURCHASE_INWARD":
            match = resolution["match"]
            product_stmt = select(Product).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
                (Product.item_id == match["item_id"]) | (Product.barcode == match.get("barcode")),
            )
            product = (await db.execute(product_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Matched canonical item has no legacy inventory product for GRN posting."})
            quantity = row.get("quantity", row.get("qty"))
            cost_price = row.get("costPrice", row.get("price", row.get("sellingPrice")))
            if quantity is None or float(quantity) <= 0 or cost_price is None:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Quantity and cost price are required for Purchase Inward."})
            resolved_rows.append({"row": row, "match": match, "product": product, "quantity": quantity, "cost_price": cost_price})
            continue

        if target == "STOCK_ADJUSTMENT":
            match = resolution["match"]
            product_stmt = select(Product).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
                (Product.item_id == match["item_id"]) | (Product.barcode == match.get("barcode")),
            )
            product = (await db.execute(product_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Matched item has no inventory product for stock adjustment."})
            quantity = row.get("quantity", row.get("qty"))
            if quantity is None or float(quantity) <= 0:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "A positive quantity is required for Stock Adjustment."})
            resolved_rows.append({"row": row, "match": match, "product": product, "quantity": quantity})
            continue

        if target == "SALES_RETURN":
            match = resolution["match"]
            product_stmt = select(Product).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
                (Product.item_id == match["item_id"]) | (Product.barcode == match.get("barcode")),
            )
            product = (await db.execute(product_stmt)).scalars().first()
            quantity = row.get("quantity", row.get("qty"))
            if not product or quantity is None or float(quantity) <= 0:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "A matched product and positive return quantity are required."})
            resolved_rows.append({"row": row, "match": match, "product": product, "quantity": quantity})
            continue

        if target == "LABEL_PRINT":
            quantity = row.get("quantity", row.get("qty", 1))
            if float(quantity or 0) <= 0:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "A positive quantity is required for Label Printing."})
            resolved_rows.append({"row": row, "match": resolution["match"], "quantity": quantity})
            continue

        mrp = row.get("mrp")
        selling_price = row.get("sellingPrice", row.get("price"))
        cost_price = row.get("costPrice")
        if mrp is None or selling_price is None:
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "MRP and selling price are required for Price Book imports."})
        if float(selling_price) > float(mrp):
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Selling price cannot be greater than MRP."})

        match = resolution["match"]
        entry_request = PriceBookEntryCreateRequest(
            item_id=match["item_id"],
            variant_id=match.get("variant_id"),
            min_quantity=float(row.get("quantity", row.get("qty", 1)) or 1),
            selling_price=float(selling_price),
            mrp=float(mrp),
            cost_price=float(cost_price) if cost_price is not None and str(cost_price).strip() else None,
        )
        resolved_rows.append({"row": row, "match": match, "request": entry_request})

    results: List[Dict[str, Any]] = []
    purchase_items: List[PurchaseReceiptItemCreate] = []
    return_items: List[SalesReturnItemCreate] = []
    created_styles_map: Dict[str, Any] = {}
    commit_row_warnings: Dict[int, List[str]] = {}
    commit_all_warnings: List[str] = []
    if target == "ITEM_MASTER":
        consistency_report = CatalogConsistencyValidator.validate_batch_style_consistency(request.rows)
        commit_row_warnings = consistency_report["row_warnings"]
        commit_all_warnings = consistency_report["all_warnings"]
    try:
        for index, resolved in enumerate(resolved_rows, start=1):
            if target == "ITEM_MASTER":
                row = resolved["row"]
                style_code = resolved["style_code"]
                clean_barcode = (resolved.get("barcode") or "").strip().upper()
                clean_sku = (resolved.get("sku") or "").strip().upper()

                # Explicit separation:
                # 1. Flat Item columns: item_code, style_code, color, size, vendor_code, hsn_code, tax_rate, department, category, brand
                color = _text(row, "color", "colour", "COLOR", "Color")
                size = _text(row, "size", "SIZE", "Size")
                cat_raw = _text(row, "category", "Category", "MERCHANDISE_CATEGORY") or "Footwear"
                dept_raw = _text(row, "department", "Department", "MERCHANDISE_DEPARTMENT")
                cat = "Footwear" if "footwear" in (cat_raw + " " + (dept_raw or "")).lower() else cat_raw
                dept = dept_raw or ("Footwear" if cat == "Footwear" else None)
                brand = _text(row, "brand", "Brand", "BRAND_NAME")
                hsn = _text(row, "hsn", "hsn_code", "HSN_CODE", "HSN") or "64041990"
                uom = _text(row, "uom", "UOM") or "PRS"
                tax_rate = float(row.get("tax_rate", row.get("gst", row.get("GST_RATE_PERCENT", 18))) or 18)
                buying_price = float(row.get("buyingPrice", row.get("buying_price", row.get("BUYING_PRICE", 0))) or 0)
                cost_price = float(row.get("costPrice", row.get("cost_price", row.get("LANDED_COST_PRICE", 0))) or 0)
                mrp = float(row.get("mrp", row.get("MRP", 0)) or 0)
                selling_price = float(row.get("sellingPrice", row.get("price", row.get("SELLING_PRICE", 0))) or 0)
                image_url = _text(row, "primary_image_url", "image_url", "IMAGE_LINK", "image_link", "image")

                # 2. v2.2: First-class attribute extraction (promoted from attributes_json blob)
                # Each field gets its own SQL column on Item — queryable, reportable, IM-001 controlled.
                v22_gender          = _text(row, "gender", "Gender", "GENDER", "Gndr")
                v22_purchase_class  = _text(row, "purchase_class", "purchaseClass", "PURCHASE_CLASS")
                v22_product_type    = _text(row, "product_type", "productType", "PRODUCT_TYPE", "Product_Type")
                v22_design_attr     = _text(row, "design_attribute", "designAttribute", "DESIGN_ATTRIBUTE", "Design_Attribute")
                v22_heel_type       = _text(row, "heel_type", "heelType", "HEEL_TYPE", "Heel_Type", "heel")
                v22_upper_material  = _text(row, "upper_material", "upperMaterial", "UPPER_MATERIAL", "Upper_Material", "upper")
                v22_outsole         = _text(row, "outsole_material", "outsole", "outsoleMaterial", "OUTSOLE_MATERIAL", "OUTSOLE", "sole")
                v22_collection_type = _text(row, "collection_type", "collectionType", "COLLECTION_TYPE", "Collection_Type")

                # IM-008: IS_INVENTORY_YN / IS_BILLABLE_YN / IS_SERVICE_YN — only Y/N accepted (BLOCK if invalid)
                def _yn_field(row: dict, *keys: str, default: bool = True) -> bool:
                    """Parse a Y/N cell; raises ValueError on invalid input (IM-008 BLOCK)."""
                    raw = _text(row, *keys)
                    if raw is None or raw.strip() == "":
                        return default
                    val = raw.strip().upper()
                    if val == "Y":
                        return True
                    if val == "N":
                        return False
                    raise ValueError(f"IM-008: Field {keys[0]} must be Y or N, got '{raw}'")

                try:
                    v22_is_inventory = _yn_field(row, "IS_INVENTORY_YN", "is_inventory_yn", default=True)
                    v22_is_billable  = _yn_field(row, "IS_BILLABLE_YN",  "is_billable_yn",  default=True)
                    v22_is_service   = _yn_field(row, "IS_SERVICE_YN",   "is_service_yn",   default=False)
                except ValueError as im008_err:
                    raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": str(im008_err)})

                # IM-009: Service items cannot be inventory items
                if v22_is_service:
                    v22_is_inventory = False

                # Keep attributes_json for any remaining non-standard pass-through keys only
                footwear_nested_attrs = {k: v for k, v in (row.get("attributes_json") or {}).items() if v is not None and str(v).strip()}

                # Part 6: HSN / GST Soft Validation (Human Review Flag)
                requires_review_reasons = []
                upper_mat = (footwear_nested_attrs.get("upper_material") or "").strip().lower()
                synthetic_keywords = ("synthetic", "rubber", "plastic", "pvc", "pu", "faux", "mesh", "textile", "canvas")
                if any(kw in upper_mat for kw in synthetic_keywords) and hsn.strip().startswith("6403"):
                    requires_review_reasons.append(
                        f"HSN/Material Mismatch Flag: Upper material '{upper_mat}' indicates synthetic/rubber/plastic "
                        f"but HSN code '{hsn}' belongs to chapter 6403 (leather-upper footwear). Flagged for human/CA sign-off (REQUIRES_REVIEW)."
                    )

                if selling_price > 2500 and tax_rate <= 5:
                    requires_review_reasons.append(
                        f"GST Slab Flag: Selling price ({selling_price}) crosses Rs. 2,500 but GST tax rate is {tax_rate}%. "
                        f"Flagged for human/CA sign-off (REQUIRES_REVIEW)."
                    )
                elif 0 < selling_price < 2500 and tax_rate >= 18:
                    requires_review_reasons.append(
                        f"GST Slab Flag: Selling price ({selling_price}) is below Rs. 2,500 but GST tax rate is {tax_rate}%. "
                        f"Flagged for human/CA sign-off (REQUIRES_REVIEW)."
                    )

                flag_requires_review = len(requires_review_reasons) > 0
                item_status = "REQUIRES_REVIEW" if flag_requires_review else "ACTIVE"

                if requires_review_reasons:
                    for reason in requires_review_reasons:
                        commit_row_warnings.setdefault(index - 1, []).append(reason)
                        if reason not in commit_all_warnings:
                            commit_all_warnings.append(reason)

                # 3. Resolve or create parent Item
                if style_code in created_styles_map:
                    item = created_styles_map[style_code]
                    if resolved.get("vendor_code") and not item.vendor_code:
                        item.vendor_code = resolved["vendor_code"]
                    if color and not item.color:
                        item.color = color
                    if size and not item.size:
                        item.size = size
                    # v2.2: Write first-class columns; also keep attrs_json for pass-through extras
                    if footwear_nested_attrs:
                        current_attrs = dict(item.attributes_json or {})
                        current_attrs.update(footwear_nested_attrs)
                        item.attributes_json = current_attrs
                    if v22_gender and not item.gender:                   item.gender = v22_gender
                    if v22_purchase_class and not item.purchase_class:   item.purchase_class = v22_purchase_class
                    if v22_product_type and not item.product_type:       item.product_type = v22_product_type
                    if v22_design_attr and not item.design_attribute:    item.design_attribute = v22_design_attr
                    if v22_heel_type and not item.heel_type:             item.heel_type = v22_heel_type
                    if v22_upper_material and not item.upper_material:   item.upper_material = v22_upper_material
                    if v22_outsole and not item.outsole_material:        item.outsole_material = v22_outsole
                    if v22_collection_type and not item.collection_type: item.collection_type = v22_collection_type
                    # IM-008/009 flags (always set — last import row wins on update)
                    item.is_inventory_yn = v22_is_inventory
                    item.is_billable_yn  = v22_is_billable
                    item.is_service_yn   = v22_is_service
                    if flag_requires_review:
                        item.status = "REQUIRES_REVIEW"
                else:
                    item_stmt = select(Item).where(
                        Item.company_id == company_id,
                        Item.item_code == style_code,
                        Item.is_deleted == False
                    )
                    existing_item = (await db.execute(item_stmt)).scalars().first()
                    if existing_item:
                        item = existing_item
                        if resolved.get("vendor_code") and not item.vendor_code:
                            item.vendor_code = resolved["vendor_code"]
                        if color and not item.color:
                            item.color = color
                        if size and not item.size:
                            item.size = size
                        # v2.2: Write first-class columns; keep attrs_json for pass-through extras
                        if footwear_nested_attrs:
                            current_attrs = dict(item.attributes_json or {})
                            current_attrs.update(footwear_nested_attrs)
                            item.attributes_json = current_attrs
                        if v22_gender and not item.gender:                   item.gender = v22_gender
                        if v22_purchase_class and not item.purchase_class:   item.purchase_class = v22_purchase_class
                        if v22_product_type and not item.product_type:       item.product_type = v22_product_type
                        if v22_design_attr and not item.design_attribute:    item.design_attribute = v22_design_attr
                        if v22_heel_type and not item.heel_type:             item.heel_type = v22_heel_type
                        if v22_upper_material and not item.upper_material:   item.upper_material = v22_upper_material
                        if v22_outsole and not item.outsole_material:        item.outsole_material = v22_outsole
                        if v22_collection_type and not item.collection_type: item.collection_type = v22_collection_type
                        item.is_inventory_yn = v22_is_inventory
                        item.is_billable_yn  = v22_is_billable
                        item.is_service_yn   = v22_is_service
                        if flag_requires_review:
                            item.status = "REQUIRES_REVIEW"
                    else:
                        item = await UniversalItemMasterService.create_item(
                            session=db,
                            company_id=company_id,
                            item_code=style_code,
                            item_name=resolved["item_name"],
                            category=cat,
                            department=dept,
                            brand=brand,
                            style_code=style_code,
                            color=color,
                            size=size,
                            vendor_code=resolved.get("vendor_code"),
                            tax_rate=tax_rate,
                            mrp=mrp,
                            selling_price=selling_price,
                            cost_price=cost_price,
                            buying_price=buying_price if buying_price > 0 else None,
                            primary_uom=uom,
                            hsn_code=hsn,
                            branch_id=getattr(current_user, "branch_id", None) or "BR-001",
                            attributes_json=footwear_nested_attrs,
                            primary_image_url=image_url,
                            status=item_status,
                            # ── v2.2 first-class fields ──────────────────────────────────────
                            gender=v22_gender,
                            purchase_class=v22_purchase_class,
                            product_type=v22_product_type,
                            design_attribute=v22_design_attr,
                            heel_type=v22_heel_type,
                            upper_material=v22_upper_material,
                            outsole_material=v22_outsole,
                            collection_type=v22_collection_type,
                            is_inventory_yn=v22_is_inventory,
                            is_billable_yn=v22_is_billable,
                            is_service_yn=v22_is_service,
                            commit=False,
                        )
                        if flag_requires_review:
                            item.status = "REQUIRES_REVIEW"
                        if resolved.get("vendor_code"):
                            item.vendor_code = resolved["vendor_code"]
                    created_styles_map[style_code] = item

                # 4. Create ItemVariant
                if not clean_sku:
                    clean_sku = f"{style_code}-{color}-{size}".upper() if (color and size) else f"{style_code}-VAR-{index}"

                attrs = {
                    **footwear_nested_attrs,
                }
                if color:
                    attrs["color"] = color
                if size:
                    attrs["size"] = size
                # product_type & purchase_class are now first-class Item columns (v2.2)— not in variant attrs_json
                attrs = {k: v for k, v in attrs.items() if v}

                row_mrp = float(row.get("mrp", row.get("MRP", item.mrp)) or item.mrp or 0)
                row_selling = float(row.get("sellingPrice", row.get("price", row.get("SELLING_PRICE", item.selling_price))) or item.selling_price or 0)
                row_cost = float(row.get("costPrice", row.get("cost_price", row.get("LANDED_COST_PRICE", item.cost_price))) or item.cost_price or 0)

                variant_stmt = select(ItemVariant).where(
                    ItemVariant.company_id == company_id,
                    ItemVariant.variant_sku == clean_sku,
                    ItemVariant.is_deleted == False
                )
                variant = (await db.execute(variant_stmt)).scalars().first()
                if not variant:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        item_id=item.id,
                        variant_sku=clean_sku,
                        variant_name=f"{style_code} {color} {size}".strip() or item.item_name,
                        attributes_json=attrs,
                        mrp=Decimal(str(row_mrp)),
                        selling_price=Decimal(str(row_selling)),
                        cost_price=Decimal(str(row_cost)),
                        is_active=True,
                    )
                    db.add(variant)
                    await db.flush()

                # 3. Create ItemBarcode
                if clean_barcode:
                    bc_stmt = select(ItemBarcode).where(
                        ItemBarcode.company_id == company_id,
                        ItemBarcode.barcode == clean_barcode,
                        ItemBarcode.is_deleted == False
                    )
                    existing_bc = (await db.execute(bc_stmt)).scalars().first()
                    if existing_bc:
                        match_mode = (request.existing_match_mode or "SKIP").upper().strip()
                        if match_mode == "FAIL_ON_EXISTING":
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail=f"Row {index}: Barcode '{clean_barcode}' already exists in database.",
                            )
                        elif match_mode == "UPDATE_METADATA_AND_PRICE":
                            if variant:
                                variant.mrp = Decimal(str(row_mrp))
                                variant.selling_price = Decimal(str(row_selling))
                                if row_cost > 0:
                                    variant.cost_price = Decimal(str(row_cost))
                            results.append({
                                "row_number": row.get("rowNumber", index),
                                "status": "UPDATED_EXISTING_MATCH",
                                "item_id": item.id,
                                "variant_sku": variant.variant_sku if variant else clean_sku,
                                "barcode": clean_barcode,
                                "message": "Updated pricing for existing item match",
                                "warnings": commit_row_warnings.get(index - 1, []),
                            })
                            continue
                        else:  # SKIP
                            results.append({
                                "row_number": row.get("rowNumber", index),
                                "status": "SKIPPED_EXISTING_MATCH",
                                "item_id": existing_bc.item_id,
                                "variant_id": existing_bc.variant_id,
                                "barcode": clean_barcode,
                                "message": "Skipped existing item match",
                                "warnings": commit_row_warnings.get(index - 1, []),
                            })
                            continue
                    else:
                        tax_inc = _text(row, "tax_inclusive_yn", "TAX_INCLUSIVE_YN").upper() == "Y" if _text(row, "tax_inclusive_yn", "TAX_INCLUSIVE_YN") else None
                        barcode_entity = ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            company_id=company_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=clean_barcode,
                            barcode_type="EAN13" if len(clean_barcode) == 13 and clean_barcode.isdigit() else "CUSTOM",
                            is_primary=True,
                            is_tax_inclusive=tax_inc,
                        )
                        db.add(barcode_entity)

                # 4. Warehouse Location
                wh_code = _text(row, "warehouse_code", "WAREHOUSE_CODE", "warehouse_id")
                reorder = row.get("reorder_level", row.get("REORDER_LEVEL"))
                if wh_code and reorder is not None:
                    try:
                        loc_stmt = select(ItemWarehouseLocation).where(
                            ItemWarehouseLocation.item_id == item.id,
                            ItemWarehouseLocation.warehouse_id == wh_code,
                            ItemWarehouseLocation.is_deleted == False
                        )
                        existing_loc = (await db.execute(loc_stmt)).scalars().first()
                        if not existing_loc:
                            db.add(ItemWarehouseLocation(
                                id=f"loc_{uuid.uuid4().hex[:12]}",
                                company_id=company_id,
                                item_id=item.id,
                                warehouse_id=wh_code,
                                min_reorder_level=Decimal(str(reorder)),
                            ))
                    except Exception:
                        pass

                # 5. Authoritative Pricing Domain: Route pricing to PriceBookEntry (SSOT) + items baseline fallback
                effective_price_mode = (request.price_mode or "DO_NOT_CREATE").upper().strip()
                if effective_price_mode in ("CREATE_AS_DRAFT", "CREATE_LIVE_RETAIL"):
                    pb_id = request.price_book_id
                    if not pb_id:
                        pb_stmt = select(PriceBook).where(
                            PriceBook.company_id == company_id,
                            PriceBook.is_default == True,
                            PriceBook.is_deleted == False
                        )
                        default_pb = (await db.execute(pb_stmt)).scalars().first()
                        if not default_pb:
                            default_pb = PriceBook(
                                id=f"pb_{uuid.uuid4().hex[:12]}",
                                company_id=company_id,
                                name="Default Retail Price Book",
                                code=f"PB-RETAIL-{company_id}",
                                currency="INR",
                                is_default=True,
                                status="ACTIVE" if effective_price_mode == "CREATE_LIVE_RETAIL" else "DRAFT",
                            )
                            db.add(default_pb)
                            await db.flush()
                        pb_id = default_pb.id

                    # 5a. Variant-level PriceBookEntry
                    if variant:
                        pbe_stmt = select(PriceBookEntry).where(
                            PriceBookEntry.price_book_id == pb_id,
                            PriceBookEntry.item_id == item.id,
                            PriceBookEntry.variant_id == variant.id,
                            PriceBookEntry.min_quantity == Decimal("1.0000"),
                            PriceBookEntry.is_deleted == False
                        )
                        existing_pbe = (await db.execute(pbe_stmt)).scalars().first()
                        if existing_pbe:
                            existing_pbe.selling_price = Decimal(str(row_selling))
                            existing_pbe.mrp = Decimal(str(row_mrp))
                            if row_cost > 0:
                                existing_pbe.cost_price = Decimal(str(row_cost))
                        else:
                            db.add(PriceBookEntry(
                                id=f"pbe_{uuid.uuid4().hex[:12]}",
                                company_id=company_id,
                                price_book_id=pb_id,
                                item_id=item.id,
                                variant_id=variant.id,
                                min_quantity=Decimal("1.0000"),
                                selling_price=Decimal(str(row_selling)),
                                mrp=Decimal(str(row_mrp)),
                                cost_price=Decimal(str(row_cost)) if row_cost > 0 else None,
                            ))
                    else:
                        # 5b. Item-level PriceBookEntry (when no variant exists)
                        item_pbe_stmt = select(PriceBookEntry).where(
                            PriceBookEntry.price_book_id == pb_id,
                            PriceBookEntry.item_id == item.id,
                            PriceBookEntry.variant_id.is_(None),
                            PriceBookEntry.min_quantity == Decimal("1.0000"),
                            PriceBookEntry.is_deleted == False
                        )
                        existing_item_pbe = (await db.execute(item_pbe_stmt)).scalars().first()
                        if existing_item_pbe:
                            existing_item_pbe.selling_price = Decimal(str(row_selling))
                            existing_item_pbe.mrp = Decimal(str(row_mrp))
                            if row_cost > 0:
                                existing_item_pbe.cost_price = Decimal(str(row_cost))
                        else:
                            db.add(PriceBookEntry(
                                id=f"pbe_{uuid.uuid4().hex[:12]}",
                                company_id=company_id,
                                price_book_id=pb_id,
                                item_id=item.id,
                                variant_id=None,
                                min_quantity=Decimal("1.0000"),
                                selling_price=Decimal(str(row_selling)),
                                mrp=Decimal(str(row_mrp)),
                                cost_price=Decimal(str(row_cost)) if row_cost > 0 else None,
                            ))

                # 5c. Documented legacy baseline fallback write on Item
                if row_mrp > 0:
                    item.mrp = Decimal(str(row_mrp))
                if row_selling > 0:
                    item.selling_price = Decimal(str(row_selling))
                if row_cost > 0:
                    item.cost_price = Decimal(str(row_cost))

                results.append({
                    "row_number": row.get("rowNumber", index),
                    "status": "CREATED",
                    "item_id": item.id,
                    "item_code": item.item_code,
                    "item_status": item.status,
                    "variant_sku": variant.variant_sku,
                    "barcode": clean_barcode,
                    "warnings": commit_row_warnings.get(index - 1, []),
                })
            elif target == "PRICE_BOOK":
                entry = await PricingEngine.add_price_book_entry(
                    session=db,
                    company_id=company_id,
                    price_book_id=request.price_book_id,
                    req=resolved["request"],
                    created_by=user_id,
                    commit=False,
                )
                results.append({"row_number": resolved["row"].get("rowNumber"), "status": "COMMITTED", "entry_id": entry.id, "item_id": entry.item_id})
            elif target == "STOCK_ADJUSTMENT":
                row = resolved["row"]
                movement_type = str(row.get("movement_type", row.get("movementType", "ADJUSTMENT_IN"))).upper()
                if movement_type not in {"ADJUSTMENT_IN", "ADJUSTMENT_OUT"}:
                    raise HTTPException(status_code=422, detail=f"Invalid stock adjustment movement type: {movement_type}")
                movement = await StockAccountingBoundaryService.record_stock_movement(
                    session=db,
                    company_id=company_id,
                    req=StockMovementRecordRequest(
                        product_id=resolved["product"].id,
                        quantity=float(resolved["quantity"]),
                        movement_type=movement_type,
                        reference_doc_type="UNIVERSAL_IMPORT",
                        reference_doc_id=request.idempotency_key,
                        warehouse_id=request.warehouse_id,
                        batch=row.get("batch_no", row.get("batch")),
                        unit_cost=float(row.get("costPrice", 0) or 0),
                        remarks=request.reason,
                        source_module="UNIVERSAL_IMPORT",
                    ),
                    user_id=user_id,
                    commit=False,
                )
                results.append({"row_number": row.get("rowNumber"), "status": "ADJUSTED", "movement_id": movement.id, "product_id": resolved["product"].id})
            elif target == "SALES_RETURN":
                return_items.append(SalesReturnItemCreate(
                    product_id=resolved["product"].id,
                    item_id=resolved["match"].get("item_id"),
                    code=resolved["product"].code,
                    name=resolved["product"].name,
                    quantity=resolved["quantity"],
                    price=0,
                    total_amount=0,
                ))
            elif target == "LABEL_PRINT":
                row = resolved["row"]
                match = resolved["match"]
                results.append({
                    "row_number": row.get("rowNumber"),
                    "status": "PRINT_READY",
                    "item_id": match.get("item_id"),
                    "variant_id": match.get("variant_id"),
                    "barcode": match.get("barcode") or row.get("barcode"),
                    "item_name": match.get("item_name"),
                    "quantity": resolved["quantity"],
                    "mrp": row.get("mrp", match.get("mrp")),
                    "selling_price": row.get("sellingPrice", row.get("price", match.get("selling_price"))),
                })
            else:
                row = resolved["row"]
                purchase_items.append(PurchaseReceiptItemCreate(
                    product_id=resolved["product"].id,
                    item_id=resolved["match"].get("item_id"),
                    code=resolved["product"].code,
                    name=resolved["product"].name,
                    batch_no=row.get("batch_no", row.get("batch")),
                    mrp=float(row.get("mrp")) if row.get("mrp") is not None else None,
                    quantity_received=resolved["quantity"],
                    cost_price=resolved["cost_price"],
                    gst_rate=row.get("gst_rate", row.get("gst", 18)),
                ))

        if target == "PURCHASE_INWARD":
            receipt = await PurchaseService(db, tenant).create_purchase_receipt(PurchaseReceiptCreate(
                id=f"imp-grn-{payload_hash[:12]}",
                receipt_no=request.receipt_no or f"GRN-IMP-{payload_hash[:10].upper()}",
                supplier_id=request.supplier_id,
                warehouse_id=request.warehouse_id,
                notes="Universal Import Purchase Inward",
                items=purchase_items,
            ))
            results = [
                {"row_number": row.get("rowNumber"), "status": "RECEIVED", "receipt_id": receipt.id, "product_id": item.product_id}
                for row, item in zip(request.rows, purchase_items)
            ]
        if target == "SALES_RETURN":
            sales_return = await SalesService(db, tenant).create_sales_return(
                SalesReturnCreate(
                    id=f"imp-ret-{payload_hash[:12]}",
                    return_no=request.return_no,
                    original_invoice_id=request.original_invoice_id,
                    reason=request.reason,
                    items=return_items,
                ),
                idempotency_key=request.idempotency_key,
            )
            results = [
                {"row_number": item["row"].get("rowNumber"), "status": "RETURNED", "return_id": sales_return.id, "product_id": item["product"].id}
                for item in resolved_rows
            ]

        audit = ComplianceImmutableAuditLog(
            id=f"uil_{payload_hash[:16]}",
            company_id=company_id,
            event_type="UNIVERSAL_IMPORT_COMMIT",
            entity_name="price_book_entries" if target == "PRICE_BOOK" else "items" if target == "ITEM_MASTER" else "purchase_receipts" if target == "PURCHASE_INWARD" else "stock_movements",
            entity_id=request.idempotency_key,
            actor_user_id=user_id,
            before_state_json=None,
            after_state_json=json.dumps({"target": target, "price_book_id": request.price_book_id, "row_count": len(results)}),
            action_summary=f"Committed {len(results)} Price Book import rows",
            payload_hash=payload_hash,
        )
        db.add(audit)
        await db.commit()
    except Exception as error:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Universal import rolled back: {error}") from error
    return {
        "success": True,
        "idempotent_replay": False,
        "idempotency_key": request.idempotency_key,
        "results": results,
        "warnings": commit_all_warnings if target == "ITEM_MASTER" else [],
    }


@router.get("/templates/item-master.xlsx", summary="Download dynamic Item Master template pre-populated with live database masters")
async def download_item_master_template(
    company_id: Optional[str] = Query("COMP-001"),
    warehouse_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    _current_user: Any = Depends(get_current_user),
):
    """
    Generate and stream an authoritative SMRITI Item Master Standard v2.2 Excel workbook,
    dynamically pre-populating lookup dropdown lists (Warehouses, Brands, Departments, Categories)
    from live database records for the specified company.
    """
    effective_company = company_id or "COMP-001"

    # 1. Fetch live warehouses
    wh_stmt = select(Warehouse.code).where(
        Warehouse.company_id == effective_company,
        Warehouse.is_deleted == False
    ).order_by(Warehouse.code)
    wh_codes = [r[0] for r in (await db.execute(wh_stmt)).all() if r[0]]

    # 2. Fetch live brands
    brand_stmt = select(Item.brand).where(
        Item.company_id == effective_company,
        Item.brand.isnot(None),
        Item.is_deleted == False
    ).distinct().order_by(Item.brand)
    brand_names = [r[0] for r in (await db.execute(brand_stmt)).all() if r[0]]

    # 3. Fetch live departments
    dept_stmt = select(Item.department).where(
        Item.company_id == effective_company,
        Item.department.isnot(None),
        Item.is_deleted == False
    ).distinct().order_by(Item.department)
    dept_names = [r[0] for r in (await db.execute(dept_stmt)).all() if r[0]]

    # 4. Fetch live categories
    cat_stmt = select(Item.category).where(
        Item.company_id == effective_company,
        Item.category.isnot(None),
        Item.is_deleted == False
    ).distinct().order_by(Item.category)
    cat_names = [r[0] for r in (await db.execute(cat_stmt)).all() if r[0]]

    # Load canonical template base
    template_path = Path("assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx")
    if not template_path.exists():
        template_path = Path(__file__).resolve().parents[4] / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"
    if not template_path.exists():
        template_path = Path(__file__).resolve().parent.parent.parent.parent / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"

    wb = openpyxl.load_workbook(template_path)
    if "Validation Lists" in wb.sheetnames:
        vl_ws = wb["Validation Lists"]
        # Update warehouses in column S (Col 19)
        if wh_codes:
            for idx, w in enumerate(wh_codes, start=2):
                vl_ws.cell(row=idx, column=19, value=w)
            if "List_WAREHOUSE_CODE" in wb.defined_names:
                wb.defined_names["List_WAREHOUSE_CODE"].attr_text = f"'Validation Lists'!$S$2:$S${len(wh_codes)+1}"

        # Update brands in column B (Col 2)
        if brand_names:
            for idx, b in enumerate(brand_names, start=2):
                vl_ws.cell(row=idx, column=2, value=b)
            if "List_BRAND_NAME" in wb.defined_names:
                wb.defined_names["List_BRAND_NAME"].attr_text = f"'Validation Lists'!$B$2:$B${len(brand_names)+1}"

        # Update departments in column F (Col 6)
        if dept_names:
            for idx, d in enumerate(dept_names, start=2):
                vl_ws.cell(row=idx, column=6, value=d)
            if "List_MERCHANDISE_DEPARTMENT" in wb.defined_names:
                wb.defined_names["List_MERCHANDISE_DEPARTMENT"].attr_text = f"'Validation Lists'!$F$2:$F${len(dept_names)+1}"

        # Update categories in column G (Col 7)
        if cat_names:
            for idx, c in enumerate(cat_names, start=2):
                vl_ws.cell(row=idx, column=7, value=c)
            if "List_MERCHANDISE_CATEGORY" in wb.defined_names:
                wb.defined_names["List_MERCHANDISE_CATEGORY"].attr_text = f"'Validation Lists'!$G$2:$G${len(cat_names)+1}"

    # If warehouse_id was selected, prefill sample row 5
    if warehouse_id and "Item Master Template" in wb.sheetnames:
        it_ws = wb["Item Master Template"]
        it_ws.cell(row=5, column=28, value=warehouse_id.strip().upper())

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"SMRITI_Item_Master_Standard_v2.2_{effective_company}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )