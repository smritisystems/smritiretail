"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control Database Base Model Schema (Decoupled from Operational Company DBs)
"""

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class ControlBase(DeclarativeBase):
    """
    Canonical Declarative Base for the SMRITI Control Database.
    Completely decoupled from operational Company Database metadata (BaseEntity).
    
    Control DB owns:
    - Central Users & Auth Credentials
    - Tenants, Companies, Branches Registry
    - User-Company & User-Branch Assignments
    - Company Database Registry & Credential References
    - System Configurations & Platform Capabilities
    - Security Audit Logs
    """
    pass
