"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Integration Hub Connector Registry Models (smritisys Control Plane).
Blueprint ss45: integration_registry, connector_registry, provider_registry,
               integration_credentials_reference, integration_policies,
               integration_versions.

Blueprint Rule 08: Integration Hub definitions belong in smritisys.
Blueprint Rule 09: Credentials are references only -- no secrets stored.
Blueprint Rule 10: smriti-api is the execution layer.
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import Base


class ProviderRegistry(Base):
    """
    Canonical catalogue of external providers (GST portal, payment gateways,
    eCommerce channels, accounting ERPs, communication providers).
    Stored in smritisys Control Plane.
    """
    __tablename__ = "provider_registry"

    id = Column(String(50), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

    code = Column(String(100), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    provider_category = Column(String(50), nullable=False)   # GOVERNMENT | PAYMENT | ECOMMERCE | ACCOUNTING | COMMUNICATION | LOGISTICS
    provider_type = Column(String(50), nullable=False)       # GST | PAYMENT_GATEWAY | MARKETPLACE | ERP | SMS | EMAIL | WHATSAPP | COURIER
    homepage_url = Column(String(500), nullable=True)
    docs_url = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    supported_auth_types = Column(JSONB, nullable=False, default=[])   # API_KEY | OAUTH2 | BASIC | CERTIFICATE
    supported_environments = Column(JSONB, nullable=False, default=["SANDBOX", "PRODUCTION"])
    capabilities_required = Column(JSONB, nullable=False, default=[])
    metadata_schema = Column(JSONB, nullable=False, default={})
    status = Column(String(30), nullable=False, default="ACTIVE")


class ConnectorRegistry(Base):
    """
    Connector type definitions that implement communication with providers.
    Defines protocol, direction, retry policy, and configuration schema.
    Stored in smritisys Control Plane — not executable code.
    """
    __tablename__ = "connector_registry"

    id = Column(String(50), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

    code = Column(String(100), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    provider_code = Column(String(100), nullable=False)
    connector_type = Column(String(50), nullable=False)      # TALLY | GST_EINVOICE | EWAY_BILL | SHOPIFY | WOOCOMMERCE | RAZORPAY | STRIPE | TWILIO | SENDGRID | WHATSAPP
    protocol = Column(String(30), nullable=False, default="REST")        # REST | SOAP | XML | WEBHOOK | SFTP | DATABASE
    direction = Column(String(20), nullable=False, default="OUTBOUND")   # OUTBOUND | INBOUND | BIDIRECTIONAL
    event_triggers = Column(JSONB, nullable=False, default=[])
    config_schema = Column(JSONB, nullable=False, default={})
    retry_policy = Column(JSONB, nullable=False, default={"max_attempts": 3, "backoff": "EXPONENTIAL"})
    timeout_seconds = Column(Integer, nullable=False, default=30)
    status = Column(String(30), nullable=False, default="ACTIVE")


class IntegrationRegistry(Base):
    """
    Named integration instances linking business events to connectors.
    Defines what SMRITI integrates with, not how the integration executes.
    Stored in smritisys Control Plane. Execution is in smriti-api services.
    """
    __tablename__ = "integration_registry"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)

    code = Column(String(100), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    connector_code = Column(String(100), nullable=False)
    provider_code = Column(String(100), nullable=False)
    integration_category = Column(String(50), nullable=False)    # GOVERNMENT | PAYMENT | ECOMMERCE | ACCOUNTING | COMMUNICATION | LOGISTICS
    direction = Column(String(20), nullable=False, default="OUTBOUND")
    trigger_mode = Column(String(30), nullable=False, default="EVENT")   # EVENT | SCHEDULED | ON_DEMAND | WEBHOOK
    outbox_event_types = Column(JSONB, nullable=False, default=[])
    config_defaults = Column(JSONB, nullable=False, default={})
    uses_outbox = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="ACTIVE")


class IntegrationCredentialReference(Base):
    """
    References to credentials for integrations.
    ONLY stores the pointer (env var name or secret manager path).
    Actual credential values are NEVER stored in smritisys or smritiXXX.
    Blueprint Rule 09: No executable business logic or secrets in smritisys.
    """
    __tablename__ = "integration_credentials_reference"

    id = Column(String(50), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

    integration_code = Column(String(100), nullable=False)
    credential_key = Column(String(200), nullable=False)     # e.g. "api_key", "client_id", "client_secret"
    credential_type = Column(String(50), nullable=False)     # API_KEY | OAUTH_CLIENT | CERTIFICATE | BASIC_AUTH
    env_var_name = Column(String(200), nullable=True)        # Environment variable name holding the credential
    secret_manager_path = Column(String(500), nullable=True) # Secret manager key path
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("integration_code", "credential_key", name="uq_int_cred_key"),
    )


class IntegrationPolicy(Base):
    """
    Per-integration policy definitions (rate limiting, retry windows,
    error escalation, data filtering policies).
    Stored in smritisys as governed metadata, not executable code.
    """
    __tablename__ = "integration_policies"

    id = Column(String(50), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

    code = Column(String(100), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    integration_code = Column(String(100), nullable=True)    # None = global platform policy
    policy_type = Column(String(50), nullable=False)         # RATE_LIMIT | RETRY_WINDOW | ERROR_ESCALATION | DATA_FILTER | SCHEDULE
    policy_definition = Column(JSONB, nullable=False)
    status = Column(String(30), nullable=False, default="ACTIVE")


class IntegrationVersion(Base):
    """
    Version lineage tracking for integration definitions.
    Blueprint Rule 23: Version all governed metadata.
    """
    __tablename__ = "integration_versions"

    id = Column(String(50), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    integration_code = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False)
    changelog = Column(Text, nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="DRAFT")   # DRAFT | ACTIVE | DEPRECATED

    __table_args__ = (
        UniqueConstraint("integration_code", "version", name="uq_int_version"),
    )
