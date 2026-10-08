"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid as _uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Text
)
from sqlalchemy.orm import relationship
from ..db.base import Base


class UserRole(str, PyEnum):
    SYSADMIN           = "SYSADMIN"           # Global — root system administrator
    ADMIN              = "ADMIN"              # Global / Company administrator
    MANAGER            = "MANAGER"            # Company/branch — full business manager
    STORE_MANAGER      = "STORE_MANAGER"      # Full operational store management
    BRANCH_ADMIN       = "BRANCH_ADMIN"       # Branch-scoped administrator
    INVENTORY_MANAGER  = "INVENTORY_MANAGER"  # Stock balance & catalog operations
    PURCHASE_EXECUTIVE = "PURCHASE_EXECUTIVE" # Purchase orders, GRN, suppliers
    SALES_EXECUTIVE    = "SALES_EXECUTIVE"    # Quotes, orders, CRM, counter sales
    CASHIER            = "CASHIER"            # POS checkout billing & shifts
    ACCOUNTANT         = "ACCOUNTANT"         # Ledger, tax & payment reconciliation
    AUDITOR            = "AUDITOR"            # Compliance & audit verification
    HR_EXECUTIVE       = "HR_EXECUTIVE"       # Staff, attendance & payroll
    REPORT_USER        = "REPORT_USER"        # Analytical report viewing & export
    VIEWER             = "VIEWER"             # General business read-only


class User(Base):
    """
    SMRITI system user.

    NOT a subclass of BaseEntity — users belong to the auth domain,
    not to any single tenant. A SYSADMIN user has no company/branch;
    all other roles are scoped to one company + branch.
    """
    __tablename__ = "users"

    id              = Column(String(50),  primary_key=True, default=lambda: str(_uuid.uuid4())[:8])
    uuid            = Column(String(36),  nullable=False, unique=True, default=lambda: str(_uuid.uuid4()))
    username        = Column(String(80),  nullable=False, unique=True, index=True)
    email           = Column(String(255), nullable=True,  unique=True, index=True)
    mobile          = Column(String(20),  nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(SAEnum(UserRole), nullable=False, default=UserRole.CASHIER)
    role_id         = Column(String(50), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active       = Column(Boolean,     nullable=False, default=True)
    is_deleted      = Column(Boolean,     nullable=False, default=False)

    # Tenant scope — NULL for SYSADMIN
    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True, index=True)
    branch_id  = Column(String(50), ForeignKey("branches.id",  ondelete="RESTRICT"), nullable=True, index=True)

    # Extended staff management fields
    status            = Column(String(50), nullable=False, default="Active")
    employee_id       = Column(String(20), nullable=True)
    employee_code     = Column(String(20), nullable=True)
    display_name      = Column(String(100), nullable=True)
    full_name         = Column(String(200), nullable=True)
    gender            = Column(String(10), nullable=True)
    date_of_birth     = Column(String(20), nullable=True)
    alternate_mobile  = Column(String(20), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    address           = Column(String(500), nullable=True)
    city              = Column(String(100), nullable=True)
    state             = Column(String(100), nullable=True)
    country           = Column(String(50), nullable=False, default="India")
    pin_code          = Column(String(10), nullable=True)
    department        = Column(String(100), nullable=True)
    designation       = Column(String(100), nullable=True)
    branch            = Column(String(200), nullable=True)
    department_id     = Column(String(50), nullable=True)
    designation_id    = Column(String(50), nullable=True)
    date_of_joining   = Column(String(20), nullable=True)
    reporting_manager = Column(String(200), nullable=True)
    employment_type   = Column(String(20), nullable=False, default="Permanent")
    allowed_branches  = Column(Text, nullable=True)  # JSON array stored as text
    photo             = Column(Text, nullable=True)  # base64 string
    salary_json       = Column(Text, nullable=True)  # JSON structure
    payment_json      = Column(Text, nullable=True)  # JSON structure
    performance_json  = Column(Text, nullable=True)  # JSON structure
    preferences_json  = Column(Text, nullable=True)  # JSON structure
    notification_settings_json = Column(Text, nullable=True)  # JSON structure

    created_at  = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))

    @property
    def password_reset_required(self) -> bool:
        return self.status == "PendingPasswordChange"

    company = relationship("Company", foreign_keys=[company_id])
    branch_rel  = relationship("Branch",  foreign_keys=[branch_id])


class RefreshTokenBlacklist(Base):
    """
    Stores invalidated refresh tokens (after logout).
    Rows are safe to purge once their `expires_at` has passed.
    """
    __tablename__ = "refresh_token_blacklist"

    id         = Column(String(36),  primary_key=True, default=lambda: str(_uuid.uuid4()))
    token_jti  = Column(String(255), nullable=False, unique=True, index=True)   # JWT `jti` claim
    user_id    = Column(String(50),  ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
