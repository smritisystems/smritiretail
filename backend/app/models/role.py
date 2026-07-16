"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
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

    name             = Column(String(100), nullable=False, unique=True, index=True)
    description      = Column(Text, nullable=True)
    permissions_json = Column(Text, nullable=False)  # JSON list of permissions
    is_system        = Column(Boolean, default=False)
