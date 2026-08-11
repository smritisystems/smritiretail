"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Declarative Base for Secondary Master Database / Master Exchange Hub (smriti_master_hub).
               100% decoupled from ControlBase.metadata and CompanyBase.metadata.
"""

from sqlalchemy.orm import DeclarativeBase


class MasterHubBase(DeclarativeBase):
    """
    Base class for all Secondary Master Database entities.
    Table definitions registered on MasterHubBase.metadata must NEVER
    overlap with ControlBase or CompanyBase.
    """
    pass
