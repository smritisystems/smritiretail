"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Consignment / Modern Trade Schemas.
"""

from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field


# --- ConsignmentPartner schemas ---

class ConsignmentPartnerBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    gst_number: Optional[str] = Field(None, max_length=15)
    status: str = "Active"
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None


class ConsignmentPartnerCreate(ConsignmentPartnerBase):
    pass


class ConsignmentPartnerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    gst_number: Optional[str] = None
    status: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None


class ConsignmentPartnerResponse(ConsignmentPartnerBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


# --- ConsignmentTransfer schemas ---

class ConsignmentTransferItemBase(BaseModel):
    product_id: str
    code: str
    name: str
    hsn_code: Optional[str] = None
    qty_sent: Decimal
    rate: Decimal
    gst_rate: Decimal = Decimal("18.00")


class ConsignmentTransferItemCreate(ConsignmentTransferItemBase):
    pass


class ConsignmentTransferItemResponse(ConsignmentTransferItemBase):
    id: str
    transfer_id: str
    qty_sold: Decimal
    qty_returned: Decimal
    qty_on_hand: Decimal
    tax_amount: Decimal
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class ConsignmentTransferBase(BaseModel):
    partner_id: str
    transfer_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None


class ConsignmentTransferCreate(ConsignmentTransferBase):
    items: List[ConsignmentTransferItemCreate]


class ConsignmentTransferResponse(ConsignmentTransferBase):
    id: str
    uuid: str
    transfer_no: str
    status: str
    invoice_id: Optional[str] = None
    tax_total: Decimal
    grand_total: Decimal
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int
    items: List[ConsignmentTransferItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- ConsignmentSaleReport schemas ---

class ConsignmentSaleReportItemBase(BaseModel):
    transfer_item_id: str
    product_id: str
    qty_sold: Decimal
    rate: Decimal
    gst_rate: Decimal = Decimal("18.00")


class ConsignmentSaleReportItemCreate(ConsignmentSaleReportItemBase):
    pass


class ConsignmentSaleReportItemResponse(ConsignmentSaleReportItemBase):
    id: str
    report_id: str
    tax_amount: Decimal
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class ConsignmentSaleReportBase(BaseModel):
    partner_id: str
    report_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None


class ConsignmentSaleReportCreate(ConsignmentSaleReportBase):
    items: List[ConsignmentSaleReportItemCreate]


class ConsignmentSaleReportResponse(ConsignmentSaleReportBase):
    id: str
    uuid: str
    report_no: str
    status: str
    total_sales_value: Decimal
    total_tax_value: Decimal
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    items: List[ConsignmentSaleReportItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- ConsignmentSettlement schemas ---

class ConsignmentSettlementBase(BaseModel):
    partner_id: str
    settlement_date: date = Field(default_factory=date.today)
    total_amount_due: Decimal = Decimal("0.00")
    total_deductions: Decimal = Decimal("0.00")
    net_amount_payable: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    deduction_details: Optional[str] = None
    notes: Optional[str] = None


class ConsignmentSettlementCreate(ConsignmentSettlementBase):
    pass


class ConsignmentSettlementResponse(ConsignmentSettlementBase):
    id: str
    uuid: str
    settlement_no: str
    status: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ConsignmentReturn schemas ---

class ConsignmentReturnItemBase(BaseModel):
    transfer_item_id: str
    product_id: str
    qty_returned: Decimal
    rate: Decimal


class ConsignmentReturnItemCreate(ConsignmentReturnItemBase):
    pass


class ConsignmentReturnItemResponse(ConsignmentReturnItemBase):
    id: str
    return_id: str
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class ConsignmentReturnBase(BaseModel):
    partner_id: str
    return_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None


class ConsignmentReturnCreate(ConsignmentReturnBase):
    items: List[ConsignmentReturnItemCreate]


class ConsignmentReturnResponse(ConsignmentReturnBase):
    id: str
    uuid: str
    return_no: str
    status: str
    total_value: Decimal
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    items: List[ConsignmentReturnItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
