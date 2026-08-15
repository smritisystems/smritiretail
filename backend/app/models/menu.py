"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from ..db.base import BaseEntity

class SmritiMenu(BaseEntity):
    """
    Control Plane Menu Registry mapped to existing smriti_menus PostgreSQL table.
    Global system menus have tenant_id=None, company_id=None, branch_id=None.
    Location/company specific overrides populate company_id/branch_id.
    """
    __tablename__ = "smriti_menus"

    title        = Column(String(255), nullable=False)
    route        = Column(String(255), nullable=True)
    icon         = Column(String(100), nullable=True)
    module       = Column(String(100), nullable=False, index=True)
    permission   = Column(String(100), nullable=True)
    sequence     = Column(Integer, nullable=False, default=0)
    parent_id    = Column(String(255), ForeignKey("smriti_menus.id"), nullable=True)
    feature_flag = Column(String(100), nullable=True)
    badge        = Column(String(50), nullable=True)
