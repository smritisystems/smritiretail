"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class ApprovalPolicy(BaseEntity):
    """
    Governance policy defining threshold criteria and required approver roles for transaction execution.
    """
    __tablename__ = "approval_policies"

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    document_type = Column(String(50), nullable=False, index=True)  # SALES_INVOICE, PURCHASE_ORDER, CREDIT_MEMO
    min_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    max_amount = Column(Numeric(15, 2), nullable=True)
    required_role = Column(String(50), nullable=False)  # STORE_MANAGER, FINANCE_CONTROLLER, DIRECTOR
    priority = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="ACTIVE")
    description = Column(Text, nullable=True)


class ApprovalRequest(BaseEntity):
    """
    State machine tracking an approval request for a specific business document.
    """
    __tablename__ = "approval_requests"

    request_no = Column(String(100), nullable=False, unique=True, index=True)
    reference_doc_type = Column(String(50), nullable=False, index=True)
    reference_doc_id = Column(String(50), nullable=False, index=True)
    policy_id = Column(String(50), ForeignKey("approval_policies.id", ondelete="SET NULL"), nullable=True)
    document_amount = Column(Numeric(15, 2), nullable=False)
    requested_by = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="PENDING")  # PENDING, APPROVED, REJECTED, CANCELLED
    current_assigned_role = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    actions = relationship("ApprovalAction", back_populates="request", cascade="all, delete-orphan")


class ApprovalAction(BaseEntity):
    """
    Immutable audit ledger of an approval or rejection decision.
    """
    __tablename__ = "approval_actions"

    request_id = Column(String(50), ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(30), nullable=False)  # APPROVE, REJECT, REQUEST_CHANGES
    action_by = Column(String(100), nullable=False)
    action_by_role = Column(String(50), nullable=False)
    comments = Column(Text, nullable=True)
    action_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    request = relationship("ApprovalRequest", back_populates="actions")
