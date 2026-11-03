from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .sales import SalesInvoiceBase, SalesInvoiceCreate


SourceDocumentType = Literal["SALES_ORDER", "PACKING_SLIP"]


class SourceBillingPrepareRequest(BaseModel):
    source_type: SourceDocumentType
    source_document_id: Optional[str] = Field(None, min_length=1, max_length=100)
    source_document_ids: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_source_documents(self):
        if bool(self.source_document_id) == bool(self.source_document_ids):
            raise ValueError("Provide either source_document_id or source_document_ids, but not both.")
        if len(set(self.source_document_ids)) != len(self.source_document_ids):
            raise ValueError("Source document IDs must be unique.")
        if self.source_document_ids and self.source_type != "SALES_ORDER":
            raise ValueError("Only Sales Orders can be prepared together for consolidated billing.")
        if self.source_document_ids and len(self.source_document_ids) < 2:
            raise ValueError("Consolidated billing requires at least two Sales Orders.")
        return self


class SourceBillingLineRequest(BaseModel):
    source_line_id: str = Field(..., min_length=1, max_length=50)
    source_document_id: Optional[str] = Field(None, min_length=1, max_length=100)
    quantity: Decimal = Field(..., gt=Decimal("0"))

    @field_validator("quantity")
    @classmethod
    def validate_quantity_precision(cls, value: Decimal) -> Decimal:
        if not value.is_finite() or value != value.quantize(Decimal("0.0001")):
            raise ValueError("Source billing quantity must be finite and use at most four decimal places.")
        return value


class SourceBillingPrepareLine(BaseModel):
    source_line_id: str
    source_document_id: Optional[str] = None
    source_document_number: Optional[str] = None
    order_line_id: Optional[str] = None
    product_id: str
    item_id: Optional[str] = None
    variant_id: Optional[str] = None
    code: str
    barcodes: list[str] = Field(default_factory=list)
    article_no: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    name: str
    ordered_quantity: Decimal
    po_quantity: Decimal = Decimal("0")
    document_quantity: Optional[Decimal] = None
    previously_billed_quantity: Decimal
    reserved_quantity: Decimal = Decimal("0")
    stock_on_hand: Optional[Decimal] = None
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


class SourceBillingDocumentSummary(BaseModel):
    id: str
    number: str


class SourceBillingPrepareResponse(BaseModel):
    source_type: SourceDocumentType
    source_document_id: Optional[str] = None
    source_document_number: Optional[str] = None
    source_documents: list[SourceBillingDocumentSummary] = Field(default_factory=list)
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
    source_document_id: Optional[str] = Field(None, min_length=1, max_length=100)
    source_document_ids: list[str] = Field(default_factory=list, max_length=20)
    lines: list[SourceBillingLineRequest] = Field(..., min_length=1)
    invoice: SalesInvoiceBase

    @model_validator(mode="after")
    def validate_source_documents(self):
        if bool(self.source_document_id) == bool(self.source_document_ids):
            raise ValueError("Provide either source_document_id or source_document_ids, but not both.")
        if len(set(self.source_document_ids)) != len(self.source_document_ids):
            raise ValueError("Source document IDs must be unique.")
        if self.source_document_ids and self.source_type != "SALES_ORDER":
            raise ValueError("Only Sales Orders can be committed together for consolidated billing.")
        if self.source_document_ids and len(self.source_document_ids) < 2:
            raise ValueError("Consolidated billing requires at least two Sales Orders.")
        if self.source_document_ids:
            selected = set(self.source_document_ids)
            if any(line.source_document_id not in selected for line in self.lines):
                raise ValueError("Every consolidated billing line must identify one of the selected Sales Orders.")
        return self


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
    source_document_id: Optional[str] = None
    source_document_ids: list[str] = Field(default_factory=list)
    allocated_lines: int
    allocated_quantity: Decimal
