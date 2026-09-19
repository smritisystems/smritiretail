"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Enums (as Literal types for Pydantic v2 compat)
# ─────────────────────────────────────────────────────────────────────────────

AssignmentLevel = Literal[
    "BRAND", "CATEGORY", "STYLE", "ARTICLE", "MODEL", "SKU", "BARCODE"
]
VendorPriority = Literal["PRIMARY", "PREFERRED", "SECONDARY"]
AssignmentStatus = Literal["ACTIVE", "INACTIVE", "RESTRICTED"]

DecisionStatus = Literal["ASSIGNED", "CROSS_VENDOR", "UNASSIGNED", "RESTRICTED"]
DecisionAction = Literal["ALLOW", "READ_ONLY", "APPROVAL_REQUIRED", "BLOCK"]


# ─────────────────────────────────────────────────────────────────────────────
# VendorProductAssignment — Request / Response
# ─────────────────────────────────────────────────────────────────────────────

class VendorProductAssignmentCreate(BaseModel):
    """Request body to create a new vendor-product assignment."""
    vendor_party_id: str = Field(
        ..., description="Canonical parties.id of the vendor (SUPPLIER role)."
    )
    legacy_supplier_id: Optional[str] = Field(
        None, description="Legacy suppliers.id — bridge field for backward compat."
    )
    assignment_level: AssignmentLevel = Field(
        ..., description="Catalog hierarchy level at which the assignment is made."
    )
    assignment_target_id: str = Field(
        ..., description="ID of the entity at the given level (item_id, variant_id, etc.)."
    )
    assignment_target_code: str = Field(
        ..., description="Denormalized code for fast search."
    )
    assignment_target_name: Optional[str] = Field(
        None, description="Human-readable name of the assigned entity."
    )
    vendor_priority: VendorPriority = Field(
        "PRIMARY", description="Priority when multiple vendors supply the same product."
    )
    status: AssignmentStatus = Field("ACTIVE")
    allow_purchase: bool = True
    allow_po: bool = True
    allow_grn: bool = True
    approval_required: bool = Field(
        False,
        description="When True, this assignment always requires approval regardless of global policy.",
    )
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    remarks: Optional[str] = None

    @field_validator("effective_to")
    @classmethod
    def effective_to_after_from(cls, v: Optional[date], info: Any) -> Optional[date]:
        if v and info.data.get("effective_from") and v < info.data["effective_from"]:
            raise ValueError("effective_to must be on or after effective_from.")
        return v


class VendorProductAssignmentUpdate(BaseModel):
    """Partial update — all fields optional."""
    vendor_priority: Optional[VendorPriority] = None
    status: Optional[AssignmentStatus] = None
    allow_purchase: Optional[bool] = None
    allow_po: Optional[bool] = None
    allow_grn: Optional[bool] = None
    approval_required: Optional[bool] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    remarks: Optional[str] = None


class VendorProductAssignmentOut(BaseModel):
    """Response shape for a single assignment."""
    id: str
    company_id: Optional[str]
    branch_id: Optional[str]
    vendor_party_id: str
    legacy_supplier_id: Optional[str]
    assignment_level: str
    assignment_target_id: str
    assignment_target_code: str
    assignment_target_name: Optional[str]
    vendor_priority: str
    status: str
    allow_purchase: bool
    allow_po: bool
    allow_grn: bool
    approval_required: bool
    effective_from: Optional[date]
    effective_to: Optional[date]
    remarks: Optional[str]
    created_at: Optional[datetime]
    modified_at: Optional[datetime]
    created_by: Optional[str]

    model_config = {"from_attributes": True}


class VendorProductAssignmentListOut(BaseModel):
    items: List[VendorProductAssignmentOut]
    total: int


# ─────────────────────────────────────────────────────────────────────────────
# PO Product Evaluation — Request / Response
# ─────────────────────────────────────────────────────────────────────────────

class POProductEvaluateRequest(BaseModel):
    """Request to evaluate a single product for a given vendor in a PO context."""
    vendor_id: str = Field(
        ...,
        description="Canonical parties.id or legacy suppliers.id of the PO vendor.",
    )
    product_ref: str = Field(
        ...,
        description="Item identifier — item_id, variant_id, barcode, item_code, or style_code.",
    )
    transaction_date: Optional[date] = Field(
        None,
        description="The PO date. Defaults to today. Used for effective-date evaluation.",
    )
    purchase_order_id: Optional[str] = Field(
        None,
        description="If the PO already exists, attach the decision log to it.",
    )


