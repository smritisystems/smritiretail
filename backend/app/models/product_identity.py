"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class BarcodeProvider(BaseEntity):
    """Barcode provider and pool configuration."""
    __tablename__ = "barcode_providers"

    name = Column(String(100), nullable=False)
    provider_type = Column(String(50), nullable=False)
    pool_code = Column(String(100), nullable=True)
    priority = Column(Integer, default=100)
    config = Column(JSONB, server_default="'{}'::jsonb", default=dict)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)


class IdentityRule(BaseEntity):
    """Rule definition used for business key and fingerprint evaluation."""
    __tablename__ = "identity_rules"

    name = Column(String(150), nullable=False)
    code = Column(String(100), nullable=False, unique=True, index=True)
    scope = Column(JSONB, server_default="'{}'::jsonb", default=dict)
    expression = Column(Text, nullable=False)
    priority = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)


class ProductIdentity(BaseEntity):
    """Identity record for a product SKU and barcode lifecycle state."""
    __tablename__ = "product_identities"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    business_key = Column(String(255), nullable=False, index=True)
    fingerprint = Column(String(255), nullable=False, unique=True)
    barcode = Column(String(100), nullable=False, index=True)
    barcode_provider_id = Column(String(50), ForeignKey("barcode_providers.id", ondelete="SET NULL"), nullable=True)
    state = Column(String(50), nullable=False, default="Available")
    identity_metadata = Column(JSONB, server_default="'{}'::jsonb", default=dict)
    rule_id = Column(String(50), ForeignKey("identity_rules.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("company_id", "branch_id", "product_id", "business_key", name="uq_product_identity_business_key"),
        UniqueConstraint("company_id", "branch_id", "barcode", name="uq_product_identity_barcode"),
    )
