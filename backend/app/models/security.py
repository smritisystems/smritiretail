"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, ForeignKey, Boolean, Integer, Text, Enum
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
    policies = relationship("SMRITIRolePolicy", back_populates="role")
    user_roles = relationship("SMRITIUserRole", back_populates="role")


class SMRITIPermission(BaseEntity):
    """
    SMRITI Permission model. Decoupled from roles via policies.
    """
    __tablename__ = "smriti_permissions"

    code        = Column(String(100), nullable=False, unique=True, index=True)
    resource    = Column(String(100), nullable=False, index=True)
    action      = Column(String(50), nullable=False)
    scope       = Column(String(50), nullable=False, default="OWN_BRANCH")  # e.g., OWN_BRANCH, ALL_BRANCHES, OWN_DOCUMENTS
    module      = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)


class SMRITIPolicy(BaseEntity):
    """
    SMRITI Policy model. Groups permissions into reusable policies.
    """
    __tablename__ = "smriti_policies"

    code        = Column(String(50), nullable=False, unique=True, index=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    roles = relationship("SMRITIRolePolicy", back_populates="policy")
    permissions = relationship("SMRITIPolicyPermission", back_populates="policy")


class SMRITIRolePolicy(BaseEntity):
    """
    Junction table mapping Roles to Policies.
    """
    __tablename__ = "smriti_role_policies"

    role_id   = Column(String(50), ForeignKey("smriti_roles.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(String(50), ForeignKey("smriti_policies.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    role = relationship("SMRITIRole", back_populates="policies")
    policy = relationship("SMRITIPolicy", back_populates="roles")


class SMRITIPolicyPermission(BaseEntity):
    """
    Junction table mapping Policies to Permissions. Supports Explicit Deny vs. Allow.
    """
    __tablename__ = "smriti_policy_permissions"

    policy_id       = Column(String(50), ForeignKey("smriti_policies.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id   = Column(String(50), ForeignKey("smriti_permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_type = Column(Enum(PermissionType), nullable=False, default=PermissionType.ALLOW)

    # Relationships
    policy = relationship("SMRITIPolicy", back_populates="permissions")
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
