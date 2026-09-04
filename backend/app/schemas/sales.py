"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.19.0
Created      : 2026-07-11
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date as datetime_date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, AliasChoices

# ─────────────────────────── Sales Invoice ───────────────────────────

class SalesInvoiceItemBase(BaseModel):
    product_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("product_id", "productId"))
    item_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("item_id", "itemId"))
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    batch_no: Optional[str] = Field(None, max_length=100, validation_alias=AliasChoices("batch_no", "batchNo"))
    quantity: Decimal = Decimal("1.0000")
    price: Decimal = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=15, validation_alias=AliasChoices("hsn_code", "hsnCode"))
    gst_rate: Optional[Decimal] = Field(Decimal("18.00"), validation_alias=AliasChoices("gst_rate", "gstRate"))
    tax_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("tax_amount", "taxAmount"))
    total_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("total_amount", "totalAmount"))
    mrp: Optional[Decimal] = None
    disc_pct: Optional[Decimal] = Field(None, validation_alias=AliasChoices("disc_pct", "discPct", "discountPct"))
    taxable_value: Optional[Decimal] = Field(None, validation_alias=AliasChoices("taxable_value", "taxableValue"))
    cgst_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("cgst_amount", "cgstAmount"))
    sgst_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("sgst_amount", "sgstAmount"))
    igst_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("igst_amount", "igstAmount"))
    is_tax_inclusive: Optional[bool] = Field(None, validation_alias=AliasChoices("is_tax_inclusive", "isTaxInclusive"))
    line_no: Optional[int] = Field(None, validation_alias=AliasChoices("line_no", "lineNo"))

class SalesInvoiceItemCreate(SalesInvoiceItemBase):
    pass

