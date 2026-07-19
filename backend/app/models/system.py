"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Boolean, Text, Integer
from ..db.base import BaseEntity


class TallyConfig(BaseEntity):
    """
    Tally ERP integration connection settings.
    """
    __tablename__ = "tally_configs"

    endpoint           = Column(String(250), nullable=False, default="http://localhost:9000")
    company_name       = Column(String(200), nullable=False)
    sync_interval_mins = Column(Integer, default=60)


class SystemConfig(BaseEntity):
    """
    Global system parameters and business workflows configurations registry.
    """
    __tablename__ = "system_configs"

    key      = Column(String(100), nullable=False, unique=True, index=True)
    value    = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, default="General")