class POProductBatchEvaluateRequest(BaseModel):
    """Batch-evaluate multiple products for the same vendor in one request."""
    vendor_id: str
    product_refs: List[str] = Field(..., max_length=200)
    transaction_date: Optional[date] = None
    purchase_order_id: Optional[str] = None


class POProductDecision(BaseModel):
    """
    Authoritative decision produced by POProductPolicyEngine.

    status  — business classification of the product relative to the vendor.
    action  — what the system permits/requires for this combination.

    STATUS ≠ ACTION (Rule 9 of Execution Command):
        CROSS_VENDOR + ALLOW_WITH_APPROVAL  →  status=CROSS_VENDOR, action=APPROVAL_REQUIRED
    """
    product_ref: str
    status: DecisionStatus
    action: DecisionAction

    # Assignment trace
    assignment_id: Optional[str] = None
    assignment_level: Optional[str] = None
    assignment_vendor_id: Optional[str] = None
    assignment_vendor_name: Optional[str] = None

    # Approval guidance
    approval_required: bool = False
    approval_reason_required: bool = False
    approval_reasons: List[Dict[str, str]] = Field(
        default_factory=list,
        description="List of {code, label} options for the approval reason picker.",
    )

    # Explainability (Rule 22)
    explanation: str = Field(
        ...,
        description="Human-readable explanation of why this decision was made.",
    )

    # Internal governance
    policy_snapshot: Dict[str, Any] = Field(
        default_factory=dict,
        description="Snapshot of the 8 SystemParameter values that governed this decision.",
    )
    policy_version: str = Field(
        "",
        description="Canonical code or hash identifying the parameter set version.",
    )

    # Decision log reference
    decision_log_id: Optional[str] = None


class POProductBatchDecision(BaseModel):
    """Batch decision response."""
    vendor_id: str
    transaction_date: Optional[date]
    decisions: List[POProductDecision]
    evaluated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Admin Diagnostic (Rule 25)
# ─────────────────────────────────────────────────────────────────────────────

class POProductDiagnosticRequest(BaseModel):
    vendor_id: str
    product_ref: str
    transaction_date: Optional[date] = None


class POProductDiagnosticOut(BaseModel):
    """
    Administrator-facing diagnostic explaining the full resolution chain
    for a vendor + product combination. Used by support and audit teams.
    """
    vendor_id: str
    vendor_name: Optional[str]
    product_ref: str
    product_name: Optional[str]

    # Assignment chain
    candidate_assignments: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="All VendorProductAssignment rows considered, ordered by level specificity.",
    )
    winning_assignment: Optional[Dict[str, Any]] = Field(
        None,
        description="The assignment row actually used for the decision.",
    )

    # Policy trace
    active_policy: Dict[str, Any] = Field(
        default_factory=dict,
        description="The 8 SystemParameter values governing this company's PO policy.",
    )
    business_template: Optional[str] = Field(
        None, description="Template that last configured this policy, if any."
    )

    # Final decision
    decision: POProductDecision

    evaluated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Business Configuration (Rule 4 — four-layer architecture)
# ─────────────────────────────────────────────────────────────────────────────

class POPolicyConfigOut(BaseModel):
    """
    Business-language representation of the PO purchasing policy.
    Shown in the configuration UI (Guided / Custom / Advanced modes).
    Never exposes canonical parameter keys to normal users.
    """
    # Business labels (non-technical)
    what_products_should_buyers_see: str = Field(
        ..., description="Assigned products only | Assigned first, others available | Show all"
    )
    cross_vendor_product_policy: str
    unassigned_product_policy: str
    restricted_product_policy: str
    show_vendor_status_to_buyer: bool
    show_explanation_for_restrictions: bool
    require_approval_reason: bool
    audit_approval_decisions: bool

    # Internal — only returned in Advanced mode
    canonical_params: Optional[Dict[str, str]] = None
    business_template: Optional[str] = None
    last_configured_by: Optional[str] = None
    last_configured_at: Optional[datetime] = None


class POPolicyTemplateOut(BaseModel):
    """A business template option shown in Guided/Custom configuration modes."""
    template_code: str
    template_name: str
    description: str
    recommended_for: List[str]
    preview: POPolicyConfigOut


class POPolicyApplyRequest(BaseModel):
    """
    Apply a template or custom configuration.
    Requires user confirmation after compare step (Rule 18 — never silent overwrite).
    """
    template_code: Optional[str] = Field(
        None, description="Apply this template's defaults. Mutually exclusive with custom_values."
    )
    custom_values: Optional[Dict[str, str]] = Field(
        None, description="Custom override values keyed by canonical_code."
    )
    confirmed: bool = Field(
        ...,
        description="Must be True. Client must show the diff and get user confirmation before sending.",
    )
    applied_by: str
    remarks: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# PO Submit Validation (Spec §16, §18, §37)
