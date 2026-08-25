"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class ItemBarcodeItem(BaseModel):
    id: Optional[str] = None
    variant_id: Optional[str] = None
    barcode: str
    barcode_type: str = "EAN13"
    is_primary: bool = False


class ItemVariantItem(BaseModel):
    id: Optional[str] = None
    variant_sku: str
    variant_name: str
    attributes_json: Dict[str, Any] = Field(default_factory=dict)
    mrp: float = 0.0
    selling_price: float = 0.0
    cost_price: float = 0.0
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
    brand: Optional[str] = None
    hsn_code: Optional[str] = "0000"
    tax_rate: float = 18.0
    primary_uom: str = "PCS"
    mrp: float = 0.0
    selling_price: float = 0.0
    cost_price: float = 0.0
    buying_price: Optional[float] = None
    is_batch_tracked: bool = False
    is_serial_tracked: bool = False
    is_favorite: bool = False
    primary_image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    attributes_json: Dict[str, Any] = Field(default_factory=dict)
    variants: List[ItemVariantItem] = Field(default_factory=list)
    barcodes: List[ItemBarcodeItem] = Field(default_factory=list)
    batches: List[ItemBatchItem] = Field(default_factory=list)
    locations: List[ItemLocationItem] = Field(default_factory=list)


class ItemUpdateRequest(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    primary_uom: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    status: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None
    attributes_json: Optional[Dict[str, Any]] = None


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item_code: str
    item_name: str
    item_type: str
    category: str
    category_code: Optional[str] = None
    brand: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: float
    primary_uom: str
    mrp: float
    selling_price: float
    cost_price: float
    is_batch_tracked: bool
    is_serial_tracked: bool
    status: str
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
    matched_by: str  # BARCODE, VARIANT_SKU, ITEM_CODE, SERIAL
    item_id: str
    item_code: str
    item_name: str
    variant_id: Optional[str] = None
    variant_sku: Optional[str] = None
    barcode: Optional[str] = None
    serial_number: Optional[str] = None
    tax_rate: float
    mrp: float
    selling_price: float
    cost_price: float
    primary_uom: str
    category: str
    brand: Optional[str] = None


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
