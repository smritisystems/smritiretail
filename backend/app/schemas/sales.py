"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-11
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from datetime import datetime, date as datetime_date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, AliasChoices

# ─────────────────────────── Sales Invoice ───────────────────────────

class SalesInvoiceItemBase(BaseModel):
    product_id: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("product_id", "productId"))
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
    product_id: str = Field(..., max_length=50)
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    quantity: Decimal = Decimal("1.0000")
    price: Decimal = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=15)
    gst_rate: Decimal = Decimal("18.00")
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Field(..., ge=0)

class SalesOrderItemCreate(SalesOrderItemBase):
    pass

class SalesOrderItemResponse(SalesOrderItemBase):
    id: int
    order_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesOrderBase(BaseModel):
    order_no: str = Field(..., max_length=100)
    date: datetime_date = Field(default_factory=datetime_date.today)
    customer_name: str = Field(..., max_length=255)
    tax_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    status: str = "Draft"
    source_quotation_id: Optional[str] = Field(None, max_length=50)

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

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────── Sales Return ───────────────────────────

class SalesReturnItemBase(BaseModel):
    product_id: str = Field(..., max_length=50)
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
    items: Optional[List[SalesReturnItemCreate]] = None

class SalesReturnResponse(SalesReturnBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False
    version: Optional[int] = 1
    items: List[SalesReturnItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
