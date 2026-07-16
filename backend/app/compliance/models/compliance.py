"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.base import BaseEntity


class GovernmentService(BaseEntity):
    """
    Represents external compliance services discovered/configured in the system.
    """
    __tablename__ = "government_services"

    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    provider = Column(String(100), nullable=False)
    api_version = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)  # ACTIVE, DISABLED, DEPRECATED
    display_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    environments = Column(Text, nullable=True)  # Serialized JSON configuration
    capabilities = Column(Text, nullable=True)  # Comma-separated or JSON list of capabilities

class ComplianceCredentials(BaseEntity):
    """
    Encrypted credentials for accessing external government/compliance services.
    Scoped by company and branch.
    """
    __tablename__ = "compliance_credentials"

    service_id = Column(
        String(50),
        ForeignKey("government_services.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    encrypted_username = Column(Text, nullable=False)
    encrypted_password = Column(Text, nullable=False)
    encrypted_client_secret = Column(Text, nullable=True)

class ComplianceAuditLog(BaseEntity):
    """
    Audit log record for tracking request and response payloads with external compliance APIs.
    """
    __tablename__ = "compliance_audit_logs"

    service_id = Column(String(50), nullable=False, index=True)
    endpoint = Column(String(255), nullable=False)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)
    status_code = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class ComplianceOutbox(BaseEntity):
    """
    Transactional outbox for queued/retrying compliance events.
    Guarantees reliability using the Outbox pattern.
    """
    __tablename__ = "compliance_outboxes"

    service_id = Column(String(50), nullable=False, index=True)
    state = Column(String(50), nullable=False)  # DRAFT, VALIDATED, QUEUED, etc.
    action = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
