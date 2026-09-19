from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


POStatus = Literal["DRAFT", "OPEN", "PARTIALLY_BILLED", "FULLY_BILLED", "CLOSED", "CANCELLED", "EXPIRED"]
OverBillingPolicy = Literal["BLOCK", "WARN", "ALLOW_WITH_AUTHORIZATION", "ALLOW"]


class CustomerPOLineCreate(BaseModel):
    line_number: str = Field(..., max_length=20)
    product_id: Optional[str] = Field(None, max_length=50)
    item_id: Optional[str] = Field(None, max_length=50)
    variant_id: Optional[str] = Field(None, max_length=50)
    code: str = Field(..., max_length=50)
    description: str = Field(..., max_length=255)
    quantity_ordered: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    gst_rate: Decimal = Field(Decimal("18.00"), ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=15)
    uom: str = Field("EA", max_length=20)
    delivery_location_id: Optional[str] = Field(None, max_length=50)


class CustomerPOCreate(BaseModel):
    customer_id: str = Field(..., max_length=50)
    po_number: str = Field(..., min_length=1, max_length=100)
    po_date: date
    valid_until: Optional[date] = None
    currency: str = Field("INR", min_length=3, max_length=3)
    status: POStatus = "OPEN"
    notes: Optional[str] = None
    lines: List[CustomerPOLineCreate] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.valid_until and self.valid_until < self.po_date:
            raise ValueError("valid_until cannot be before po_date")
        return self


class CustomerPOUpdate(BaseModel):
    valid_until: Optional[date] = None
    status: Optional[POStatus] = None
    notes: Optional[str] = None


class CustomerPOLineResponse(CustomerPOLineCreate):
    id: str
    quantity_cancelled: Decimal
    quantity_billed: Decimal
    quantity_remaining: Decimal
    ordered_value: Decimal
    billed_value: Decimal
    remaining_value: Decimal
    line_status: str
    model_config = ConfigDict(from_attributes=True)


class CustomerPOResponse(BaseModel):
    id: str
    company_id: Optional[str]
    branch_id: Optional[str]
    customer_id: str
    po_number: str
    po_date: date
    valid_until: Optional[date]
    currency: str
    status: str
    ordered_value: Decimal
    cancelled_value: Decimal
    billed_value: Decimal
    remaining_value: Decimal
    ordered_quantity: Decimal
    cancelled_quantity: Decimal
    billed_quantity: Decimal
    remaining_quantity: Decimal
    billing_policy_snapshot: dict[str, Any]
    notes: Optional[str]
    closed_at: Optional[date]
    lines: List[CustomerPOLineResponse] = []
    model_config = ConfigDict(from_attributes=True)


class CustomerPOBillingLine(BaseModel):
    customer_po_line_id: str
    quantity: Decimal = Field(..., gt=0)


class CustomerPOBillingRequest(BaseModel):
    invoice: dict[str, Any]
    lines: List[CustomerPOBillingLine] = Field(..., min_length=1)
    authorization: Optional[str] = None
    idempotency_key: Optional[str] = None


class CustomerPOUtilizationResponse(BaseModel):
    po_id: str
    po_number: str
    status: str
    ordered_quantity: Decimal
    billed_quantity: Decimal
    remaining_quantity: Decimal
    ordered_value: Decimal
    billed_value: Decimal
    remaining_value: Decimal
    billable_lines: List[CustomerPOLineResponse]


class CustomerPOBillingHistoryResponse(BaseModel):
    allocation_id: str
    invoice_id: str
    invoice_number: str
    customer_po_line_id: str
    allocated_quantity: Decimal
    allocated_value: Decimal
    status: str
    created_at: Optional[datetime]
    model_config = ConfigDict(from_attributes=True)
