"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : SCDM v1.1 Settlement & Claims Engine Models
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Level-1 Platform Capability (ADR-0016)
"""

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Numeric, Text, JSON, Enum
)
from sqlalchemy.orm import relationship

from ..db.base import Base


class ClaimStatus(str, enum.Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "UnderReview"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    SETTLED = "Settled"
    CLOSED = "Closed"


class SettlementStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING_RECONCILIATION = "PendingReconciliation"
    RECONCILED = "Reconciled"
    DISPUTED = "Disputed"
    CLOSED = "Closed"


def _uid(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


class SCDMClaimType(Base):
    """Configurable Master for Retailer Claims (Shortage, Damage, Scheme Discount, etc.)."""
    __tablename__ = "scdm_claim_types"

    id = Column(String, primary_key=True, default=lambda: _uid("CT-"))

    tenant_id = Column(String(50), nullable=True, index=True)
    company_id = Column(String(50), nullable=True, index=True)

    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False, default="Shortage")  # Shortage, Damage, Scheme, PriceDrop, Freight
    requires_approval = Column(Boolean, default=True)
    requires_evidence = Column(Boolean, default=False)
    tax_treatment = Column(String(50), default="GST_Reversal")
    description = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SCDMClaim(Base):
    """Itemized Claim filed by retailer or distributor against a Channel Dispatch."""
    __tablename__ = "scdm_claims"

    id = Column(String, primary_key=True, default=lambda: _uid("CLM-"))
    tenant_id = Column(String(50), nullable=True, index=True)
    company_id = Column(String(50), nullable=True, index=True)
    branch_id = Column(String(50), nullable=True, index=True)

    claim_number = Column(String(50), nullable=False, unique=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    dispatch_id = Column(String(50), ForeignKey("scdm_channel_dispatches.id"), nullable=True, index=True)
    claim_type_id = Column(String(50), ForeignKey("scdm_claim_types.id"), nullable=True, index=True)

    claim_category = Column(String(50), nullable=False, default="Shortage")
    status = Column(Enum(ClaimStatus), nullable=False, default=ClaimStatus.DRAFT, index=True)

    claimed_amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    approved_amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    rejected_amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))

    reference_doc_no = Column(String(100), nullable=True)  # Retailer Debit Note / Debit Memo #
    reason = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    attachments_json = Column(JSON, nullable=True, default=dict)  # Documents/Photos/PDF links

    created_by = Column(String(100), nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    approved_by = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SCDMSettlement(Base):
    """Header record for Customer Remittance Batch & Settlement Reconciler."""
    __tablename__ = "scdm_settlements"

    id = Column(String, primary_key=True, default=lambda: _uid("STL-"))
    tenant_id = Column(String(50), nullable=True, index=True)
    company_id = Column(String(50), nullable=True, index=True)
    branch_id = Column(String(50), nullable=True, index=True)

    settlement_number = Column(String(50), nullable=False, unique=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)

    status = Column(Enum(SettlementStatus), nullable=False, default=SettlementStatus.DRAFT, index=True)

    remittance_ref = Column(String(100), nullable=True)  # Payment Advice / UTR / Check #
    remittance_date = Column(DateTime(timezone=True), nullable=True)

    gross_dispatch_value = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total_deductions = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    net_received_amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    unreconciled_variance = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))

    payment_advice_doc = Column(String(255), nullable=True)
    remarks = Column(Text, nullable=True)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reconciled_at = Column(DateTime(timezone=True), nullable=True)

    lines = relationship("SCDMSettlementLine", backref="settlement", cascade="all, delete-orphan")


class SCDMSettlementLine(Base):
    """Itemized detail matching customer remittance to dispatches and approved claims."""
    __tablename__ = "scdm_settlement_lines"

    id = Column(String, primary_key=True, default=lambda: _uid("SLN-"))
    settlement_id = Column(String(50), ForeignKey("scdm_settlements.id", ondelete="CASCADE"), nullable=False, index=True)
    dispatch_id = Column(String(50), ForeignKey("scdm_channel_dispatches.id"), nullable=True, index=True)
    claim_id = Column(String(50), ForeignKey("scdm_claims.id"), nullable=True, index=True)

    line_type = Column(String(50), nullable=False, default="Dispatch")  # Dispatch, ClaimDeduction, TaxAdjustment
    amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
