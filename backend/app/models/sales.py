"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.3
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text, text
from sqlalchemy.orm import relationship
from ..db.base import Base, BaseEntity, RowSecuredMixin

class SalesInvoice(RowSecuredMixin, BaseEntity):
    """
    SalesInvoice — Outbound Customer Tax Invoice document.
    """
    __tablename__ = "sales_invoices"

    invoice_no      = Column(String(100), nullable=False, unique=True)
    order_id        = Column(String(50), ForeignKey("sales_orders.id", ondelete="RESTRICT"), nullable=True)
    customer_id     = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    invoice_date    = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    due_date        = Column(DateTime(timezone=True), nullable=True)
    subtotal        = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    tax_total       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    cgst_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    sgst_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    igst_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    grand_total     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    paid_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    balance_due     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    status          = Column(String(30), nullable=False, default="Unpaid")  # Unpaid, Partial, Paid
    notes           = Column(Text, nullable=True)

    order    = relationship("SalesOrder")
    customer = relationship("Customer")
    items    = relationship("SalesInvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")
    payments = relationship("SalesPayment", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")


class SalesInvoiceItem(BaseEntity):
    """
    SalesInvoiceItem — Individual product line item in a SalesInvoice.
    """
    __tablename__ = "sales_invoice_items"

    invoice_id     = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False)
    product_id     = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity       = Column(Numeric(12, 4), nullable=False)
    unit_price     = Column(Numeric(15, 2), nullable=False)
    gst_percentage = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    cgst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    sgst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    igst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    line_total     = Column(Numeric(15, 2), nullable=False)

    invoice = relationship("SalesInvoice", back_populates="items")
    product = relationship("Product")


class SalesPayment(RowSecuredMixin, BaseEntity):
    """
    SalesPayment — Customer payment receipt record.
    """
    __tablename__ = "sales_payments"

    payment_no   = Column(String(100), nullable=False, unique=True)
    invoice_id   = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False)
    customer_id  = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    payment_date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    payment_mode = Column(String(30), nullable=False)  # CASH, CARD, UPI, CREDIT
    amount       = Column(Numeric(15, 2), nullable=False)
    reference_no = Column(String(100), nullable=True)
    notes        = Column(Text, nullable=True)

    invoice  = relationship("SalesInvoice", back_populates="payments")
    customer = relationship("Customer")



class SalesQuotation(BaseEntity):
    __tablename__ = "sales_quotations"

    quotation_no  = Column(String(100), nullable=False, unique=True)
    date          = Column(Date, nullable=False, server_default=text("CURRENT_DATE"), default=lambda: datetime.now(timezone.utc).date())
    customer_name = Column(String(255), nullable=False)
    tax_total     = Column(Numeric(15, 2), default=0.00)
    grand_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    status        = Column(String(20), default="Draft")  # Draft | Submitted | Approved | Rejected | Cancelled | Converted
    sales_order_id = Column(String(50), nullable=True)
    cgst_total    = Column(Numeric(15, 2), nullable=False, server_default="0.00", default=0.00)
    sgst_total    = Column(Numeric(15, 2), nullable=False, server_default="0.00", default=0.00)
    igst_total    = Column(Numeric(15, 2), nullable=False, server_default="0.00", default=0.00)

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
    tenant_id    = Column(String(50), nullable=True, index=True)
    company_id   = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True)
    branch_id    = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True)
    cgst_amount  = Column(Numeric(15, 2), nullable=False, server_default="0.00", default=0.00)
    sgst_amount  = Column(Numeric(15, 2), nullable=False, server_default="0.00", default=0.00)
    igst_amount  = Column(Numeric(15, 2), nullable=False, server_default="0.00", default=0.00)

    # Relationships
    quotation = relationship("SalesQuotation", back_populates="items")




class SalesReturn(RowSecuredMixin, BaseEntity):
    """
    SalesReturn — Outbound Customer Return request record.
    """
    __tablename__ = "sales_returns"

    return_no      = Column(String(100), nullable=False, unique=True)
    invoice_id     = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False)
    customer_id    = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    return_date    = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    reason         = Column(Text, nullable=True)
    status         = Column(String(30), nullable=False, default="Draft")  # Draft, Approved, Rejected
    refund_amount  = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    credit_note_id = Column(String(50), nullable=True)

    invoice  = relationship("SalesInvoice")
    customer = relationship("Customer")
    items    = relationship("SalesReturnItem", back_populates="return_order", cascade="all, delete-orphan", lazy="selectin")


class SalesReturnItem(BaseEntity):
    """
    SalesReturnItem — Individual returned product item line.
    """
    __tablename__ = "sales_return_items"

    return_id      = Column(String(50), ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False)
    product_id     = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity       = Column(Numeric(12, 4), nullable=False)
    unit_price     = Column(Numeric(15, 2), nullable=False)
    condition      = Column(String(30), nullable=False, default="Restockable")  # Restockable, Damaged
    gst_percentage = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    cgst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    sgst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    igst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    line_total     = Column(Numeric(15, 2), nullable=False)

    return_order = relationship("SalesReturn", back_populates="items")
    product      = relationship("Product")


