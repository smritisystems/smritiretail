"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Platform Models -- Shared infrastructure for all SMRITI business modules.

Contains:
  DocumentNumberSeries -- centralized document numbering engine
  DocumentWorkflow     -- generic document state machine
  IntegrationLog       -- external API call audit trail
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Text,
    DateTime, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


# ---------------------------------------------------------------------------
# 1. Document Number Series
#    Used by: NumberingService to generate unique, branch-scoped doc numbers.
#    e.g.  INV-2026-MUM-000047  |  CT-2026-DEL-000003
# ---------------------------------------------------------------------------

class DocumentNumberSeries(BaseEntity):
    """
    Centralized document numbering. One row per (prefix + fiscal_year + branch).
    NumberingService.next() increments last_seq atomically using SELECT FOR UPDATE.

    Design rules:
    - prefix:       document type code   (INV, CT, CSR, CS, CR, PO, SO, GRN, DN, CN)
    - fiscal_year:  4-digit year string  (2026, 2027 ...)
    - branch_id:    scoped per branch    (inherited from BaseEntity FK)
    - format_str:   Python format string with placeholders:
                    {PREFIX}-{FY}-{SEQ:06d}          -> INV-2026-000047
                    {PREFIX}/{BRANCH}/{FY_SHORT}/{SEQ:06d} -> INV/MUM/26-27/000001
    """
    __tablename__ = "document_number_series"

    # Sequence key
    prefix       = Column(String(20),  nullable=False)   # INV, CT, CSR ...
    fiscal_year  = Column(String(9),   nullable=False)   # 2026 or 2026-27
    branch_code  = Column(String(20),  nullable=True)    # MUM, DEL, etc. (nullable = global)

    # Counter (updated atomically by NumberingService)
    last_seq     = Column(Integer,     nullable=False, default=0)
    pad_length   = Column(Integer,     nullable=False, default=6)  # zero-padding width

    # Format template
    # Supported placeholders: {PREFIX} {FY} {FY_SHORT} {BRANCH} {SEQ:0Nd}
    format_str   = Column(String(100), nullable=False,
                          default="{PREFIX}-{FY}-{SEQ:06d}")

    # Metadata
    description  = Column(String(200), nullable=True)
    is_locked    = Column(Boolean, default=False)  # prevent changes mid-year

    __table_args__ = (
        UniqueConstraint("prefix", "fiscal_year", "branch_id", name="uq_doc_series"),
        Index("ix_doc_series_prefix_fy", "prefix", "fiscal_year"),
    )


# ---------------------------------------------------------------------------
# 2. Document Workflow
#    Generic state machine for all SMRITI business documents.
#    Used by: SalesInvoice, PurchaseOrder, ConsignmentTransfer,
#             Settlement, Return, etc.
# ---------------------------------------------------------------------------

class DocumentWorkflow(BaseEntity):
    """
    Tracks the lifecycle state and full transition history of any document.

    Standard lifecycle:
        Draft -> Submitted -> Approved -> Posted -> Cancelled | Closed

    Document-specific shortcuts are allowed (e.g. Draft -> Posted for POS bills).

    One row per document (document_type + document_id combination is unique).
    """
    __tablename__ = "document_workflows"

    document_type   = Column(String(60),  nullable=False)  # SalesInvoice, ConsignmentTransfer, ...
    document_id     = Column(String(50),  nullable=False)  # FK to the owning document
    document_number = Column(String(80),  nullable=True)   # human-readable number for display
    current_status  = Column(String(30),  nullable=False, default="Draft")

    # Full transition history as JSONB array:
    # [{"from": "Draft", "to": "Submitted", "user": "admin", "ts": "...", "remarks": "..."}]
    status_history  = Column(JSONB, nullable=False, server_default="'[]'::jsonb")

    # Optional: who is currently responsible for action
    assigned_to     = Column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint("document_type", "document_id", name="uq_doc_workflow"),
        Index("ix_doc_workflow_type_status", "document_type", "current_status"),
    )


# ---------------------------------------------------------------------------
# 3. Integration Log
#    Records every outbound call to external APIs:
#    GSTN, NIC E-Invoice, E-Way Bill, Payment Gateways, WhatsApp, SMS, etc.
# ---------------------------------------------------------------------------

class IntegrationLog(BaseEntity):
    """
    Immutable audit trail of all external API interactions.
    Supports troubleshooting, retry tracking, and compliance reporting.

    Design: write-once rows. Never update; append new row on retry.
    """
    __tablename__ = "integration_logs"

    # What system was called
    integration_name = Column(String(60),  nullable=False)  # GSTN, NIC, Razorpay, WhatsApp...
    endpoint         = Column(String(500), nullable=True)    # URL called
    http_method      = Column(String(10),  nullable=True)    # GET, POST, PUT

    # What triggered this call
    ref_document_type = Column(String(60),  nullable=True)   # SalesInvoice, ConsignmentTransfer...
    ref_document_id   = Column(String(50),  nullable=True)
    ref_document_no   = Column(String(80),  nullable=True)

    # Request
    request_payload   = Column(JSONB, nullable=True)
    request_headers   = Column(JSONB, nullable=True)         # sanitized (no secrets)

    # Response
    response_status   = Column(Integer, nullable=True)       # HTTP status code
    response_payload  = Column(JSONB,   nullable=True)
    response_time_ms  = Column(Integer, nullable=True)

    # Outcome
    status    = Column(String(20), nullable=False, default="Pending")
    # Pending | Success | Failed | Retrying | Cancelled
    error_message = Column(Text, nullable=True)
    retry_count   = Column(Integer, default=0)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # Idempotency key (client-side, for safe retries)
    idempotency_key = Column(String(100), nullable=True, index=True)

    __table_args__ = (
        Index("ix_integration_log_ref", "ref_document_type", "ref_document_id"),
        Index("ix_integration_log_status", "status", "next_retry_at"),
        Index("ix_integration_log_integration", "integration_name", "created_at"),
    )
