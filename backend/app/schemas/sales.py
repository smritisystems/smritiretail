"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.3
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from datetime import datetime, date as datetime_date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, AliasChoices

# ─────────────────────────── Sales Invoice ───────────────────────────

class SalesInvoicePaymentBase(BaseModel):
    payment_mode: str = Field(..., max_length=20, validation_alias=AliasChoices("payment_mode", "paymentMode"))
    amount: Decimal = Field(..., ge=0)
    transaction_no: Optional[str] = Field(None, max_length=100, validation_alias=AliasChoices("transaction_no", "transactionNo"))

class SalesInvoicePaymentCreate(SalesInvoicePaymentBase):
    pass

class SalesInvoicePaymentResponse(SalesInvoicePaymentBase):
    id: str
    invoice_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesInvoiceItemBase(BaseModel):
    product_id: str = Field(..., max_length=50, validation_alias=AliasChoices("product_id", "productId"))
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    quantity: Decimal = Field(Decimal("1.0000"), validation_alias=AliasChoices("quantity", "qty"))
    price: Decimal = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=15)
    gst_rate: Decimal = Field(Decimal("18.00"), validation_alias=AliasChoices("gst_rate", "taxRate", "gstPercentage"))
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Field(Decimal("0.00"), ge=0)
    cgst_amount: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("cgst_amount", "cgstAmount"))
    sgst_amount: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("sgst_amount", "sgstAmount"))
    igst_amount: Decimal = Field(Decimal("0.00"), validation_alias=AliasChoices("igst_amount", "igstAmount"))

class SalesInvoiceItemCreate(SalesInvoiceItemBase):
    pass

class SalesInvoiceItemResponse(SalesInvoiceItemBase):
    id: int
    invoice_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesInvoiceBase(BaseModel):
    invoice_no: Optional[str] = Field(None, max_length=100)
    date: datetime_date = Field(default_factory=datetime_date.today)
    customer_id: str = Field(..., max_length=50, validation_alias=AliasChoices("customer_id", "customerId"))
    tax_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    is_interstate: bool = Field(False, validation_alias=AliasChoices("is_interstate", "isInterstate"))
    eway_bill_no: Optional[str] = Field(None, max_length=50, validation_alias=AliasChoices("eway_bill_no", "eWayBillNo"))
    status: str = "Draft"
    place_of_supply: Optional[str] = Field(None, max_length=2, validation_alias=AliasChoices("place_of_supply", "placeOfSupply"))
    cgst_total: Decimal = Decimal("0.00")
    sgst_total: Decimal = Decimal("0.00")
    igst_total: Decimal = Decimal("0.00")

class SalesInvoiceCreate(SalesInvoiceBase):
    id: Optional[str] = Field(None, max_length=50)
    items: List[SalesInvoiceItemCreate] = []
    payments: List[SalesInvoicePaymentCreate] = []

class SalesInvoiceUpdate(BaseModel):
    invoice_no: Optional[str] = None
    date: Optional[datetime_date] = None
    customer_id: Optional[str] = None
    tax_total: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    is_interstate: Optional[bool] = None
    eway_bill_no: Optional[str] = None
    status: Optional[str] = None
    place_of_supply: Optional[str] = None
    cgst_total: Optional[Decimal] = None
    sgst_total: Optional[Decimal] = None
    igst_total: Optional[Decimal] = None
    items: Optional[List[SalesInvoiceItemCreate]] = None
    payments: Optional[List[SalesInvoicePaymentCreate]] = None

class SalesInvoiceResponse(SalesInvoiceBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int
    items: List[SalesInvoiceItemResponse] = []
    payments: List[SalesInvoicePaymentResponse] = []

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
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int
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
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int
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
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int
    items: List[SalesReturnItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
