"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 26.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for NIC GST Gateway
"""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class EInvoiceGenerateRequest(BaseModel):
    invoice_number: str
    seller_gstin: str
    buyer_gstin: str
    total_invoice_value: float
    taxable_value: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float


class EInvoiceResponse(BaseModel):
    invoice_number: str
    irn_hash: str
    signed_qr_code: str
    status: str


class EWayBillGenerateRequest(BaseModel):
    invoice_number: str
    transporter_id: str
    vehicle_number: str
    consignment_value: float
    distance_km: int = 100


class GSTR1SummaryResponse(BaseModel):
    period: str
    b2b_invoices_count: int
    b2b_taxable_value: float
    b2c_invoices_count: int
    b2c_taxable_value: float
    total_cgst: float
    total_sgst: float
    total_igst: float