class SalesInvoiceItemResponse(SalesInvoiceItemBase):
    id: int
    invoice_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesInvoiceBase(BaseModel):
    invoice_no: Optional[str] = Field(None, max_length=100, validation_alias=AliasChoices("invoice_no", "invoiceNo"))
    date: datetime_date = Field(default_factory=datetime_date.today)
    customer_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("customer_id", "customerId"))
    warehouse_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("warehouse_id", "warehouseId"))
    tax_total: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("tax_total", "taxTotal"))
    grand_total: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("grand_total", "grandTotal"))
    is_interstate: Optional[bool] = Field(False, validation_alias=AliasChoices("is_interstate", "isInterstate"))
    eway_bill_no: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("eway_bill_no", "eWayBillNo", "ewayBillNo"))
    payment_mode: Optional[str] = Field("CASH", validation_alias=AliasChoices("payment_mode", "paymentMode"))
    status: str = "Draft"
    customer_name: Optional[str] = Field(None, validation_alias=AliasChoices("customer_name", "customerName"))
    customer_gstin: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("customer_gstin", "customerGstin", "gstin"))
    pos_state: Optional[str] = Field(None, max_length=100, validation_alias=AliasChoices("pos_state", "posState"))
    billing_address: Optional[str] = Field(None, validation_alias=AliasChoices("billing_address", "billingAddress"))
    shipping_address: Optional[str] = Field(None, validation_alias=AliasChoices("shipping_address", "shippingAddress"))
    taxable_value: Optional[Decimal] = Field(None, validation_alias=AliasChoices("taxable_value", "taxableValue"))
    rounding_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("rounding_amount", "roundingAmount"))
    # v1373 -- Sprint 14/15 fields (salesperson, terminal, payment)
    salesperson_id:   Optional[str]     = Field(None, max_length=50,  validation_alias=AliasChoices("salesperson_id",   "salespersonId"))
    salesperson_name: Optional[str]     = Field(None,                  validation_alias=AliasChoices("salesperson_name", "salespersonName"))
    terminal_id:      Optional[str]     = Field(None, max_length=50,  validation_alias=AliasChoices("terminal_id",      "terminalId"))
    counter_id:       Optional[str]     = Field(None, max_length=50,  validation_alias=AliasChoices("counter_id",       "counterId"))
    paid_amount:      Optional[Decimal] = Field(Decimal("0.00"),       validation_alias=AliasChoices("paid_amount",      "paidAmount"))
    balance_amount:   Optional[Decimal] = Field(Decimal("0.00"),       validation_alias=AliasChoices("balance_amount",   "balanceAmount"))
    discount_amount:  Optional[Decimal] = Field(Decimal("0.00"),       validation_alias=AliasChoices("discount_amount",  "discountAmount"))
    net_amount:       Optional[Decimal] = Field(Decimal("0.00"),       validation_alias=AliasChoices("net_amount",       "netAmount"))
    rule_snapshots:   Optional[dict]    = Field(default_factory=dict, validation_alias=AliasChoices("rule_snapshots", "ruleSnapshots", "metadata"))
    remarks:          Optional[str]     = Field(None,                  validation_alias=AliasChoices("remarks", "notes", "importValidationNotes"))
    # ── Legacy store/site snapshot (retained for historical invoice immutability) ──
    sis_code:         Optional[str]     = Field(None, max_length=50,  validation_alias=AliasChoices("sis_code", "sisCode"))
    site_name:        Optional[str]     = Field(None,                  validation_alias=AliasChoices("site_name", "siteName"))
    # ── Corporate B2B fields (Phase 1 additions — all nullable, backward-safe) ──
    # FK to the CustomerDeliveryLocation that was active at invoice creation time.
    # SET NULL on location soft-delete; snapshot fields below preserve immutability.
    delivery_location_id:     Optional[str]  = Field(None, max_length=50,  validation_alias=AliasChoices("delivery_location_id",     "deliveryLocationId"))
    # Snapshot of the store code at invoice creation time (immutable after save)
    delivery_store_code:      Optional[str]  = Field(None, max_length=50,  validation_alias=AliasChoices("delivery_store_code",      "deliveryStoreCode"))
    # Ship-to GSTIN — separate from customer_gstin (billed-party GSTIN)
    delivery_gstin:           Optional[str]  = Field(None, max_length=15,  validation_alias=AliasChoices("delivery_gstin",           "deliveryGstin"))
    # FK to the CustomerGSTRegistration used as the billed-party GSTIN on this invoice
    billed_party_gstin_id:    Optional[str]  = Field(None, max_length=50,  validation_alias=AliasChoices("billed_party_gstin_id",    "billedPartyGstinId"))
    # FK to the CustomerBillingLocation used on this invoice
    billing_location_id:      Optional[str]  = Field(None, max_length=50,  validation_alias=AliasChoices("billing_location_id",     "billingLocationId"))
    # Snapshot of the billing store code at invoice creation time
    billing_store_code:       Optional[str]  = Field(None, max_length=50,  validation_alias=AliasChoices("billing_store_code",      "billingStoreCode"))
    # Full JSONB snapshot of the delivery location at invoice creation time
    delivery_location_snapshot: Optional[dict] = Field(None,              validation_alias=AliasChoices("delivery_location_snapshot", "deliveryLocationSnapshot"))
    # Transaction-level Place of Supply state code (e.g. '27', '06') — stored explicitly
    # so it remains correct even when customer GSTIN differs from delivery GSTIN.
    place_of_supply_code:     Optional[str]  = Field(None, max_length=2,   validation_alias=AliasChoices("place_of_supply_code",     "placeOfSupplyCode"))
    po_reference:             Optional[str]  = Field(None, max_length=100, validation_alias=AliasChoices("po_reference",            "poReference", "po_number", "poNumber"))

class SalesInvoiceCreate(SalesInvoiceBase):
    id: Optional[str] = Field(None, max_length=50)
    items: List[SalesInvoiceItemCreate] = []

class SalesInvoiceUpdate(BaseModel):
    invoice_no: Optional[str] = None
    date: Optional[datetime_date] = None
    customer_id: Optional[str] = None
    tax_total: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    is_interstate: Optional[bool] = None
    eway_bill_no: Optional[str] = Field(None, validation_alias=AliasChoices("eway_bill_no", "eWayBillNo", "ewayBillNo"))
    payment_mode: Optional[str] = None
    status: Optional[str] = None
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    pos_state: Optional[str] = None
    items: Optional[List[SalesInvoiceItemCreate]] = None

