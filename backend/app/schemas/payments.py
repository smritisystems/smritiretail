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

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# TENDER & PAYMENT PROCESS SCHEMAS
# ============================================================================

class PaymentTenderItem(BaseModel):
    tender_type: str = Field(..., description="CASH, CARD, UPI, NETBANKING, WALLET, CREDIT_NOTE, CHEQUE, LOYALTY_POINTS, BANK_TRANSFER")
    amount: float = Field(..., gt=0.0)
    gateway_reference: Optional[str] = None
    auth_code: Optional[str] = None
    card_last4: Optional[str] = None
    bank_name: Optional[str] = None
    cheque_no: Optional[str] = None
    notes: Optional[str] = None


class ProcessPaymentRequest(BaseModel):
    reference_doc_type: str = Field(..., description="SALES_INVOICE, POS_BILL, PURCHASE_BILL, SALES_RETURN")
    reference_doc_id: str
    party_id: Optional[str] = None
    tenders: List[PaymentTenderItem] = Field(..., min_length=1)
    idempotency_key: str = Field(..., min_length=5, max_length=100)
    branch_id: str = "BR-001"
    currency: str = "INR"
    auto_allocate: bool = True


class PaymentAllocationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payment_id: str
    invoice_id: str
    allocated_amount: float
    discount_allowed: float = 0.0
    settled_at: Optional[datetime] = None


class PaymentTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    branch_id: str
    transaction_no: str
    reference_doc_type: str
    reference_doc_id: str
    party_id: Optional[str] = None
    tender_type: str
    amount: float
    currency: str
    status: str  # SUCCESS, REFUNDED, PARTIALLY_REFUNDED, VOIDED
    idempotency_key: str
    gateway_reference: Optional[str] = None
    captured_at: Optional[datetime] = None
    allocations: List[PaymentAllocationDetail] = Field(default_factory=list)


class MultiTenderPaymentResponse(BaseModel):
    total_amount: float
    currency: str
    status: str
    idempotency_key: str
    transactions: List[PaymentTransactionResponse]
    receipt_no: Optional[str] = None


# ============================================================================
# REFUND SCHEMAS
# ============================================================================

class PaymentRefundRequest(BaseModel):
    payment_transaction_id: str
    refund_amount: float = Field(..., gt=0.0)
    reason: str = Field(..., min_length=3)
    refund_tender_type: Optional[str] = None  # Defaults to original tender
    reference_return_id: Optional[str] = None
    idempotency_key: str = Field(..., min_length=5, max_length=100)


class PaymentRefundResponse(BaseModel):
    refund_transaction_id: str
    original_payment_id: str
    refund_amount: float
    remaining_balance: float
    status: str  # REFUND_SUCCESS, PARTIAL_REFUND
    reason: str
    refunded_at: datetime


# ============================================================================
# ALLOCATION & RECEIPT SCHEMAS
# ============================================================================

class PaymentAllocationRequest(BaseModel):
    invoice_id: str
    allocated_amount: float = Field(..., gt=0.0)
    discount_allowed: float = Field(0.0, ge=0.0)


class PaymentReceiptTenderLine(BaseModel):
    tender_type: str
    amount: float
    gateway_reference: Optional[str] = None
    transaction_no: str


class PaymentReceiptResponse(BaseModel):
    receipt_no: str
    receipt_date: datetime
    company_id: str
    branch_id: str
    reference_doc_type: str
    reference_doc_id: str
    party_id: Optional[str] = None
    total_paid: float
    currency: str
    tenders: List[PaymentReceiptTenderLine]
    allocations: List[PaymentAllocationDetail]
    status: str
