"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Model : B2B Dispatch Batch - persistent dispatch session replacing in-memory _AUDIT_CACHE
"""

import uuid as _uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, DateTime, Date, Text, JSON, Index,
)
from sqlalchemy.orm import relationship

from ..db.base import Base


class DispatchBatch(Base):
    """
    Persistent B2B dispatch batch session.

    Replaces the in-memory _AUDIT_CACHE and _BATCH_CACHE dicts in
    dispatch_invoicing.py.  A batch is created when the user uploads a dispatch
    matrix; each store's invoice is a DispatchBatchInvoice child record.
    """

    __tablename__ = "dispatch_batches"

    id              = Column(String(50), primary_key=True, default=lambda: str(_uuid.uuid4()))
    batch_ref       = Column(String(80), nullable=False, unique=True, index=True)  # human-readable batch ID

    # Tenant scope
    company_id      = Column(String(50), nullable=False, index=True)
    branch_id       = Column(String(50), nullable=True)

    # Source matrix metadata
    source_filename = Column(String(255), nullable=True)
    sheet_name      = Column(String(80),  nullable=True)
    detected_sizes  = Column(JSON,        nullable=True)  # list[str]
    available_sheets = Column(JSON,       nullable=True)  # list[str]
    matrix_date     = Column(Date,        nullable=True)

    # Pre-flight audit result
    preflight_status = Column(String(20), nullable=False, default="PENDING")
    # PENDING | AUDITED | ERROR
    total_stores     = Column(Integer,    nullable=False, default=0)
    ready_stores     = Column(Integer,    nullable=False, default=0)
    warning_stores   = Column(Integer,    nullable=False, default=0)
    error_stores     = Column(Integer,    nullable=False, default=0)
    preflight_log    = Column(JSON,       nullable=True)  # list of DispatchValidationIssue dicts

    # Batch generation result
    batch_status     = Column(String(20), nullable=False, default="PENDING")
    # PENDING | GENERATED | FAILED | DELIVERED
    generated_at     = Column(DateTime(timezone=True), nullable=True)
    package_path     = Column(String(500), nullable=True)  # path to ZIP on disk/S3

    # Audit
    created_by       = Column(String(80), nullable=False, default="system")
    created_at       = Column(DateTime(timezone=True), nullable=False,
                              default=lambda: datetime.now(timezone.utc))
    modified_at      = Column(DateTime(timezone=True), nullable=False,
                              default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc))

    invoices = relationship("DispatchBatchInvoice", back_populates="batch",
                            cascade="all, delete-orphan", lazy="select")

    __table_args__ = (
        Index("ix_dispatch_batch_company", "company_id", "preflight_status"),
    )

    def __repr__(self):
        return f"<DispatchBatch {self.batch_ref} status={self.batch_status}>"


class DispatchBatchInvoice(Base):
    """
    One generated invoice within a dispatch batch (one per destination store).

    Replaces the list of DispatchGeneratedInvoice objects previously held in
    _BATCH_CACHE[batch_id]["invoices"].
    """

    __tablename__ = "dispatch_batch_invoices"

    id              = Column(String(50), primary_key=True, default=lambda: str(_uuid.uuid4())[:12])
    batch_id        = Column(String(50), nullable=False, index=True)
    # No FK — intentional; DispatchBatch may be in a different DB schema in future.

    # Store / destination
    store_code      = Column(String(30),  nullable=False)
    store_name      = Column(String(255), nullable=True)
    gstin           = Column(String(20),  nullable=True)
    state_code      = Column(Integer,     nullable=True)
    state_name      = Column(String(80),  nullable=True)
    pincode         = Column(Integer,     nullable=True)
    is_interstate   = Column(Boolean,     nullable=False, default=False)

    # Invoice identity
    invoice_number  = Column(String(80),  nullable=True, index=True)
    invoice_date    = Column(Date,        nullable=True)
    po_number       = Column(String(80),  nullable=True)

    # Tax breakdown
    taxable_value   = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    cgst_amount     = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sgst_amount     = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    igst_amount     = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    tax_amount      = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    rounding_amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    grand_total     = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    pairs_count     = Column(Integer,        nullable=False, default=0)

    # E-Invoice / E-Way Bill (populated after IRN generation)
    irn             = Column(String(100), nullable=True)
    ack_no          = Column(String(50),  nullable=True)
    ack_dt          = Column(DateTime(timezone=True), nullable=True)
    signed_qr       = Column(Text,       nullable=True)   # QR payload
    ewb_number      = Column(String(50), nullable=True)
    ewb_valid_till  = Column(DateTime(timezone=True), nullable=True)

    # Artefact paths
    pdf_path        = Column(String(500), nullable=True)
    json_path       = Column(String(500), nullable=True)

    # Status
    status          = Column(String(20),  nullable=False, default="READY")
    # READY | WARNING | ERROR | GENERATED | IRN_PENDING | IRN_DONE
    validation_errors   = Column(JSON, nullable=True)   # list[str]
    validation_warnings = Column(JSON, nullable=True)   # list[str]

    # Audit
    created_at   = Column(DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc))
    modified_at  = Column(DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    batch = relationship("DispatchBatch", back_populates="invoices")

    __table_args__ = (
        Index("ix_dispatch_inv_batch_store", "batch_id", "store_code"),
        Index("ix_dispatch_inv_invoice_no",  "invoice_number"),
    )

    def __repr__(self):
        return f"<DispatchBatchInvoice store={self.store_code} invoice={self.invoice_number}>"