class SalesInvoiceResponse(SalesInvoiceBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False
    version: Optional[int] = 1
    items: List[SalesInvoiceItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────── Sales Quotation ───────────────────────────

class SalesQuotationItemBase(BaseModel):
    product_id: str = Field(..., max_length=50)
    item_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("item_id", "itemId"))
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    quantity: Decimal = Decimal("1.0000")
    price: Decimal = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=15)
    gst_rate: Decimal = Decimal("18.00")
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Field(..., ge=0)

class SalesQuotationItemCreate(SalesQuotationItemBase):
    pass

class SalesQuotationItemResponse(SalesQuotationItemBase):
    id: int
    quotation_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesQuotationBase(BaseModel):
    quotation_no: str = Field(..., max_length=100)
    date: datetime_date = Field(default_factory=datetime_date.today)
    customer_name: str = Field(..., max_length=255)
    tax_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    status: str = "Draft"
    sales_order_id: Optional[str] = Field(None, max_length=50)

class SalesQuotationCreate(SalesQuotationBase):
    id: str = Field(..., max_length=50)
    items: List[SalesQuotationItemCreate] = []

class SalesQuotationUpdate(BaseModel):
    quotation_no: Optional[str] = None
    date: Optional[datetime_date] = None
    customer_name: Optional[str] = None
    tax_total: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    status: Optional[str] = None
    sales_order_id: Optional[str] = None
    items: Optional[List[SalesQuotationItemCreate]] = None

class SalesQuotationResponse(SalesQuotationBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False
    version: Optional[int] = 1
    items: List[SalesQuotationItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────── Sales Order ───────────────────────────

class SalesOrderItemBase(BaseModel):
    product_id: str = Field(..., max_length=50, validation_alias=AliasChoices("product_id", "productId"))
    item_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("item_id", "itemId"))
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    quantity: Decimal = Decimal("1.0000")
    price: Decimal = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=15, validation_alias=AliasChoices("hsn_code", "hsnCode"))
    gst_rate: Decimal = Field(Decimal("18.00"), validation_alias=AliasChoices("gst_rate", "gstRate"))
    tax_amount: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("tax_amount", "taxAmount"))
    total_amount: Decimal = Field(..., ge=0, validation_alias=AliasChoices("total_amount", "totalAmount"))

    # Extended PO Line Item Identifiers
    sr_no: Optional[int] = Field(None, validation_alias=AliasChoices("sr_no", "srNo"))
    article_no: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("article_no", "articleNo"))
    ean: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("ean", "barcode"))
    vendor_style: Optional[str] = Field(None, max_length=100, validation_alias=AliasChoices("vendor_style", "vendorStyle", "style"))
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    uom: Optional[str] = Field("EA", max_length=20)
    mrp: Optional[Decimal] = Field(None)
    base_cost: Optional[Decimal] = Field(None, validation_alias=AliasChoices("base_cost", "baseCost"))
    taxable_value: Optional[Decimal] = Field(None, validation_alias=AliasChoices("taxable_value", "taxableValue"))
    igst_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("igst_amount", "igstAmount"))
    cgst_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("cgst_amount", "cgstAmount"))
    sgst_amount: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("sgst_amount", "sgstAmount"))
    line_total: Optional[Decimal] = Field(None, validation_alias=AliasChoices("line_total", "lineTotal"))
    delivery_date: Optional[datetime_date] = Field(None, validation_alias=AliasChoices("delivery_date", "deliveryDate"))
    site_code: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("site_code", "siteCode"))

class SalesOrderItemCreate(SalesOrderItemBase):
    pass

class SalesOrderItemResponse(SalesOrderItemBase):
    id: int
    order_id: str = Field(..., validation_alias=AliasChoices("order_id", "orderId"))

    model_config = ConfigDict(from_attributes=True)


