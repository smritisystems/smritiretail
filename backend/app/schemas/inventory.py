"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

class ProductBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    price: Decimal = Decimal("0.00")
    stock: int = 0
    category: str = Field(..., max_length=100)
    is_favorite: bool = False
    barcode: str = Field(..., max_length=100)
    secondary_barcodes: List[str] = []
    brand: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    mrp: Optional[Decimal] = None
    gst_percentage: Optional[Decimal] = None
    style_code: Optional[str] = Field(None, max_length=100)
    cost_price: Optional[Decimal] = None
    sku: Optional[str] = Field(None, max_length=100)
    hsn_code: Optional[str] = Field(None, max_length=15)
    pricing_mode: str = "Fixed"
    tracking_mode: str = "Standard"
    variant_template_id: Optional[str] = Field(None, max_length=50)
    weight_grams: Decimal = Decimal("0.00")
    attributes: Dict[str, Any] = {}
    primary_image_url: Optional[str] = Field(None, max_length=512)
    gallery_images: List[str] = []

class ProductCreate(ProductBase):
    id: str = Field(..., max_length=50)

class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    price: Optional[Decimal] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    is_favorite: Optional[bool] = None
    barcode: Optional[str] = None
    secondary_barcodes: Optional[List[str]] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    mrp: Optional[Decimal] = None
    gst_percentage: Optional[Decimal] = None
    style_code: Optional[str] = None
    cost_price: Optional[Decimal] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    pricing_mode: Optional[str] = None
    tracking_mode: Optional[str] = None
    variant_template_id: Optional[str] = None
    weight_grams: Optional[Decimal] = None
    attributes: Optional[Dict[str, Any]] = None
    primary_image_url: Optional[str] = None
    gallery_images: Optional[List[str]] = None

class ProductResponse(ProductBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


class StockMovementCreate(BaseModel):
    product_id: str = Field(..., max_length=50)
    product_name: str = Field(..., max_length=255)
    sku: str = Field(..., max_length=50)
    quantity: Decimal
    movement_type: str = Field(..., max_length=20)
    reference_doc_type: Optional[str] = Field(None, max_length=50)
    reference_doc_id: Optional[str] = Field(None, max_length=50)
    warehouse: Optional[str] = Field(None, max_length=100)
    bin: Optional[str] = Field(None, max_length=50)
    batch: Optional[str] = Field(None, max_length=50)
    serial: Optional[str] = Field(None, max_length=50)
    unit_cost: Optional[Decimal] = None
    remarks: Optional[str] = None
    user: Optional[str] = Field(None, max_length=100)
    device: Optional[str] = Field(None, max_length=100)
    branch: Optional[str] = Field(None, max_length=100)
    source_module: Optional[str] = Field(None, max_length=50)
    approval: Optional[str] = Field(None, max_length=50)
    id: Optional[str] = Field(None, max_length=50)
    company_id: Optional[str] = Field(None, max_length=50)
    branch_id: Optional[str] = Field(None, max_length=50)


class StockMovementResponse(BaseModel):
    id: str
    uuid: str
    product_id: str
    product_name: str
    sku: str
    quantity: Decimal
    movement_type: str
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    warehouse: Optional[str] = None
    bin: Optional[str] = None
    batch: Optional[str] = None
    serial: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    remarks: Optional[str] = None
    user: Optional[str] = None
    device: Optional[str] = None
    branch: Optional[str] = None
    source_module: Optional[str] = None
    approval: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)
