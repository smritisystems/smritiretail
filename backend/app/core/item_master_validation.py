from __future__ import annotations
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.1.0
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
Centralized Item Master 422 Validation Mapper.

Architecture:

  Path A — Pydantic RequestValidationError:
    RequestValidationError
         ↓
    ItemMasterValidationMapper.build_422_response()
         ↓
    Structured {"error": {"code": "ITEM_MASTER_VALIDATION_ERROR", "fields": [...]}}
         ↓
    Frontend itemMasterValidationMapper.ts (field-level inline errors)

  Path B — Dynamic Attribute HTTPException(422):
    AttributesService / IM-001 raises HTTPException(422, detail={"errors": [...]})
         ↓
    http_exception_handler detects Item Master endpoint + 422 + structured detail
         ↓
    ItemMasterValidationMapper.build_dynamic_attr_422_response()
         ↓
    Same structured contract: {"error": {"code": "ITEM_MASTER_VALIDATION_ERROR", ...}}
         ↓
    Frontend itemMasterValidationMapper.ts (same handling path)

This module is the SINGLE source of truth for all Item Master 422 error
message translations. Do NOT add field-error messages in individual routes
or schemas — add them here and reference via field key.
"""

import re
from typing import Any


# ---------------------------------------------------------------------------
# Human-Readable Field Label Registry
# ---------------------------------------------------------------------------
# Maps canonical Pydantic field names (including nested dot-notation) to
# the human-readable business label shown to end users.
# ---------------------------------------------------------------------------

FIELD_LABELS: dict[str, str] = {
    # ── Basic Information ────────────────────────────────────────────────────
    "code":                    "SKU / Item Code",
    "sku":                     "SKU / Item Code",
    "item_code":               "SKU / Item Code",
    "style_code":              "Article / Design / Style / Model",
    "article":                 "Article / Design / Style / Model",
    "name":                    "Product Name",
    "item_name":               "Product Name",
    "style_name":              "Product Name",
    "brand":                   "Brand",
    "category":                "Category",
    "gender":                  "Gender",
    "product_type":            "Product Type",
    "design_attribute":        "Design Attribute",
    "heel_type":               "Heel Type",
    "upper_material":          "Upper Material",
    "outsole_material":        "Outsole Material",
    "purchase_class":          "Purchase Class",
    "collection_type":         "Collection Type",

    # ── Variant ──────────────────────────────────────────────────────────────
    "color":                   "Colour / Shade",
    "colour":                  "Colour / Shade",
    "size":                    "Size",
    "size_system":             "Size System",
    "variant.color":           "Colour / Shade",
    "variant.colour":          "Colour / Shade",
    "variant.size":            "Size",
    "variant.size_system":     "Size System",

    # ── Classification ────────────────────────────────────────────────────────
    "hsn_code":                "HSN Code",

    # ── Pricing ──────────────────────────────────────────────────────────────
    "mrp":                     "Retail Price (MRP)",
    "price":                   "Retail Price",
    "selling_price":           "Selling Price",
    "cost_price":              "Cost Price",
    "buying_price":            "Dealer / Buying Price",
    "pricing.retail_price":    "Retail Price",
    "pricing.mrp":             "Retail Price (MRP)",
    "pricing.cost_price":      "Cost Price",
    "pricing.buying_price":    "Dealer / Buying Price",

    # ── Tax ──────────────────────────────────────────────────────────────────
    "gst_percentage":          "GST %",
    "tax_rate":                "GST %",
    "is_tax_inclusive":        "Tax Inclusive",

    # ── System Flags ─────────────────────────────────────────────────────────
    "status":                  "Product Status",
    "is_inventory_yn":         "Inventory Item",
    "is_billable_yn":          "Billable Item",
    "is_service_yn":           "Service Item",

    # ── Barcode ──────────────────────────────────────────────────────────────
    "barcode":                 "Barcode",
    "primary_barcode":         "Primary Barcode",

    # ── Units & UOM (Phase 2) ─────────────────────────────────────────────────
    "stock_uom":               "Stock UOM",
    "stock_uom_id":            "Stock UOM",
    "sales_uom":               "Sales UOM",
    "sales_uom_id":            "Sales UOM",
    "purchase_uom":            "Purchase UOM",
    "purchase_uom_id":         "Purchase UOM",
    "conversion_factor":       "Conversion Factor",
    "uom.stock_uom_id":        "Stock UOM",
    "uom.sales_uom_id":        "Sales UOM",
    "uom.purchase_uom_id":     "Purchase UOM",
    "uom.conversion_factor":   "Conversion Factor",

    # ── Commercial Pricing (Phase 2) ──────────────────────────────────────────
    "dealer_price":            "Dealer Price",
    "wholesale_price":         "Wholesale Price",
    "minimum_selling_price":   "Minimum Selling Price",
    "maximum_discount_percent":"Maximum Discount %",
    "pricing.dealer_price":    "Dealer Price",
    "pricing.wholesale_price": "Wholesale Price",
    "pricing.minimum_selling_price": "Minimum Selling Price",
    "pricing.maximum_discount_percent": "Maximum Discount %",

    # ── Statutory Tax Profile (Phase 2) ───────────────────────────────────────
    "hsn_sac_code":            "HSN/SAC Code",
    "gst_rate":                "GST Rate %",
    "tax_category":            "Tax Category",
    "tax_inclusive":           "Tax Inclusive",
    "sales_tax_rate":          "Sales Tax Rate %",
    "purchase_tax_rate":       "Purchase Tax Rate %",
    "tax_exempt":              "Tax Exempt",
    "tax.hsn_sac_code":        "HSN/SAC Code",
    "tax.gst_rate":            "GST Rate %",
    "tax.tax_inclusive":       "Tax Inclusive",

    # ── Purchasing / Supplier Settings (Phase 2) ──────────────────────────────
    "preferred_supplier_id":   "Preferred Supplier",
    "supplier_item_code":      "Supplier Item Code",
    "minimum_purchase_qty":    "Minimum Purchase Qty",
    "purchase_cost":           "Purchase Cost",
    "last_purchase_price":     "Last Purchase Price",
    "purchase_lead_time":      "Purchase Lead Time (Days)",
    "purchasing.preferred_supplier_id": "Preferred Supplier",
    "purchasing.purchase_uom_id": "Purchase UOM",
    "purchasing.minimum_purchase_qty": "Minimum Purchase Qty",

    # ── Sales Settings (Phase 2) ──────────────────────────────────────────────
    "allow_discount":          "Allow Discount",
    "billable":                "Billable Item",
    "sales.selling_price":     "Selling Price",
    "sales.mrp":               "Retail Price (MRP)",
    "sales.allow_discount":    "Allow Discount",
    "sales.billable":          "Billable Item",

    # ── Inventory Policy (Phase 2) ────────────────────────────────────────────
    "minimum_stock":           "Minimum Stock",
    "reorder_level":           "Reorder Level",
    "reorder_quantity":        "Reorder Quantity",
    "maximum_stock":           "Maximum Stock",
    "safety_stock":            "Safety Stock",
    "lead_time":               "Lead Time (Days)",
    "inventory_policy.minimum_stock": "Minimum Stock",
    "inventory_policy.reorder_level": "Reorder Level",
    "inventory_policy.reorder_quantity": "Reorder Quantity",
    "inventory_policy.maximum_stock": "Maximum Stock",
    "inventory_policy.safety_stock": "Safety Stock",
    "inventory_policy.lead_time": "Lead Time (Days)",
}

# ---------------------------------------------------------------------------
# Human-Readable Validation Message Templates
# ---------------------------------------------------------------------------
# For each field + error type combination, we produce a business-friendly
# sentence without technical jargon.
# ---------------------------------------------------------------------------

# Default messages by field key (for "missing" / "value_error.missing")
FIELD_REQUIRED_MESSAGES: dict[str, str] = {
    "code":             "SKU / Item Code is required or must be approved before saving.",
    "sku":              "SKU / Item Code is required or must be approved before saving.",
    "item_code":        "SKU / Item Code is required or must be approved before saving.",
    "variant_sku":      "SKU / Item Code is required or must be approved before saving.",
    "style_code":       "Article / Design / Style / Model is required.",
    "article":          "Article / Design / Style / Model is required.",
    "name":             "Product Name is required.",
    "item_name":        "Product Name is required.",
    "style_name":       "Product Name is required.",
    "brand":            "Please select a Brand.",
    "category":         "Please select a Category.",
    "gender":           "Please select a Gender.",
    "product_type":     "Please select a Product Type.",
    "color":            "Please enter a Colour / Shade.",
    "colour":           "Please enter a Colour / Shade.",
    "size":             "Size is required.",
    "size_system":      "Please select a Size System.",
    "hsn_code":         "HSN Code is required.",
    "hsn_sac_code":     "A valid statutory HSN/SAC code is required.",
    "mrp":              "Retail Price (MRP) is required.",
    "price":            "Retail Price is required.",
    "selling_price":    "Selling Price is required.",
    "gst_percentage":   "GST % is required.",
    "tax_rate":         "GST % is required.",
    "gst_rate":         "GST % is required.",
    "barcode":          "Barcode is required.",
    "status":           "Product Status is required.",
    "stock_uom":        "Please select a valid Stock UOM.",
    "stock_uom_id":     "Please select a valid Stock UOM.",
}

# Messages for nested variant fields
NESTED_REQUIRED_MESSAGES: dict[str, str] = {
    "variant.color":        "Please enter a Colour / Shade.",
    "variant.colour":       "Please enter a Colour / Shade.",
    "variant.size":         "Size is required.",
    "variant.size_system":  "Please select a Size System.",
    "pricing.retail_price": "Retail Price must be greater than 0.",
    "pricing.mrp":          "Retail Price (MRP) must be greater than 0.",
    "pricing.cost_price":   "Cost Price must be greater than 0.",
    "pricing.buying_price": "Dealer / Buying Price must be greater than 0.",
}

# Translate a raw pydantic message fragment to human-readable form
_MSG_TRANSLATIONS: list[tuple[str, str]] = [
    (r"field required",                    "is required"),
    (r"none is not an allowed value",      "is required"),
    (r"value is not a valid",              "must be a valid value"),
    (r"ensure this value is greater than 0", "must be greater than 0"),
    (r"ensure this value is greater than or equal to 0", "must be 0 or greater"),
    (r"value is not a valid integer",      "must be a whole number"),
    (r"value is not a valid float",        "must be a valid number"),
    (r"value is not a valid decimal",      "must be a valid number"),
    (r"string does not match regex",       "contains invalid characters"),
    (r"str type expected",                 "must be text"),
    (r"int type expected",                 "must be a number"),
    (r"float type expected",               "must be a number"),
    (r"value error, ",                     ""),
    (r"value_error\.",                     ""),
    (r"type_error\.",                      ""),
    (r"literal_error",                     "contains an invalid value"),
]

# ---------------------------------------------------------------------------
# Dynamic Attribute Label → Field Key mapping
# ---------------------------------------------------------------------------
# AttributesService produces error strings using the DB AttributeDefinition
# `label` value (e.g. "Style", "Article No", "Season"). This registry maps
# those label-based strings to canonical Item Master field keys so that dynamic
# attribute errors surface as structured ITEM_MASTER_VALIDATION_ERROR fields.
# ---------------------------------------------------------------------------

# Map lowercase stripped label → (field_key, human_message, section)
_DYN_LABEL_MAP: dict[str, tuple[str, str, str]] = {
    # Style / Article (mandatory dynamic attribute)
    "style":           ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "style code":      ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "style no":        ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "style number":    ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "article":         ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "article no":      ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "article code":    ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "article number":  ("style_code", "Article / Design / Style / Model is required. Please enter the Article or Style code.", "Basic Information"),
    "design":          ("style_code", "Article / Design / Style / Model is required. Please enter the Design code.", "Basic Information"),
    "model":           ("style_code", "Article / Design / Style / Model is required. Please enter the Model code.", "Basic Information"),
    # Color / Shade
    "color":           ("color", "Colour / Shade is required. Please select or enter a colour.", "Variant"),
    "colour":          ("color", "Colour / Shade is required. Please select or enter a colour.", "Variant"),
    "shade":           ("color", "Colour / Shade is required. Please select or enter a colour.", "Variant"),
    # Size
    "size":            ("size", "Size is required. Please select a size from the size chart.", "Variant"),
    "size system":     ("size_system", "Size System is required. Please select the size standard (e.g. UK, EU, India).", "Variant"),
    # Season / Collection (informational — not blocking primary fields)
    "season":          ("design_attribute", "Season / Collection must be a valid value.", "Basic Information"),
    "collection":      ("design_attribute", "Collection must be a valid value.", "Basic Information"),
    # Gender
    "gender":          ("gender", "Gender is required. Please select Men, Women, Kids, or Unisex.", "Basic Information"),
    # Product Type
    "product type":    ("product_type", "Product Type is required. Please select a product type.", "Basic Information"),
    "type":            ("product_type", "Product Type is required. Please select a product type.", "Basic Information"),
    # Brand
    "brand":           ("brand", "Please select a Brand.", "Basic Information"),
    # Category
    "category":        ("category", "Please select a Category.", "Basic Information"),
    # HSN
    "hsn":             ("hsn_code", "HSN Code is required.", "Classification"),
    "hsn code":        ("hsn_code", "HSN Code is required.", "Classification"),
    # Footwear Dimensions (IM-001)
    "heel type":       ("heel_type", "Heel Type is not in the approved list. Please select an approved heel type.", "Basic Information"),
    "heel_type":       ("heel_type", "Heel Type is not in the approved list. Please select an approved heel type.", "Basic Information"),
    "heels":           ("heel_type", "Heel Type is not in the approved list. Please select an approved heel type.", "Basic Information"),
    "upper material":  ("upper_material", "Upper Material is not in the approved list. Please select an approved upper material.", "Basic Information"),
    "upper_material":  ("upper_material", "Upper Material is not in the approved list. Please select an approved upper material.", "Basic Information"),
    "upper":           ("upper_material", "Upper Material is not in the approved list. Please select an approved upper material.", "Basic Information"),
    "outsole material":("outsole_material", "Outsole Material is not in the approved list. Please select an approved outsole material.", "Basic Information"),
    "outsole_material":("outsole_material", "Outsole Material is not in the approved list. Please select an approved outsole material.", "Basic Information"),
    "outsole":         ("outsole_material", "Outsole Material is not in the approved list. Please select an approved outsole material.", "Basic Information"),
    "gst rate percent":("gst_percentage", "GST % is not in the approved list.", "Tax"),
    "gst rate":        ("gst_percentage", "GST % is not in the approved list.", "Tax"),
    "gst":             ("gst_percentage", "GST % is not in the approved list.", "Tax"),
    "purchase class":  ("purchase_class", "Purchase Class is not in the approved list.", "Basic Information"),
    "collection type": ("collection_type", "Collection Type is not in the approved list.", "Basic Information"),
}


# Section lookup — maps field to form section for frontend navigation
FIELD_SECTIONS: dict[str, str] = {
    "code":             "Basic Information",
    "sku":              "Basic Information",
    "item_code":        "Basic Information",
    "style_code":       "Basic Information",
    "name":             "Basic Information",
    "item_name":        "Basic Information",
    "style_name":       "Basic Information",
    "brand":            "Basic Information",
    "category":         "Basic Information",
    "gender":           "Basic Information",
    "product_type":     "Basic Information",
    "design_attribute": "Basic Information",
    "heel_type":        "Basic Information",
    "upper_material":   "Basic Information",
    "outsole_material": "Basic Information",
    "purchase_class":   "Basic Information",
    "collection_type":  "Basic Information",
    "color":            "Variant",
    "colour":           "Variant",
    "size":             "Variant",
    "size_system":      "Variant",
    "variant.color":    "Variant",
    "variant.colour":   "Variant",
    "variant.size":     "Variant",
    "variant.size_system": "Variant",
    "hsn_code":         "Classification",
    "mrp":              "Pricing",
    "price":            "Pricing",
    "selling_price":    "Pricing",
    "cost_price":       "Pricing",
    "buying_price":     "Pricing",
    "pricing.retail_price": "Pricing",
    "pricing.mrp":      "Pricing",
    "pricing.cost_price": "Pricing",
    "pricing.buying_price": "Pricing",
    "gst_percentage":   "Tax",
    "tax_rate":         "Tax",
    "is_tax_inclusive": "Tax",
    "status":           "System",
    "is_inventory_yn":  "System",
    "is_billable_yn":   "System",
    "is_service_yn":    "System",
    "barcode":          "Barcode",

    # ── Units & UOM (Phase 2) ─────────────────────────────────────────────────
    "stock_uom":        "Units & UOM",
    "stock_uom_id":     "Units & UOM",
    "sales_uom":        "Units & UOM",
    "sales_uom_id":     "Units & UOM",
    "purchase_uom":     "Units & UOM",
    "purchase_uom_id":  "Units & UOM",
    "conversion_factor":"Units & UOM",
    "uom.stock_uom_id": "Units & UOM",
    "uom.sales_uom_id": "Units & UOM",
    "uom.purchase_uom_id": "Units & UOM",
    "uom.conversion_factor": "Units & UOM",

    # ── Commercial Pricing (Phase 2) ──────────────────────────────────────────
    "dealer_price":            "Pricing & Commercial",
    "wholesale_price":         "Pricing & Commercial",
    "minimum_selling_price":   "Pricing & Commercial",
    "maximum_discount_percent":"Pricing & Commercial",
    "pricing.dealer_price":    "Pricing & Commercial",
    "pricing.wholesale_price": "Pricing & Commercial",
    "pricing.minimum_selling_price": "Pricing & Commercial",
    "pricing.maximum_discount_percent": "Pricing & Commercial",

    # ── Statutory Tax Profile (Phase 2) ───────────────────────────────────────
    "hsn_sac_code":            "Tax Profile",
    "gst_rate":                "Tax Profile",
    "tax_category":            "Tax Profile",
    "tax_inclusive":           "Tax Profile",
    "sales_tax_rate":          "Tax Profile",
    "purchase_tax_rate":       "Tax Profile",
    "tax_exempt":              "Tax Profile",
    "tax.hsn_sac_code":        "Tax Profile",
    "tax.gst_rate":            "Tax Profile",
    "tax.tax_inclusive":       "Tax Profile",

    # ── Purchasing / Supplier Settings (Phase 2) ──────────────────────────────
    "preferred_supplier_id":   "Purchasing",
    "supplier_item_code":      "Purchasing",
    "minimum_purchase_qty":    "Purchasing",
    "purchase_cost":           "Purchasing",
    "last_purchase_price":     "Purchasing",
    "purchase_lead_time":      "Purchasing",
    "purchasing.preferred_supplier_id": "Purchasing",
    "purchasing.purchase_uom_id": "Purchasing",
    "purchasing.minimum_purchase_qty": "Purchasing",

    # ── Sales Settings (Phase 2) ──────────────────────────────────────────────
    "allow_discount":          "Sales",
    "billable":                "Sales",
    "sales.selling_price":     "Sales",
    "sales.mrp":               "Sales",
    "sales.allow_discount":    "Sales",
    "sales.billable":          "Sales",

    # ── Inventory Policy (Phase 2) ────────────────────────────────────
    "minimum_stock":           "Inventory Policy",
    "reorder_level":           "Inventory Policy",
    "reorder_quantity":        "Inventory Policy",
    "maximum_stock":           "Inventory Policy",
    "safety_stock":            "Inventory Policy",
    "lead_time":               "Inventory Policy",
    "inventory_policy.minimum_stock": "Inventory Policy",
    "inventory_policy.reorder_level": "Inventory Policy",
    "inventory_policy.reorder_quantity": "Inventory Policy",
    "inventory_policy.maximum_stock": "Inventory Policy",
    "inventory_policy.safety_stock": "Inventory Policy",
    "inventory_policy.lead_time": "Inventory Policy",
}


# ---------------------------------------------------------------------------
# Core Mapper
# ---------------------------------------------------------------------------

class ItemMasterValidationMapper:
    """
    Converts a FastAPI RequestValidationError into the canonical SMRITI
    ITEM_MASTER_VALIDATION_ERROR response structure.
    """

    @staticmethod
    def _normalize_loc(loc: tuple) -> str:
        """
        Convert pydantic loc tuple to dot-notation field path.
        e.g. ('body', 'pricing', 'retail_price') → 'pricing.retail_price'
        e.g. ('body', 'name')                    → 'name'
        e.g. ('body', 'variants', 0, 'color')    → 'variant.color'
        """
        parts = [str(p) for p in loc if p not in ("body", "query", "path", "header")]
        # Normalize list-indices: "variants.0.color" → "variant.color"
        cleaned: list[str] = []
        skip_next_int = False
        for part in parts:
            if part.isdigit():
                skip_next_int = False  # just skip numeric indices
                continue
            # Plurals to singular for nested sections
            if part == "variants":
                part = "variant"
            elif part == "barcodes":
                part = "barcode"
            elif part == "batches":
                part = "batch"
            cleaned.append(part)
        return ".".join(cleaned) if cleaned else "unknown"

    @staticmethod
    def _translate_pydantic_msg(raw_msg: str) -> str:
        """Convert raw pydantic error message to a user-safe fragment."""
        msg = raw_msg.lower().strip()
        for pattern, replacement in _MSG_TRANSLATIONS:
            msg = re.sub(pattern, replacement, msg, flags=re.IGNORECASE)
        # Remove leading/trailing noise
        return msg.strip(", ").strip()

    @staticmethod
    def _build_human_message(field_key: str, raw_msg: str) -> str:
        """
        Build the complete human-readable error message for one field.

        Priority:
        1. Exact match in FIELD_REQUIRED_MESSAGES (for missing/required errors)
        2. Exact match in NESTED_REQUIRED_MESSAGES
        3. Custom HSN / GST business rules
        4. Generic label + translated pydantic message
        """
        raw_lower = raw_msg.lower()

        # Check if this is a "required" style error
        is_required = any(kw in raw_lower for kw in [
            "required", "none is not", "missing", "blank", "field required",
            "cannot be blank", "value_error.missing",
        ])

        # 1. Direct required-message lookup
        if is_required:
            if field_key in FIELD_REQUIRED_MESSAGES:
                return FIELD_REQUIRED_MESSAGES[field_key]
            if field_key in NESTED_REQUIRED_MESSAGES:
                return NESTED_REQUIRED_MESSAGES[field_key]

        # 2. HSN-specific validation
        if field_key == "hsn_code":
            if "required" in raw_lower or "blank" in raw_lower or is_required:
                return "HSN Code is required."
            return "HSN Code must contain a valid 6 or 8 digit value."

        # 3. Price > 0 rules
        if field_key in ("mrp", "price", "pricing.mrp", "pricing.retail_price"):
            if "greater than 0" in raw_lower or "must be greater" in raw_lower:
                label = FIELD_LABELS.get(field_key, "Retail Price")
                return f"{label} must be greater than 0."

        if field_key in ("cost_price", "pricing.cost_price"):
            if "greater than 0" in raw_lower or "mandatory" in raw_lower:
                return "Cost Price must be greater than 0."

        if field_key in ("buying_price", "pricing.buying_price"):
            if "greater than 0" in raw_lower or "mandatory" in raw_lower:
                return "Dealer / Buying Price must be greater than 0."

        # 4. MRP >= Selling Price
        if "mrp" in field_key and "greater than or equal to" in raw_lower and "selling" in raw_lower:
            return "Retail Price (MRP) must be greater than or equal to the Selling Price."

        # 5. GST
        if field_key in ("gst_percentage", "tax_rate"):
            return "Please enter a valid GST rate."

        # 6. Selling Price
        if field_key in ("selling_price",):
            if "greater than" in raw_lower:
                return "Selling Price must be greater than 0."

        # 7. Barcode
        if field_key == "barcode" and is_required:
            return "Barcode is required."

        # 8. Generic fallback
        label = FIELD_LABELS.get(field_key, field_key.replace("_", " ").replace(".", " > ").title())
        translated_msg = ItemMasterValidationMapper._translate_pydantic_msg(raw_msg)
        _technical_indicators = ["constraint", "internal", "pydantic", "sqlalchemy", "error", "exception"]
        if (
            not translated_msg
            or translated_msg in ("value error", "type error")
            or any(t in translated_msg.lower() for t in _technical_indicators)
        ):
            return f"{label}: Please check and correct this value."
        return f"{label} {translated_msg}."

    @classmethod
    def build_422_response(cls, errors: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Converts a list of pydantic validation error dicts into the canonical
        SMRITI ITEM_MASTER_VALIDATION_ERROR JSON structure.

        Returns:
            {
              "error": {
                "code": "ITEM_MASTER_VALIDATION_ERROR",
                "message": "Please correct the highlighted fields.",
                "status": 422,
                "fields": [{"field": "sku", "message": "SKU / Item Code is required.", "section": "Basic Information"}]
              }
            }
        """
        seen_fields: set[str] = set()
        field_errors: list[dict[str, str]] = []

        for err in errors:
            loc = err.get("loc", ())
            raw_msg = err.get("msg", "Invalid value")
            field_key = cls._normalize_loc(loc)

            # De-duplicate: multiple pydantic errors for same field path
            if field_key in seen_fields:
                continue
            seen_fields.add(field_key)

            human_msg = cls._build_human_message(field_key, raw_msg)
            entry: dict[str, str] = {
                "field": field_key,
                "message": human_msg,
            }
            section = FIELD_SECTIONS.get(field_key)
            if section:
                entry["section"] = section

            field_errors.append(entry)

        n = len(field_errors)
        summary = (
            f"Please correct {n} field{'s' if n != 1 else ''} before saving."
            if n > 0
            else "Please correct the highlighted fields before saving."
        )

        return {
            "error": {
                "code": "ITEM_MASTER_VALIDATION_ERROR",
                "message": summary,
                "status": 422,
                "fields": field_errors,
            }
        }

    @classmethod
    def build_duplicate_sku_response(cls, sku_value: str) -> dict[str, Any]:
        """Structured 422 response for duplicate SKU / Item Code."""
        return {
            "error": {
                "code": "ITEM_MASTER_VALIDATION_ERROR",
                "message": "Please correct 1 field before saving.",
                "status": 422,
                "fields": [
                    {
                        "field": "code",
                        "message": (
                            f"SKU / Item Code '{sku_value}' already exists. "
                            f"Please use a unique SKU."
                        ),
                        "section": "Basic Information",
                    }
                ],
            }
        }

    @classmethod
    def build_duplicate_barcode_response(cls, barcode_value: str) -> dict[str, Any]:
        """Structured 422 response for duplicate Barcode."""
        return {
            "error": {
                "code": "ITEM_MASTER_VALIDATION_ERROR",
                "message": "Please correct 1 field before saving.",
                "status": 422,
                "fields": [
                    {
                        "field": "barcode",
                        "message": (
                            f"Barcode '{barcode_value}' is already assigned to another product."
                        ),
                        "section": "Barcode",
                    }
                ],
            }
        }

    @classmethod
    def build_unknown_field_response(cls, field_key: str, raw_msg: str) -> dict[str, Any]:
        """
        Fallback for 422 errors on unknown/unexpected fields.
        Sanitises raw message — never exposes Pydantic/internal detail.
        """
        label = FIELD_LABELS.get(field_key, field_key.replace("_", " ").title())
        return {
            "error": {
                "code": "ITEM_MASTER_VALIDATION_ERROR",
                "message": "Please correct 1 field before saving.",
                "status": 422,
                "fields": [
                    {
                        "field": field_key,
                        "message": f"{label}: Please check and correct this value.",
                    }
                ],
            }
        }

    @classmethod
    def build_dynamic_attr_422_response(cls, detail: dict) -> dict[str, Any] | None:
        """
        Converts an AttributesService / IM-001 HTTPException(422) detail dict
        into the canonical ITEM_MASTER_VALIDATION_ERROR structure.

        Input shape (from AttributesService.validate_product_attributes):
            {
                "message": "Dynamic attribute validation failed",
                "errors":  ["Style is required", "Size contains invalid value(s): XS"]
            }

        Also handles IM-001 shape:
            {
                "detail": "IM-001 [BLOCK]: Controlled field 'GST_RATE_PERCENT' ..."
            }

        Returns None if `detail` is not in a recognised dynamic-attr shape,
        allowing the caller to fall through to the generic HREP handler.
        """
        if not isinstance(detail, dict):
            return None

        raw_errors: list[str] = []

        # Shape A: AttributesService {"message": "...", "errors": [...]}
        if isinstance(detail.get("errors"), list):
            raw_errors = [str(e) for e in detail["errors"]]

        # Shape B: IM-001 single string detail — wrapped in outer dict by Starlette
        elif isinstance(detail.get("detail"), str) and "IM-001" in detail["detail"]:
            raw_errors = [detail["detail"]]

        # Shape C: Single message in detail dict (e.g. from universal_import commit or direct raise)
        elif isinstance(detail.get("message"), str):
            raw_errors = [detail["message"]]

        if not raw_errors:
            return None

        seen_fields: set[str] = set()
        field_errors: list[dict[str, str]] = []

        # If field_failures is present (from IM-001 / Controlled Field validator), map directly
        if isinstance(detail.get("field_failures"), list) and detail["field_failures"]:
            for ff in detail["field_failures"]:
                std_field = str(ff.get("field", "")).lower()
                if std_field in seen_fields:
                    continue
                seen_fields.add(std_field)
                bad_val = str(ff.get("value", ""))
                near_match = ff.get("near_match")
                label = FIELD_LABELS.get(std_field, std_field.replace("_", " ").title())
                sec = FIELD_SECTIONS.get(std_field, "Basic Information")
                if near_match:
                    human_msg = f"{label} '{bad_val}' is not in the approved list. Did you mean '{near_match}'? Check the System Master Lookup for the correct approved value."
                else:
                    human_msg = f"{label} '{bad_val}' is not recognised. Check the System Master Lookup for the correct approved value."
                field_errors.append({
                    "field": std_field,
                    "message": human_msg,
                    "section": sec,
                })

        for raw_err in raw_errors:
            field_key, human_msg, section = cls._parse_dynamic_attr_error(raw_err)
            if field_key in seen_fields:
                continue
            seen_fields.add(field_key)
            entry: dict[str, str] = {
                "field": field_key,
                "message": human_msg,
                "section": section,
            }
            field_errors.append(entry)

        if not field_errors:
            return None

        n = len(field_errors)
        summary = (
            f"Please correct {n} field{'s' if n != 1 else ''} before saving."
        )
        row_num = detail.get("row_number")
        if row_num is not None:
            summary = f"Row {row_num}: {summary}"

        resp: dict[str, Any] = {
            "error": {
                "code": "ITEM_MASTER_VALIDATION_ERROR",
                "message": summary,
                "status": 422,
                "fields": field_errors,
            }
        }
        if row_num is not None:
            resp["error"]["row_number"] = row_num

        if detail.get("code") == "SMRITI-VAL-002" or "im-001" in str(detail).lower() or detail.get("field_failures"):
            resp["error"]["error_code"] = "SMRITI-VAL-002"
            resp["error"]["reference_id"] = "IM-001"
            if detail.get("field_failures"):
                resp["error"]["field_failures"] = detail.get("field_failures")
            if detail.get("suggested_action"):
                resp["error"]["suggested_action"] = detail.get("suggested_action")
        return resp

    @staticmethod
    def _parse_dynamic_attr_error(raw_err: str) -> tuple[str, str, str]:
        """
        Parse a single dynamic attribute error string into (field_key, human_message, section).

        Handles patterns:
          "Style is required"                          → style_code, required msg
          "Article No is required"                     → style_code, required msg
          "Color contains invalid value(s): Pink"      → color, invalid msg
          "Heel Type “X” is not in the approved list"  → heel_type, message
          "IM-001 [BLOCK]: Controlled field '...' ..." → safe fallback
        """
        raw_lower = raw_err.lower().strip()

        # ── IM-004 Article / Style code required ─────────────────────────────
        if "article_style_code required" in raw_lower or "cannot derive style from sku" in raw_lower:
            return "style_code", "Article / Style Code is required. Please provide a Style Code for each row.", "Basic Information"

        # ── IM-001 governance block ───────────────────────────────────────────
        # e.g. "IM-001 [BLOCK]: Controlled field 'GST_RATE_PERCENT' value '12.0' not found"
        if "im-001" in raw_lower or "[block]" in raw_lower:
            # Extract which controlled field is mentioned
            import re as _re
            m = _re.search(r"controlled field '([^']+)'", raw_err, _re.IGNORECASE)
            if m:
                controlled_field = m.group(1).lower().replace("_", " ")
                # Try to map the controlled field name
                for label_key, (fk, msg, sec) in _DYN_LABEL_MAP.items():
                    if label_key == controlled_field or label_key in controlled_field or controlled_field in label_key:
                        return fk, msg, sec
            # Safe fallback for unknown IM-001 fields
            return "style_code", "A required product attribute is not registered. Please check your product configuration under Settings → Master Lookup.", "Basic Information"

        # ── Controlled Field "is not in approved list" or "not recognised" ──
        if "not in the approved list" in raw_lower or "not recognised" in raw_lower or "not found in system master lookup" in raw_lower:
            import re as _re_cf
            m_cf = _re_cf.match(r"^(.+?)\s+[“\"']([^”\"']+)[\"”']\s+is not", raw_err, _re_cf.IGNORECASE)
            if m_cf:
                label_part = m_cf.group(1).strip().lower()
                for label_key, (fk, msg, sec) in _DYN_LABEL_MAP.items():
                    if label_key == label_part or label_key in label_part or label_part in label_key:
                        return fk, msg, sec
            m_cf2 = _re_cf.search(r"controlled field '([^']+)'", raw_err, _re_cf.IGNORECASE)
            if m_cf2:
                cf_name = m_cf2.group(1).lower().replace("_", " ")
                for label_key, (fk, msg, sec) in _DYN_LABEL_MAP.items():
                    if label_key in cf_name or cf_name in label_key:
                        return fk, msg, sec
            for label_key, (fk, msg, sec) in _DYN_LABEL_MAP.items():
                if raw_lower.startswith(label_key):
                    return fk, msg, sec

        # ── "<Label> is required" ─────────────────────────────────────────────
        if "is required" in raw_lower:
            label_part = raw_lower.replace("is required", "").strip().rstrip(".")
            if label_part in _DYN_LABEL_MAP:
                fk, msg, sec = _DYN_LABEL_MAP[label_part]
                return fk, msg, sec
            # Partial match
            for label_key, (fk, msg, sec) in _DYN_LABEL_MAP.items():
                if label_key in label_part or label_part.startswith(label_key):
                    return fk, msg, sec
            # Unknown label — don't echo the raw label (may contain technical words)
            return "style_code", "A required product detail is missing. Please check all required fields and try again.", "Basic Information"

        # ── "<Label> contains invalid value(s): X" ────────────────────────────
        if "contains invalid" in raw_lower or "invalid value" in raw_lower:
            import re as _re2
            # Extract label before "contains"
            m2 = _re2.match(r"^(.+?)\s+contains", raw_err, _re2.IGNORECASE)
            label_part = m2.group(1).strip().lower() if m2 else ""
            # Extract invalid values
            m3 = _re2.search(r"invalid value(?:s)?:\s*(.+)$", raw_err, _re2.IGNORECASE)
            invalid_vals = m3.group(1).strip() if m3 else "unknown"

            if label_part in _DYN_LABEL_MAP:
                fk, _, sec = _DYN_LABEL_MAP[label_part]
                label = FIELD_LABELS.get(fk, label_part.title())
                return fk, f"{label} contains an invalid value. Please select from the approved list.", sec
            for label_key, (fk, _, sec) in _DYN_LABEL_MAP.items():
                if label_key in label_part:
                    label = FIELD_LABELS.get(fk, label_part.title())
                    return fk, f"{label} contains an invalid value. Please select from the approved list.", sec
            safe_label = label_part.replace("_", " ").title() or "A product attribute"
            return "style_code", f"{safe_label} contains an invalid value. Please select from the approved list.", "Basic Information"

        # ── "<Label> must be numeric" / "must use YYYY-MM-DD" etc. ────────────
        for suffix, tmpl in [
            ("must be numeric", "must be a number"),
            ("must use yyyy-mm-dd format", "must use YYYY-MM-DD date format"),
            ("must be boolean", "must be Yes or No"),
        ]:
            if suffix in raw_lower:
                label_part = raw_lower.replace(suffix, "").strip().rstrip(".")
                if label_part in _DYN_LABEL_MAP:
                    fk, _, sec = _DYN_LABEL_MAP[label_part]
                    label = FIELD_LABELS.get(fk, label_part.title())
                    return fk, f"{label} {tmpl}.", sec

        # ── Generic fallback — safe, no internal text ─────────────────────────
        # Do NOT echo the raw label — it may contain words like 'dynamic', 'system', etc.
        return "style_code", "A required product detail is missing or has an invalid value. Please review all fields and try again.", "Basic Information"


# ---------------------------------------------------------------------------
# Endpoint Matcher
# ---------------------------------------------------------------------------

ITEM_MASTER_PATHS: tuple[str, ...] = (
    "/api/v1/inventory",
    "/api/v1/inventory/",
    "/api/v1/item-styles",
    "/api/v1/item-variants",
    "/api/v1/item-barcodes",
    "/api/v1/universal/items",
    "/api/v1/universal/items/",
    "/api/v1/universal-import",
    "/api/v1/universal-import/",
)


def is_item_master_endpoint(path: str) -> bool:
    """Return True if the request path belongs to Item Master domain."""
    return any(path.startswith(p) for p in ITEM_MASTER_PATHS)
