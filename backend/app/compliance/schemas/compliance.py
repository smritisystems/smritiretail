"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GovernmentServiceBase(BaseModel):
    name: str = Field(..., max_length=255, description="Full name of compliance service")
    version: str = Field(..., max_length=50, description="Version of the service connector")
    provider: str = Field(..., max_length=100, description="Government or NIC provider name")
    api_version: str = Field(..., max_length=50, description="Underlying API version")
    status: str = Field("ACTIVE", description="Service configuration status (ACTIVE, DISABLED, DEPRECATED)")
    display_name: str | None = Field(None, max_length=255)
    description: str | None = Field(None)
    environments: str | None = Field(None, description="Serialized JSON configuration dictionary")
    capabilities: str | None = Field(None, description="Comma-separated or JSON list of capabilities")

class GovernmentServiceCreate(GovernmentServiceBase):
    id: str = Field(..., max_length=50, description="Unique string service identifier (e.g. ewaybill)")

class GovernmentServiceOut(GovernmentServiceBase):
    id: str
    uuid: str
    is_active: bool
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplianceCredentialsBase(BaseModel):
    service_id: str = Field(..., max_length=50)
    encrypted_username: str
    encrypted_password: str
    encrypted_client_secret: str | None = None

class ComplianceCredentialsCreate(ComplianceCredentialsBase):
    pass

class ComplianceCredentialsOut(ComplianceCredentialsBase):
    id: str
    uuid: str
    company_id: str | None = None
    branch_id: str | None = None
    is_active: bool
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplianceAuditLogBase(BaseModel):
    service_id: str = Field(..., max_length=50)
    endpoint: str = Field(..., max_length=255)
    request_payload: str | None = None
    response_payload: str | None = None
    status_code: int | None = None
    duration_ms: int | None = None

class ComplianceAuditLogCreate(ComplianceAuditLogBase):
    pass

class ComplianceAuditLogOut(ComplianceAuditLogBase):
    id: str
    uuid: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplianceOutboxBase(BaseModel):
    service_id: str = Field(..., max_length=50)
    state: str = Field(..., max_length=50)
    action: str = Field(..., max_length=100)
    payload: str
    idempotency_key: str = Field(..., max_length=100)
    attempts: int = 0
    next_retry_at: datetime | None = None
    error_message: str | None = None

class ComplianceOutboxCreate(ComplianceOutboxBase):
    pass

class ComplianceOutboxOut(ComplianceOutboxBase):
    id: str
    uuid: str
    company_id: str | None = None
    branch_id: str | None = None
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class HealthStatusOut(BaseModel):
    status: str
    database: str
    vault: str
    registry: str
    connectors: int
    version: str
    milestone: str

class DebugOutboxIn(BaseModel):
    service_id: str = Field(..., max_length=50)
    action: str = Field(..., max_length=100)
    payload: str
    idempotency_key: str = Field(..., max_length=100)


# ---------------------------------------------------------------------------
# E-Invoice & E-Way Bill Business Request / Response Schemas
# ---------------------------------------------------------------------------

class EInvoiceItem(BaseModel):
    item_code: str
    description: str
    hsn_code: str
    quantity: float
    unit: str = "PCS"
    unit_price: float
    gross_amount: float
    discount_amount: float = 0.0
    taxable_amount: float
    gst_rate: float
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    igst_amount: float = 0.0
    total_item_value: float


class EInvoiceGenerationRequest(BaseModel):
    invoice_id: str = Field(..., description="Internal SMRITI sales_invoices ID")
    invoice_no: str = Field(..., description="Statutory invoice series number")
    invoice_date: str = Field(..., description="Invoice date DD/MM/YYYY")
    supplier_gstin: str
    supplier_legal_name: str
    supplier_address: str
    supplier_pincode: str
    supplier_state_code: str
    buyer_gstin: str = Field("URP", description="Buyer GSTIN or URP for unregistered")
    buyer_legal_name: str
    buyer_address: str
    buyer_pincode: str
    buyer_state_code: str
    items: list[EInvoiceItem]
    total_taxable_value: float
    total_cgst_value: float = 0.0
    total_sgst_value: float = 0.0
    total_igst_value: float = 0.0
    total_invoice_value: float
    financial_year: str = "2026-27"
    environment: str = "sandbox"


class EInvoiceResponse(BaseModel):
    status: str
    invoice_id: str
    invoice_no: str
    irn: str
    ack_no: int
    ack_date: str
    signed_invoice: str
    signed_qr_code: str
    status_code: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class EWayBillGenerationRequest(BaseModel):
    invoice_id: str = Field(..., description="Internal SMRITI sales_invoices or transfer ID")
    doc_no: str = Field(..., description="Invoice or Delivery Challan number")
    doc_type: str = Field("INV", description="INV (Tax Invoice) or CHL (Delivery Challan)")
    from_gstin: str
    to_gstin: str
    from_pincode: str
    to_pincode: str
    trans_distance_km: int = Field(100, description="Transit distance in kilometers")
    transporter_id: str | None = None
    transporter_name: str | None = None
    vehicle_no: str | None = None
    total_invoice_value: float
    items_count: int = 1
    environment: str = "sandbox"


class EWayBillResponse(BaseModel):
    status: str
    invoice_id: str
    doc_no: str
    eway_bill_no: str
    eway_bill_date: str
    valid_upto: str
    trans_distance_km: int
    vehicle_no: str | None = None
    transporter_id: str | None = None
    status_code: str


class CancelComplianceDocRequest(BaseModel):
    document_type: str = Field(..., description="EINVOICE or EWAYBILL")
    document_no: str = Field(..., description="IRN hash or 12-digit EWB Number")
    reason: str = Field("Duplicate", description="Cancellation reason code/text")
    remarks: str | None = None
