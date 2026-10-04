"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.1
Created      : 2026-07-12
Modified     : 2026-10-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Boolean, Text
from ..db.base import BaseEntity


class Role(BaseEntity):
    """
    Access Roles registry with associated granular permissions list mapping.
    """
    __tablename__ = "roles"

    # NOTE: Uniqueness on 'name' is enforced by two PostgreSQL partial indexes
    # created in migration v1516_role_tenancy_constraints:
    #   uq_roles_system_name  WHERE is_system = TRUE  AND is_deleted = FALSE
    #   uq_roles_company_name WHERE is_system = FALSE AND is_deleted = FALSE
    # DO NOT add unique=True or index=True here — it creates an alembic
    # autogenerate hazard (would attempt to recreate the dropped ix_roles_name).
    name             = Column(String(100), nullable=False)
    description      = Column(Text, nullable=True)
    permissions_json = Column(Text, nullable=False)  # JSON list of permissions
    is_system        = Column(Boolean, default=False)
