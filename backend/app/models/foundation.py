"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: ADR-015 — SMRITI Foundation Platform v3.0 ORM Models

foundation.py — All 10 Foundation Platform Engine ORM Models:
  1. Identity Engine    : SmritiEntityRegistry
  2. Address Engine     : SmritiAddress
  3. Contact Engine     : SmritiContact
  4. Bank Engine        : SmritiBank (master), SmritiBankAccount
  5. Communication      : SmritiCommChannel
  6. Settings Engine    : SmritiSetting
  7. Branding Engine    : SmritiTheme, SmritiThemeVariant, SmritiBranding, SmritiReportTemplate
  8. Audit Engine       : SmritiAuditLog
  (Document Engine reuses attachment.py — DocumentModel + AttachmentModel)
  (Notification Engine reuses notification.py — existing tables)
"""

from datetime import datetime, timezone
import uuid as uuid_pkg
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, SmallInteger,
    Numeric, Text, ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from ..db.base import Base


def _uuid() -> str:
    return str(uuid_pkg.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 1: IDENTITY — SmritiEntityRegistry
# Central anchor for all Foundation Engine polymorphic relationships.
# Every addressable business entity registers here before using any engine.
# ─────────────────────────────────────────────────────────────────────────────
class SmritiEntityRegistry(Base):
    """
    ADR-015 Identity Engine.
    Single parent for all Foundation Engine FK relationships, replacing the
    fragile owner_type + owner_id string pattern with enforced referential integrity.
    """
    __tablename__ = "smriti_entity_registry"

    id           = Column(String(50), primary_key=True, default=_uuid)
    tenant_id    = Column(String(50), nullable=False, index=True)
    entity_type  = Column(String(30), nullable=False, index=True)
    # COMPANY | BRANCH | WAREHOUSE | CUSTOMER | SUPPLIER | EMPLOYEE | LEAD | VENDOR | FRANCHISE
    source_table = Column(String(100), nullable=False)  # "companies", "branches", "customers"
    source_id    = Column(String(50), nullable=False)   # PK in the source table
    display_name = Column(String(255), nullable=False)  # denormalized for audit log display
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at  = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("entity_type", "source_id", name="uq_entity_source"),
        Index("idx_entity_registry_tenant",      "tenant_id"),
        Index("idx_entity_registry_type",        "entity_type"),
        Index("idx_entity_registry_source",      "source_table", "source_id"),
    )

    # Relationships
    addresses      = relationship("SmritiAddress",     back_populates="entity", cascade="all, delete-orphan")
    contacts       = relationship("SmritiContact",     back_populates="entity", cascade="all, delete-orphan")
    bank_accounts  = relationship("SmritiBankAccount", back_populates="entity", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 2: ADDRESS — SmritiAddress
# ─────────────────────────────────────────────────────────────────────────────
class SmritiAddress(Base):
    """
    ADR-015 Address Engine.
    Universal address table for any entity type. Includes logistics fields
    (geo_region, tax_region, delivery_zone, route_code) added in v3.0.
    """
    __tablename__ = "smriti_addresses"

    id           = Column(String(50), primary_key=True, default=_uuid)
    tenant_id    = Column(String(50), nullable=False, index=True)
    entity_id    = Column(String(50), ForeignKey("smriti_entity_registry.id", ondelete="RESTRICT"), nullable=False)
    address_type = Column(String(30), nullable=False, default="REGISTERED")
    # REGISTERED | CORPORATE_HQ | BILLING | SHIPPING | FACTORY | GODOWN | HOME | DELIVERY | SITE
    is_primary   = Column(Boolean, nullable=False, default=False)

    # Core
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    landmark      = Column(String(255), nullable=True)
    city          = Column(String(100), nullable=False)
    district      = Column(String(100), nullable=True)
    state_code    = Column(String(2),   nullable=False)   # GST state code 01-38
    state_name    = Column(String(100), nullable=False)   # denormalized for PDF
    pincode       = Column(String(10),  nullable=False)
    country_code  = Column(String(2),   nullable=False, default="IN")

    # Geospatial
    latitude      = Column(Numeric(10, 7), nullable=True)
    longitude     = Column(Numeric(10, 7), nullable=True)
    plus_code     = Column(String(20), nullable=True)     # Google Plus Code

    # Logistics (v3.0)
    geo_region            = Column(String(50), nullable=True)   # NORTH|SOUTH|EAST|WEST|CENTRAL|NORTHEAST
    tax_region            = Column(String(50), nullable=True)   # Multi-state tax zone mapping
    delivery_zone         = Column(String(50), nullable=True)   # ZONE_A|ZONE_B|LOCAL|OUTSTATION
    route_code            = Column(String(20), nullable=True)   # Dispatch route for logistics
    default_warehouse_id  = Column(String(50), nullable=True)   # Soft ref — no hard FK (future)
    delivery_instructions = Column(Text, nullable=True)

    is_verified   = Column(Boolean, nullable=False, default=False)
    verified_at   = Column(DateTime(timezone=True), nullable=True)
    is_active     = Column(Boolean, nullable=False, default=True)
    created_at    = Column(DateTime(timezone=True), nullable=False, default=_now)
    created_by    = Column(String(50), nullable=True)
    modified_at   = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    modified_by   = Column(String(50), nullable=True)

    __table_args__ = (
        Index("idx_addr_entity",        "entity_id"),
        Index("idx_addr_tenant_type",   "tenant_id", "address_type"),
        Index("idx_addr_pincode",       "pincode"),
        Index("idx_addr_delivery_zone", "delivery_zone"),
    )

    entity = relationship("SmritiEntityRegistry", back_populates="addresses")


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 3: CONTACT — SmritiContact
# ─────────────────────────────────────────────────────────────────────────────
class SmritiContact(Base):
    """
    ADR-015 Contact Engine.
    Universal contact table. Includes preferred_language, preferred_channel,
    working_hours_json, is_emergency_contact, notification_pref_json (v3.0).
    """
    __tablename__ = "smriti_contacts"

    id           = Column(String(50), primary_key=True, default=_uuid)
    tenant_id    = Column(String(50), nullable=False, index=True)
    entity_id    = Column(String(50), ForeignKey("smriti_entity_registry.id", ondelete="RESTRICT"), nullable=False)
    contact_role = Column(String(50), nullable=False)
    # CEO|CFO|GST_SIGNATORY|ACCOUNTS|IT_CONTACT|SUPPORT|BILLING|SALES_CONTACT|PURCHASE_CONTACT|PRIMARY|LEGAL

    # Identity
    salutation   = Column(String(10),  nullable=True)
    first_name   = Column(String(100), nullable=False)
    last_name    = Column(String(100), nullable=True)
    designation  = Column(String(100), nullable=True)
    department   = Column(String(100), nullable=True)

    # Communication
    email        = Column(String(255), nullable=True, index=True)
    mobile       = Column(String(20),  nullable=True, index=True)
    phone_office = Column(String(20),  nullable=True)
    phone_ext    = Column(String(10),  nullable=True)
    whatsapp     = Column(String(20),  nullable=True)
    linkedin_url = Column(String(255), nullable=True)

    # Enrichment (v3.0)
    preferred_language     = Column(String(10),  nullable=True, default="en-IN")
    preferred_channel      = Column(String(20),  nullable=True, default="EMAIL")
    # EMAIL|SMS|WHATSAPP|PHONE
    working_hours_json     = Column(JSONB, nullable=True)
    # {"mon_fri": "09:00-18:00", "sat": "09:00-14:00", "timezone": "Asia/Kolkata"}
    is_emergency_contact   = Column(Boolean, nullable=False, default=False)
    notification_pref_json = Column(JSONB, nullable=True)
    # {"invoice_sent": ["EMAIL","WHATSAPP"], "payment_reminder": ["SMS"]}

    is_primary   = Column(Boolean, nullable=False, default=False)
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at  = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_contact_entity", "entity_id"),
        Index("idx_contact_email",  "email"),
        Index("idx_contact_mobile", "mobile"),
    )

    entity = relationship("SmritiEntityRegistry", back_populates="contacts")


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 4A: BANK MASTER — SmritiBank
# ─────────────────────────────────────────────────────────────────────────────
class SmritiBank(Base):
    """
    ADR-015 Bank Master.
    Single source of truth for bank metadata. Eliminates repeated bank name typing.
    Seeded with all major Indian banks on migration.
    """
    __tablename__ = "smriti_banks"

    id              = Column(String(50), primary_key=True, default=_uuid)
    bank_code       = Column(String(10),  nullable=False, unique=True, index=True)
    bank_name       = Column(String(255), nullable=False)
    bank_name_short = Column(String(50),  nullable=False)
    ifsc_prefix     = Column(String(4),   nullable=True)   # First 4 chars of IFSC
    swift_bic       = Column(String(11),  nullable=True)
    country_code    = Column(String(2),   nullable=False, default="IN")
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), nullable=False, default=_now)

    accounts = relationship("SmritiBankAccount", back_populates="bank")


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 4B: BANK ACCOUNTS — SmritiBankAccount
# ─────────────────────────────────────────────────────────────────────────────
class SmritiBankAccount(Base):
    """
    ADR-015 Bank Account Engine.
    Universal bank accounts — entity_id owns the account (COMPANY|SUPPLIER|EMPLOYEE).
    account_number_enc: AES-256 encrypted; NEVER returned in API responses.
    account_number_masked: always ****{last4}; safe for API responses.
    """
    __tablename__ = "smriti_bank_accounts"

    id                    = Column(String(50), primary_key=True, default=_uuid)
    tenant_id             = Column(String(50), nullable=False, index=True)
    entity_id             = Column(String(50), ForeignKey("smriti_entity_registry.id", ondelete="RESTRICT"), nullable=False)
    bank_id               = Column(String(50), ForeignKey("smriti_banks.id", ondelete="RESTRICT"), nullable=True)

    account_nickname      = Column(String(100), nullable=False)
    account_number_masked = Column(String(30),  nullable=False)    # ****1234 — safe to return
    account_number_enc    = Column(String(500), nullable=False)    # AES-256 encrypted — NEVER in API
    account_type          = Column(String(30),  nullable=False, default="CURRENT")
    # CURRENT|SAVINGS|OVERDRAFT|CASH_CREDIT|ESCROW
    ifsc_code             = Column(String(11),  nullable=False)
    micr_code             = Column(String(9),   nullable=True)
    swift_code            = Column(String(11),  nullable=True)
    iban                  = Column(String(34),  nullable=True)
    upi_id                = Column(String(100), nullable=True)
    currency_code         = Column(String(3),   nullable=False, default="INR")

    is_default_receipts   = Column(Boolean, nullable=False, default=False)
    is_default_payments   = Column(Boolean, nullable=False, default=False)
    is_active             = Column(Boolean, nullable=False, default=True)
    created_at            = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at           = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_bank_acct_entity", "entity_id"),
        Index("idx_bank_acct_tenant", "tenant_id"),
    )

    entity = relationship("SmritiEntityRegistry", back_populates="bank_accounts")
    bank   = relationship("SmritiBank", back_populates="accounts")


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 5: COMMUNICATION — SmritiCommChannel
# ─────────────────────────────────────────────────────────────────────────────
class SmritiCommChannel(Base):
    """
    ADR-015 Communication Engine.
    Unified SMTP/SMS/WhatsApp/Push configuration with health monitoring (v3.0).
    config_json_enc: AES-256 encrypted channel-specific JSON blob. NEVER in API responses.
    """
    __tablename__ = "smriti_comm_channels"

    id           = Column(String(50), primary_key=True, default=_uuid)
    tenant_id    = Column(String(50), nullable=False, index=True)
    company_id   = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    channel_type = Column(String(30), nullable=False)
    # SMTP|SMS|WHATSAPP|PUSH_NOTIFICATION|WEBHOOK_API|IN_APP
    provider     = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)

    # Encrypted config blob (NEVER returned in API)
    config_json_enc = Column(Text, nullable=False)

    is_active  = Column(Boolean, nullable=False, default=False)
    is_default = Column(Boolean, nullable=False, default=False)

    # Health Monitoring (v3.0)
    last_success_at      = Column(DateTime(timezone=True), nullable=True)
    last_failure_at      = Column(DateTime(timezone=True), nullable=True)
    consecutive_failures = Column(SmallInteger, nullable=False, default=0)
    health_status        = Column(String(20), nullable=False, default="UNCHECKED")
    # HEALTHY|DEGRADED|FAILED|UNCHECKED
    retry_policy_json    = Column(JSONB, nullable=True)
    # {"max_retries": 3, "backoff_seconds": [30, 120, 300], "strategy": "EXPONENTIAL"}
    rate_limit_per_hour  = Column(Integer, nullable=True)
    sent_this_hour       = Column(Integer, nullable=False, default=0)
    hour_window_start    = Column(DateTime(timezone=True), nullable=True)

    last_tested_at     = Column(DateTime(timezone=True), nullable=True)
    last_test_status   = Column(String(20), nullable=True)    # SUCCESS|FAILED|PENDING
    last_test_error    = Column(Text, nullable=True)

    created_at  = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_comm_company_type", "company_id", "channel_type"),
        Index("idx_comm_health",       "health_status"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 6: SETTINGS — SmritiSetting
# ─────────────────────────────────────────────────────────────────────────────
class SmritiSetting(Base):
    """
    ADR-015 Settings Engine.
    Metadata-driven key/value settings with self-validation (v3.0).
    Extends the existing SystemConfig pattern to support COMPANY|BRANCH|USER scope.
    validation_regex, minimum_value, maximum_value, allowed_values_json make
    each setting row self-validating — no hardcoded validation in service code.
    """
    __tablename__ = "smriti_settings"

    id           = Column(String(50), primary_key=True, default=_uuid)
    tenant_id    = Column(String(50), nullable=True)
    owner_type   = Column(String(20), nullable=False, default="COMPANY")
    # SYSTEM|COMPANY|BRANCH|USER
    owner_id     = Column(String(50), nullable=True)   # NULL for SYSTEM scope
    setting_key  = Column(String(100), nullable=False)
    setting_value = Column(Text, nullable=False)
    data_type    = Column(String(20), nullable=False, default="STRING")
    # STRING|INTEGER|BOOLEAN|DECIMAL|JSON|DATE|ENUM|URL|EMAIL|COLOR

    # Classification
    category      = Column(String(50), nullable=False, default="General")
    display_label = Column(String(100), nullable=True)
    help_text     = Column(Text, nullable=True)
    sort_order    = Column(SmallInteger, nullable=False, default=0)

    # Self-Validation (v3.0)
    validation_regex    = Column(String(500), nullable=True)
    minimum_value       = Column(Numeric(20, 6), nullable=True)
    maximum_value       = Column(Numeric(20, 6), nullable=True)
    allowed_values_json = Column(JSONB, nullable=True)  # ["OPT_A", "OPT_B"] for ENUM

    is_encrypted    = Column(Boolean, nullable=False, default=False)
    is_readonly     = Column(Boolean, nullable=False, default=False)
    is_visible_in_ui = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at     = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("owner_type", "owner_id", "setting_key", name="uq_setting_owner_key"),
        Index("idx_settings_owner",    "owner_type", "owner_id"),
        Index("idx_settings_category", "category"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 7: BRANDING — SmritiTheme, SmritiThemeVariant, SmritiBranding, SmritiReportTemplate
# ─────────────────────────────────────────────────────────────────────────────
class SmritiTheme(Base):
    """ADR-015 Branding Engine — Theme identity (icon pack, illustration set, fonts)."""
    __tablename__ = "smriti_themes"

    id               = Column(String(50), primary_key=True, default=_uuid)
    tenant_id        = Column(String(50), nullable=True)
    company_id       = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    theme_name       = Column(String(100), nullable=False, default="Default")
    icon_pack        = Column(String(50), nullable=True, default="lucide")
    illustration_set = Column(String(50), nullable=True, default="smriti_default")
    font_heading     = Column(String(100), nullable=True, default="Inter")
    font_body        = Column(String(100), nullable=True, default="Inter")
    border_radius_px = Column(SmallInteger, nullable=True, default=8)
    is_active        = Column(Boolean, nullable=False, default=True)
    created_at       = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at      = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    variants = relationship("SmritiThemeVariant", back_populates="theme", cascade="all, delete-orphan")


class SmritiThemeVariant(Base):
    """ADR-015 Branding Engine — LIGHT / DARK / HIGH_CONTRAST / PRINT per theme."""
    __tablename__ = "smriti_theme_variants"

    id               = Column(String(50), primary_key=True, default=_uuid)
    theme_id         = Column(String(50), ForeignKey("smriti_themes.id", ondelete="CASCADE"), nullable=False)
    variant          = Column(String(20), nullable=False)   # LIGHT|DARK|HIGH_CONTRAST|PRINT
    primary_color    = Column(String(7), nullable=False, default="#2563EB")
    secondary_color  = Column(String(7), nullable=False, default="#64748B")
    accent_color     = Column(String(7), nullable=False, default="#0EA5E9")
    background_color = Column(String(7), nullable=False, default="#FFFFFF")
    surface_color    = Column(String(7), nullable=False, default="#F8FAFC")
    text_primary     = Column(String(7), nullable=False, default="#0F172A")
    text_secondary   = Column(String(7), nullable=False, default="#475569")
    border_color     = Column(String(7), nullable=False, default="#E2E8F0")
    danger_color     = Column(String(7), nullable=False, default="#EF4444")
    success_color    = Column(String(7), nullable=False, default="#22C55E")
    warning_color    = Column(String(7), nullable=False, default="#F59E0B")
    is_default       = Column(Boolean, nullable=False, default=False)
    created_at       = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        UniqueConstraint("theme_id", "variant", name="uq_theme_variant"),
    )

    theme = relationship("SmritiTheme", back_populates="variants")


class SmritiBranding(Base):
    """ADR-015 Branding Engine — Asset rows (LOGO_PRIMARY, FAVICON, SIGNATURE, STAMP_SEAL, etc.)."""
    __tablename__ = "smriti_branding"

    id              = Column(String(50), primary_key=True, default=_uuid)
    tenant_id       = Column(String(50), nullable=True)
    company_id      = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    asset_type      = Column(String(30), nullable=False)
    # LOGO_PRIMARY|LOGO_WHITE|LOGO_DARK|FAVICON|WATERMARK|SIGNATURE|STAMP_SEAL|REPORT_BANNER
    file_url        = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    width_px        = Column(Integer, nullable=True)
    height_px       = Column(Integer, nullable=True)
    mime_type       = Column(String(50), nullable=True)
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        Index("idx_branding_company_type", "company_id", "asset_type"),
    )


class SmritiReportTemplate(Base):
    """ADR-015 Branding Engine — HTML print templates per document type."""
    __tablename__ = "smriti_report_templates"

    id            = Column(String(50), primary_key=True, default=_uuid)
    tenant_id     = Column(String(50), nullable=True)
    company_id    = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    template_type = Column(String(50), nullable=False)
    # INVOICE|CREDIT_NOTE|PURCHASE_ORDER|QUOTATION|DELIVERY_CHALLAN|PAYMENT_RECEIPT|SALARY_SLIP|GSTR1_REPORT
    header_html   = Column(Text, nullable=True)
    footer_html   = Column(Text, nullable=True)
    css_override  = Column(Text, nullable=True)
    is_default    = Column(Boolean, nullable=False, default=False)
    created_at    = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at   = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_rpt_tpl_company_type", "company_id", "template_type"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 8 (SOCIAL): SmritiSocialProfile
# ─────────────────────────────────────────────────────────────────────────────
class SmritiSocialProfile(Base):
    """
    ADR-015 Social Engine.
    Row-per-platform pattern instead of fixed columns (platform + url rows).
    Adding new platforms (TikTok, IndiaMART) = INSERT, never schema migration.
    """
    __tablename__ = "smriti_social_profiles"

    id           = Column(String(50), primary_key=True, default=_uuid)
    company_id   = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    platform     = Column(String(30), nullable=False)
    # WEBSITE|LINKEDIN|TWITTER_X|FACEBOOK|INSTAGRAM|YOUTUBE|GOOGLE_MAPS|GOOGLE_BUSINESS|JUSTDIAL|INDIAMART
    url          = Column(String(500), nullable=False)
    display_text = Column(String(100), nullable=True)
    is_active    = Column(Boolean, nullable=False, default=True)
    sort_order   = Column(SmallInteger, nullable=False, default=0)
    created_at   = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        Index("idx_social_company", "company_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 9 (AUDIT): SmritiAuditLog — INSERT-ONLY, SHA-256 hash-chained
# ─────────────────────────────────────────────────────────────────────────────
class SmritiAuditLog(Base):
    """
    ADR-015 Universal Foundation Audit Engine.
    INSERT-ONLY — no UPDATE or DELETE method is exposed in AuditRepository.
    Every Foundation Engine write + every Company master field change is recorded here.
    Hash-chained per AOP-006 using SHA-256(prev_hash + changed_table + record_id + field + new_value + changed_at).
    """
    __tablename__ = "smriti_audit_log"

    id                = Column(String(50), primary_key=True, default=_uuid)
    tenant_id         = Column(String(50), nullable=False)

    # What changed
    entity_id         = Column(String(50), nullable=True)  # smriti_entity_registry.id (if applicable)
    changed_table     = Column(String(100), nullable=False)
    changed_record_id = Column(String(50),  nullable=False)
    field_name        = Column(String(100), nullable=False)
    old_value         = Column(Text, nullable=True)
    new_value         = Column(Text, nullable=True)
    change_type       = Column(String(20), nullable=False, default="UPDATE")
    # CREATE|UPDATE|DELETE|SOFT_DELETE|ACTIVATE|DEACTIVATE|TEST|VERIFY

    # Why it changed
    change_reason = Column(Text, nullable=True)
    change_source = Column(String(20), nullable=False, default="UI")
    # UI|API|SYSTEM|MIGRATION|IMPORT

    # Who changed (AOP-006)
    changed_by       = Column(String(50),  nullable=False)
    changed_by_name  = Column(String(255), nullable=False)   # denormalized — preserved on user delete
    changed_at       = Column(DateTime(timezone=True), nullable=False, default=_now)
    ip_address       = Column(String(45),  nullable=True)
    session_id       = Column(String(100), nullable=True)
    trace_id         = Column(String(100), nullable=True)    # AOP-006 propagation
    correlation_id   = Column(String(100), nullable=True)

    # Hash chain (AOP-006)
    sha256_hash = Column(String(64), nullable=False)
    prev_hash   = Column(String(64), nullable=True)   # NULL for first record per entity

    __table_args__ = (
        Index("idx_audit_tenant",    "tenant_id"),
        Index("idx_audit_entity",    "entity_id"),
        Index("idx_audit_table",     "changed_table", "changed_record_id"),
        Index("idx_audit_user",      "changed_by"),
        Index("idx_audit_timestamp", "changed_at"),
    )
