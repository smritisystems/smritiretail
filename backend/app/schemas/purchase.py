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
* Modified   : 2026-07-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


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
    outstanding: Decimal
    company_id:  Optional[str] = None
    branch_id:   Optional[str] = None

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
    product_id: str
    code:       str
    name:       str
    quantity:   Decimal
    cost_price: Decimal
    gst_rate:   Decimal = Decimal("18.00")


class PurchaseOrderItemResponse(BaseModel):
    id:         str
    product_id: str
    code:       str
    name:       str
    quantity:   Decimal
    cost_price: Decimal
    gst_rate:   Decimal
    tax_amount: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    id:          str
    order_no:    str
    supplier_id: str
    notes:       Optional[str] = None
    items:       List[PurchaseOrderItemCreate]

class PurchaseOrderCancelRequest(BaseModel):
    """Optional cancellation reason for cancelling a purchase order."""
    reason: Optional[str] = None


class PurchaseOrderAmendRequest(BaseModel):
    """
    Amendment: the original (Confirmed) PO is cancelled and a new Confirmed
    PO is created from the supplied items.
    """
    new_order_id: str
    new_order_no: str
    items:        List[PurchaseOrderItemCreate]
    reason:       Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    id:          str
    order_no:    str
    supplier_id: str
    status:      str
    notes:       Optional[str] = None
    subtotal:    Decimal
    tax_total:   Decimal
    grand_total: Decimal
    items:       List[PurchaseOrderItemResponse] = []
    company_id:  Optional[str] = None
    branch_id:   Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Receipt (GRN) ───────────────────────────

class PurchaseReceiptItemCreate(BaseModel):
    product_id:       str
    code:             str
    name:             str
    quantity_ordered:  Optional[Decimal] = None
    quantity_received: Decimal
    cost_price:       Decimal
    gst_rate:         Decimal = Decimal("18.00")


class PurchaseReceiptItemResponse(BaseModel):
    id:                str
    product_id:        str
    code:              str
    name:              str
    quantity_ordered:  Optional[Decimal] = None
    quantity_received: Decimal
    cost_price:        Decimal
    gst_rate:          Decimal
    tax_amount:        Decimal
    line_total:        Decimal

    model_config = {"from_attributes": True}


class PurchaseReceiptCreate(BaseModel):
    id:          str
    receipt_no:  str
    supplier_id: str
    order_id:    Optional[str] = None   # link to PO — optional
    notes:       Optional[str] = None
    items:       List[PurchaseReceiptItemCreate]


class PurchaseReceiptResponse(BaseModel):
    id:          str
    receipt_no:  str
    supplier_id: str
    order_id:    Optional[str] = None
    status:      str
    notes:       Optional[str] = None
    subtotal:    Decimal
    tax_total:   Decimal
    grand_total: Decimal
    items:       List[PurchaseReceiptItemResponse] = []
    company_id:  Optional[str] = None
    branch_id:   Optional[str] = None

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