# ─────────────────────────────────────────────────────────────────────────────

class POSubmitLine(BaseModel):
    """One PO line sent for authoritative revalidation before submit."""
    product_ref: str = Field(..., description="Barcode, SKU, item code, or product ID.")
    quantity: float = Field(..., gt=0)
    rate: float = Field(..., ge=0)
    line_index: int = Field(..., description="0-based line index for mapping results back.")
    decision_log_id: Optional[str] = Field(
        None,
        description="Log ID from the browse-time evaluation. Used for stale-detection diff."
    )


class POSubmitValidationRequest(BaseModel):
    """Request body for POST /purchase/validate-po-submit."""
    vendor_id: str
    transaction_date: Optional[str] = Field(
        None, description="ISO date string. Defaults to today."
    )
    purchase_order_id: Optional[str] = None
    lines: List[POSubmitLine]


class POSubmitLineResult(BaseModel):
    """Decision result for a single PO line at submit time."""
    line_index: int
    product_ref: str
    status: DecisionStatus
    action: DecisionAction
    approval_required: bool
    explanation: str
    stale: bool = Field(
        False,
        description="True if the backend decision differs from the browse-time snapshot."
    )
    previous_action: Optional[DecisionAction] = Field(
        None, description="The browse-time action — only set when stale=True."
    )


class POSubmitValidationResult(BaseModel):
    """Response from POST /purchase/validate-po-submit."""
    can_submit: bool = Field(..., description="False if any line has action=BLOCK.")
    allowed_count: int
    approval_required_count: int
    blocked_count: int
    stale_count: int = Field(
        0, description="Lines whose policy decision changed since browse-time."
    )
    line_results: List[POSubmitLineResult]
    blocked_lines: List[int] = Field(default_factory=list, description="0-based line indices of BLOCK decisions.")
    stale_lines: List[int] = Field(default_factory=list, description="0-based line indices of stale decisions.")
    policy_version: str
    validated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Vendor Change Re-evaluation (Spec §4, §22)
# ─────────────────────────────────────────────────────────────────────────────

class POVendorChangeRequest(BaseModel):
    """Request body for POST /purchase/evaluate-vendor-change."""
    new_vendor_id: str
    product_refs: List[str] = Field(
        ..., description="Product references for every existing PO line."
    )
    line_indices: Optional[List[int]] = Field(
        None, description="Parallel array of 0-based line indices. If omitted, indices = 0..N-1."
    )
    transaction_date: Optional[str] = None
    purchase_order_id: Optional[str] = None


class POVendorChangeSummary(BaseModel):
    assigned: int = 0
    cross_vendor: int = 0
    unassigned: int = 0
    restricted: int = 0
    blocked: int = 0
    approval_required: int = 0


class POVendorChangeLineResult(BaseModel):
    line_index: int
    product_ref: str
    status: DecisionStatus
    action: DecisionAction
    approval_required: bool
    explanation: str


class POVendorChangeResult(BaseModel):
    """Response from POST /purchase/evaluate-vendor-change."""
    new_vendor_id: str
    summary: POVendorChangeSummary
    decisions: List[POVendorChangeLineResult]
    evaluated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate Product Check (Spec §24)
# ─────────────────────────────────────────────────────────────────────────────

class PODuplicateCheckRequest(BaseModel):
    """Request body for POST /purchase/check-duplicate-product."""
    new_product_ref: str
    existing_product_refs: List[str] = Field(
        ..., description="Product refs already on the PO (same order as line indices)."
    )


class PODuplicateCheckResult(BaseModel):
    """Response from POST /purchase/check-duplicate-product."""
    is_duplicate: bool
    existing_line_index: Optional[int] = Field(
        None, description="0-based index of the matching existing line."
    )
    existing_product_ref: Optional[str] = None
    existing_qty: Optional[float] = None


# ─────────────────────────────────────────────────────────────────────────────
# Approval Reasons (Spec §12, v1477 master)
# ─────────────────────────────────────────────────────────────────────────────

class POApprovalReasonOut(BaseModel):
    """One approval reason loaded from the v1477 master values."""
    code: str
    label: str
    sort_order: int = 0
    requires_note: bool = Field(
        False, description="True for OTHER — free-text explanation mandatory."
    )
    is_active: bool = True

