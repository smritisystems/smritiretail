"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class ApprovalStrategy(str, enum.Enum):
    SEQUENTIAL = "SEQUENTIAL"
    PARALLEL = "PARALLEL"
    HYBRID = "HYBRID"


class ApprovalRequestStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    ARCHIVED = "ARCHIVED"


class SMRITIApprovalPolicy(BaseEntity):
    """Top-level approval policy envelope with effective date validity and scope."""
    __tablename__ = "smriti_approval_policies"

    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    document_type = Column(String(50), nullable=False, index=True)  # e.g. PurchaseOrder, SalesInvoice, StockDispatch
    scope_type = Column(String(30), default="GLOBAL")  # GLOBAL, COMPANY, BRANCH, STORE
    scope_id = Column(String(50), nullable=True)
    priority = Column(Integer, default=10)
    policy_version = Column(Integer, default=1)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_to = Column(DateTime(timezone=True), nullable=True)
    description = Column(Text, nullable=True)

    matrices = relationship("SMRITIApprovalMatrix", back_populates="policy", cascade="all, delete-orphan")


class SMRITIApprovalMatrix(BaseEntity):
    """Approval matrix defining threshold bands and steps."""
    __tablename__ = "smriti_approval_matrices"

    policy_id = Column(String(50), ForeignKey("smriti_approval_policies.id", ondelete="CASCADE"), nullable=False)
    matrix_name = Column(String(100), nullable=False)
    min_amount = Column(Numeric(15, 2), default=0.00)
    max_amount = Column(Numeric(15, 2), nullable=True)

    policy = relationship("SMRITIApprovalPolicy", back_populates="matrices")
    steps = relationship("SMRITIApprovalStep", back_populates="matrix", cascade="all, delete-orphan")


class SMRITIApprovalStep(BaseEntity):
    """Workflow step within an approval matrix."""
    __tablename__ = "smriti_approval_steps"

    matrix_id = Column(String(50), ForeignKey("smriti_approval_matrices.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)
    step_name = Column(String(100), nullable=False)
    strategy = Column(String(30), default=ApprovalStrategy.SEQUENTIAL.value)
    sla_hours = Column(Integer, default=24)
    auto_escalate_role_id = Column(String(50), nullable=True)

    matrix = relationship("SMRITIApprovalMatrix", back_populates="steps")
    conditions = relationship("SMRITIApprovalCondition", back_populates="step", cascade="all, delete-orphan")
    assignments = relationship("SMRITIApprovalAssignment", back_populates="step", cascade="all, delete-orphan")


class SMRITIApprovalCondition(BaseEntity):
    """Rule condition evaluated safely via AST DSL evaluator."""
    __tablename__ = "smriti_approval_conditions"

    step_id = Column(String(50), ForeignKey("smriti_approval_steps.id", ondelete="CASCADE"), nullable=False)
    expression_dsl = Column(Text, nullable=False)  # e.g., "Amount > 50000 AND Margin < 0.08"

    step = relationship("SMRITIApprovalStep", back_populates="conditions")


class SMRITIApprovalAssignment(BaseEntity):
    """Role or User assignment for an approval step."""
    __tablename__ = "smriti_approval_assignments"

    step_id = Column(String(50), ForeignKey("smriti_approval_steps.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(String(50), nullable=True)
    user_id = Column(String(50), nullable=True)

    step = relationship("SMRITIApprovalStep", back_populates="assignments")


class SMRITIApprovalRequest(BaseEntity):
    """Active or historical document approval request instance."""
    __tablename__ = "smriti_approval_requests"

    request_no = Column(String(50), unique=True, nullable=False, index=True)
    document_type = Column(String(50), nullable=False, index=True)
    document_id = Column(String(50), nullable=False, index=True)
    document_hash = Column(String(64), nullable=False)  # SHA-256 document payload hash
    policy_version = Column(Integer, default=1)
    requester_id = Column(String(50), nullable=False)
    current_step_number = Column(Integer, default=1)
    status = Column(String(30), default=ApprovalRequestStatus.SUBMITTED.value, index=True)

    actions = relationship("SMRITIApprovalAction", back_populates="request", cascade="all, delete-orphan")
    history = relationship("SMRITIApprovalHistory", back_populates="request", cascade="all, delete-orphan")
    comments = relationship("SMRITIApprovalComment", back_populates="request", cascade="all, delete-orphan")


class SMRITIApprovalAction(BaseEntity):
    """Audit action log for an approval request step with execution context."""
    __tablename__ = "smriti_approval_actions"

    request_id = Column(String(50), ForeignKey("smriti_approval_requests.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)
    action = Column(String(30), nullable=False)  # SUBMIT, APPROVE, REJECT, DELEGATE, OVERRIDE
    action_by = Column(String(50), nullable=False)
    remarks = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    correlation_id = Column(String(64), nullable=True)

    request = relationship("SMRITIApprovalRequest", back_populates="actions")


class SMRITIApprovalHistory(BaseEntity):
    """State transition timeline history."""
    __tablename__ = "smriti_approval_histories"

    request_id = Column(String(50), ForeignKey("smriti_approval_requests.id", ondelete="CASCADE"), nullable=False)
    state_from = Column(String(30), nullable=False)
    state_to = Column(String(30), nullable=False)
    transition_by = Column(String(50), nullable=False)
    transition_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    request = relationship("SMRITIApprovalRequest", back_populates="history")


class SMRITIApprovalDelegation(BaseEntity):
    """Date-bound approval delegation rule."""
    __tablename__ = "smriti_approval_delegations"

    delegator_id = Column(String(50), nullable=False, index=True)
    delegate_id = Column(String(50), nullable=False, index=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    remarks = Column(Text, nullable=True)


class SMRITIApprovalEscalation(BaseEntity):
    """Log of automatic SLA escalation triggers."""
    __tablename__ = "smriti_approval_escalations"

    request_id = Column(String(50), ForeignKey("smriti_approval_requests.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)
    escalated_from_role = Column(String(50), nullable=False)
    escalated_to_role = Column(String(50), nullable=False)
    trigger_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SMRITIApprovalComment(BaseEntity):
    """Threaded approval comments and attachments."""
    __tablename__ = "smriti_approval_comments"

    request_id = Column(String(50), ForeignKey("smriti_approval_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), nullable=False)
    comment = Column(Text, nullable=False)
    attachments_json = Column(JSON, nullable=True)

    request = relationship("SMRITIApprovalRequest", back_populates="comments")


class SMRITIApprovalOutbox(BaseEntity):
    """Transactional Outbox table for decoupled event bus publishing."""
    __tablename__ = "smriti_approval_outbox"

    event_type = Column(String(100), nullable=False, index=True)
    payload_json = Column(JSON, nullable=False)
    status = Column(String(20), default="PENDING", index=True)  # PENDING, PROCESSED, FAILED
    processed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
