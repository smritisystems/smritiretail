"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class FormulaDefinition(BaseEntity):
    """
    Centralized, versioned mathematical and KPI formula definition in Control Plane (smritisys).
    No arbitrary executable code; uses structured JSON AST for deterministic calculation.
    """
    __tablename__ = "formula_definitions"

    code = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # PRICING, GST_TAX, DISCOUNT, LOYALTY, COMMISSION, PROFITABILITY
    description = Column(Text, nullable=True)
    expression_ast = Column(JSONB, nullable=False)  # Structured AST e.g. {"op": "add", "left": "base_price", "right": "tax"}
    parameters_schema = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))  # Parameter types and constraints
    is_active = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="ACTIVE")  # DRAFT, ACTIVE, DEPRECATED, ARCHIVED

    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_formula_code_version"),
        Index("ix_formula_cat_status", "category", "status"),
    )


class BusinessRuleDefinition(BaseEntity):
    """
    Centralized, versioned declarative business rules (smritisys).
    Encodes conditions and actions for discounts, promotions, return windows, credit limits.
    """
    __tablename__ = "business_rule_definitions"

    code = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    rule_type = Column(String(50), nullable=False)  # DISCOUNT_RULE, PROMOTION_RULE, RETURN_POLICY, CREDIT_LIMIT
    priority = Column(Integer, nullable=False, default=100)
    conditions = Column(JSONB, nullable=False)  # Condition tree: {"all": [...], "any": [...]}
    actions = Column(JSONB, nullable=False)  # Action definitions: [{"type": "APPLY_DISCOUNT_PERCENT", "value": 10}]
    scopes = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))  # Applicability scopes (channels, tiers)
    is_active = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="ACTIVE")

    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_business_rule_code_version"),
        Index("ix_brule_type_status", "rule_type", "status"),
    )


class PolicyDefinition(BaseEntity):
    """
    Centralized, versioned statutory, compliance, and governance policy definitions (smritisys).
    Encodes GST calculation rules, invoice return windows, rounding policies, cancellation limits.
    """
    __tablename__ = "policy_definitions"

    code = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    policy_type = Column(String(50), nullable=False)  # GST_TAX_POLICY, RETURN_POLICY, ROUNDING_POLICY, APPROVAL_POLICY
    parameters = Column(JSONB, nullable=False)  # Policy configuration parameters
    is_active = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="ACTIVE")

    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_policy_code_version"),
        Index("ix_policy_type_status", "policy_type", "status"),
    )


class WorkflowDefinition(BaseEntity):
    """
    Centralized, versioned state machine and document approval workflow definitions (smritisys).
    Defines allowed states, transitions, required roles, and transition hooks.
    """
    __tablename__ = "workflow_definitions"

    code = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    doc_type = Column(String(50), nullable=False, index=True)  # SalesInvoice, PurchaseOrder, StockTransfer
    name = Column(String(200), nullable=False)
    initial_state = Column(String(50), nullable=False, default="DRAFT")
    states = Column(JSONB, nullable=False)  # List of valid states e.g. ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"]
    transitions = Column(JSONB, nullable=False)  # Transitions: [{"from": "DRAFT", "to": "APPROVED", "action": "APPROVE", "required_roles": ["MANAGER"]}]
    is_active = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="ACTIVE")

    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_workflow_code_version"),
        Index("ix_workflow_doc_status", "doc_type", "status"),
    )
