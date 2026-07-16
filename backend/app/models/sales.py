"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-11
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, Text, text
from sqlalchemy.orm import relationship
from ..db.base import Base, BaseEntity

class SalesInvoice(BaseEntity):
    __tablename__ = "sales_invoices"

    invoice_no   = Column(String(100), nullable=False, unique=True)
    date         = Column(Date, nullable=False, server_default=text("CURRENT_DATE"), default=lambda: datetime.now(timezone.utc).date())
    customer_id  = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    shift_id     = Column(String(50), ForeignKey("shifts.id",    ondelete="SET NULL"), nullable=True, index=True)
    tax_total    = Column(Numeric(15, 2), default=0.00)
    grand_total  = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_interstate = Column(Boolean, default=False)
    eway_bill_no = Column(String(50))
    payment_mode = Column(String(20), default="CASH")  # CASH | CARD | UPI | CREDIT
    status       = Column(String(20), default="Draft")

    # Relationships
    items = relationship("SalesInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class SalesInvoiceItem(Base):
    __tablename__ = "sales_invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    quantity = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price = Column(Numeric(15, 2), nullable=False)
    hsn_code = Column(String(15))
    gst_rate = Column(Numeric(5, 2), default=18.00)
    tax_amount = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    invoice = relationship("SalesInvoice", back_populates="items")


class SalesQuotation(BaseEntity):
    __tablename__ = "sales_quotations"

    quotation_no  = Column(String(100), nullable=False, unique=True)
    date          = Column(Date, nullable=False, server_default=text("CURRENT_DATE"), default=lambda: datetime.now(timezone.utc).date())
    customer_name = Column(String(255), nullable=False)
    tax_total     = Column(Numeric(15, 2), default=0.00)
    grand_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    status        = Column(String(20), default="Draft")  # Draft | Submitted | Approved | Rejected | Cancelled | Converted
    sales_order_id = Column(String(50), nullable=True)

    # Relationships
    items = relationship("SalesQuotationItem", back_populates="quotation", cascade="all, delete-orphan")


class SalesQuotationItem(Base):
    __tablename__ = "sales_quotation_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quotation_id = Column(String(50), ForeignKey("sales_quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    code         = Column(String(50), nullable=False)
    name         = Column(String(255), nullable=False)
    quantity     = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price        = Column(Numeric(15, 2), nullable=False)
    hsn_code     = Column(String(15))
    gst_rate     = Column(Numeric(5, 2), default=18.00)
    tax_amount   = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    quotation = relationship("SalesQuotation", back_populates="items")


class SalesOrder(BaseEntity):
    __tablename__ = "sales_orders"

    order_no           = Column(String(100), nullable=False, unique=True)
    date               = Column(Date, nullable=False, server_default=text("CURRENT_DATE"), default=lambda: datetime.now(timezone.utc).date())
    customer_name      = Column(String(255), nullable=False)
    tax_total          = Column(Numeric(15, 2), default=0.00)
    grand_total        = Column(Numeric(15, 2), nullable=False, default=0.00)
    status             = Column(String(20), default="Draft")  # Draft | Submitted | Approved | Rejected | Confirmed | Shipped | Cancelled
    source_quotation_id = Column(String(50), nullable=True)

    # Relationships
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id     = Column(String(50), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    code         = Column(String(50), nullable=False)
    name         = Column(String(255), nullable=False)
    quantity     = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price        = Column(Numeric(15, 2), nullable=False)
    hsn_code     = Column(String(15))
    gst_rate     = Column(Numeric(5, 2), default=18.00)
    tax_amount   = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    order = relationship("SalesOrder", back_populates="items")


class SalesReturn(BaseEntity):
    __tablename__ = "sales_returns"

    return_no          = Column(String(100), nullable=False, unique=True)
    original_invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    credit_note_number = Column(String(100), nullable=True)
    date               = Column(Date, nullable=False, server_default=text("CURRENT_DATE"), default=lambda: datetime.now(timezone.utc).date())
    reason             = Column(Text, nullable=True)
    tax_total          = Column(Numeric(15, 2), default=0.00)
    grand_total        = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_interstate      = Column(Boolean, default=False)
    status             = Column(String(20), default="Draft")  # Draft | Submitted | Approved | Cancelled

    # Relationships
    items = relationship("SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan")


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    return_id    = Column(String(50), ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    code         = Column(String(50), nullable=False)
    name         = Column(String(255), nullable=False)
    quantity     = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price        = Column(Numeric(15, 2), nullable=False)
    gst_rate     = Column(Numeric(5, 2), default=18.00)
    tax_amount   = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    sales_return = relationship("SalesReturn", back_populates="items")
