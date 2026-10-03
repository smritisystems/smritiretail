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
Target Model : Goods Receipt Note (GRN) - canonical inward receiving record
"""

import uuid as _uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, DateTime, Date,
    ForeignKey, Text, Index,
)
from sqlalchemy.orm import relationship

from ..db.base import Base


class GoodsReceiptNote(Base):
    """
    Canonical Goods Receipt Note (GRN).

    One GRN represents a single physical inward delivery event against one or more
    purchase orders from one vendor to one branch.  Posting a GRN triggers:
      1. Inventory stock-in (InwardStockMovement)
      2. Inward cost allocation (InwardCostComponent)
      3. Three-way match check against the linked purchase order(s)
      4. Barcode assignment for serialised items

    Status workflow:  DRAFT -> POSTED -> (optional) CANCELLED
    """

    __tablename__ = "goods_receipt_notes"

    # Identity
    id           = Column(String(50),  primary_key=True, default=lambda: str(_uuid.uuid4())[:12])
    uuid         = Column(String(36),  nullable=False, unique=True, default=lambda: str(_uuid.uuid4()))
    grn_number   = Column(String(60),  nullable=False, unique=True, index=True)

    # Tenant scope
    company_id   = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id    = Column(String(50), ForeignKey("branches.id",  ondelete="RESTRICT"), nullable=False, index=True)

    # Vendor and PO linkage
    vendor_id    = Column(String(50),  nullable=False, index=True)
    vendor_name  = Column(String(255), nullable=True)
    vendor_gstin = Column(String(20),  nullable=True)
    primary_po_id = Column(String(50), nullable=True, index=True)

    # Dates
    grn_date      = Column(Date, nullable=False)
    received_date = Column(Date, nullable=True)
    invoice_date  = Column(Date, nullable=True)
    invoice_no    = Column(String(80), nullable=True)

    # Status workflow: DRAFT | POSTED | CANCELLED
    status        = Column(String(20), nullable=False, default="DRAFT", index=True)

    # Financial totals
    total_quantity = Column(Numeric(14, 3), nullable=False, default=Decimal("0"))
    total_taxable  = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    total_tax      = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    total_landed   = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    currency_code  = Column(String(5),  nullable=False, default="INR")

    # Transport details
    vehicle_no    = Column(String(20),  nullable=True)
    lr_no         = Column(String(50),  nullable=True)
    lr_date       = Column(Date,        nullable=True)
    transporter   = Column(String(255), nullable=True)

    # Remarks
    remarks          = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Three-way match outcome
    match_status       = Column(String(20), nullable=True)
    match_variance_pct = Column(Numeric(7, 4), nullable=True)

    # Audit
    created_by   = Column(String(80), nullable=False, default="system")
    modified_by  = Column(String(80), nullable=True)
    posted_by    = Column(String(80), nullable=True)
    posted_at    = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(String(80), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc))
    modified_at  = Column(DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    lines = relationship("GoodsReceiptLine", back_populates="grn",
                         cascade="all, delete-orphan", lazy="select")

    __table_args__ = (
        Index("ix_grn_company_branch_date", "company_id", "branch_id", "grn_date"),
        Index("ix_grn_vendor_status",       "vendor_id",  "status"),
    )

    def __repr__(self):
        return f"<GoodsReceiptNote {self.grn_number} status={self.status}>"


class GoodsReceiptLine(Base):
    """Individual line item within a GRN."""

    __tablename__ = "goods_receipt_lines"

    id         = Column(String(50), primary_key=True, default=lambda: str(_uuid.uuid4())[:12])
    grn_id     = Column(String(50), ForeignKey("goods_receipt_notes.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    # PO linkage
    po_id      = Column(String(50), nullable=True, index=True)
    po_line_id = Column(String(50), nullable=True)

    # Product identity
    product_id   = Column(String(50),  nullable=False, index=True)
    product_code = Column(String(80),  nullable=True)
    product_name = Column(String(255), nullable=True)
    variant_id   = Column(String(50),  nullable=True)
    barcode      = Column(String(80),  nullable=True, index=True)
    hsn_code     = Column(String(20),  nullable=True)
    batch_no     = Column(String(80),  nullable=True)
    lot_no       = Column(String(80),  nullable=True)
    serial_no    = Column(String(80),  nullable=True)
    expiry_date  = Column(Date,        nullable=True)

    # Quantities
    ordered_qty  = Column(Numeric(14, 3), nullable=True)
    received_qty = Column(Numeric(14, 3), nullable=False, default=Decimal("0"))
    rejected_qty = Column(Numeric(14, 3), nullable=False, default=Decimal("0"))
    accepted_qty = Column(Numeric(14, 3), nullable=False, default=Decimal("0"))
    uom          = Column(String(20), nullable=True, default="NOS")

    # Pricing
    unit_cost     = Column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    discount_pct  = Column(Numeric(7,  4), nullable=False, default=Decimal("0"))
    discount_amt  = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    taxable_value = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    gst_rate      = Column(Numeric(7,  4), nullable=False, default=Decimal("0"))
    cgst_amt      = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sgst_amt      = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    igst_amt      = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    total_value   = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    landed_cost   = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))

    # QC / Inspection
    qc_status        = Column(String(20), nullable=True)
    rejection_reason = Column(Text,       nullable=True)

    # Three-way match
    po_unit_cost   = Column(Numeric(14, 4), nullable=True)
    price_variance = Column(Numeric(14, 4), nullable=True)
    qty_variance   = Column(Numeric(14, 3), nullable=True)

    # Audit
    created_at  = Column(DateTime(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))

    grn = relationship("GoodsReceiptNote", back_populates="lines")

    __table_args__ = (
        Index("ix_grn_line_product", "grn_id", "product_id"),
    )

    def __repr__(self):
        return f"<GoodsReceiptLine grn={self.grn_id} product={self.product_code} qty={self.received_qty}>"
