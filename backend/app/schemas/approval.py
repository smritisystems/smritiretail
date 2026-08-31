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
# APPROVAL POLICY SCHEMAS
# ============================================================================

class ApprovalPolicyCreateRequest(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=50)
    document_type: str = Field(..., description="SALES_INVOICE, PURCHASE_ORDER, CREDIT_MEMO, DISCOUNT_EXCEPTION, MANUAL_JOURNAL")
    min_amount: Decimal = Field(Decimal("0.00"), ge=0)
    max_amount: Optional[Decimal] = None
    required_role: str = Field(..., description="STORE_MANAGER, FINANCE_CONTROLLER, DIRECTOR, SYSADMIN")
    priority: int = Field(1, ge=1)
    description: Optional[str] = None


class ApprovalPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    document_type: str
    min_amount: Decimal
    max_amount: Optional[Decimal] = None
    required_role: str
    priority: int
    status: str
    description: Optional[str] = None


# ============================================================================
# APPROVAL REQUEST & ENFORCEMENT SCHEMAS
# ============================================================================

class ApprovalEnforcementCheckRequest(BaseModel):
    document_type: str
    document_amount: Decimal = Field(..., ge=0)
    caller_role: str = "CASHIER"


class ApprovalEnforcementCheckResponse(BaseModel):
    requires_approval: bool
    matching_policy_code: Optional[str] = None
    required_role: Optional[str] = None
    reason: str


class ApprovalRequestCreateRequest(BaseModel):
    reference_doc_type: str
    reference_doc_id: str
    document_amount: Decimal = Field(..., ge=0)
    notes: Optional[str] = None


class ApprovalActionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str
    action_by: str
    action_by_role: str
    comments: Optional[str] = None
    action_at: datetime


class ApprovalRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    request_no: str
    reference_doc_type: str
    reference_doc_id: str
    policy_id: Optional[str] = None
    document_amount: Decimal
    requested_by: str
    status: str
    current_assigned_role: str
    notes: Optional[str] = None
    actions: List[ApprovalActionDetailResponse] = Field(default_factory=list)


# ============================================================================
# APPROVAL ACTIONS & ESCALATION SCHEMAS
# ============================================================================

class ApprovalActionRequest(BaseModel):
    request_id: str
    action: str = Field(..., description="APPROVE, REJECT, REQUEST_CHANGES")
    comments: Optional[str] = None


class ApprovalActionResponse(BaseModel):
    request_id: str
    request_no: str
    action: str
    action_by: str
    action_by_role: str
    new_status: str
    timestamp: datetime
    message: str


class ApprovalEscalationRequest(BaseModel):
    request_id: str
    escalate_to_role: str = Field(..., description="FINANCE_CONTROLLER, DIRECTOR, SYSADMIN")
    reason: Optional[str] = None


class ApprovalEscalationResponse(BaseModel):
    request_id: str
    request_no: str
    previous_role: str
    new_role: str
    status: str
    escalated_at: datetime
