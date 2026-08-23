"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Boolean,
    Integer,
    ForeignKey,
    DateTime,
    Text,
    text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class PlatformCapability(BaseEntity):
    """
    Control Plane catalog of system-wide industry business capabilities (smritisys).
    Enforces strict dependency chains across the 26 canonical SMRITI capabilities.
    """
    __tablename__ = "platform_capabilities"

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    category = Column(String(50), nullable=False)  # CORE, COMMERCE, OPERATIONS, COMPLIANCE, PLATFORM
    description = Column(Text, nullable=True)
    dependencies = Column(JSONB, server_default=text("'[]'"), default=list)  # List of prerequisite capability codes
    min_version = Column(String(20), nullable=False, default="1.0.0")
    is_core = Column(Boolean, nullable=False, default=False)
    default_enabled = Column(Boolean, nullable=False, default=False)
    status = Column(String(30), nullable=False, default="ACTIVE")


class WorkspaceTemplate(BaseEntity):
    """
    Control Plane vertical template defining default feature sets, menus, and UI layouts (smritisys).
    """
    __tablename__ = "workspace_templates"

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    vertical = Column(String(50), nullable=False)  # SUPERMARKET, APPAREL, WMS, PHARMACY, RESTAURANT, ENTERPRISE
    included_capabilities = Column(JSONB, server_default=text("'[]'"), default=list)
    layout_config = Column(JSONB, server_default=text("'{}'"), default=dict)
    is_system_template = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="ACTIVE")
    description = Column(Text, nullable=True)


class TenantCapabilityBinding(BaseEntity):
    """
    Tenant Data Plane subscription binding activating specific capabilities for a company (smritiXXX).
    """
    __tablename__ = "tenant_capability_bindings"
    __table_args__ = (
        UniqueConstraint("capability_code", name="uq_tenant_capability_code"),
    )

    capability_code = Column(String(50), nullable=False, index=True)
    is_enabled = Column(Boolean, nullable=False, default=True)
    plan_tier = Column(String(30), nullable=False, default="ENTERPRISE")  # BASIC, PROFESSIONAL, ENTERPRISE
    configuration = Column(JSONB, server_default=text("'{}'"), default=dict)
    status = Column(String(30), nullable=False, default="ACTIVE")
    activated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class FeatureFlag(BaseEntity):
    """
    Control Plane and Tenant dynamic feature flags and experiment toggles.
    """
    __tablename__ = "feature_flags"

    key = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, default="GENERAL")
    description = Column(Text, nullable=True)
    is_global_enabled = Column(Boolean, nullable=False, default=False)
    company_overrides = Column(JSONB, server_default=text("'{}'"), default=dict)  # {"COMP-001": true, "COMP-002": false}


class UserWorkspaceConfig(BaseEntity):
    """
    Tenant Data Plane user preference customizing workspace templates, pinned widgets, and UI themes (smritiXXX).
    """
    __tablename__ = "user_workspace_configs"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_workspace_config"),
    )

    user_id = Column(String(50), nullable=False, index=True)
    template_code = Column(String(50), nullable=False, default="RETAIL_SUPERMARKET")
    theme_preference = Column(String(30), nullable=False, default="DARK_RETRO")
    pinned_modules = Column(JSONB, server_default=text("'[]'"), default=list)
    custom_widgets = Column(JSONB, server_default=text("'{}'"), default=dict)
