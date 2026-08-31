"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# NUMBERING & SERIES SCHEMAS
# ============================================================================

class DocumentSeriesCreateRequest(BaseModel):
    name: str = Field(..., max_length=200)
    document_type: str = Field(..., description="SALES_INVOICE, POS_BILL, DELIVERY_CHALLAN, GOODS_RECEIPT_NOTE, CREDIT_NOTE, DEBIT_NOTE, PURCHASE_ORDER, PAYMENT_RECEIPT")
    module: Optional[str] = "SALES"
    prefix: str = Field("", max_length=100)
    suffix: str = Field("", max_length=100)
    running_length: int = Field(4, ge=1, le=10)
    reset_rule: str = Field("Financial Year", description="Financial Year, Calendar Year, Monthly, Daily, Never")
    financial_year: Optional[str] = None
    company_code: Optional[str] = None
    mode: str = "Auto"
    description: Optional[str] = None


class DocumentSeriesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    document_type: str
    module: Optional[str] = None
    prefix: str
    suffix: str
    running_length: int
    reset_rule: str
    current_number: int
    financial_year: Optional[str] = None
    company_code: Optional[str] = None
    mode: str


class SequenceAllocateRequest(BaseModel):
    document_type: str
    company_code: Optional[str] = None
    branch_id: Optional[str] = "BR-001"
    financial_year: Optional[str] = None


class SequenceAllocateResponse(BaseModel):
    series_id: str
    document_type: str
    allocated_number: int
    document_no: str
    allocated_at: datetime


# ============================================================================
# TEMPLATE & RENDERING SCHEMAS
# ============================================================================

class DocumentTemplateCreateRequest(BaseModel):
    template_code: str = Field(..., max_length=100)
    template_name: str = Field(..., max_length=255)
    template_type: str = Field("TAX_INVOICE", description="TAX_INVOICE, POS_RECEIPT, DELIVERY_CHALLAN, PURCHASE_ORDER, CREDIT_NOTE")
    layout_configuration: Dict[str, Any] = Field(default_factory=dict)
    is_default: bool = True
    effective_from: Optional[date] = None


class DocumentTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_code: str
    template_name: str
    template_type: str
    status: str
    current_version: str
    effective_from: date
    layout_configuration: Dict[str, Any]
    configuration_hash: str
    is_default: bool


class DocumentRenderRequest(BaseModel):
    template_code: str
    document_type: str = "TAX_INVOICE"
    document_id: str
    document_no: str
    data_context: Dict[str, Any] = Field(..., description="Invoice header, line items, tax totals, seller & buyer party details")
    render_format: str = Field("HTML", description="HTML, TEXT, PDF_SIMULATION")


class DocumentRenderResponse(BaseModel):
    artifact_id: str
    document_id: str
    document_no: str
    template_code: str
    template_version: str
    rendered_output: str
    sha256_hash: str
    file_size_bytes: int
    generated_at: datetime


# ============================================================================
# PRINT JOB & LIFECYCLE SCHEMAS
# ============================================================================

class DocumentPrintJobRequest(BaseModel):
    document_id: str
    document_type: str = "TAX_INVOICE"
    target_printer: Optional[str] = "DEFAULT_SYSTEM_PRINTER"
    copy_type: str = Field("ORIGINAL_FOR_RECIPIENT", description="ORIGINAL_FOR_RECIPIENT, DUPLICATE_FOR_TRANSPORTER, TRIPLICATE_FOR_SUPPLIER, EXTRA_COPY")
    operator: Optional[str] = None


class DocumentPrintJobResponse(BaseModel):
    print_job_id: str
    document_id: str
    reprint_count: int
    is_reprint: bool
    watermark_label: str
    spool_status: str  # DISPATCHED, SPOOLED, SUCCESS
    dispatched_at: datetime


class DocumentLifecycleUpdateRequest(BaseModel):
    document_type: str
    document_id: str
    target_state: str = Field(..., description="DRAFT, ISSUED, PRINTED, AMENDED, CANCELLED, VOIDED")
    reason: Optional[str] = None


class DocumentLifecycleStatusResponse(BaseModel):
    document_type: str
    document_id: str
    previous_state: str
    current_state: str
    updated_at: datetime
    transition_allowed: bool
