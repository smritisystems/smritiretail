"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, Index, func
from ..db.base import BaseEntity


class SmritiIdentityRegistry(BaseEntity):
    """
    Central control-plane identity governance registry (Blueprint Section 12, 13).
    Defines how entity types are identified, structured, and scoped across the SMRITI platform.
    Does NOT store universal entity records; governs entity metadata and generation rules.
    """
    __tablename__ = "smriti_identity_registry"

    entity_type = Column(String(50), nullable=False, unique=True, index=True)  # e.g. ITEM, CUSTOMER, SALES_INVOICE
    entity_code = Column(String(20), nullable=False)                          # e.g. ITM, CUS, INV
    identity_group = Column(String(50), nullable=False, index=True)           # e.g. MASTER_DATA, SALES, REPORTING
    group_code = Column(String(10), nullable=False, index=True)               # e.g. MST, SAL, RPT, ORG
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Technical Identity Layer (Layer A)
    system_id_strategy = Column(String(50), nullable=False, default="UUIDv7")
    system_id_format = Column(String(50), nullable=False, default="UUID_HYPHENATED")
    system_id_immutable = Column(Boolean, default=True, nullable=False)

    # Human-Friendly Identity Code Layer (Layer D)
    identity_code_enabled = Column(Boolean, default=True, nullable=False)
    identity_code_format = Column(String(100), default="{group_code}-{entity_code}-{seq:08d}", nullable=False)
    identity_code_prefix = Column(String(30), nullable=False)                 # e.g. MST-ITM, SAL-INV
    identity_code_strategy = Column(String(50), default="SEQUENTIAL", nullable=False)
    identity_code_scope = Column(String(50), default="TENANT", nullable=False)  # GLOBAL, TENANT, COMPANY, BRANCH
    identity_code_immutable = Column(Boolean, default=True, nullable=False)

    # Business Code Layer
    business_code_enabled = Column(Boolean, default=True, nullable=False)
    business_code_field = Column(String(50), nullable=True)                   # e.g. item_code, order_no, sku
    business_code_strategy = Column(String(50), default="USER_SPECIFIED_OR_AUTOGEN", nullable=False)

    # Multi-tenant and branch scopes
    tenant_scoped = Column(Boolean, default=True, nullable=False)
    company_scoped = Column(Boolean, default=True, nullable=False)
    branch_scoped = Column(Boolean, default=False, nullable=False)
    warehouse_scoped = Column(Boolean, default=False, nullable=False)

    # Physical table mappings
    database_table = Column(String(100), nullable=False)
    primary_key_field = Column(String(50), default="id", nullable=False)
    identity_code_field = Column(String(50), default="identity_code", nullable=False)

    parent_entity_type = Column(String(50), nullable=True)
    user_visible = Column(Boolean, default=True, nullable=False)
    searchable = Column(Boolean, default=True, nullable=False)

    status = Column(String(20), default="ACTIVE", nullable=False)              # ACTIVE, DEPRECATED, RETIRED
    registry_version = Column(Integer, default=1, nullable=False)


class SmritiNumberingRegistry(BaseEntity):
    """
    Central sequential identity counter ledger (Blueprint Section 26).
    Provides atomic, row-locked allocation per entity type, group, and multi-tenant scope.
    Uses COALESCE on nullable scope columns to guarantee strict uniqueness in PostgreSQL.
    """
    __tablename__ = "smriti_numbering_registry"

    entity_type = Column(String(50), nullable=False, index=True)
    identity_group = Column(String(50), nullable=False, index=True)
    group_code = Column(String(10), nullable=False)
    prefix = Column(String(50), nullable=False)                               # e.g. MST-ITM, SAL-INV
    format_template = Column(String(100), default="{prefix}-{seq:08d}", nullable=False)
    scope = Column(String(50), default="TENANT", nullable=False)              # GLOBAL, TENANT, COMPANY, BRANCH, FINANCIAL_YEAR
    sequence_value = Column(Integer, default=0, nullable=False)
    padding = Column(Integer, default=8, nullable=False)
    reset_policy = Column(String(50), default="NEVER", nullable=False)        # NEVER, FINANCIAL_YEAR, CALENDAR_YEAR, MONTHLY, DAILY
    financial_year = Column(String(20), nullable=False, default="")
    tenant_id = Column(String(50), nullable=False, default="")
    status = Column(String(20), default="ACTIVE", nullable=False)

    __table_args__ = (
        Index(
            "uq_smriti_numbering_registry_scope",
            "entity_type", "group_code", "prefix", "scope", "tenant_id", "company_id", "branch_id", "financial_year",
            unique=True
        ),
    )


class SmritiIdentityAlias(BaseEntity):
    """
    Historical alias and cross-system polymorphic identifier resolution registry (Blueprint Section 68).
    Ensures historical identities, renames, and external IDs continue to resolve cleanly to canonical IDs.
    """
    __tablename__ = "smriti_identity_alias"

    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(50), nullable=False, index=True)                # Canonical technical ID
    canonical_identity_code = Column(String(100), nullable=True, index=True)
    alias_code = Column(String(100), nullable=False, index=True)
    alias_type = Column(String(50), default="HISTORICAL_RENAME", nullable=False)  # HISTORICAL_RENAME, RECLASSIFICATION, EXTERNAL_SYNC, LEGACY_IMPORT
    source_system = Column(String(50), default="SMRITI", nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_to = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        Index(
            "uq_smriti_identity_alias_code",
            "entity_type", "alias_code", func.coalesce(Column("company_id", String(50)), ""),
            unique=True
        ),
    )


class SmritiIdentityAllocationLog(BaseEntity):
    """
    Immutable audit ledger of identity issuances (Blueprint Section 40, 84).
    Records provenance: when, why, and for what scope every identity was generated.
    """
    __tablename__ = "smriti_identity_allocation_log"

    tenant_id = Column(String(50), nullable=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    group_code = Column(String(10), nullable=False, index=True)
    canonical_id = Column(String(50), nullable=False, index=True)             # Issued UUIDv7
    identity_code = Column(String(100), nullable=False, index=True)           # Issued human-friendly code
    scope = Column(String(50), nullable=False, default="TENANT")
    purpose = Column(String(50), nullable=False, default="ENTITY_CREATION")   # ENTITY_CREATION, ADMINISTRATIVE_ALLOCATE, PREVIEW
    correlation_id = Column(String(100), nullable=True)
