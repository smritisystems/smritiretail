"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.2.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from sqlalchemy import Column, String, Boolean, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import BaseEntity


class ScreenLayoutTemplate(BaseEntity):
    """
    Stores metadata-driven Screen Studio custom layouts, field ordering, and button action limits per company/tenant.
    """
    __tablename__ = "screen_layout_templates"

    id = Column(String(50), primary_key=True, default=lambda: f"tpl_{uuid.uuid4().hex[:12]}")
    screen_id = Column(String(100), nullable=False, index=True)  # pos, items, sales, etc.
    industry_pack = Column(String(50), nullable=False, default="GENERAL_RETAIL", index=True)
    template_name = Column(String(150), nullable=False)
    
    max_primary_buttons = Column(Integer, default=7)
    fields_config = Column(JSONB, nullable=False, default=list)
    buttons_config = Column(JSONB, nullable=False, default=list)
    
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
