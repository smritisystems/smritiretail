"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

tax.py — Unified ORM Models for GST Monthly Tax Settlements, Outward/Inward GSTR-1 Return Filing DTOs,
and Statutory E-Way Bills.
"""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.base import BaseEntity, RowSecuredMixin


class GstTaxSettlement(RowSecuredMixin, BaseEntity):
    """
    GstTaxSettlement — Monthly GST Tax Settlement calculating Output Tax Liability vs Input Tax Credit (ITC).
    """
    __tablename__ = "gst_tax_settlements"

    settlement_no         = Column(String(100), nullable=False, unique=True)
    tax_period            = Column(String(20), nullable=False)  # YYYY-MM
    outward_cgst          = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    outward_sgst          = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    outward_igst          = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_outward_tax     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    inward_itc_cgst       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    inward_itc_sgst       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    inward_itc_igst       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_inward_itc      = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    net_cgst_payable      = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    net_sgst_payable      = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    net_igst_payable      = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_net_tax_payable = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    carry_forward_itc     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    status                = Column(String(30), nullable=False, default="CALCULATED")  # CALCULATED, SETTLED, FILED
    notes                 = Column(Text, nullable=True)


class GstReturnFiling(RowSecuredMixin, BaseEntity):
    """
    GstReturnFiling — GST Return Filing compilation (GSTR-1, GSTR-3B, GSTR-2B) containing serialized portal JSON.
    """
    __tablename__ = "gst_return_filings"

    filing_no            = Column(String(100), nullable=False, unique=True)
    return_type          = Column(String(20), nullable=False)  # GSTR1, GSTR3B, GSTR2B
    tax_period           = Column(String(20), nullable=False)  # YYYY-MM
    gstr1_payload_json   = Column(Text, nullable=False)
    b2b_invoices_count   = Column(Integer, nullable=False, default=0)
    b2c_invoices_count   = Column(Integer, nullable=False, default=0)
    credit_notes_count   = Column(Integer, nullable=False, default=0)
    total_taxable_value  = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_tax_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    status               = Column(String(30), nullable=False, default="GENERATED")  # GENERATED, FILED, ACKNOWLEDGED
    arn_number           = Column(String(100), nullable=True)
    filed_at             = Column(DateTime(timezone=True), nullable=True)


class EWayBill(RowSecuredMixin, BaseEntity):
    """
    EWayBill — Statutory E-Way Bill record for goods transport exceeding threshold.
    """
    __tablename__ = "eway_bills"

    eway_bill_no      = Column(String(100), nullable=False, unique=True)
    invoice_id        = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False)
    consignment_value = Column(Numeric(15, 2), nullable=False)
    transporter_id    = Column(String(50), nullable=True)
    transporter_name  = Column(String(255), nullable=True)
    transport_mode    = Column(String(30), nullable=False, default="ROAD")  # ROAD, RAIL, AIR, SHIP
    vehicle_no        = Column(String(50), nullable=True)
    distance_km       = Column(Numeric(10, 2), nullable=False)
    valid_from        = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    valid_until       = Column(DateTime(timezone=True), nullable=False)
    status            = Column(String(30), nullable=False, default="GENERATED")  # GENERATED, IN_TRANSIT, CANCELLED, EXPIRED

    invoice           = relationship("SalesInvoice")
