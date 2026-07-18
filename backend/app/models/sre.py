# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

from datetime import datetime, date
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, 
    Text, ForeignKey, Date, DateTime, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity, Base


class CorporateGstinRegistry(BaseEntity):
    """
    Corporate Multi-GSTIN Registrations per state boundaries.
    """
    __tablename__ = "corporate_gstin_registry"

    gstin          = Column(String(15), nullable=False, unique=True)
    state_code     = Column(String(2),  nullable=False) # e.g. '27' for Maharashtra
    warehouse_name = Column(String(100), nullable=False)


class SreRuleEngine(BaseEntity):
    """
    Compliance and tax timing rules matching dispatch transactions.
    """
    __tablename__ = "sre_rule_engine"

    dispatch_type          = Column(String(50), nullable=False, unique=True) # SALE_ON_APPROVAL, CONSIGNMENT_TRANSFER, BRANCH_TRANSFER
    tax_timing             = Column(String(20), nullable=False) # IMMEDIATE, DEFERRED
    max_deferral_days      = Column(Integer,    default=0)
    warning_buffer_days    = Column(Integer,    default=15)
    required_document_type = Column(String(30), nullable=False) # TAX_INVOICE, DELIVERY_CHALLAN


class SreStatutoryLedger(BaseEntity):
    """
    Immutable compliance log tracking dispatches and time limits.
    """
    __tablename__ = "sre_statutory_ledger"

    sku               = Column(String(50), nullable=False)
    batch_no          = Column(String(50), nullable=False)
    dispatch_id       = Column(String(50), nullable=False, index=True)

    origin_gstin_id   = Column(String(50), ForeignKey("corporate_gstin_registry.id", ondelete="RESTRICT"), nullable=False, index=True)
    destination_gstin = Column(String(15), nullable=False)

    total_qty         = Column(Numeric(12, 4), nullable=False, default=0.0000)
    approved_qty      = Column(Numeric(12, 4), nullable=False, default=0.0000)
    returned_qty      = Column(Numeric(12, 4), nullable=False, default=0.0000)
    unit_cost         = Column(Numeric(15, 2), nullable=False, default=0.00)
    gst_rate          = Column(Numeric(5, 2),  nullable=False, default=18.00)

    tax_type_applied          = Column(String(15), nullable=False) # CGST_SGST, IGST, DEFERRED
    statutory_state           = Column(String(30), nullable=False, default="TAX_DEFERRED") # TAX_DEFERRED, PARTIALLY_TAXED, FULLY_TAXED, DEEMED_SUPPLY_TRIGGERED, RETURNED_CLOSED
    dispatch_date             = Column(Date,       nullable=False, default=date.today)
    expiry_date               = Column(Date,       nullable=False)
    is_asset_on_balance_sheet = Column(Boolean,    default=True)

    # Relationships
    origin_gstin = relationship("CorporateGstinRegistry")


class SreComplianceDecision(BaseEntity):
    """
    Audit record logging core tax matching decisions.
    """
    __tablename__ = "sre_compliance_decisions"

    dispatch_id      = Column(String(50),  nullable=False, index=True)
    evaluated_rule   = Column(String(255), nullable=False)
    decision         = Column(String(255), nullable=False)
    reason           = Column(Text,        nullable=True)
    evaluated_at     = Column(DateTime,    nullable=False, default=datetime.utcnow)
    engine_version   = Column(String(20),  nullable=False, default="1.0.0")
