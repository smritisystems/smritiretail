# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

from datetime import datetime, date
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, 
    Text, ForeignKey, Date, DateTime, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class StockDispatch(BaseEntity):
    """
    Unified Stock Dispatch Document supporting Normal Sales, Consignments,
    Sale-on-Approval, samples, and branch transfers.
    """
    __tablename__ = "stock_dispatches"

    dispatch_no   = Column(String(80), nullable=False, unique=True)
    dispatch_type = Column(String(30), nullable=False) # CONSIGNMENT | APPROVAL | BRANCH | NORMAL
    partner_id    = Column(String(50), ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=True, index=True)
    dispatch_date = Column(Date,       nullable=False, default=date.today)
    
    status        = Column(String(30), nullable=False, default="Draft")
    # Draft | Dispatched | Closed
    
    invoice_id    = Column(String(50), ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    
    tax_total     = Column(Numeric(15, 2), default=0.00)
    grand_total   = Column(Numeric(15, 2), default=0.00)
    notes         = Column(Text, nullable=True)

    # Relationships
    partner = relationship("ConsignmentPartner")
    items   = relationship("StockDispatchLine", back_populates="dispatch", cascade="all, delete-orphan")
    invoice = relationship("SalesInvoice")
    events  = relationship("DispatchApprovalEvent", back_populates="dispatch", cascade="all, delete-orphan")


class StockDispatchLine(BaseEntity):
    """
    Item lines in a unified stock dispatch.
    Tracks quantities sent, approved/invoiced, and returned.
    """
    __tablename__ = "stock_dispatch_lines"

    dispatch_id  = Column(String(50), ForeignKey("stock_dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    sku          = Column(String(50),  nullable=False)
    name         = Column(String(255), nullable=False)
    
    qty_sent     = Column(Numeric(12, 4), nullable=False, default=0.0000)
    qty_invoiced = Column(Numeric(12, 4), nullable=False, default=0.0000)
    qty_returned = Column(Numeric(12, 4), nullable=False, default=0.0000)
    qty_on_hand  = Column(Numeric(12, 4), nullable=False, default=0.0000) # qty_sent - qty_invoiced - qty_returned
    
    rate         = Column(Numeric(15, 2), nullable=False, default=0.00)
    gst_rate     = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount   = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    dispatch = relationship("StockDispatch", back_populates="items")
    product  = relationship("Product")


class DispatchApprovalEvent(BaseEntity):
    """
    Audit log tracking status/quantity approvals or edits on dispatches.
    """
    __tablename__ = "dispatch_approval_events"

    dispatch_id = Column(String(50), ForeignKey("stock_dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    action      = Column(String(50), nullable=False) # DISPATCH | SALE_REPORT | RETURN | TIMEOUT
    qty         = Column(Numeric(12, 4), nullable=False, default=0.0000)
    user_id     = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address  = Column(String(45), nullable=True)
    reason      = Column(Text,        nullable=True)

    # Relationships
    dispatch = relationship("StockDispatch", back_populates="events")
    user     = relationship("User")
