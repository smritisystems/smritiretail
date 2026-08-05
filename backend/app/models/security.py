"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-18
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, ForeignKey, Boolean, Integer, Text, Enum, DateTime, Numeric
from sqlalchemy.orm import relationship
import enum

from ..db.base import BaseEntity


class PermissionType(str, enum.Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"


class SMRITIRole(BaseEntity):
    """
    SMRITI Role Model. Support hierarchical role trees.
    """
    __tablename__ = "smriti_roles"

    code           = Column(String(50), nullable=False, unique=True, index=True)
    name           = Column(String(100), nullable=False)
    description    = Column(Text, nullable=True)
    parent_role_id = Column(String(50), ForeignKey("smriti_roles.id", ondelete="SET NULL"), nullable=True)
    is_system_role = Column(Boolean, default=False, nullable=False)

    # Relationships
    parent_role = relationship("SMRITIRole", remote_side="SMRITIRole.id", backref="sub_roles")
    permission_sets = relationship("SMRITIRolePermissionSet", back_populates="role")
    user_roles = relationship("SMRITIUserRole", back_populates="role")


class SMRITIPermission(BaseEntity):
    """
    SMRITI Permission model. Decoupled from roles via permission sets.
    """
    __tablename__ = "smriti_permissions"

    code        = Column(String(100), nullable=False, unique=True, index=True)
    resource    = Column(String(100), nullable=False, index=True)
    action      = Column(String(50), nullable=False)
    scope       = Column(String(50), nullable=False, default="OWN_BRANCH")  # e.g., OWN_BRANCH, ALL_BRANCHES, OWN_DOCUMENTS
    module      = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)


