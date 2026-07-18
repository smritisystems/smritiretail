"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Consignment / Modern Trade Models -- Tracks stock transfers and sales reporting.
"""

from datetime import datetime, date
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, 
    Text, ForeignKey, Date, DateTime, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class ConsignmentPartner(BaseEntity):
    """
    Modern Trade retail chains (e.g. Reliance Retail, Shoppers Stop, Big Bazaar).
    """
    __tablename__ = "consignment_partners"

    name       = Column(String(255), nullable=False)
    code       = Column(String(50),  nullable=False, unique=True)
    gst_number = Column(String(15),  nullable=True)
    status     = Column(String(20),  default="Active")  # Active | Blocked
    
    billing_address  = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)

    # Relationships
    transfers = relationship("ConsignmentTransfer", back_populates="partner")


class ConsignmentTransfer(BaseEntity):
    """
    Tracks stock dispatched to a consignment partner.
    Dispatched status creates a real SalesInvoice in Draft/Posted status to serve as
    the legal Tax Invoice moving the goods.
    """
    __tablename__ = "consignment_transfers"

    partner_id      = Column(String(50), ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False, index=True)
    transfer_no     = Column(String(80), nullable=False, unique=True)
    transfer_date   = Column(Date,       nullable=False, default=date.today)
    
    status          = Column(String(30), nullable=False, default="Draft")
    # Draft | Dispatched | PartialReturn | Settled | Closed
    
    invoice_id      = Column(String(50), ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    
    tax_total       = Column(Numeric(15, 2), default=0.00)
    grand_total     = Column(Numeric(15, 2), default=0.00)
    
    notes           = Column(Text, nullable=True)

    # Relationships
    partner = relationship("ConsignmentPartner", back_populates="transfers")
    items   = relationship("ConsignmentTransferItem", back_populates="transfer", cascade="all, delete-orphan")
    invoice = relationship("SalesInvoice")


class ConsignmentTransferItem(BaseEntity):
    """
    Itemized lines in a consignment transfer.
    Tracks sent quantities vs actual sold and returned.
    """
    __tablename__ = "consignment_transfer_items"

    transfer_id  = Column(String(50), ForeignKey("consignment_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    code         = Column(String(50),  nullable=False)
    name         = Column(String(255), nullable=False)
    hsn_code     = Column(String(15),  nullable=True)

    qty_sent     = Column(Numeric(12, 4), nullable=False, default=0.0000)
    qty_sold     = Column(Numeric(12, 4), nullable=False, default=0.0000)
    qty_returned = Column(Numeric(12, 4), nullable=False, default=0.0000)
    qty_on_hand  = Column(Numeric(12, 4), nullable=False, default=0.0000) # qty_sent - qty_sold - qty_returned
    
    rate         = Column(Numeric(15, 2), nullable=False, default=0.00)
    gst_rate     = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount   = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    transfer = relationship("ConsignmentTransfer", back_populates="items")
    product  = relationship("Product")


class ConsignmentSaleReport(BaseEntity):
    """
    Weekly or monthly sale report submitted by the chain store detailing what actually sold.
    Processing a report updates qty_sold and qty_on_hand in transfer items.
    """
    __tablename__ = "consignment_sale_reports"

    partner_id   = Column(String(50), ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False, index=True)
    report_no    = Column(String(80), nullable=False, unique=True)
    report_date  = Column(Date,       nullable=False, default=date.today)
    
    status       = Column(String(30), nullable=False, default="Draft")
    # Draft | Submitted | Processed | Rejected | Settled
    
    total_sales_value = Column(Numeric(15, 2), default=0.00)
    total_tax_value   = Column(Numeric(15, 2), default=0.00)
    
    notes        = Column(Text, nullable=True)

    # Relationships
    items = relationship("ConsignmentSaleReportItem", back_populates="report", cascade="all, delete-orphan")


class ConsignmentSaleReportItem(BaseEntity):
    """
    Lines of sold stock from report. Links back to transfer lines.
    """
    __tablename__ = "consignment_sale_report_items"

    report_id        = Column(String(50), ForeignKey("consignment_sale_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    transfer_item_id = Column(String(50), ForeignKey("consignment_transfer_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id       = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    
    qty_sold         = Column(Numeric(12, 4), nullable=False, default=0.0000)
    rate             = Column(Numeric(15, 2), nullable=False, default=0.00)
    gst_rate         = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount       = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount     = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    report        = relationship("ConsignmentSaleReport", back_populates="items")
    transfer_item = relationship("ConsignmentTransferItem")
    product       = relationship("Product")


class ConsignmentSettlement(BaseEntity):
    """
    Settlement of payments from sold stock, reconciling fees and adjustments.
    """
    __tablename__ = "consignment_settlements"

    partner_id          = Column(String(50), ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False, index=True)
    settlement_no       = Column(String(80), nullable=False, unique=True)
    settlement_date     = Column(Date,       nullable=False, default=date.today)
    
    status              = Column(String(30), nullable=False, default="Draft")
    # Draft | Agreed | Paid | Disputed | Closed

    total_amount_due    = Column(Numeric(15, 2), default=0.00)
    total_deductions    = Column(Numeric(15, 2), default=0.00) # marketing, listing fees, etc.
    net_amount_payable  = Column(Numeric(15, 2), default=0.00)
    paid_amount         = Column(Numeric(15, 2), default=0.00)

    deduction_details   = Column(Text, nullable=True) # Description of deductions
    notes               = Column(Text, nullable=True)


class ConsignmentReturn(BaseEntity):
    """
    Return of unsold or damaged stock from the partner back to warehouse.
    Processing a return restores warehouse stock and records a Credit Note.
    """
    __tablename__ = "consignment_returns"

    partner_id   = Column(String(50), ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False, index=True)
    return_no    = Column(String(80), nullable=False, unique=True)
    return_date  = Column(Date,       nullable=False, default=date.today)
    
    status       = Column(String(30), nullable=False, default="Draft")
    # Draft | Submitted | Processed | Cancelled
    
    total_value  = Column(Numeric(15, 2), default=0.00)
    notes        = Column(Text, nullable=True)

    # Relationships
    items = relationship("ConsignmentReturnItem", back_populates="consignment_return", cascade="all, delete-orphan")


class ConsignmentReturnItem(BaseEntity):
    """
    Items returned.
    """
    __tablename__ = "consignment_return_items"

    return_id        = Column(String(50), ForeignKey("consignment_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    transfer_item_id = Column(String(50), ForeignKey("consignment_transfer_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id       = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)

    qty_returned     = Column(Numeric(12, 4), nullable=False, default=0.0000)
    rate             = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount     = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    consignment_return = relationship("ConsignmentReturn", back_populates="items")
    transfer_item      = relationship("ConsignmentTransferItem")
    product            = relationship("Product")
