"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, text
from ..db.base import BaseEntity


class ComplianceImmutableAuditLog(BaseEntity):
    """
    Tamper-evident regulatory audit trail capturing financial transactions,
    security events, and master data modifications with cryptographic SHA-256
    hash-chaining and immutable WORM governance (Section 12).
    """
    __tablename__ = "compliance_immutable_audit_logs"

    event_type = Column(String(100), nullable=False, index=True)
    entity_name = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(100), nullable=False, index=True)
    actor_user_id = Column(String(100), nullable=True, index=True)
    actor_role = Column(String(50), nullable=True)
    ip_address = Column(String(50), nullable=True)
    before_state_json = Column(Text, nullable=True)
    after_state_json = Column(Text, nullable=True)
    action_summary = Column(Text, nullable=False)
    payload_hash = Column(String(64), nullable=False, index=True)  # SHA-256 Hex of current record + previous_hash
    previous_hash = Column(String(64), nullable=True, index=True)  # SHA-256 Hex of immediate predecessor block
    hash_chain_verified = Column(Boolean, nullable=False, default=True)  # Set to True on insertion
    request_id = Column(String(100), nullable=True, index=True)  # Ingress request correlation UUID
    client_user_agent = Column(String(255), nullable=True)  # Audit client / terminal identifier
    retention_policy = Column(String(50), nullable=False, default="STATUTORY_7_YEARS")  # WORM statutory period
    worm_locked = Column(Boolean, nullable=False, default=True)  # WORM immutable flag preventing modification
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

