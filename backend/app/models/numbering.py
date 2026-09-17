"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-12
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Text, UniqueConstraint
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

    # Shoper 9 Parity & Multi-Terminal Scoping
    terminal_id                = Column(String(50), default="COMMON", nullable=True)
    is_common_across_terminals = Column(Boolean, default=True)
    transaction_group          = Column(String(50), default="SALES")  # SALES, CASH, SLIPS
    start_number               = Column(Integer, default=1)
    is_void_unified            = Column(Boolean, default=False)

    # Bill number segment arrangement — controls how prefix/number/suffix are ordered.
    # Allowed values (enforced by DB CHECK constraint from migration v1461):
    #   PREFIX_NUM_SUFFIX   – {prefix}{num}{suffix}  ← default / backward-compatible
    #   PREFIX_YEAR_SEP_NUM – {prefix}{year}/{num}
    #   NUM_ONLY            – {num}
    #   PREFIX_SEP_NUM      – {prefix}/{num}
    number_format = Column(String(30), default="PREFIX_NUM_SUFFIX", nullable=False)

    __table_args__ = (
        # Prevents two active series with the same display name per company/branch.
        UniqueConstraint(
            "company_id", "branch_id", "name",
            name="uq_document_series_name_per_company"
        ),
        # Prevents two active series with identical prefix+suffix+type+terminal config.
        UniqueConstraint(
            "company_id", "branch_id", "prefix", "suffix",
            "document_type", "transaction_group", "terminal_id",
            name="uq_document_series_prefix_config"
        ),
    )


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

