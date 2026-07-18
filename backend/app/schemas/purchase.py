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

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

# ─────────────────────────── Supplier ───────────────────────────

class SupplierCreate(BaseModel):
    id:          str
    name:        str
    code:        str
    gst_number:  str | None = None
    mobile:      str | None = None
    email:       str | None = None
    address:     str | None = None
    city:        str | None = None
    state:       str | None = None
    pincode:     str | None = None


class SupplierResponse(BaseModel):
    id:          str
    name:        str
    code:        str
    gst_number:  str | None = None
    mobile:      str | None = None
    email:       str | None = None
    address:     str | None = None
    city:        str | None = None
    state:       str | None = None
    pincode:     str | None = None
    outstanding: Decimal
    company_id:  str | None = None
    branch_id:   str | None = None

    model_config = {"from_attributes": True}



class SupplierUpdate(BaseModel):
    """Partial-update schema for a supplier. All fields optional."""
    name:       str | None = None
    gst_number: str | None = None
    mobile:     str | None = None
    email:      str | None = None
    address:    str | None = None
    city:       str | None = None
    state:      str | None = None
    pincode:    str | None = None


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
    notes:       str | None = None
    items:       list[PurchaseOrderItemCreate]

class PurchaseOrderCancelRequest(BaseModel):
    """Optional cancellation reason for cancelling a purchase order."""
    reason: str | None = None


class PurchaseOrderAmendRequest(BaseModel):
    """
    Amendment: the original (Confirmed) PO is cancelled and a new Confirmed
    PO is created from the supplied items.
    """
    new_order_id: str
    new_order_no: str
    items:        list[PurchaseOrderItemCreate]
    reason:       str | None = None

class PurchaseOrderResponse(BaseModel):
    id:          str
    order_no:    str
    supplier_id: str
    status:      str
    notes:       str | None = None
    subtotal:    Decimal
    tax_total:   Decimal
    grand_total: Decimal
    items:       list[PurchaseOrderItemResponse] = []
    company_id:  str | None = None
    branch_id:   str | None = None

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Receipt (GRN) ───────────────────────────

class PurchaseReceiptItemCreate(BaseModel):
    product_id:       str
    code:             str
    name:             str
    quantity_ordered:  Decimal | None = None
    quantity_received: Decimal
    cost_price:       Decimal
    gst_rate:         Decimal = Decimal("18.00")


class PurchaseReceiptItemResponse(BaseModel):
    id:                str
    product_id:        str
    code:              str
    name:              str
    quantity_ordered:  Decimal | None = None
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
    order_id:    str | None = None   # link to PO — optional
    notes:       str | None = None
    items:       list[PurchaseReceiptItemCreate]


class PurchaseReceiptResponse(BaseModel):
    id:          str
    receipt_no:  str
    supplier_id: str
    order_id:    str | None = None
    status:      str
    notes:       str | None = None
    subtotal:    Decimal
    tax_total:   Decimal
    grand_total: Decimal
    items:       list[PurchaseReceiptItemResponse] = []
    company_id:  str | None = None
    branch_id:   str | None = None

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Reorder Configurations ───────────────────────────

class PurchaseReorderConfigCreate(BaseModel):
    product_id:            str
    reorder_level:         Decimal
    reorder_quantity:      Decimal
    preferred_supplier_id: str | None = None


class PurchaseReorderConfigResponse(BaseModel):
    id:                    str
    uuid:                  str
    product_id:            str
    reorder_level:         Decimal
    reorder_quantity:      Decimal
    preferred_supplier_id: str | None = None
    company_id:            str | None = None
    branch_id:             str | None = None
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
    company_id:    str | None = None
    branch_id:     str | None = None
    created_at:    datetime
    modified_at:   datetime
    is_active:     bool

    model_config = {"from_attributes": True}