class SMRITIPermissionSet(BaseEntity):
    """
    SMRITI PermissionSet model. Groups permissions into reusable sets.
    """
    __tablename__ = "smriti_permission_sets"

    code        = Column(String(50), nullable=False, unique=True, index=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    roles = relationship("SMRITIRolePermissionSet", back_populates="permission_set")
    permissions = relationship("SMRITIPermissionSetPermission", back_populates="permission_set")


class SMRITIRolePermissionSet(BaseEntity):
    """
    Junction table mapping Roles to PermissionSets.
    """
    __tablename__ = "smriti_role_permission_sets"

    role_id           = Column(String(50), ForeignKey("smriti_roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_set_id = Column(String(50), ForeignKey("smriti_permission_sets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    role = relationship("SMRITIRole", back_populates="permission_sets")
    permission_set = relationship("SMRITIPermissionSet", back_populates="roles")


class SMRITIPermissionSetPermission(BaseEntity):
    """
    Junction table mapping PermissionSets to Permissions. Supports Explicit Deny vs. Allow.
    """
    __tablename__ = "smriti_permission_set_permissions"

    permission_set_id = Column(String(50), ForeignKey("smriti_permission_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id     = Column(String(50), ForeignKey("smriti_permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_type   = Column(Enum(PermissionType), nullable=False, default=PermissionType.ALLOW)

    # Relationships
    permission_set = relationship("SMRITIPermissionSet", back_populates="permissions")
    permission = relationship("SMRITIPermission")


class SMRITIUserRole(BaseEntity):
    """
    Mapping table linking system users to dynamic SMRITI Roles.
    """
    __tablename__ = "smriti_user_roles"

    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(String(50), ForeignKey("smriti_roles.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    role = relationship("SMRITIRole", back_populates="user_roles")
    user = relationship("User", backref="user_smriti_roles")


class SMRITIMenu(BaseEntity):
    """
    SMRITI Dynamic Menu metadata for Dynamic sidebar workspace rendering.
    """
    __tablename__ = "smriti_menus"

    parent_id    = Column(String(50), ForeignKey("smriti_menus.id", ondelete="SET NULL"), nullable=True)
    title        = Column(String(100), nullable=False)
    route        = Column(String(200), nullable=True)
    icon         = Column(String(100), nullable=True)
    module       = Column(String(100), nullable=False, index=True)
    permission   = Column(String(100), nullable=True)  # Associated permission code required to see menu
    sequence     = Column(Integer, default=0, nullable=False)
    feature_flag = Column(String(100), nullable=True)  # System toggle or feature flag
    badge        = Column(String(50), nullable=True)    # e.g., "New", "Beta"

    # Relationships
    parent = relationship("SMRITIMenu", remote_side="SMRITIMenu.id", backref="sub_menus")


class SMRITISecurityAudit(BaseEntity):
    """
    Security configuration change audit log.
    """
    __tablename__ = "smriti_security_audits"

    user_id     = Column(String(50), nullable=False, index=True)
    username    = Column(String(80), nullable=False)
    action      = Column(String(100), nullable=False)
    old_value   = Column(Text, nullable=True)
    new_value   = Column(Text, nullable=True)
    reason      = Column(Text, nullable=True)
    ip_address  = Column(String(50), nullable=True)
    device_info = Column(Text, nullable=True)


class SMRITIUserAssignment(BaseEntity):
    """
    Multi-context, dynamic role & scope assignment table linking users to companies, branches, stores, and roles.
    Supports temporal valid_from/valid_to bounds for delegations and auditor temporary access.
    """
    __tablename__ = "smriti_user_assignments"

    user_id              = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id           = Column(String(50), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id            = Column(String(50), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    store_id             = Column(String(50), nullable=True, index=True)
    warehouse_id         = Column(String(50), nullable=True, index=True)
    role_id              = Column(String(50), ForeignKey("smriti_roles.id", ondelete="SET NULL"), nullable=True, index=True)
    permission_set_id    = Column(String(50), ForeignKey("smriti_permission_sets.id", ondelete="SET NULL"), nullable=True)
    workspace_profile_id = Column(String(50), nullable=True)
    persona              = Column(String(100), nullable=True)
    effective_scope      = Column(String(50), nullable=False, default="STORE")  # PLATFORM, TENANT, REGION, COMPANY, BRANCH, STORE, WAREHOUSE, OWN
    valid_from           = Column(DateTime(timezone=True), nullable=True)
    valid_to             = Column(DateTime(timezone=True), nullable=True)
    is_delegated         = Column(Boolean, nullable=False, default=False)
    delegated_by_user_id = Column(String(50), nullable=True)
    status               = Column(String(50), nullable=False, default="ACTIVE")  # ACTIVE, DELEGATED, EXPIRED, SUSPENDED

    # Relationships
    user = relationship("User", backref="user_assignments")
    role = relationship("SMRITIRole")


class SMRITIWorkspaceProfile(BaseEntity):
    """
    UX Workspace Profile model defining theme, default workspace, dashboard layout, and shortcuts per Persona.
    Decoupled from security permissions.
    """
    __tablename__ = "smriti_workspace_profiles"

    code                 = Column(String(50), nullable=False, unique=True, index=True)
    name                 = Column(String(100), nullable=False)
    persona              = Column(String(100), nullable=False, index=True)
    default_workspace_id = Column(String(100), nullable=False, default="launchpad")
    layout_json          = Column(Text, nullable=True)
    theme                = Column(String(50), nullable=False, default="light")
    shortcuts_json       = Column(Text, nullable=True)
    is_default           = Column(Boolean, nullable=False, default=False)


class SMRITISecurityPolicy(BaseEntity):
    """
    Metadata-driven business authorization and enforcement policies.
    """
    __tablename__ = "smriti_security_policies"

    code              = Column(String(100), nullable=False, unique=True, index=True)
    name              = Column(String(150), nullable=False)
    description       = Column(Text, nullable=True)
    category          = Column(String(50), nullable=False, default="AUTHORIZATION")
    rule_expression   = Column(Text, nullable=False)
    enforcement_level = Column(String(50), nullable=False, default="BLOCK")  # BLOCK, WARN, AUDIT
    is_active         = Column(Boolean, nullable=False, default=True)


class SMRITIFieldSecurityMask(BaseEntity):
    """
    Field-Level Security (FLS) masking definition per resource, field, and role.
    States: VISIBLE, HIDDEN, READ_ONLY, MASKED, EDITABLE, CALCULATED
    """
    __tablename__ = "smriti_field_security_masks"

    resource    = Column(String(100), nullable=False, index=True)
    field_name  = Column(String(100), nullable=False, index=True)
    role_id     = Column(String(50), ForeignKey("smriti_roles.id", ondelete="CASCADE"), nullable=True, index=True)
    field_state = Column(String(50), nullable=False, default="VISIBLE")


class SMRITIApprovalMatrix(BaseEntity):
    """
    Financial threshold approval matrix limits per Role and Domain.
    """
    __tablename__ = "smriti_approval_matrices"

    role_id                  = Column(String(50), ForeignKey("smriti_roles.id", ondelete="CASCADE"), nullable=False, index=True)
    domain                   = Column(String(100), nullable=False, index=True)  # PURCHASE, SALES, INVENTORY
    approval_limit_amount    = Column(Numeric(18, 4), nullable=False, default=0.0)
    currency                 = Column(String(10), nullable=False, default="INR")
    requires_higher_approval = Column(Boolean, nullable=False, default=False)

    role = relationship("SMRITIRole")
