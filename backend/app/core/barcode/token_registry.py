# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

SMRITI Label Studio Token Registry
====================================
Central registry of all thermal label printing tokens used across ZPL/TSPL script generation,
layout diagnostics, and visual field mapping. Single source of truth.
"""

import datetime
from typing import Dict, Any, List, Optional


BARCODE_TOKEN_REGISTRY: Dict[str, Dict[str, str]] = {
    "barcode": {
        "source": "item.barcode",
        "item_master_field": "Item Barcode (primary scanned code)",
        "category": "Barcode",
        "example": "8901234567890",
        "description": "Scanned barcode / EAN-13 number printed as barcode + human-readable text",
    },
    "item_code": {
        "source": "item.code / item.item_code / item.sku",
        "item_master_field": "Item Code (inventory identification)",
        "category": "Item",
        "example": "BBM-SPORTS-BLK-08",
        "description": "Item Code used for inventory identification",
    },
    "item_name": {
        "source": "item.name / item.item_name",
        "item_master_field": "Item Name",
        "category": "Item",
        "example": "BBM Sports Black",
        "description": "Full product name / description (truncated to 28 chars on label)",
    },
    "brand": {
        "source": "item.brand",
        "item_master_field": "Brand",
        "category": "Item",
        "example": "Tattly Threads",
        "description": "Brand name printed prominently on label",
    },
    "mrp": {
        "source": "item.mrp / item.price",
        "item_master_field": "Maximum Retail Price (MRP)",
        "category": "Pricing",
        "example": "1899",
        "description": "Maximum Retail Price — integer format (e.g. 1899, not 1899.00)",
    },
    "rsp": {
        "source": "item.price / item.selling_price",
        "item_master_field": "Retail Selling Price (RSP)",
        "category": "Pricing",
        "example": "1499",
        "description": "Discounted Retail Selling Price",
    },
    "size": {
        "source": "item.attributes[Size|Shoe Size|Footwear Size] / item.size",
        "item_master_field": "Item Attributes → Size",
        "category": "Variant",
        "example": "8",
        "description": "Shoe/garment size from Item Attribute table",
    },
    "color": {
        "source": "item.attributes[Color|Colour|Shade] / item.color",
        "item_master_field": "Item Attributes → Color",
        "category": "Variant",
        "example": "BLACK",
        "description": "Color / shade from Item Attribute table",
    },
    "style": {
        "source": "item.custom_style_code > item.variant_of > item.style_no > item_code",
        "item_master_field": "Intelligent Style Resolution",
        "category": "Style",
        "example": "CH-01-A",
        "description": "Resolved Style/Article code using priority chain",
    },
    "style_code": {
        "source": "item.custom_style_code > item.variant_of > item.style_no > item_code",
        "item_master_field": "Intelligent Style Resolution (Alias)",
        "category": "Style",
        "example": "CH-01-A",
        "description": "Alias for {style}",
    },
    "article_no": {
        "source": "item.style_no / item.article_no",
        "item_master_field": "Article / Style Number",
        "category": "Style",
        "example": "ART-990",
        "description": "Explicit Manufacturer Article Number",
    },
    "pkd_date": {
        "source": "item.pkd_date / current_month",
        "item_master_field": "Packed Date (Month & Year)",
        "category": "Compliance",
        "example": "07/2026",
        "description": "Packed / Manufactured date formatted as MM/YYYY (Legal Metrology compliance)",
    },
    "material": {
        "source": "item.material / item.attributes[Material]",
        "item_master_field": "Fabric / Material Composition",
        "category": "Compliance",
        "example": "100% COTTON",
        "description": "Garment / product material composition string",
    },
    "department": {
        "source": "item.department / item.category",
        "item_master_field": "Department / Category",
        "category": "Classification",
        "example": "FOOTWEAR",
        "description": "Product Department or Master Category",
    },
    "hsn": {
        "source": "item.hsn / item.hsn_code",
        "item_master_field": "HSN Code",
        "category": "Taxation",
        "example": "6403",
        "description": "Harmonized System Nomenclature code for Indian GST compliance",
    },
    "company": {
        "source": "System Default / Business Profile",
        "item_master_field": "Company Name",
        "category": "Legal",
        "example": "SMRITI RETAIL PVT LTD",
        "description": "Company / Manufacturer legal name printed at label footer",
    },
    "gst_rate": {
        "source": "item.gst_rate / tax_slab",
        "item_master_field": "GST Percentage",
        "category": "Taxation",
        "example": "12%",
        "description": "Applicable GST tax rate percentage string",
    },
    "gross_wt": {
        "source": "item.gross_wt / item.weight",
        "item_master_field": "Gross Weight",
        "category": "Compliance",
        "example": "850g",
        "description": "Gross weight including packaging",
    },
    "net_wt": {
        "source": "item.net_wt / item.net_weight",
        "item_master_field": "Net Quantity / Weight",
        "category": "Compliance",
        "example": "1 Pair",
        "description": "Net quantity or unit count (e.g. 1 N / 1 Pair / 500g)",
    },
}


def resolve_style_code(item_dict: Dict[str, Any]) -> str:
    """
    Intelligent 4-Step Style Token Resolution Chain (SMRITI ACP_BARCODE_003)
    1. custom_style_code
    2. variant_of (Parent Template SKU)
    3. style_no / styleCode / article_no
    4. SKU Hyphen Split fallback (e.g. BBM-0001-6-BLK -> BBM-0001)
    """
    if not item_dict:
        return ""

    c_style = str(item_dict.get("custom_style_code") or "").strip()
    if c_style:
        return c_style

    v_parent = str(item_dict.get("variant_of") or "").strip()
    if v_parent:
        return v_parent

    s_no = str(item_dict.get("style_no") or item_dict.get("styleCode") or item_dict.get("article_no") or "").strip()
    if s_no:
        return s_no

    code = str(item_dict.get("code") or item_dict.get("item_code") or item_dict.get("sku") or "").strip()
    if "-" in code:
        parts = code.split("-")
        if len(parts) >= 2:
            return f"{parts[0]}-{parts[1]}"

    return code


def build_token_dict(item_dict: Dict[str, Any], company_name: str = "SMRITI RETAIL") -> Dict[str, str]:
    """
    Builds a complete, normalized token substitution dictionary from an item record.
    Returns string values for all registered tokens.
    """
    item = item_dict or {}

    # Extract price & MRP
    raw_mrp = item.get("mrp") or item.get("price") or 0
    try:
        mrp_val = int(round(float(raw_mrp)))
    except (ValueError, TypeError):
        mrp_val = 0

    raw_rsp = item.get("rsp") or item.get("price") or item.get("selling_price") or raw_mrp
    try:
        rsp_val = int(round(float(raw_rsp)))
    except (ValueError, TypeError):
        rsp_val = mrp_val

    # Packed date formatting
    pkd = str(item.get("pkd_date") or "").strip()
    if not pkd:
        now = datetime.datetime.now()
        pkd = now.strftime("%m/%Y")

    # Style resolution
    resolved_style = resolve_style_code(item)

    # Attributes extraction (dict or list format)
    attributes = item.get("attributes") or {}
    size_str = str(item.get("size") or "").strip()
    color_str = str(item.get("color") or item.get("colour") or "").strip()
    material_str = str(item.get("material") or "").strip()

    if isinstance(attributes, dict):
        if not size_str:
            size_str = str(attributes.get("Size") or attributes.get("Shoe Size") or attributes.get("Footwear Size") or "").strip()
        if not color_str:
            color_str = str(attributes.get("Color") or attributes.get("Colour") or attributes.get("Shade") or "").strip()
        if not material_str:
            material_str = str(attributes.get("Material") or attributes.get("Fabric") or "").strip()
    elif isinstance(attributes, list):
        for attr in attributes:
            if isinstance(attr, dict):
                a_name = str(attr.get("name") or attr.get("attribute") or "").lower()
                a_val = str(attr.get("value") or "").strip()
                if not size_str and a_name in ("size", "shoe size", "footwear size"):
                    size_str = a_val
                elif not color_str and a_name in ("color", "colour", "shade"):
                    color_str = a_val
                elif not material_str and a_name in ("material", "fabric"):
                    material_str = a_val

    # Item Code & Barcode
    barcode_str = str(item.get("barcode") or "").strip()
    item_code_str = str(item.get("code") or item.get("item_code") or item.get("sku") or "").strip()
    if not barcode_str:
        barcode_str = item_code_str

    item_name_str = str(item.get("name") or item.get("item_name") or item.get("description") or "").strip()

    token_map: Dict[str, str] = {
        "barcode": barcode_str,
        "item_code": item_code_str,
        "item_name": item_name_str[:28],
        "brand": str(item.get("brand") or "SMRITI").strip(),
        "mrp": str(mrp_val),
        "rsp": str(rsp_val),
        "size": size_str or "FS",
        "color": color_str or "STD",
        "style": resolved_style,
        "style_code": resolved_style,
        "article_no": str(item.get("article_no") or item.get("style_no") or resolved_style).strip(),
        "pkd_date": pkd,
        "material": material_str or "COTTON BLEND",
        "department": str(item.get("department") or item.get("category") or "APPAREL").strip(),
        "hsn": str(item.get("hsn") or item.get("hsn_code") or "6403").strip(),
        "company": str(item.get("company") or company_name).strip(),
        "gst_rate": str(item.get("gst_rate") or "12%").strip(),
        "gross_wt": str(item.get("gross_wt") or item.get("weight") or "").strip(),
        "net_wt": str(item.get("net_wt") or "1 N").strip(),
    }

    return token_map


def get_registry_for_api() -> List[Dict[str, Any]]:
    """
    Returns the token registry formatted for front-end autocomplete, field mapping UI,
    and OpenAPI schema documentation.
    """
    result = []
    for token_key, meta in BARCODE_TOKEN_REGISTRY.items():
        result.append({
            "token": f"{{{token_key}}}",
            "key": token_key,
            "category": meta.get("category", "General"),
            "item_master_field": meta.get("item_master_field", ""),
            "example": meta.get("example", ""),
            "description": meta.get("description", ""),
        })
    return result
