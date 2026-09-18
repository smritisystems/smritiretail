"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.18.0
* Created    : 2026-07-11
* Modified   : 2026-09-18
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ─────────────────────────── Supplier ───────────────────────────

class SupplierCreate(BaseModel):
    id:          str
    name:        str
    code:        str
    gst_number:  Optional[str] = None
    mobile:      Optional[str] = None
    email:       Optional[str] = None
    address:     Optional[str] = None
    city:        Optional[str] = None
    state:       Optional[str] = None
    pincode:     Optional[str] = None


class SupplierResponse(BaseModel):
    id:            str
    identity_code: Optional[str] = None
    name:          str
    code:          str
    gst_number:    Optional[str] = None
    mobile:        Optional[str] = None
    email:         Optional[str] = None
    address:       Optional[str] = None
    city:          Optional[str] = None
    state:         Optional[str] = None
    pincode:       Optional[str] = None
    outstanding:   Decimal
    company_id:    Optional[str] = None
    branch_id:     Optional[str] = None

    model_config = {"from_attributes": True}


class SupplierUpdate(BaseModel):
    """Partial-update schema for a supplier. All fields optional."""
    name:       Optional[str] = None
    gst_number: Optional[str] = None
    mobile:     Optional[str] = None
    email:      Optional[str] = None
    address:    Optional[str] = None
    city:       Optional[str] = None
    state:      Optional[str] = None
    pincode:    Optional[str] = None


# ─────────────────────────── Purchase Order ───────────────────────────

class PurchaseOrderItemCreate(BaseModel):
    product_id: Optional[str] = None
    item_id:    Optional[str] = None
    code:       Optional[str] = None
    name:       Optional[str] = None
    quantity:   Decimal
    cost_price: Optional[Decimal] = None
    gst_rate:   Decimal = Decimal("18.00")

    @model_validator(mode="before")
    @classmethod
    def normalize_line_item(cls, data: any) -> any:
        if isinstance(data, dict):
            if not data.get("code") and data.get("item_code"):
                data["code"] = str(data["item_code"])
            if not data.get("product_id"):
                data["product_id"] = data.get("code") or data.get("item_code") or "PROD-GENERIC"
            if not data.get("name") and data.get("item_name"):
                data["name"] = str(data["item_name"])
            elif not data.get("name"):
                data["name"] = data.get("code") or "Item"
            if data.get("cost_price") is None and data.get("rate") is not None:
                data["cost_price"] = data["rate"]
            elif data.get("cost_price") is None:
                data["cost_price"] = Decimal("0.00")
            if data.get("gst_rate") is None and data.get("tax_percent") is not None:
                data["gst_rate"] = data["tax_percent"]
        return data