class CreditNote(RowSecuredMixin, BaseEntity):
    """
    CreditNote — Tax-compliant GST Credit Note document.
    """
    __tablename__ = "credit_notes"

    credit_note_no = Column(String(100), nullable=False, unique=True)
    return_id      = Column(String(50), ForeignKey("sales_returns.id", ondelete="RESTRICT"), nullable=False)
    invoice_id     = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False)
    customer_id    = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    issue_date     = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    subtotal       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    tax_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    cgst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    sgst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    igst_amount    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    grand_total    = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    status         = Column(String(30), nullable=False, default="Issued")
    notes          = Column(Text, nullable=True)

    return_order = relationship("SalesReturn")
    invoice      = relationship("SalesInvoice")
    customer     = relationship("Customer")



class SalesOrder(RowSecuredMixin, BaseEntity):
    """
    SalesOrder — Aggregate Root for Customer Sales Orders.
    FSM Lifecycle: Draft -> Confirmed -> Allocated -> Picking -> Packed -> Shipped -> Delivered.
    """
    __tablename__ = "sales_orders"

    order_no           = Column(String(100), nullable=False, unique=True)
    customer_id        = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    customer_name      = Column(String(255), nullable=True)
    subtotal           = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total          = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total        = Column(Numeric(15, 2), nullable=False, default=0.00)
    status             = Column(String(30), nullable=False, default="Draft")
    fulfillment_status = Column(String(30), nullable=False, default="Unfulfilled")
    payment_status     = Column(String(30), nullable=False, default="Unpaid")
    notes              = Column(Text, nullable=True)

    customer = relationship("Customer")
    items    = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin")


class SalesOrderItem(Base):
    """
    SalesOrderItem — Line item in a customer sales order.
    """
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id          = Column(String(50), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id        = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    code              = Column(String(50), nullable=True)
    name              = Column(String(255), nullable=True)
    ordered_quantity  = Column(Numeric(10, 2), nullable=False, default=1.00)
    reserved_quantity = Column(Numeric(10, 2), nullable=False, default=0.00)
    quantity          = Column(Numeric(12, 4), nullable=True)
    unit_price        = Column(Numeric(15, 2), nullable=False, default=0.00)
    price             = Column(Numeric(15, 2), nullable=True)
    line_total        = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount      = Column(Numeric(15, 2), nullable=True)
    tenant_id         = Column(String(50), nullable=True, index=True)
    company_id        = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True)
    branch_id         = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True)

    order   = relationship("SalesOrder", back_populates="items")
    product = relationship("Product")


class FulfillmentWave(RowSecuredMixin, BaseEntity):
    """
    FulfillmentWave — Aggregate Root for Warehouse Batch Picking Waves.
    Consolidates multiple sales orders for efficient zone/batch picking.
    """
    __tablename__ = "fulfillment_waves"

    wave_no      = Column(String(100), nullable=False, unique=True)
    status       = Column(String(30), nullable=False, default="Created")
    total_orders = Column(Integer, nullable=False, default=0)
    total_items  = Column(Integer, nullable=False, default=0)

    pick_lists = relationship("PickList", back_populates="wave", cascade="all, delete-orphan", lazy="selectin")


class PickList(RowSecuredMixin, BaseEntity):
    """
    PickList — Consolidated warehouse picking list.
    """
    __tablename__ = "pick_lists"

    pick_list_no = Column(String(100), nullable=False, unique=True)
    wave_id      = Column(String(50), ForeignKey("fulfillment_waves.id", ondelete="CASCADE"), nullable=False)
    status       = Column(String(30), nullable=False, default="Pending")

    wave  = relationship("FulfillmentWave", back_populates="pick_lists")
    items = relationship("PickListItem", back_populates="pick_list", cascade="all, delete-orphan", lazy="selectin")


class PickListItem(BaseEntity):
    """
    PickListItem — Individual product picking line in a PickList.
    """
    __tablename__ = "pick_list_items"

    pick_list_id     = Column(String(50), ForeignKey("pick_lists.id", ondelete="CASCADE"), nullable=False)
    order_id         = Column(String(50), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    product_id       = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity_to_pick = Column(Numeric(10, 2), nullable=False)
    quantity_picked  = Column(Numeric(10, 2), nullable=False, default=0.00)
    status           = Column(String(30), nullable=False, default="Pending")

    pick_list = relationship("PickList", back_populates="items")
    order     = relationship("SalesOrder")
    product   = relationship("Product")


class ShipmentPackage(RowSecuredMixin, BaseEntity):
    """
    ShipmentPackage — Outbound package and parcel tracking record.
    """
    __tablename__ = "shipment_packages"

    package_no    = Column(String(100), nullable=False, unique=True)
    order_id      = Column(String(50), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    wave_id       = Column(String(50), nullable=True)
    carrier       = Column(String(100), nullable=True)
    tracking_no   = Column(String(100), nullable=True)
    weight_kg     = Column(Numeric(10, 3), nullable=False, default=0.000)
    shipping_cost = Column(Numeric(15, 2), nullable=False, default=0.00)
    status        = Column(String(30), nullable=False, default="PACKED")
    dispatch_date = Column(DateTime(timezone=True), nullable=True)

    order = relationship("SalesOrder")









