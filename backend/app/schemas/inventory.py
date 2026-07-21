"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.6.0
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class ProductVendorCreate(BaseModel):
    supplier_id: str = Field(..., description="Supplier ID reference")
    supplier_product_code: Optional[str] = Field(None, max_length=100)
    supplier_barcode: Optional[str] = Field(None, max_length=100)
    purchase_uom_id: Optional[str] = Field(None, max_length=50)
    currency_id: str = "INR"
    cost_price: Decimal = Decimal("0.00")
    last_purchase_price: Decimal = Decimal("0.00")
    last_purchase_date: Optional[datetime] = None
    discount_percentage: Decimal = Decimal("0.00")
    tax_inclusive: bool = False
    minimum_order_qty: Decimal = Decimal("1.00")
    maximum_order_qty: Optional[Decimal] = None
    lead_time_days: int = 1
    supplier_warranty_days: int = 0
    priority: int = 1
    is_preferred: bool = False
    approval_status: str = "Approved"


class ProductVendorResponse(ProductVendorCreate):
    id: str
    product_id: str
    company_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ProductTaxProfileCreate(BaseModel):
    hsn_code: Optional[str] = Field(None, max_length=20)
    gst_rate: Decimal = Decimal("18.00")
    cess_rate: Decimal = Decimal("0.00")
    is_inclusive_tax: bool = False
    tax_group_id: Optional[str] = None
    effective_from: datetime = Field(default_factory=datetime.utcnow)
    effective_to: Optional[datetime] = None


class ProductTaxProfileResponse(ProductTaxProfileCreate):
    id: str
    product_id: str
    model_config = ConfigDict(from_attributes=True)


class ProductInventoryPolicyCreate(BaseModel):
    is_batch_tracked: bool = False
    is_serial_tracked: bool = False
    is_expiry_required: bool = False
    is_qc_required: bool = False
    allow_negative_stock: bool = False


class ProductInventoryPolicyResponse(ProductInventoryPolicyCreate):
    id: str
    product_id: str
    model_config = ConfigDict(from_attributes=True)


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
    size_scale_id: Optional[str] = Field(None, max_length=50)
    sourcing_mode_override: Optional[str] = Field(None, max_length=30)
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
    vendors: List[ProductVendorCreate] = []
    tax_profiles: List[ProductTaxProfileCreate] = []
    inventory_policy: Optional[ProductInventoryPolicyCreate] = None


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
    size_scale_id: Optional[str] = None
    sourcing_mode_override: Optional[str] = None
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
    vendors: Optional[List[ProductVendorCreate]] = None
    tax_profiles: Optional[List[ProductTaxProfileCreate]] = None
    inventory_policy: Optional[ProductInventoryPolicyCreate] = None


class ProductResponse(ProductBase):
    id: str
    tenant_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    vendors: List[ProductVendorResponse] = []
    tax_profiles: List[ProductTaxProfileResponse] = []
    inventory_policy: Optional[ProductInventoryPolicyResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ProductBarcodeBase(BaseModel):
    product_id: str
    barcode: str
    is_primary: bool = False


class ProductBarcodeResponse(ProductBarcodeBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


class StockMovementBase(BaseModel):
    product_id: str
    quantity: float
    movement_type: str = "IN"
    reference_id: Optional[str] = None
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementResponse(StockMovementBase):
    id: str
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

