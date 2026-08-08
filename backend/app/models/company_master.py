"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from datetime import datetime, timezone
import uuid as uuid_pkg
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, SmallInteger,
    Text, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship

from ..db.base import Base


def _uuid() -> str:
    return str(uuid_pkg.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# Organization — Optional Root Entity (Enterprise Edition)
# ─────────────────────────────────────────────────────────────────────────────
class Organization(Base):
    """
    ADR-015 Organization root entity.
    Optional layer above companies for holding groups, franchise networks,
    and multi-entity conglomerates. Small businesses see only their company —
    organization_id on Company is nullable and the STANDALONE org is
    auto-created on first setup, completely invisible to the user.
    """
    __tablename__ = "organizations"

    id         = Column(String(50), primary_key=True, default=_uuid)
    tenant_id  = Column(String(50), nullable=True, index=True)
    name       = Column(String(255), nullable=False)
    org_type   = Column(String(30), nullable=False, default="STANDALONE")
    # STANDALONE | HOLDING | FRANCHISE_NETWORK | GROUP
    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    companies = relationship("Company", back_populates="organization")


# ─────────────────────────────────────────────────────────────────────────────
# CompanyTaxProfile — 1:1 with Company
# ─────────────────────────────────────────────────────────────────────────────
class CompanyTaxProfile(Base):
    """
    ADR-015 Company Tax Profile.
    Stores all statutory tax identifiers for the company.
    Mandatory 1:1 relationship — every company has exactly one tax profile.
    Every write to this table triggers an entry in smriti_audit_log.
    """
    __tablename__ = "company_tax_profiles"

    id          = Column(String(50), primary_key=True, default=_uuid)
    company_id  = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"),
                         nullable=False, unique=True, index=True)

    # GST
    gstin                  = Column(String(15), nullable=True, index=True)
    # Format: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$
    gstin_state_code       = Column(String(2),  nullable=True)   # extracted from gstin[0:2]
    gst_registration_type  = Column(String(30), nullable=True)
    # REGULAR|COMPOSITION|SEZ|CASUAL|ISD|UNREGISTERED
    gst_registration_date  = Column(Date, nullable=True)

    # PAN
    pan_number = Column(String(10), nullable=True)   # ^[A-Z]{5}[0-9]{4}[A-Z]$
    pan_name   = Column(String(255), nullable=True)  # Name as per PAN card

    # TAN
    tan_number = Column(String(10), nullable=True)   # ^[A-Z]{4}[0-9]{5}[A-Z]$
    tds_circle = Column(String(50), nullable=True)   # TDS jurisdiction

    # Company Identity
    cin_number = Column(String(21), nullable=True)   # MCA Company Identity Number
    llpin      = Column(String(10), nullable=True)   # LLP Identification Number

    # MSME
    msme_registration_no   = Column(String(20), nullable=True)  # Udyam-XX-00-0000000
    msme_category          = Column(String(20), nullable=True)  # MICRO|SMALL|MEDIUM
    msme_registration_date = Column(Date, nullable=True)

    # International Trade
    import_export_code = Column(String(10), nullable=True)  # DGFT IEC (10-digit)
    lu_number          = Column(String(30), nullable=True)  # LUT Bond number (exports)
    lu_expiry_date     = Column(Date, nullable=True)

    created_at  = Column(DateTime(timezone=True), nullable=False, default=_now)
    created_by  = Column(String(50), nullable=True)
    modified_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    modified_by = Column(String(50), nullable=True)

    __table_args__ = (
        Index("idx_tax_profile_gstin", "gstin"),
    )

    company = relationship("Company", backref="tax_profile", uselist=False)


# ─────────────────────────────────────────────────────────────────────────────
# CompanyFinancialYear — 1:M with Company (but only ONE active at a time)
# ─────────────────────────────────────────────────────────────────────────────
class CompanyFinancialYear(Base):
    """
    ADR-015 Company Financial Year.
    Defines fiscal/accounting periods. Only ONE row may have is_active=TRUE
    per company at any time — enforced by partial unique index.
    Status lifecycle: OPEN → CLOSED → LOCKED (irreversible at LOCKED)
    """
    __tablename__ = "company_financial_years"

    id          = Column(String(50), primary_key=True, default=_uuid)
    company_id  = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"),
                         nullable=False, index=True)

    year_label  = Column(String(20), nullable=False)   # e.g. "FY 2025-26"
    start_date  = Column(Date, nullable=False)          # e.g. 2025-04-01
    end_date    = Column(Date, nullable=False)          # e.g. 2026-03-31
    status      = Column(String(20), nullable=False, default="OPEN")
    # OPEN → CLOSED → LOCKED (LOCKED is irreversible per BR-FY-003)
    is_active   = Column(Boolean, nullable=False, default=False)
    # Only ONE per company — enforced by partial unique index in migration

    closed_at  = Column(DateTime(timezone=True), nullable=True)
    closed_by  = Column(String(50), nullable=True)
    locked_at  = Column(DateTime(timezone=True), nullable=True)
    locked_by  = Column(String(50), nullable=True)

    created_at  = Column(DateTime(timezone=True), nullable=False, default=_now)
    modified_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("company_id", "year_label", name="uq_company_fy_label"),
        Index("idx_fy_company", "company_id"),
    )
    # Note: Partial unique index idx_one_active_fy is created in Alembic migration
    # because SQLAlchemy __table_args__ does not support WHERE clauses on UniqueConstraint.

    company = relationship("Company", backref="financial_years")
