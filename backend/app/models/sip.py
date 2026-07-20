"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.47.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import BaseEntity


class UniversalIdentityRegistry(BaseEntity):
    """
    Central enterprise identity registry providing global uniqueness and cross-domain identity lookup.
    """
    __tablename__ = "smriti_universal_identities"

    domain = Column(String(50), nullable=False, index=True)  # PRODUCT, CUSTOMER, SUPPLIER, WAREHOUSE, ASSET, EMPLOYEE, VOUCHER, BATCH, SERIAL
    entity_id = Column(String(50), nullable=False, index=True)
    business_key = Column(String(255), nullable=False, unique=True, index=True)
    identity_hash = Column(String(64), nullable=False, index=True)
    
    identifier_standard = Column(String(30), nullable=False, default="GS1")  # GS1, GTIN, EAN, UPC, ISBN, UDI, INTERNAL, CUSTOM
    barcode_value = Column(String(100), nullable=True, index=True)
    digital_link_uri = Column(Text, nullable=True)
    sgtin96_hex = Column(String(32), nullable=True)
    
    # Federation fields
    external_identity = Column(String(100), nullable=True, index=True)
    source_system = Column(String(100), nullable=True)
    master_record_id = Column(String(50), nullable=True)
    canonical_id = Column(String(50), nullable=True)
    merge_status = Column(String(30), default="UNMERGED")  # UNMERGED | MERGED | SPLIT
    
    rule_id = Column(String(50), ForeignKey("smriti_identity_rules.id", ondelete="SET NULL"), nullable=True)
    rule_version = Column(Integer, default=1)
    status = Column(String(30), default="ACTIVE", index=True)  # ACTIVE | REPLACED | DEPRECATED | ARCHIVED


class SIPIdentityRule(BaseEntity):
    """
    Governs identity generation rules with version history and 8-stage lifecycle governance FSM.
    """
    __tablename__ = "smriti_identity_rules"

    name = Column(String(150), nullable=False)
    code = Column(String(100), nullable=False, unique=True, index=True)
    domain = Column(String(50), nullable=False, index=True)
    version = Column(Integer, default=1)
    
    lifecycle_state = Column(String(30), default="DRAFT", index=True)
    # DRAFT | REVIEW | APPROVED | SIMULATION | PILOT | PRODUCTION | DEPRECATED | ARCHIVED
    
    pattern_template = Column(String(255), nullable=False)
    identifier_standard = Column(String(30), default="GS1")
    priority = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)


class SIPIdentityRuleVersion(BaseEntity):
    """
    Audit ledger tracking immutable rule version iterations and rollback snapshots.
    """
    __tablename__ = "smriti_identity_rule_versions"

    rule_id = Column(String(50), ForeignKey("smriti_identity_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    pattern_template = Column(String(255), nullable=False)
    lifecycle_state = Column(String(30), nullable=False)
    change_summary = Column(Text, nullable=True)


class SIPIdentityOutbox(BaseEntity):
    """
    Transactional outbox for reliable event publication across domain identity life events.
    """
    __tablename__ = "smriti_identity_outbox"

    event_type = Column(String(100), nullable=False, index=True)
    # IdentityRegistered | IdentityUpdated | RuleActivated | RuleDeprecated | SimulationCompleted | HealthCheckCompleted
    
    aggregate_type = Column(String(50), nullable=False, default="UniversalIdentity")
    aggregate_id = Column(String(50), nullable=False)
    payload = Column(JSONB, nullable=False, default=dict)
    
    status = Column(String(30), default="PENDING", index=True)  # PENDING | PUBLISHED | FAILED
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
