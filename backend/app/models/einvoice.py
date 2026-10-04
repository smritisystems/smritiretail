"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.120.0
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, DateTime, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import text
from ..db.base import BaseEntity


class EInvoice(BaseEntity):
    """E-Invoice record - maps SMRITI sales invoice to NIC/IRP IRN."""
    __tablename__ = "e_invoices"

    invoice_id      = Column(String(50), nullable=False, index=True)     # SMRITI invoice ID
    invoice_no      = Column(String(80), nullable=False, index=True)     # SMRITI invoice number
    gstin_supplier  = Column(String(20), nullable=True)
    gstin_buyer     = Column(String(20), nullable=True)
    invoice_date    = Column(DateTime, nullable=True)
    invoice_value   = Column(Numeric(18, 2), nullable=True)
    irn             = Column(String(128), unique=True, nullable=True)    # IRP IRN
    ack_no          = Column(String(50), nullable=True)
    ack_date        = Column(DateTime, nullable=True)
    signed_invoice  = Column(Text, nullable=True)                        # Signed JSON payload
    signed_qr_code  = Column(Text, nullable=True)
    status          = Column(String(20), nullable=False, default="PENDING")
    # PENDING | GENERATED | CANCELLED | FAILED
    irp_response    = Column(JSONB, server_default=text("'{}'"), default=dict)
    cancel_reason   = Column(String(50), nullable=True)
    cancel_remark   = Column(Text, nullable=True)
    cancelled_at    = Column(DateTime, nullable=True)
    retry_count     = Column(Integer, default=0)
    error_detail    = Column(Text, nullable=True)


class EInvoiceBatch(BaseEntity):
    """Batch submission record for bulk e-invoice generation."""
    __tablename__ = "e_invoice_batches"

    batch_no        = Column(String(40), unique=True, nullable=False)
    status          = Column(String(20), nullable=False, default="QUEUED")
    # QUEUED | PROCESSING | PARTIAL | COMPLETED | FAILED
    total_invoices  = Column(Integer, default=0)
    success_count   = Column(Integer, default=0)
    failed_count    = Column(Integer, default=0)
    submitted_by    = Column(String(50), nullable=True)
    completed_at    = Column(DateTime, nullable=True)
    notes           = Column(Text, nullable=True)
