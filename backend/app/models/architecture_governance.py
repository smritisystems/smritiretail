"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance Model
"""

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.base import Base


class ArchitectureDomain(Base):
    """
    High-level business domain boundary (e.g. CRM, Inventory, Billing, Procurement).
    """
    __tablename__ = "architecture_domains"

    id = Column(String(50), primary_key=True)  # e.g. 'crm', 'inventory', 'sales', 'purchase'
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    lead_architect = Column(String(100), nullable=False, default="Core Architecture")
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    entities = relationship("ArchitectureEntity", back_populates="domain", cascade="all, delete-orphan")


class ArchitectureEntity(Base):
    """
    Canonical Single Source of Truth definition for a core business concept.
    Exactly ONE canonical owner is designated per entity.
    """
    __tablename__ = "architecture_entities"

    entity_key = Column(String(50), primary_key=True)  # e.g. 'customer', 'item', 'item_variant'
    domain_id = Column(String(50), ForeignKey("architecture_domains.id", ondelete="CASCADE"), nullable=False)
    canonical_name = Column(String(100), nullable=False)
    canonical_db = Column(String(50), nullable=False, default="smriti001")
    canonical_table = Column(String(100), nullable=False)
    canonical_model = Column(String(100), nullable=False)
    canonical_service = Column(String(100), nullable=False)
    canonical_api = Column(String(255), nullable=False)
    canonical_ui = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="CANONICAL")  # CANONICAL | FROZEN | RETIRING
    version = Column(Integer, nullable=False, default=1)
    owner = Column(String(100), nullable=False, default="Core Architecture")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    domain = relationship("ArchitectureDomain", back_populates="entities")
    capabilities = relationship("ArchitectureCapability", back_populates="entity", cascade="all, delete-orphan")


class ArchitectureCapability(Base):
    """
    Specific business capability or function provided by an entity.
    Decoupled from component names to prevent semantic duplication.
    """
    __tablename__ = "architecture_capabilities"

    capability_key = Column(String(100), primary_key=True)  # e.g. 'customer.lookup', 'tax.gst_calculation'
    entity_key = Column(String(50), ForeignKey("architecture_entities.entity_key", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    business_intent = Column(Text, nullable=False)
    canonical_component = Column(String(255), nullable=False)
    canonical_file = Column(String(255), nullable=False)
    canonical_service = Column(String(100), nullable=False)
    canonical_api = Column(String(255), nullable=False)
    semantic_fingerprint = Column(JSONB, nullable=False, default=dict)  # {"inputs": [...], "outputs": [...], "tables": [...]}
    status = Column(String(30), nullable=False, default="ACTIVE")  # ACTIVE | DEPRECATED | FROZEN
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    entity = relationship("ArchitectureEntity", back_populates="capabilities")


class ArchitectureFile(Base):
    """
    Registry of production source files and their architectural role.
    """
    __tablename__ = "architecture_files"

    file_path = Column(String(255), primary_key=True)  # Relative from repo root (e.g. 'src/components/drilldown/UniversalBrowseEngine.tsx')
    module_key = Column(String(50), nullable=False)
    capability_key = Column(String(100), ForeignKey("architecture_capabilities.capability_key", ondelete="CASCADE"), nullable=False)
    purpose = Column(Text, nullable=False)
    role = Column(String(30), nullable=False, default="CANONICAL")  # CANONICAL | ADAPTER | PROJECTION | TEST | LEGACY
    canonical_file = Column(String(255), nullable=True)  # If role != CANONICAL, points to canonical owner
    deprecated_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ArchitectureApi(Base):
    """
    Registry of canonical and compatibility API routes.
    """
    __tablename__ = "architecture_apis"

    api_key = Column(String(100), primary_key=True)  # e.g. 'api.crm.customers.list'
    capability_key = Column(String(100), ForeignKey("architecture_capabilities.capability_key", ondelete="CASCADE"), nullable=False)
    entity_key = Column(String(50), ForeignKey("architecture_entities.entity_key", ondelete="CASCADE"), nullable=False)
    http_method = Column(String(10), nullable=False)  # GET | POST | PUT | DELETE | PATCH
    route_path = Column(String(255), nullable=False)  # e.g. '/api/v1/crm/customers'
    canonical_service = Column(String(100), nullable=False)
    request_schema = Column(String(100), nullable=True)
    response_schema = Column(String(100), nullable=True)
    version = Column(String(20), nullable=False, default="v1")
    role = Column(String(30), nullable=False, default="CANONICAL")  # CANONICAL | COMPATIBILITY_ALIAS
    status = Column(String(30), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ArchitectureDecision(Base):
    """
    Formal Architecture Exemption & Decision Record (ADR) ledger.
    Every non-canonical implementation must have an approved entry here.
    """
    __tablename__ = "architecture_decisions"

    decision_id = Column(String(50), primary_key=True)  # e.g. 'ADR-DUP-001', 'ADR-FROZEN-001'
    subject = Column(String(200), nullable=False)
    canonical_owner = Column(String(255), nullable=False)
    secondary_owner = Column(String(255), nullable=False)
    classification = Column(String(50), nullable=False)  # ADAPTER | PROJECTION | CACHE | SPECIALIZED_UI | COMPATIBILITY | MIGRATION | TEST_ONLY | FROZEN_INVESTIGATION
    reason = Column(Text, nullable=False)
    scope = Column(Text, nullable=False)
    migration_plan = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="APPROVED")  # APPROVED | EXPIRED | SUPERSEDED | ARCHITECTURE_DECISION_REQUIRED
    approved_by = Column(String(100), nullable=False, default="Chief Systems Architect")
    approval_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Null if permanent architecture pattern
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ArchitectureCertificate(Base):
    """
    Cryptographic / source-correlated preflight certificate proving an architecture
    preflight check authorized the creation or reuse of a business asset.
    """
    __tablename__ = "architecture_certificates"

    certificate_id = Column(String(50), primary_key=True)  # e.g. 'PF-2026-0903-8A2F1C'
    entity = Column(String(50), nullable=False)
    capability = Column(String(100), nullable=False)
    asset_type = Column(String(50), nullable=False)  # component | modal | service | api | table
    proposed_name = Column(String(255), nullable=False)
    target_file_path = Column(String(255), nullable=True)
    decision = Column(String(50), nullable=False)  # CREATE_APPROVED | REUSE_EXISTING
    canonical_owner = Column(String(255), nullable=True)
    content_hash = Column(String(64), nullable=False)  # SHA-256 of proposed asset or spec
    git_commit = Column(String(40), nullable=True)  # Git commit hash at issuance
    issued_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="ISSUED")  # ISSUED | USED | REVOKED
