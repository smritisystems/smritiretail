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

* Version    : 3.19.0
* Created    : 2026-07-11
* Modified   : 2026-10-16
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

import re
from decimal import Decimal
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .inward_cost import InwardCostComponentCreate, InwardCostComponentResponse


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
    payment_terms_days: Optional[int] = 120
    payment_terms:      Optional[str] = "120 Days"
    freight_terms:      Optional[str] = "Paid by Supplier"
    currency:           Optional[str] = "INR - Indian Rupee"
    buyer:              Optional[str] = None
    department:         Optional[str] = None
    special_instructions: Optional[str] = None
    business_terms:     Optional[str] = None
    commercial_terms:   Optional[Dict[str, Any]] = None

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
    variant_id: Optional[str] = None
    barcode:    Optional[str] = None
    code:       Optional[str] = None
    name:       Optional[str] = None
    quantity:   Decimal
    cost_price: Optional[Decimal] = None
    gst_rate:   Decimal = Decimal("18.00")

    @model_validator(mode="before")
    @classmethod
    def normalize_line_item(cls, data: any) -> any:
        if isinstance(data, dict):
            if not data.get("barcode") and data.get("bar_code"):
                data["barcode"] = str(data["bar_code"])
            if not data.get("code") and data.get("item_code"):
                data["code"] = str(data["item_code"])
            elif not data.get("code") and data.get("barcode"):
                data["code"] = str(data["barcode"])
            if not data.get("product_id"):
                data["product_id"] = data.get("code") or data.get("barcode") or data.get("item_code") or "PROD-GENERIC"
            if not data.get("name") and data.get("item_name"):
                data["name"] = str(data["item_name"])
            elif not data.get("name"):
                data["name"] = data.get("code") or data.get("barcode") or "Item"
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
    variant_id: Optional[str] = None
    code:       str
    name:       str
    quantity:   Decimal
    cost_price: Decimal
    gst_rate:   Decimal
    tax_amount: Decimal
    line_total: Decimal
    heel_type:        Optional[str] = None
    upper_material:   Optional[str] = None
    outsole_material: Optional[str] = None
    image_url:        Optional[str] = None
    brand:            Optional[str] = None
    color:            Optional[str] = None
    size:             Optional[str] = None
    style:            Optional[str] = None

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    id:          Optional[str] = Field(None, max_length=50, description="Persistent technical IDs are governed and generated server-side by IdentityEngine.")
    order_no:    Optional[str] = None
    supplier_id: str
    notes:       Optional[str] = None
    # status is normalized server-side; clients may send DRAFT or omit for default DRAFT.
    # CONFIRMED is only set server-side via the confirm endpoint.
    status:      Optional[str] = Field(default="DRAFT", description="Requested status: DRAFT (default). CONFIRMED requires the /confirm endpoint.")
    items:       Optional[List[PurchaseOrderItemCreate]] = None
    commercial_terms: Optional[Dict[str, Any]] = None
    rule_snapshots:   Optional[Dict[str, Any]] = None

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
    """
    Cancellation payload for a purchase order.
    Phase C: structured reason_code (from PO_CANCEL_REASON master) + optional free-text.
    """
    reason: Optional[str] = None
    reason_code: Optional[str] = Field(
        default=None,
        description="Structured cancellation reason code from PO_CANCEL_REASON master lookup.",
    )


class PurchaseOrderConfirmRequest(BaseModel):
    """Confirmation payload: SUBMITTED → CONFIRMED."""
    notes: Optional[str] = None


