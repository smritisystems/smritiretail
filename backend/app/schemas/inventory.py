"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, ValidationInfo


class ProductBase(BaseModel):
    variant_id: Optional[int] = None
    code: str = Field(..., max_length=50, description="Stock No / SKU")
    name: str = Field(..., max_length=255, description="Product Name / Title")
    price: Decimal = Field(..., ge=0, description="Selling Price")
    stock: int = 0
    category: str = Field(default="Footwear", max_length=100)
    is_favorite: Optional[bool] = False
    barcode: str = Field(..., max_length=100, description="Barcode")
    secondary_barcodes: Optional[List[str]] = Field(default_factory=list)
    brand: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    mrp: Decimal = Field(..., ge=0, description="MRP")
    gst_percentage: Decimal = Field(..., ge=0, description="GST Tax Rate (%)")
    style_code: Optional[str] = Field(None, max_length=100)
    buying_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    sku: Optional[str] = Field(None, max_length=100)
    hsn_code: str = Field(..., max_length=15, description="HSN Code")
    pricing_mode: Optional[str] = "Fixed"
    tracking_mode: Optional[str] = "Standard"
    variant_template_id: Optional[str] = Field(None, max_length=50)
    weight_grams: Optional[Decimal] = Decimal("0.00")
    attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)
    primary_image_url: Optional[str] = Field(None, max_length=512)
    gallery_images: Optional[List[str]] = Field(default_factory=list)

    @field_validator("code", "name", "barcode", "hsn_code", mode="before")
    @classmethod
    def validate_non_blank_string(cls, v: Any, info: ValidationInfo) -> str:
        if v is None:
            raise ValueError(f"{info.field_name} is required and cannot be blank.")
        s = str(v).strip()
        if not s:
            raise ValueError(f"{info.field_name} is required and cannot be blank or whitespace-only.")
        return s

    @field_validator("mrp", "price", "gst_percentage", mode="before")
    @classmethod
    def validate_required_numeric(cls, v: Any, info: ValidationInfo) -> Decimal:
        if v is None:
            raise ValueError(f"{info.field_name} is required and cannot be blank.")
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                raise ValueError(f"{info.field_name} is required and cannot be blank.")
            try:
                dec = Decimal(v_clean)
            except Exception:
                raise ValueError(f"{info.field_name} must be a valid number.")
        else:
            try:
                dec = Decimal(str(v))
            except Exception:
                raise ValueError(f"{info.field_name} must be a valid number.")
        if dec < 0:
            raise ValueError(f"{info.field_name} cannot be negative.")
        return dec

    @field_validator("buying_price", "cost_price", mode="before")
    @classmethod
    def validate_optional_numeric(cls, v: Any, info: ValidationInfo) -> Optional[Decimal]:
        if v is None:
            return None
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                return None
            try:
                dec = Decimal(v_clean)
            except Exception:
                raise ValueError(f"{info.field_name} must be a valid number.")
        else:
            try:
                dec = Decimal(str(v))
            except Exception:
                raise ValueError(f"{info.field_name} must be a valid number.")
        return dec

    @model_validator(mode="after")
    def validate_pricing_hierarchy(self) -> "ProductBase":
        # Check if item is an exempt non-stock/service/sample/free item
        is_non_stock = (
            (self.tracking_mode and self.tracking_mode.lower() in ["no-stock", "nostock", "service", "non-stock"])
            or (self.pricing_mode and self.pricing_mode.lower() in ["free", "sample", "promotional"])
            or (self.category and self.category.lower() in ["service", "services", "sample", "samples", "promotion", "promotional", "free"])
        )

        if is_non_stock:
            # Pricing constraints are relaxed for non-stock / service / free items
            return self

        # For stock/inventory items:
        # Gracefully default missing prices for legacy / imported stock items to prevent serialization crashes
        if self.price is None:
            self.price = Decimal("0.00")
        if self.price < Decimal("0"):
            raise ValueError("Selling Price must be greater than or equal to 0.")

        if self.buying_price is None:
            self.buying_price = self.cost_price or (self.price if self.price > Decimal("0") else Decimal("100.00"))
        if self.buying_price <= Decimal("0"):
            self.buying_price = self.price if self.price > Decimal("0") else Decimal("100.00")

        if self.cost_price is None:
            self.cost_price = self.buying_price or self.price or Decimal("100.00")
        if self.cost_price <= Decimal("0"):
            self.cost_price = self.buying_price or self.price or Decimal("100.00")

        if self.mrp is None or self.mrp < self.price:
            self.mrp = self.price

        if self.cost_price > self.buying_price:
            self.buying_price = self.cost_price

        return self


class ProductCreate(ProductBase):
    id: Optional[str] = Field(default=None, max_length=50)


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
    buying_price: Optional[Decimal] = None
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

    @field_validator("code", "name", "barcode", "hsn_code", mode="before")
    @classmethod
    def validate_update_string(cls, v: Any, info: ValidationInfo) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError(f"{info.field_name} cannot be blank or whitespace-only.")
        return s

    @field_validator("mrp", "price", "gst_percentage", "buying_price", "cost_price", mode="before")
    @classmethod
    def validate_update_numeric(cls, v: Any, info: ValidationInfo) -> Optional[Decimal]:
        if v is None:
            return None
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                raise ValueError(f"{info.field_name} cannot be blank.")
            try:
                dec = Decimal(v_clean)
            except Exception:
                raise ValueError(f"{info.field_name} must be a valid number.")
        else:
            try:
                dec = Decimal(str(v))
            except Exception:
                raise ValueError(f"{info.field_name} must be a valid number.")
        return dec

    @model_validator(mode="after")
    def validate_update_pricing_hierarchy(self) -> "ProductUpdate":
        if self.buying_price is not None and self.buying_price <= Decimal("0"):
            raise ValueError("Buying Price must be greater than 0.")
        if self.cost_price is not None and self.cost_price <= Decimal("0"):
            raise ValueError("Cost Price must be greater than 0.")
        if self.price is not None and self.price < Decimal("0"):
            raise ValueError("Selling Price must be greater than or equal to 0.")
        if self.cost_price is not None and self.buying_price is not None:
            if self.cost_price > self.buying_price:
                raise ValueError(f"Cost Price ({self.cost_price}) must be less than or equal to Buying Price ({self.buying_price}).")
        if self.mrp is not None and self.price is not None:
            if self.mrp < self.price:
                raise ValueError(f"MRP ({self.mrp}) must be greater than or equal to Selling Price ({self.price}).")
        return self


class ProductResponse(ProductBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False
    version: Optional[int] = 1

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
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
