"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-11
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from datetime import datetime, date as datetime_date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

# ─────────────────────────── Sales Invoice ───────────────────────────

class SalesInvoiceItemBase(BaseModel):
    product_id: str = Field(..., max_length=50)
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    quantity: Decimal = Decimal("1.0000")
    price: Decimal = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=15)
    gst_rate: Decimal = Decimal("18.00")
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Field(..., ge=0)

class SalesInvoiceItemCreate(SalesInvoiceItemBase):
    pass

class SalesInvoiceItemResponse(SalesInvoiceItemBase):
    id: int
    invoice_id: str

    model_config = ConfigDict(from_attributes=True)


class SalesInvoiceBase(BaseModel):
    invoice_no: str = Field(..., max_length=100)
    date: datetime_date = Field(default_factory=datetime_date.today)
    customer_id: str = Field(..., max_length=50)
    tax_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    is_interstate: bool = False
    eway_bill_no: Optional[str] = Field(None, max_length=50)
    status: str = "Draft"

class SalesInvoiceCreate(SalesInvoiceBase):
    id: str = Field(..., max_length=50)
    items: List[SalesInvoiceItemCreate] = []

class SalesInvoiceUpdate(BaseModel):
    invoice_no: Optional[str] = None
    date: Optional[datetime_date] = None
    customer_id: Optional[str] = None
    tax_total: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    is_interstate: Optional[bool] = None
    eway_bill_no: Optional[str] = None
    status: Optional[str] = None
    items: Optional[List[SalesInvoiceItemCreate]] = None

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