class PurchaseOrderAmendRequest(BaseModel):
    """
    Amendment: the original (Confirmed) PO is cancelled and a new Confirmed
    PO is created from the supplied items.
    Phase D: amend_revision is set automatically by the service from the original's revision + 1.
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
    supplier_name: Optional[str] = None
    created_at:    Optional[datetime] = None
    order_date:    Optional[Union[date, datetime, str]] = None
    delivery_date: Optional[Union[date, datetime, str]] = None
    received_date: Optional[Union[date, datetime, str]] = None
    vendor_bill_date: Optional[Union[date, datetime, str]] = None
    vendor_bill_no: Optional[str] = None
    total_amount:  Optional[Decimal] = None
    status:        str
    notes:         Optional[str] = None
    subtotal:      Decimal
    tax_total:     Decimal
    grand_total:   Decimal
    items:         List[PurchaseOrderItemResponse] = []
    company_id:    Optional[str] = None
    branch_id:     Optional[str] = None
    # Phase A lifecycle audit fields
    submitted_by:        Optional[str] = None
    submitted_at:        Optional[datetime] = None
    confirmed_by:        Optional[str] = None
    confirmed_at:        Optional[datetime] = None
    cancelled_by:        Optional[str] = None
    cancelled_at:        Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    parent_order_id:     Optional[str] = None
    # Phase D amendment chain fields
    amended_by:          Optional[str] = None
    amended_at:          Optional[datetime] = None
    amend_revision:      int = 0
    rule_snapshots:      Optional[Dict[str, Any]] = None
    commercial_terms:    Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def populate_commercial_terms(self) -> "PurchaseOrderResponse":
        if self.total_amount is None:
            self.total_amount = self.grand_total
        if self.order_date is None and self.created_at:
            self.order_date = self.created_at
        if not self.delivery_date and self.rule_snapshots and isinstance(self.rule_snapshots, dict):
            if "delivery_date" in self.rule_snapshots:
                self.delivery_date = self.rule_snapshots.get("delivery_date")
            elif "received_date" in self.rule_snapshots:
                self.delivery_date = self.rule_snapshots.get("received_date")
            elif "vendor_bill_date" in self.rule_snapshots:
                self.delivery_date = self.rule_snapshots.get("vendor_bill_date")

        # Auto-extract Vendor Bill receiving date and bill number from notes or rule snapshots
        if self.notes:
            bill_date_match = re.search(r"dated\s+([0-9]{4}-[0-9]{2}-[0-9]{2})", self.notes)
            if bill_date_match:
                extracted_date = bill_date_match.group(1)
                if not self.delivery_date:
                    self.delivery_date = extracted_date
                if not self.received_date:
                    self.received_date = extracted_date
                if not self.vendor_bill_date:
                    self.vendor_bill_date = extracted_date

            bill_no_match = re.search(r"Vendor Bill\s+([^ |]+)", self.notes)
            if bill_no_match and not self.vendor_bill_no:
                self.vendor_bill_no = bill_no_match.group(1)

        if not self.received_date and self.delivery_date:
            self.received_date = self.delivery_date
        if not self.commercial_terms and self.rule_snapshots and isinstance(self.rule_snapshots, dict):
            if "commercial_terms" in self.rule_snapshots:
                self.commercial_terms = self.rule_snapshots.get("commercial_terms")
        if not self.commercial_terms and self.notes:
            parsed = {}
            for part in self.notes.split("|"):
                if ":" in part:
                    k, v = part.split(":", 1)
                    k_str = k.strip().lower()
                    v_str = v.strip()
                    if "payment" in k_str:
                        parsed["payment_terms"] = v_str
                    elif "freight" in k_str:
                        parsed["freight_terms"] = v_str
                    elif "ref" in k_str:
                        parsed["supplier_reference"] = v_str
                    elif "instruction" in k_str:
                        parsed["special_instructions"] = v_str
                    elif "currency" in k_str:
                        parsed["currency"] = v_str
                    elif "buyer" in k_str:
                        parsed["buyer"] = v_str
                    elif "dept" in k_str or "department" in k_str:
                        parsed["department"] = v_str
            if parsed:
                self.commercial_terms = parsed

        if not self.commercial_terms:
            self.commercial_terms = {
                "payment_terms": "120 Days",
                "freight_terms": "Paid by Supplier",
                "currency": "INR",
                "delivery_terms": "Ex-Factory",
            }
        elif isinstance(self.commercial_terms, dict):
            pterms = self.commercial_terms.get("payment_terms")
            if not pterms or str(pterms).strip() in ["30 Days", "30 days", "30"]:
                self.commercial_terms["payment_terms"] = "120 Days"
        return self

    model_config = {"from_attributes": True}


from datetime import datetime, date


# ─────────────────────────── Purchase Receipt (GRN) ───────────────────────────

class PurchaseReceiptItemCreate(BaseModel):
    product_id:            Optional[str] = None
    item_id:               Optional[str] = None
    variant_id:            Optional[str] = None
    code:                  Optional[str] = None
    name:                  Optional[str] = None
    batch_no:              Optional[str] = None
    batch_id:              Optional[str] = None
    warehouse_location_id: Optional[str] = None
    mfg_date:              Optional[date] = None
    expiry_date:           Optional[date] = None
    mrp:                   Optional[Decimal] = None
    quantity_ordered:      Optional[Decimal] = None
    quantity_received:     Optional[Decimal] = None
    quantity_damaged:      Optional[Decimal] = Decimal("0.00")
    cost_price:            Optional[Decimal] = None
    gst_rate:              Decimal = Decimal("18.00")
    landed_cost:           Optional[Decimal] = None
    freight_allocated:     Optional[Decimal] = Decimal("0.00")
    purchase_order_id:     Optional[str] = None
    purchase_order_no:     Optional[str] = None
    purchase_order_line_id: Optional[str] = None
    order_id:              Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_receipt_item(cls, data: any) -> any:
        if isinstance(data, dict):
            if not data.get("product_id") and (data.get("item_id") or data.get("code")):
                data["product_id"] = data.get("item_id") or data.get("code")
            if not data.get("code") and (data.get("item_code") or data.get("item_id") or data.get("product_id")):
                data["code"] = data.get("item_code") or data.get("item_id") or data.get("product_id")
            if not data.get("name") and (data.get("item_name") or data.get("product_name")):
                data["name"] = data.get("item_name") or data.get("product_name")
            elif not data.get("name"):
                data["name"] = data.get("code") or "Item"
            if data.get("quantity_received") is None:
                data["quantity_received"] = data.get("received_qty") or data.get("accepted_qty") or data.get("quantity") or Decimal("0.00")
            if data.get("cost_price") is None:
                data["cost_price"] = data.get("unit_price") or data.get("purchase_rate") or data.get("rate") or Decimal("0.00")
            if data.get("gst_rate") is None and data.get("tax_rate") is not None:
                data["gst_rate"] = data.get("tax_rate")
            if not data.get("purchase_order_id"):
                data["purchase_order_id"] = data.get("po_id") or data.get("purchase_order") or data.get("order_id")
            if not data.get("purchase_order_no"):
                data["purchase_order_no"] = data.get("po_no") or data.get("purchase_order_no") or data.get("order_no")
            if not data.get("purchase_order_line_id"):
                data["purchase_order_line_id"] = data.get("po_line_id") or data.get("purchase_order_item_id") or data.get("order_line_id")
            if not data.get("warehouse_location_id") and data.get("location_id"):
                data["warehouse_location_id"] = data.get("location_id")
        return data


class PurchaseReceiptItemResponse(BaseModel):
    id:                    str
    product_id:            str
    item_id:               Optional[str] = None
    variant_id:            Optional[str] = None
    purchase_order_id:     Optional[str] = None
    purchase_order_no:     Optional[str] = None
    purchase_order_line_id: Optional[str] = None
    code:                  str
    name:                  str
    batch_no:              Optional[str] = None
    batch_id:              Optional[str] = None
    warehouse_location_id: Optional[str] = None
    mfg_date:              Optional[date] = None
    expiry_date:           Optional[date] = None
    mrp:                   Optional[Decimal] = None
    quantity_ordered:      Optional[Decimal] = None
    quantity_received:     Decimal
    quantity_damaged:      Decimal = Decimal("0.00")
    cost_price:            Decimal
    gst_rate:              Decimal
    tax_amount:            Decimal
    line_total:            Decimal
    landed_cost:           Optional[Decimal] = None
    freight_allocated:     Optional[Decimal] = None

    model_config = {"from_attributes": True}


class PurchaseReceiptCreate(BaseModel):
    id:                 Optional[str] = None
    receipt_no:         Optional[str] = None
    supplier_id:        str
    warehouse_id:       Optional[str] = None  # target godown — optional (defaults to Central Godown)
    order_id:           Optional[str] = None   # link to PO — optional
    notes:              Optional[str] = None
    transporter_name:   Optional[str] = None
    lr_number:          Optional[str] = None
    lr_date:            Optional[date] = None
    vehicle_number:     Optional[str] = None
    freight_amount:     Optional[Decimal] = Decimal("0.00")
    handling_amount:    Optional[Decimal] = Decimal("0.00")
    insurance_amount:   Optional[Decimal] = Decimal("0.00")
    pkg_forward_amount: Optional[Decimal] = Decimal("0.00")
    allocation_method:  Optional[str] = "VALUE"
    cost_components:    Optional[List[InwardCostComponentCreate]] = None
    attachments:        Optional[List[Dict[str, Any]]] = None
    items:              List[PurchaseReceiptItemCreate]


class PurchaseReceiptUpdate(BaseModel):
    notes:              Optional[str] = None
    transporter_name:   Optional[str] = None
    lr_number:          Optional[str] = None
    lr_date:            Optional[date] = None
    vehicle_number:     Optional[str] = None
    attachments:        Optional[List[Dict[str, Any]]] = None


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
    journal_voucher_id: Optional[str] = None

    model_config = {"from_attributes": True}


class DebitNoteCancelRequest(BaseModel):
    supplier_id:        str
    claim_amount:       Decimal
    tax_amount:         Optional[Decimal] = Decimal("0.00")
    total_debit_amount: Decimal
    debit_note_no:      Optional[str] = None
    reason:             Optional[str] = None


class PurchaseBillCreate(BaseModel):
    id:                 Optional[str] = None
    bill_no:            str
    supplier_id:        str
    receipt_id:         Optional[str] = None
    order_id:           Optional[str] = None
    bill_date:          Optional[date] = None
    due_date:           Optional[date] = None
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
    due_date:           Optional[date] = None
    taxable_amount:     Decimal
    tax_amount:         Decimal
    total_amount:       Decimal
    paid_amount:        Optional[Decimal] = Decimal("0.00")
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
    cost_components: Optional[List[InwardCostComponentResponse]] = []
    attachments:  Optional[List[Dict[str, Any]]] = None
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


# ─────────────────────────── 3-Way Matching Reconciliation ───────────────────────────

class ThreeWayMatchingLine(BaseModel):
    item_code: str
    po_qty: Decimal = Decimal("0")
    grn_accepted_qty: Decimal = Decimal("0")
    invoice_qty: Decimal = Decimal("0")
    po_rate: Decimal = Decimal("0")
    invoice_rate: Decimal = Decimal("0")
    status: Optional[str] = "MATCHED"


class ThreeWayMatchingCommitRequest(BaseModel):
    po_no: str
    grn_no: str
    vendor_invoice_no: str
    vendor_gstin: Optional[str] = None
    reconciliation_status: Optional[str] = "MATCHED"
    total_po_value: Optional[Decimal] = Decimal("0")
    total_grn_value: Optional[Decimal] = Decimal("0")
    total_invoice_value: Optional[Decimal] = Decimal("0")
    variance_amount: Optional[Decimal] = Decimal("0")
    lines: Optional[List[ThreeWayMatchingLine]] = []


class ThreeWayMatchingCommitResponse(BaseModel):
    reconciliation_id: str
    status: str = "COMMITTED"
    ap_voucher_no: str
    po_no: str
    grn_no: str
    vendor_invoice_no: str
    variance_amount: Decimal = Decimal("0")
    reconciliation_status: str
    message: str = "3-Way match reconciliation committed successfully."
