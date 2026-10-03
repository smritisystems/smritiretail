"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-10-03
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Global Product Resolution & Validation Standard (Phase 1)
"""

from decimal import Decimal
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


class ProductResolutionErrorDetail(BaseModel):
    code: str  # PRODUCT_NOT_FOUND | PRODUCT_INACTIVE | PRODUCT_QUARANTINED
    title: str
    explanation: str
    suggested_action: str
    identifier: Optional[str] = None
    identifier_type: Optional[str] = None
    line_no: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ProductResolutionResult(BaseModel):
    success: bool
    code: Optional[str] = None  # None if success, or "PRODUCT_NOT_FOUND", "PRODUCT_INACTIVE", "PRODUCT_QUARANTINED"
    message: Optional[str] = None
    identifier_type: Optional[str] = None  # "PRODUCT_ID" | "BARCODE" | "SKU" | "ITEM_CODE"
    identifier: Optional[str] = None

    # Authoritative Identifiers
    product_id: Optional[str] = None       # Authoritative legacy or mapped Product ID
    item_id: Optional[str] = None          # Canonical Item ID
    variant_id: Optional[str] = None       # Canonical Variant ID
    sku: Optional[str] = None              # Authoritative Variant SKU or Product Code
    barcode: Optional[str] = None          # Primary Barcode

    # Authoritative Product Data
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    category_code: Optional[str] = None
    uom: str = "NOS"
    hsn_code: Optional[str] = None
    tax_rate: Decimal = Decimal("0.00")
    mrp: Decimal = Decimal("0.00")
    selling_price: Decimal = Decimal("0.00")
    cost_price: Decimal = Decimal("0.00")

    # State & Governance
    is_active: bool = True
    is_quarantined: bool = False
    resolution_source: Optional[str] = None  # "CANONICAL_PRIMARY" | "LEGACY_FALLBACK" | "LEGACY_AUTHORITATIVE"
    matched_by: Optional[str] = None         # "PRODUCT_ID" | "BARCODE" | "VARIANT_SKU" | "ITEM_CODE" | "LEGACY_PRODUCT"

    # Human-Readable Error Details per HREP
    error_detail: Optional[ProductResolutionErrorDetail] = None

    # Product entity payload dictionary
    product: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class TransactionLineItemInput(BaseModel):
    line_no: int = 1
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    item_id: Optional[str] = None
    barcode: Optional[str] = None
    sku: Optional[str] = None
    code: Optional[str] = None
    quantity: Decimal = Decimal("1.0")
    is_fee_line: bool = False

    model_config = ConfigDict(from_attributes=True)


class TransactionValidationResult(BaseModel):
    is_valid: bool
    total_lines: int
    valid_lines: int
    invalid_lines: int
    errors: List[ProductResolutionErrorDetail] = []
    resolved_lines: List[ProductResolutionResult] = []

    model_config = ConfigDict(from_attributes=True)


class BatchProductResolutionItem(BaseModel):
    line_no: int = 1
    identifier: Optional[str] = None
    identifier_type: Optional[str] = None
    barcode: Optional[str] = None
    sku: Optional[str] = None
    code: Optional[str] = None
    product_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BatchProductResolutionRequest(BaseModel):
    items: List[BatchProductResolutionItem] = Field(..., min_length=1, max_length=5000)
    allow_inactive: bool = False

    model_config = ConfigDict(from_attributes=True)


class BatchProductResolutionResponse(BaseModel):
    total_requested: int
    total_resolved: int
    total_failed: int
    results: List[ProductResolutionResult] = []

    model_config = ConfigDict(from_attributes=True)
