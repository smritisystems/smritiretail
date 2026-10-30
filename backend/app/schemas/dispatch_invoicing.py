"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.40.1
Created      : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: B2B Dispatch & Tax Invoicing Studio Schemas
"""

from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DispatchValidationIssue(BaseModel):
    severity: str = Field(..., description="ERROR or WARNING")
    store_code: Optional[str] = None
    row_index: Optional[int] = None
    message: str
    guidance: Optional[str] = None


class DispatchStoreSummary(BaseModel):
    store_code: str
    store_name: str
    po_number: Optional[str] = None
    po_date: Optional[str] = None
    state: str
    state_code: int
    gstin: str
    pincode: Optional[int] = None
    city: Optional[str] = None
    distance_km: Optional[int] = None
    is_interstate: bool
    pairs_count: int
    rows_count: int
    taxable_value: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    rounding_amount: Decimal
    status: str = "READY"  # READY | WARNING | ERROR
    validation_errors: List[str] = []
    validation_warnings: List[str] = []


class DispatchPreflightAuditResponse(BaseModel):
    sheet_name: str
    available_sheets: List[str]
    detected_sizes: List[str]
    total_stores: int
    total_pairs: int
    total_taxable: Decimal
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    total_tax: Decimal
    total_invoice_value: Decimal
    stores: List[DispatchStoreSummary]
    issues: List[DispatchValidationIssue]
    is_valid_to_generate: bool
    audit_token: str


class DispatchBatchGenerateRequest(BaseModel):
    audit_token: str
    invoice_date: str = "2026-09-05"  # YYYY-MM-DD
    series_prefix: str = "TT2026-2027/"
    customer_name: str = "Reliance Retail Limited"
    customer_id: Optional[str] = None
    discount_pct: Decimal = Decimal("43.76")
    hsn_code: str = "64041990"
    gst_rate: Decimal = Decimal("5.00")
    starting_sequence: Optional[int] = None


class DispatchGeneratedInvoice(BaseModel):
    invoice_id: str
    invoice_no: str
    identity_code: str
    store_code: str
    site_name: str
    po_number: Optional[str] = None
    pairs_count: int
    taxable_value: Decimal
    tax_total: Decimal
    grand_total: Decimal
    eway_bill_id: Optional[str] = None
    eway_identity_code: Optional[str] = None
    pdf_filename: str


class DispatchBatchResult(BaseModel):
    batch_id: str
    status: str  # COMPLETED | FAILED
    invoice_date: str
    total_invoices: int
    total_pairs: int
    total_value: Decimal
    generated_invoices: List[DispatchGeneratedInvoice]
    zip_download_url: str
    excel_summary_url: Optional[str] = None
    stamped_excel_url: Optional[str] = None
    execution_time_seconds: float
    message: str = "Batch generated successfully"
