"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-08-25
Modified     : 2026-09-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ItemBarcodeItem(BaseModel):
    id: Optional[str] = None
    variant_id: Optional[str] = None
    barcode: str
    barcode_type: str = "EAN13"
    is_primary: bool = False
    is_tax_inclusive: Optional[bool] = None


class ItemVariantItem(BaseModel):
    id: Optional[str] = None
    variant_sku: Optional[str] = None
    variant_name: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    attributes_json: Dict[str, Any] = Field(default_factory=dict)
    mrp: float = 0.0
    selling_price: float = 0.0
    cost_price: float = 0.0
    tax_rate: Optional[float] = None
    is_active: bool = True
    barcodes: List[ItemBarcodeItem] = Field(default_factory=list)


class ItemBatchItem(BaseModel):
    id: Optional[str] = None
    variant_id: Optional[str] = None
    batch_number: str
    mfg_date: Optional[str] = None
    exp_date: Optional[str] = None
    mrp: float = 0.0
    cost_price: float = 0.0
    is_active: bool = True


class ItemSerialItem(BaseModel):
    id: Optional[str] = None
    variant_id: Optional[str] = None
    serial_number: str
    status: str = "AVAILABLE"
    warehouse_id: Optional[str] = None


class ItemLocationItem(BaseModel):
    id: Optional[str] = None
    warehouse_id: str
    location_bin: Optional[str] = None
    min_reorder_level: float = 0.0
    max_capacity: float = 0.0
    reorder_quantity: float = 0.0