class SalesOrderInvoiceAllocationResponse(BaseModel):
    id: str
    order_id: str = Field(..., validation_alias=AliasChoices("order_id", "orderId"))
    order_no: str = Field(..., validation_alias=AliasChoices("order_no", "orderNo"))
    po_number: str = Field(..., validation_alias=AliasChoices("po_number", "poNumber"))
    invoice_id: str = Field(..., validation_alias=AliasChoices("invoice_id", "invoiceId"))
    invoice_no: str = Field(..., validation_alias=AliasChoices("invoice_no", "invoiceNo"))
    invoice_date: datetime_date = Field(..., validation_alias=AliasChoices("invoice_date", "invoiceDate"))
    po_quantity: Decimal = Field(Decimal("0.0000"), validation_alias=AliasChoices("po_quantity", "poQuantity"))
    po_value: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("po_value", "poValue"))
    billed_quantity: Decimal = Field(Decimal("0.0000"), validation_alias=AliasChoices("billed_quantity", "billedQuantity"))
    billed_value: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("billed_value", "billedValue"))
    pending_quantity: Decimal = Field(Decimal("0.0000"), validation_alias=AliasChoices("pending_quantity", "pendingQuantity"))
    pending_value: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("pending_value", "pendingValue"))
    status: str = "ALLOCATED"
    allocation_metadata: Optional[dict] = Field(default_factory=dict, validation_alias=AliasChoices("allocation_metadata", "allocationMetadata"))

    model_config = ConfigDict(from_attributes=True)


class SalesOrderBase(BaseModel):
    order_no: str = Field(..., max_length=100, validation_alias=AliasChoices("order_no", "orderNo"))
    date: datetime_date = Field(default_factory=datetime_date.today)
    customer_name: str = Field(..., max_length=255, validation_alias=AliasChoices("customer_name", "customerName"))
    tax_total: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("tax_total", "taxTotal"))
    grand_total: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("grand_total", "grandTotal"))
    status: str = "Draft"
    source_quotation_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("source_quotation_id", "sourceQuotationId"))

    # Extended PO & Execution Metadata
    po_number: Optional[str] = Field(None, max_length=100, validation_alias=AliasChoices("po_number", "poNumber"))
    po_date: Optional[datetime_date] = Field(None, validation_alias=AliasChoices("po_date", "poDate"))
    delivery_date: Optional[datetime_date] = Field(None, validation_alias=AliasChoices("delivery_date", "deliveryDate"))
    site_code: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("site_code", "siteCode"))
    site_name: Optional[str] = Field(None, max_length=255, validation_alias=AliasChoices("site_name", "siteName"))
    delivery_address: Optional[str] = Field(None, validation_alias=AliasChoices("delivery_address", "deliveryAddress"))
    vendor_code: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("vendor_code", "vendorCode"))
    customer_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("customer_id", "customerId"))
    customer_gstin: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("customer_gstin", "customerGstin", "gstin"))
    basic_total: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("basic_total", "basicTotal"))
    is_interstate: Optional[bool] = Field(True, validation_alias=AliasChoices("is_interstate", "isInterstate"))
    total_qty: Optional[Decimal] = Field(Decimal("0.0000"), validation_alias=AliasChoices("total_qty", "totalQty"))
    billed_qty: Optional[Decimal] = Field(Decimal("0.0000"), validation_alias=AliasChoices("billed_qty", "billedQty"))
    billed_value: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("billed_value", "billedValue"))
    pending_qty: Optional[Decimal] = Field(Decimal("0.0000"), validation_alias=AliasChoices("pending_qty", "pendingQty"))
    pending_value: Optional[Decimal] = Field(Decimal("0.00"), validation_alias=AliasChoices("pending_value", "pendingValue"))
    fulfillment_status: Optional[str] = Field("UNFULFILLED", validation_alias=AliasChoices("fulfillment_status", "fulfillmentStatus"))
    po_metadata: Optional[dict] = Field(default_factory=dict, validation_alias=AliasChoices("po_metadata", "poMetadata"))

class SalesOrderCreate(SalesOrderBase):
    id: str = Field(..., max_length=50)
    items: List[SalesOrderItemCreate] = []

