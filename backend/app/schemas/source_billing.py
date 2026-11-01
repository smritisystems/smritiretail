from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .sales import SalesInvoiceBase, SalesInvoiceCreate


SourceDocumentType = Literal["SALES_ORDER", "PACKING_SLIP"]


class SourceBillingPrepareRequest(BaseModel):
    source_type: SourceDocumentType
    source_document_id: str = Field(..., min_length=1, max_length=100)


class SourceBillingLineRequest(BaseModel):
    source_line_id: str = Field(..., min_length=1, max_length=50)
    quantity: Decimal = Field(..., gt=Decimal("0"))

    @field_validator("quantity")
    @classmethod
    def validate_quantity_precision(cls, value: Decimal) -> Decimal:
        if not value.is_finite() or value != value.quantize(Decimal("0.0001")):
            raise ValueError("Source billing quantity must be finite and use at most four decimal places.")
        return value


class SourceBillingPrepareLine(BaseModel):
    source_line_id: str
    order_line_id: Optional[str] = None
    product_id: str
    item_id: Optional[str] = None
    variant_id: Optional[str] = None
    code: str
    barcodes: list[str] = Field(default_factory=list)
    name: str
    ordered_quantity: Decimal
    po_quantity: Decimal = Decimal("0")
    document_quantity: Optional[Decimal] = None
    previously_billed_quantity: Decimal
    reserved_quantity: Decimal = Decimal("0")
    remaining_quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    discount_quantity_basis: Decimal = Decimal("0.0000")
    previously_billed_order_quantity: Decimal = Decimal("0.0000")
    gst_rate: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    eligible: bool
    reason: Optional[str] = None


class SourceBillingPrepareResponse(BaseModel):
    source_type: SourceDocumentType
    source_document_id: str
    source_document_number: str
    sales_order_id: Optional[str] = None
    sales_order_number: Optional[str] = None
    po_reference: Optional[str] = None
    packing_slip_id: Optional[str] = None
    packing_slip_number: Optional[str] = None
    customer_id: str
    customer_name: str
    company_id: str
    branch_id: str
    lines: list[SourceBillingPrepareLine]


class SourceBillingCommitRequest(BaseModel):
    source_type: SourceDocumentType
    source_document_id: str = Field(..., min_length=1, max_length=100)
    lines: list[SourceBillingLineRequest] = Field(..., min_length=1)
    invoice: SalesInvoiceBase


class SourceBillingDraftRequest(BaseModel):
    source_type: SourceDocumentType
    source_document_id: str = Field(..., min_length=1, max_length=100)
    lines: list[SourceBillingLineRequest] = Field(..., min_length=1)
    invoice: SalesInvoiceCreate


class SourceBillingCommitResponse(BaseModel):
    success: bool
    idempotent_replay: bool = False
    invoice_id: str
    invoice_no: str
    source_type: SourceDocumentType
    source_document_id: str
    allocated_lines: int
    allocated_quantity: Decimal