class PurchaseOrderItemResponse(BaseModel):
    id:         str
    product_id: str
    item_id:    Optional[str] = None
    code:       str
    name:       str
    quantity:   Decimal
    cost_price: Decimal
    gst_rate:   Decimal
    tax_amount: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    id:          Optional[str] = Field(None, max_length=50, description="Persistent technical IDs are governed and generated server-side by IdentityEngine.")
    order_no:    Optional[str] = None
    supplier_id: str
    notes:       Optional[str] = None
    items:       Optional[List[PurchaseOrderItemCreate]] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_po_create(cls, data: any) -> any:
        if isinstance(data, dict):
            data["id"] = None
            if not data.get("order_no") and data.get("order_number"):
                data["order_no"] = str(data["order_number"])
            if data.get("items") is None and data.get("lines") is not None:
                data["items"] = data["lines"]
        return data

    @field_validator("order_no")
    @classmethod
    def validate_order_no(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            raise ValueError("order_no is required")
        return v.strip()


class PurchaseOrderCancelRequest(BaseModel):
    """Optional cancellation reason for cancelling a purchase order."""
    reason: Optional[str] = None


class PurchaseOrderAmendRequest(BaseModel):
    """
    Amendment: the original (Confirmed) PO is cancelled and a new Confirmed
    PO is created from the supplied items.
    """
    new_order_id: Optional[str] = None
    new_order_no: str
    items:        List[PurchaseOrderItemCreate]
    reason:       Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    id:            str
    identity_code: Optional[str] = None
    order_no:      str
    supplier_id:   str
    status:        str
    notes:         Optional[str] = None
    subtotal:      Decimal
    tax_total:     Decimal
    grand_total:   Decimal
    items:         List[PurchaseOrderItemResponse] = []
    company_id:    Optional[str] = None
    branch_id:     Optional[str] = None

    model_config = {"from_attributes": True}


from datetime import datetime, date


# ─────────────────────────── Purchase Receipt (GRN) ───────────────────────────

class PurchaseReceiptItemCreate(BaseModel):
    product_id:        str
    item_id:           Optional[str] = None
    code:              str
    name:              str
    batch_no:          Optional[str] = None
    mfg_date:          Optional[date] = None
    expiry_date:       Optional[date] = None
    mrp:               Optional[Decimal] = None
    quantity_ordered:  Optional[Decimal] = None
    quantity_received: Decimal
    quantity_damaged:  Optional[Decimal] = Decimal("0.00")
    cost_price:        Decimal
    gst_rate:          Decimal = Decimal("18.00")


class PurchaseReceiptItemResponse(BaseModel):
    id:                str
    product_id:        str
    item_id:           Optional[str] = None
    code:              str
    name:              str
    batch_no:          Optional[str] = None
    mfg_date:          Optional[date] = None
    expiry_date:       Optional[date] = None
    mrp:               Optional[Decimal] = None
    quantity_ordered:  Optional[Decimal] = None
    quantity_received: Decimal
    quantity_damaged:  Decimal = Decimal("0.00")
    cost_price:        Decimal
    gst_rate:          Decimal
    tax_amount:        Decimal
    line_total:        Decimal

    model_config = {"from_attributes": True}


class PurchaseReceiptCreate(BaseModel):
    id:           Optional[str] = None
    receipt_no:   Optional[str] = None
    supplier_id:  str
    warehouse_id: Optional[str] = None  # target godown — optional (defaults to Central Godown)
    order_id:     Optional[str] = None   # link to PO — optional
    notes:        Optional[str] = None
    items:        List[PurchaseReceiptItemCreate]


class DebitNoteCreate(BaseModel):
    id:                 Optional[str] = None
    debit_note_no:      Optional[str] = None
    supplier_id:        str
    receipt_id:         Optional[str] = None
    claim_amount:       Decimal
    tax_amount:         Optional[Decimal] = Decimal("0.00")
    total_debit_amount: Decimal
    status:             Optional[str] = "ISSUED"
    reason:             Optional[str] = None


class DebitNoteResponse(BaseModel):
    id:                 str
    identity_code:      Optional[str] = None
    debit_note_no:      str
    supplier_id:        str
    receipt_id:         Optional[str] = None
    claim_amount:       Decimal
    tax_amount:         Decimal
    total_debit_amount: Decimal
    status:             str
    reason:             Optional[str] = None
    created_at:         Optional[datetime] = None

    model_config = {"from_attributes": True}


class PurchaseBillCreate(BaseModel):
    id:                 Optional[str] = None
    bill_no:            str
    supplier_id:        str
    receipt_id:         Optional[str] = None
    order_id:           Optional[str] = None
    bill_date:          Optional[date] = None
    taxable_amount:     Decimal
    tax_amount:         Decimal
    total_amount:       Decimal
    notes:              Optional[str] = None


class PurchaseBillResponse(BaseModel):
    id:                 str
    identity_code:      Optional[str] = None
    bill_no:            str
    supplier_id:        str
    receipt_id:         Optional[str] = None
    order_id:           Optional[str] = None
    bill_date:          Optional[date] = None
    taxable_amount:     Decimal
    tax_amount:         Decimal
    total_amount:       Decimal
    status:             str
    notes:              Optional[str] = None

    model_config = {"from_attributes": True}


class PurchaseReceiptResponse(BaseModel):
    id:            str
    identity_code: Optional[str] = None
    receipt_no:    str
    supplier_id:  str
    warehouse_id: Optional[str] = None
    order_id:     Optional[str] = None
    status:       str
    notes:        Optional[str] = None
    subtotal:     Decimal
    tax_total:    Decimal
    grand_total:  Decimal
    items:        List[PurchaseReceiptItemResponse] = []
    company_id:   Optional[str] = None
    branch_id:    Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Reorder Configurations ───────────────────────────

class PurchaseReorderConfigCreate(BaseModel):
    product_id:            str
    reorder_level:         Decimal
    reorder_quantity:      Decimal
    preferred_supplier_id: Optional[str] = None


class PurchaseReorderConfigResponse(BaseModel):
    id:                    str
    uuid:                  str
    product_id:            str
    reorder_level:         Decimal
    reorder_quantity:      Decimal
    preferred_supplier_id: Optional[str] = None
    company_id:            Optional[str] = None
    branch_id:             Optional[str] = None
    created_at:            datetime
    modified_at:           datetime
    is_active:             bool

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Jurisdiction Config ───────────────────────────

class PurchaseJurisdictionConfigCreate(BaseModel):
    company_state: str


class PurchaseConfigJurisdictionRequest(BaseModel):
    state: Optional[str] = None


class PurchaseReorderConvertRequest(BaseModel):
    supplierId: str
    selectedProductIds: List[str]


class PurchaseJurisdictionConfigResponse(BaseModel):
    id:            str
    uuid:          str
    company_state: str
    company_id:    Optional[str] = None
    branch_id:     Optional[str] = None
    created_at:    datetime
    modified_at:   datetime
    is_active:     bool

    model_config = {"from_attributes": True}