class SalesOrderUpdate(BaseModel):
    order_no: Optional[str] = None
    date: Optional[datetime_date] = None
    customer_name: Optional[str] = None
    tax_total: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    status: Optional[str] = None
    source_quotation_id: Optional[str] = None
    po_number: Optional[str] = None
    po_date: Optional[datetime_date] = None
    delivery_date: Optional[datetime_date] = None
    site_code: Optional[str] = None
    site_name: Optional[str] = None
    delivery_address: Optional[str] = None
    vendor_code: Optional[str] = None
    customer_id: Optional[str] = None
    customer_gstin: Optional[str] = None
    basic_total: Optional[Decimal] = None
    is_interstate: Optional[bool] = None
    total_qty: Optional[Decimal] = None
    billed_qty: Optional[Decimal] = None
    billed_value: Optional[Decimal] = None
    pending_qty: Optional[Decimal] = None
    pending_value: Optional[Decimal] = None
    fulfillment_status: Optional[str] = None
    po_metadata: Optional[dict] = None
    items: Optional[List[SalesOrderItemCreate]] = None

class SalesOrderResponse(SalesOrderBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False
    version: Optional[int] = 1
    items: List[SalesOrderItemResponse] = []
    allocations: List[SalesOrderInvoiceAllocationResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────── Sales Return ───────────────────────────

class SalesReturnItemBase(BaseModel):
    product_id: str = Field(..., max_length=50)
    item_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("item_id", "itemId"))
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    quantity: Decimal = Decimal("1.0000")
    price: Decimal = Field(..., ge=0)
    gst_rate: Decimal = Decimal("18.00")
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Field(..., ge=0)

class SalesReturnItemCreate(SalesReturnItemBase):
    pass

class SalesReturnItemResponse(SalesReturnItemBase):
    id: int
    return_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesReturnBase(BaseModel):
    return_no: str = Field(..., max_length=100)
    original_invoice_id: str = Field(..., max_length=50)
    credit_note_number: Optional[str] = Field(None, max_length=100)
    date: datetime_date = Field(default_factory=datetime_date.today)
    reason: Optional[str] = None
    tax_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    is_interstate: bool = False
    status: str = "Draft"
    refund_mode: Optional[str] = Field("CREDIT_NOTE", validation_alias=AliasChoices("refund_mode", "refundMode"))
    supervisor_auth_token: Optional[str] = Field(None, validation_alias=AliasChoices("supervisor_auth_token", "supervisorAuthToken"))
    is_blind_return: Optional[bool] = Field(False, validation_alias=AliasChoices("is_blind_return", "isBlindReturn"))

class SalesReturnCreate(SalesReturnBase):
    id: str = Field(..., max_length=50)
    items: List[SalesReturnItemCreate] = []

class SalesReturnUpdate(BaseModel):
    return_no: Optional[str] = None
    original_invoice_id: Optional[str] = None
    credit_note_number: Optional[str] = None
    date: Optional[datetime_date] = None
    reason: Optional[str] = None
    tax_total: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    is_interstate: Optional[bool] = None
    status: Optional[str] = None
    refund_mode: Optional[str] = None
    items: Optional[List[SalesReturnItemCreate]] = None

class SalesReturnResponse(SalesReturnBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False
    version: Optional[int] = 1
    idempotency_key: Optional[str] = None
    policy_id: Optional[str] = None
    policy_version: Optional[int] = None
    policy_scope: Optional[str] = None
    policy_snapshot: dict = {}
    items: List[SalesReturnItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SalesReturnContextLine(BaseModel):
    product_id: str
    code: str
    name: str
    original_quantity: Decimal
    returned_quantity: Decimal
    remaining_quantity: Decimal
    unit_price: Decimal
    gst_rate: Decimal
    tax_amount: Decimal
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class SalesReturnContextResponse(BaseModel):
    invoice_id: str
    invoice_no: str
    invoice_date: datetime_date
    status: str
    customer: Optional[Dict[str, Any]] = None
    payment_context: Optional[Dict[str, Any]] = None
    branch_id: Optional[str] = None
    terminal_id: Optional[str] = None
    shift_id: Optional[str] = None
    lines: List[SalesReturnContextLine] = []
    effective_policy: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)

