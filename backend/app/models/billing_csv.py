"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Barcode Billing CSV Templates & Import Audit Models
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class BillingCsvTemplate(BaseEntity):
    """
    Registry of configurable Barcode Billing CSV / PDT import templates.
    Enables cashiers and corporate accountants to save custom column mappings,
    custom delimiters, and default tax policies.
    """
    __tablename__ = "billing_csv_templates"

    template_code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    delimiter = Column(String(5), nullable=False, default=",", server_default=text("','"))
    has_header = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    default_tax_inclusive = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    column_mappings = Column(JSONB, nullable=False, server_default=text("'{}'"), default=dict)
    is_system = Column(Boolean, nullable=False, default=False, server_default=text("false"))


class BillingCsvImportLog(BaseEntity):
    """
    Statutory audit log for all Barcode Billing CSV and PDT uploads.
    Tracks file hashes, row counts, validation metrics, applied tax mode,
    and links to resulting POS invoices.
    """
    __tablename__ = "billing_csv_import_logs"

    register_id = Column(String(50), nullable=True, index=True)
    shift_id = Column(String(50), nullable=True, index=True)
    cashier_id = Column(String(50), nullable=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_sha256 = Column(String(64), nullable=False, index=True)
    format_detected = Column(String(50), nullable=False)
    template_id = Column(String(50), ForeignKey("billing_csv_templates.id", ondelete="SET NULL"), nullable=True)
    total_rows = Column(Integer, nullable=False, default=0)
    valid_rows = Column(Integer, nullable=False, default=0)
    warning_rows = Column(Integer, nullable=False, default=0)
    rejected_rows = Column(Integer, nullable=False, default=0)
    total_gross_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_mode_applied = Column(String(30), nullable=False, default="INCLUSIVE")
    resulting_invoice_id = Column(String(50), nullable=True, index=True)
