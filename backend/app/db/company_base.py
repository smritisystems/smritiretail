"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Company Database Declarative Base (Isolated from Control DB)
"""

from app.db.base import Base, BaseEntity

# Canonical Declarative Base for operational Company Databases.
# Decoupled 100% from ControlBase.metadata.
CompanyBase = Base

__all__ = ["CompanyBase", "BaseEntity"]
