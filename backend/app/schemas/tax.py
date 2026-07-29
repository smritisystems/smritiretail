"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

tax.py — Pydantic DTO schemas for GST Tax Settlement, GSTR-1 Return Filing DTOs, and E-Way Bills.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class GstSettlementResponse(BaseModel):
    id: str
    settlement_no: str
    tax_period: str
    outward_cgst: Decimal
    outward_sgst: Decimal
    outward_igst: Decimal
    total_outward_tax: Decimal
    inward_itc_cgst: Decimal
    inward_itc_sgst: Decimal
    inward_itc_igst: Decimal
    total_inward_itc: Decimal
    net_cgst_payable: Decimal
    net_sgst_payable: Decimal
    net_igst_payable: Decimal
    total_net_tax_payable: Decimal
    carry_forward_itc: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


class Gstr1PayloadResponse(BaseModel):
    id: str
    filing_no: str
    return_type: str
    tax_period: str
    gstr1_payload_json: str
    b2b_invoices_count: int
    b2c_invoices_count: int
    credit_notes_count: int
    total_taxable_value: Decimal
    total_tax_amount: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


class EWayBillCreateReq(BaseModel):
    invoice_id: str
    transporter_id: Optional[str] = None
    transporter_name: Optional[str] = None
    transport_mode: Optional[str] = "ROAD"
    vehicle_no: Optional[str] = None
    distance_km: Decimal = Decimal("100.00")


class EWayBillResponse(BaseModel):
    id: str
    eway_bill_no: str
    invoice_id: str
    consignment_value: Decimal
    transporter_id: Optional[str] = None
    transporter_name: Optional[str] = None
    transport_mode: str
    vehicle_no: Optional[str] = None
    distance_km: Decimal
    valid_from: datetime
    valid_until: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)
