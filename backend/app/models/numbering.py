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

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Text
from ..db.base import BaseEntity


class DocumentSeries(BaseEntity):
    """
    State and rules for document numbering series (e.g. Sales Invoices, Purchase Orders).
    """
    __tablename__ = "document_series"

    name           = Column(String(200), nullable=False)
    document_type  = Column(String(100), nullable=False)
    module         = Column(String(100), nullable=True)
    prefix         = Column(String(100), default="")
    suffix         = Column(String(100), default="")
    running_length = Column(Integer, default=4)
    reset_rule     = Column(String(50), default="Financial Year")  # Financial Year, Calendar Year, Monthly, Daily, Never
    current_number = Column(Integer, default=0)
    last_reset_key = Column(String(50), nullable=True)
    financial_year = Column(String(20), nullable=True)
    company_code   = Column(String(50), nullable=True)
    mode           = Column(String(20), default="Auto")
    description    = Column(Text, nullable=True)


class NumberingAuditLog(BaseEntity):
    """
    Audit ledger of all document number allocations and configuration updates.
    """
    __tablename__ = "numbering_audit_logs"

    series_id   = Column(String(50), ForeignKey("document_series.id", ondelete="CASCADE"), nullable=False)
    series_name = Column(String(200), nullable=False)
    action      = Column(String(50), nullable=False)  # CREATE, UPDATE, ALLOCATE, RESET
    document_no = Column(String(200), nullable=False)
    old_value   = Column(String(200), nullable=True)
    new_value   = Column(String(200), nullable=True)
    details     = Column(Text, nullable=True)
    operator    = Column(String(100), nullable=True)