class ItemCreateRequest(BaseModel):
    item_code: Optional[str] = None
    item_name: str
    item_type: str = "FINISHED_GOOD"
    category: str
    category_code: Optional[str] = None
    department: Optional[str] = None
    brand: Optional[str] = None
    style_code: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    vendor_code: Optional[str] = None
    hsn_code: Optional[str] = "0000"
    tax_rate: float = 18.0
    primary_uom: str = "PCS"
    mrp: float = 0.0
    selling_price: float = 0.0
    cost_price: float = 0.0
    buying_price: Optional[float] = None
    # v2.2: LANDED_COST_PRICE is the canonical business name for cost_price
    landed_cost_price: Optional[float] = None
    # v2.2: first-class field (was least_saleable_qty in model; v2.2 spells it "salable")
    least_salable_qty: float = 1.0
    is_batch_tracked: bool = False
    is_serial_tracked: bool = False
    is_favorite: bool = False
    primary_image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    attributes_json: Dict[str, Any] = Field(default_factory=dict)

    # ── v2.2 Promoted Attribute Fields ─────────────────────────────────────────
    gender: Optional[str] = None                # GENDER          (Col O) — System Master Lookup
    purchase_class: Optional[str] = None        # PURCHASE_CLASS  (Col P)
    product_type: Optional[str] = None          # PRODUCT_TYPE    (Col T) — System Master Lookup
    design_attribute: Optional[str] = None      # DESIGN_ATTRIBUTE(Col U) — System Master Lookup
    heel_type: Optional[str] = None             # HEEL_TYPE       (Col V) — System Master Lookup
    upper_material: Optional[str] = None        # UPPER_MATERIAL  (Col W) — System Master Lookup
    outsole_material: Optional[str] = None      # OUTSOLE_MATERIAL(Col X)
    collection_type: Optional[str] = None       # COLLECTION_TYPE (Col D)

    # ── v2.2 Business Logic Flags (IM-008 / IM-009) ────────────────────────────
    is_inventory_yn: bool = True                # IS_INVENTORY_YN (Col AE)
    is_billable_yn: bool = True                 # IS_BILLABLE_YN  (Col AF)
    is_service_yn: bool = False                 # IS_SERVICE_YN   (Col AG)

    auto_generate_article_number: bool = False  # Optional auto-numbering via document_series
    supplier: Optional[Dict[str, Any]] = None   # Optional Article-level vendor_product_assignment

    variants: List[ItemVariantItem] = Field(default_factory=list)
    barcodes: List[ItemBarcodeItem] = Field(default_factory=list)
    batches: List[ItemBatchItem] = Field(default_factory=list)
    locations: List[ItemLocationItem] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def resolve_aliases_and_rules(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # ARTICLE_STYLE_CODE alias resolution
            if not data.get("style_code"):
                alias_val = (
                    data.get("styleCode")
                    or data.get("style")
                    or data.get("stylecode")
                    or data.get("article")
                    or data.get("article_no")
                    or data.get("style_article")
                )
                if alias_val is not None:
                    data["style_code"] = alias_val

            # LANDED_COST_PRICE alias: populate cost_price if not already set
            if data.get("landed_cost_price") and not data.get("cost_price"):
                data["cost_price"] = data["landed_cost_price"]

            # IM-009: Service items cannot be inventory-tracked
            if data.get("is_service_yn") is True:
                data["is_inventory_yn"] = False
        return data


class ItemUpdateRequest(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    department: Optional[str] = None
    brand: Optional[str] = None
    style_code: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    vendor_code: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    primary_uom: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    landed_cost_price: Optional[float] = None   # v2.2 alias for cost_price
    status: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None
    attributes_json: Optional[Dict[str, Any]] = None

    # ── v2.2 Promoted Attribute Fields ─────────────────────────────────────────
    gender: Optional[str] = None
    purchase_class: Optional[str] = None
    product_type: Optional[str] = None
    design_attribute: Optional[str] = None
    heel_type: Optional[str] = None
    upper_material: Optional[str] = None
    outsole_material: Optional[str] = None
    collection_type: Optional[str] = None

    # ── v2.2 Business Logic Flags ──────────────────────────────────────────────
    is_inventory_yn: Optional[bool] = None
    is_billable_yn: Optional[bool] = None
    is_service_yn: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_aliases_and_rules(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("style_code"):
                alias_val = (
                    data.get("styleCode")
                    or data.get("style")
                    or data.get("stylecode")
                    or data.get("article")
                    or data.get("article_no")
                    or data.get("style_article")
                )
                if alias_val is not None:
                    data["style_code"] = alias_val
            if data.get("landed_cost_price") and not data.get("cost_price"):
                data["cost_price"] = data["landed_cost_price"]
            # IM-009: Service items cannot be inventory-tracked
            if data.get("is_service_yn") is True:
                data["is_inventory_yn"] = False
        return data


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    identity_code: Optional[str] = None
    item_code: str
    item_name: str
    item_type: str = "FINISHED_GOOD"
    category: Optional[str] = "GENERAL"
    category_code: Optional[str] = None
    department: Optional[str] = None
    brand: Optional[str] = None
    style_code: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    vendor_code: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = 18.0
    primary_uom: Optional[str] = "PCS"
    mrp: Optional[float] = 0.0
    selling_price: Optional[float] = 0.0
    cost_price: Optional[float] = 0.0
    least_saleable_qty: Optional[float] = 1.0
    is_batch_tracked: bool = False
    is_serial_tracked: bool = False
    status: str = "ACTIVE"

    # ── v2.2 Promoted Attribute Fields ─────────────────────────────────────────
    gender: Optional[str] = None
    purchase_class: Optional[str] = None
    product_type: Optional[str] = None
    design_attribute: Optional[str] = None
    heel_type: Optional[str] = None
    upper_material: Optional[str] = None
    outsole_material: Optional[str] = None
    collection_type: Optional[str] = None

    # ── v2.2 Business Logic Flags ──────────────────────────────────────────────
    is_inventory_yn: bool = True
    is_billable_yn: bool = True
    is_service_yn: bool = False

    # ── v2.2 Workflow Validation ───────────────────────────────────────────────
    validation_status: Optional[str] = None
    validation_message: Optional[str] = None

    variants: List[ItemVariantItem] = Field(default_factory=list)
    barcodes: List[ItemBarcodeItem] = Field(default_factory=list)
    batches: List[ItemBatchItem] = Field(default_factory=list)
    locations: List[ItemLocationItem] = Field(default_factory=list)


class MatrixVariantDimension(BaseModel):
    dimension_name: str  # "size", "color"
    values: List[str]  # ["S", "M", "L"]


class MatrixVariantGenRequest(BaseModel):
    dimensions: List[MatrixVariantDimension]
    base_mrp: Optional[float] = None
    base_selling_price: Optional[float] = None
    base_cost_price: Optional[float] = None
    auto_generate_barcodes: bool = True


class ItemResolutionResponse(BaseModel):
    matched_by: str  # BARCODE, VARIANT_SKU, BUYER_CODE, ITEM_CODE, SERIAL
    item_id: str
    item_code: str
    item_name: str
    variant_id: Optional[str] = None
    variant_sku: Optional[str] = None
    barcode: Optional[str] = None
    serial_number: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = 0.00
    mrp: Optional[float] = 0.00
    selling_price: Optional[float] = 0.00
    cost_price: Optional[float] = 0.00
    primary_uom: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    attributes_json: Optional[Dict[str, Any]] = None
    customer_article: Optional[str] = None
    contract_rate: Optional[float] = None
    contract_discount_pct: Optional[float] = None
    customer_style_description: Optional[str] = None
    effective_price: Optional[float] = None
    currency: Optional[str] = "INR"
    tax_treatment: Optional[str] = "TAXABLE_EXCLUSIVE"
    tax_amount: Optional[float] = 0.00
    effective_price_inclusive: Optional[float] = 0.00
    physical_on_hand: Optional[float] = 0.00
    in_transit_qty: Optional[float] = 0.00
    reserved_qty: Optional[float] = 0.00
    committed_qty: Optional[float] = 0.00
    quarantine_qty: Optional[float] = 0.00
    available_to_promise: Optional[float] = 0.00
    inventory: Optional[Dict[str, Any]] = None
    pricing_audit: Optional[Dict[str, Any]] = None


class LegacyProductAdapterResponse(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    brand: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: float
    price: float
    cost: float
    mrp: float
    uom: str
    is_active: bool


# ── SMRITI Item Master Domain-Driven Schemas (Standard v2.2) ──────────────────

class ItemStyleCreateRequest(BaseModel):
    style_code: str
    style_name: str
    item_type: str = "FINISHED_GOOD"
    category: str = "GENERAL"
    category_code: Optional[str] = None
    department: Optional[str] = None
    brand: Optional[str] = None
    vendor_code: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    primary_uom: str = "PRS"
    least_saleable_qty: float = 1.0
    gender: Optional[str] = None
    product_type: Optional[str] = None
    design_attribute: Optional[str] = None
    heel_type: Optional[str] = None
    upper_material: Optional[str] = None
    outsole_material: Optional[str] = None
    collection_type: Optional[str] = None
    is_inventory_yn: bool = True
    is_billable_yn: bool = True
    is_service_yn: bool = False
    attributes_json: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class ItemStyleUpdateRequest(BaseModel):
    style_name: Optional[str] = None
    category: Optional[str] = None
    department: Optional[str] = None
    brand: Optional[str] = None
    vendor_code: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    primary_uom: Optional[str] = None
    gender: Optional[str] = None
    product_type: Optional[str] = None
    heel_type: Optional[str] = None
    upper_material: Optional[str] = None
    outsole_material: Optional[str] = None
    collection_type: Optional[str] = None
    status: Optional[str] = None


class ItemStyleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    style_code: str = Field(alias="item_code")
    style_name: str = Field(alias="item_name")
    item_type: str = "FINISHED_GOOD"
    category: Optional[str] = None
    department: Optional[str] = None
    brand: Optional[str] = None
    vendor_code: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: float = 18.0
    primary_uom: Optional[str] = "PRS"
    gender: Optional[str] = None
    product_type: Optional[str] = None
    heel_type: Optional[str] = None
    upper_material: Optional[str] = None
    outsole_material: Optional[str] = None
    collection_type: Optional[str] = None
    status: str = "ACTIVE"
    is_inventory_yn: bool = True
    is_billable_yn: bool = True
    is_service_yn: bool = False
    variant_count: Optional[int] = 0
    barcode_count: Optional[int] = 0


class ItemVariantCreateRequest(BaseModel):
    style_id: str
    color: str
    size: str
    variant_sku: Optional[str] = None  # Auto-generated if omitted: {style_code}-{color}-{size}
    variant_name: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    attributes_json: Dict[str, Any] = Field(default_factory=dict)
    # Optional commercial price point to register in Pricing Domain
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    primary_barcode: Optional[str] = None


class ItemVariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    style_id: str = Field(alias="item_id")
    variant_sku: str
    variant_name: str
    color: Optional[str] = None
    size: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    is_active: bool = True
    attributes_json: Dict[str, Any] = Field(default_factory=dict)
    barcodes: List[ItemBarcodeItem] = Field(default_factory=list)


class ItemBarcodeCreateRequest(BaseModel):
    variant_id: str
    barcode: str
    barcode_type: str = "EAN13"
    barcode_purpose: str = "RETAIL"
    is_primary: bool = False
    is_tax_inclusive: Optional[bool] = True
    least_saleable_qty: float = 1.0
    price_book_entry_id: Optional[str] = None
    # Optional commercial price points
    mrp: Optional[float] = None
    selling_price: Optional[float] = None


class ItemBarcodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    style_id: Optional[str] = Field(None, alias="item_id")
    variant_id: Optional[str] = None
    barcode: str
    barcode_type: str = "EAN13"
    barcode_purpose: str = "RETAIL"
    is_primary: bool = False
    is_tax_inclusive: Optional[bool] = None
    least_saleable_qty: Optional[float] = 1.0
    price_book_entry_id: Optional[str] = None
    status: str = "ASSIGNED"


class ItemLookupsResponse(BaseModel):
    dimensions: Dict[str, List[Dict[str, Any]]]

