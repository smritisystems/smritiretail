"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-11
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, Text, text
from sqlalchemy import DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import Base, BaseEntity

class SalesInvoice(BaseEntity):
    __tablename__ = "sales_invoices"

    invoice_no   = Column(String(100), nullable=False, unique=True)
    date         = Column(Date, nullable=False, server_default=text("CURRENT_DATE"), default=lambda: datetime.now(timezone.utc).date())
    customer_id  = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    party_id     = Column(String(50), ForeignKey("parties.id", ondelete="SET NULL"), nullable=True, index=True)
    shift_id     = Column(String(50), ForeignKey("shifts.id",    ondelete="SET NULL"), nullable=True, index=True)
    tax_total    = Column(Numeric(15, 2), default=0.00)
    grand_total  = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_interstate = Column(Boolean, default=False)
    eway_bill_no = Column(String(50))
    payment_mode = Column(String(20), default="CASH")  # CASH | CARD | UPI | CREDIT
    status       = Column(String(20), default="Draft")

    # Transaction Reproducibility & Governance Version Snapshots (P1.5)
    governance_snapshot_id = Column(String(50), nullable=True)
    rule_snapshots = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # Historical & Canonical Metadata
    source_type             = Column(String(50), default="LIVE")
    source_system           = Column(String(50))
    source_file             = Column(String(500))
    import_batch_id         = Column(String(100))
    imported_at             = Column(Date)
    import_validation_status = Column(String(50))
    import_validation_notes  = Column(Text)
    sis_code                = Column(String(50))
    pos_state               = Column(String(100))
    reverse_charge          = Column(Boolean, default=False)
    is_reverse_charge       = Column(Boolean, default=False)
    po_reference            = Column(String(100))
    customer_name           = Column(String(255))
    customer_gstin          = Column(String(50))
    billing_address         = Column(Text)
    shipping_address        = Column(Text)
    site_name               = Column(String(255))
    # Corporate B2B Customer / Delivery Location / Multi-State GST / Billing Location (Phase 1 & Phase 2F)
    delivery_location_id       = Column(String(50), ForeignKey("customer_delivery_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    delivery_store_code        = Column(String(50), nullable=True, index=True)
    delivery_gstin             = Column(String(15), nullable=True)
    billed_party_gstin_id      = Column(String(50), ForeignKey("customer_gst_registrations.id", ondelete="SET NULL"), nullable=True, index=True)
    billing_location_id        = Column(String(50), ForeignKey("customer_billing_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    billing_store_code         = Column(String(50), nullable=True, index=True)
    delivery_location_snapshot  = Column(JSONB, nullable=True)
    place_of_supply_code       = Column(String(2), nullable=True)
    taxable_value           = Column(Numeric(15, 2))
    rounding_amount         = Column(Numeric(10, 4), default=0.0000)
    amount_in_words         = Column(Text)
    bank_name               = Column(String(100))
    account_no              = Column(String(100))
    ifsc_code               = Column(String(50))
    original_pdf_sha256     = Column(String(64))
    original_pdf_path       = Column(String(500))
    original_pdf_size       = Column(Integer)
    original_pdf_pages      = Column(Integer)

    # E-Invoice & IRP Compliance (Rule 5 & Backend-Driven Compliance State)
    e_invoice_status        = Column(String(50), default="NOT_APPLICABLE")  # NOT_APPLICABLE | PENDING | GENERATED | FAILED
    irn                     = Column(String(100))
    ack_no                  = Column(String(100))
    ack_date                = Column(String(100))
    signed_qr_payload       = Column(Text)
    warehouse_id            = Column(String(50), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=True)

    # v1373 -- Sprint 14/15: Salesperson, Terminal, Payment extension
    salesperson_id   = Column(String(50),    nullable=True, index=True)
    salesperson_name = Column(String(255),   nullable=True)
    terminal_id      = Column(String(50),    nullable=True, index=True)
    counter_id       = Column(String(50),    nullable=True)
    paid_amount      = Column(Numeric(15, 2), nullable=False, server_default=text("0"), default=0.00)
    balance_amount   = Column(Numeric(15, 2), nullable=False, server_default=text("0"), default=0.00)
    discount_amount  = Column(Numeric(15, 2), nullable=False, server_default=text("0"), default=0.00)
    net_amount       = Column(Numeric(15, 2), nullable=False, server_default=text("0"), default=0.00)

    # Relationships
    items = relationship("SalesInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    delivery_location = relationship("CustomerDeliveryLocation", foreign_keys=[delivery_location_id])
    billed_party_gstin = relationship("CustomerGSTRegistration", foreign_keys=[billed_party_gstin_id])
    billing_location = relationship("CustomerBillingLocation", foreign_keys=[billing_location_id])



class SalesInvoiceItem(Base):
    __tablename__ = "sales_invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    item_id = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id = Column(String(50), nullable=True, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    batch_no = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price = Column(Numeric(15, 2), nullable=False)
    hsn_code = Column(String(15))
    gst_rate = Column(Numeric(5, 2), default=18.00)
    tax_amount = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)
    mrp          = Column(Numeric(15, 2))
    disc_pct     = Column(Numeric(7, 4))
    taxable_value = Column(Numeric(15, 2))
    igst_amount  = Column(Numeric(15, 2), default=0.00)
    cgst_amount  = Column(Numeric(15, 2), default=0.00)
    sgst_amount  = Column(Numeric(15, 2), default=0.00)
    line_no      = Column(Integer)

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
    item_id      = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id   = Column(String(50), nullable=True, index=True)
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

    # Extended Historical PO & Execution Metadata
    po_number          = Column(String(100), index=True)
    po_date            = Column(Date)
    delivery_date      = Column(Date)
    site_code          = Column(String(50))
    site_name          = Column(String(255))
    delivery_address   = Column(Text)
    vendor_code        = Column(String(50))
    customer_id        = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True, index=True)
    customer_gstin     = Column(String(50))
    basic_total        = Column(Numeric(15, 2), default=0.00)
    is_interstate      = Column(Boolean, default=True)
    total_qty          = Column(Numeric(15, 4), default=0.0000)
    billed_qty         = Column(Numeric(15, 4), default=0.0000)
    billed_value       = Column(Numeric(15, 2), default=0.00)
    pending_qty        = Column(Numeric(15, 4), default=0.0000)
    pending_value      = Column(Numeric(15, 2), default=0.00)
    fulfillment_status = Column(String(50), default="UNFULFILLED")  # UNFULFILLED | PARTIALLY_BILLED | FULLY_BILLED
    po_metadata        = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # Relationships
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")
    allocations = relationship("SalesOrderInvoiceAllocation", back_populates="order", cascade="all, delete-orphan")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id     = Column(String(50), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    item_id      = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id   = Column(String(50), nullable=True, index=True)
    code         = Column(String(50), nullable=False)
    name         = Column(String(255), nullable=False)
    quantity     = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price        = Column(Numeric(15, 2), nullable=False)
    hsn_code     = Column(String(15))
    gst_rate     = Column(Numeric(5, 2), default=18.00)
    tax_amount   = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    # Extended PO Line Identifiers
    sr_no        = Column(Integer)
    article_no   = Column(String(50))
    ean          = Column(String(50))
    vendor_style = Column(String(100))
    color        = Column(String(50))
    size         = Column(String(50))
    uom          = Column(String(20), default="EA")
    mrp          = Column(Numeric(15, 2))
    base_cost    = Column(Numeric(15, 2))
    taxable_value = Column(Numeric(15, 2))
    igst_amount  = Column(Numeric(15, 2), default=0.00)
    cgst_amount  = Column(Numeric(15, 2), default=0.00)
    sgst_amount  = Column(Numeric(15, 2), default=0.00)
    line_total   = Column(Numeric(15, 2))
    delivery_date = Column(Date)
    site_code    = Column(String(50))
    billed_quantity = Column(Numeric(12, 4), nullable=False, default=0.0000)
    pending_quantity = Column(Numeric(12, 4), nullable=False, default=0.0000)
    overbilled_quantity = Column(Numeric(12, 4), nullable=False, default=0.0000)
    line_status = Column(String(30), nullable=False, default="OPEN")  # OPEN | PARTIALLY_BILLED | BILLED | CLOSED | CANCELLED
    closure_reason = Column(Text, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(String(100), nullable=True)

    # Relationships
    order = relationship("SalesOrder", back_populates="items")


class SalesOrderInvoiceAllocation(BaseEntity):
    """
    Tracks invoice allocation details against Sales Orders / Historical POs.
    """
    __tablename__ = "sales_order_invoice_allocations"

    order_id     = Column(String(50), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    order_no     = Column(String(100), nullable=False, index=True)
    po_number    = Column(String(100), nullable=False, index=True)
    invoice_id   = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_no   = Column(String(100), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False)

    # Allocation Metrics
    po_quantity      = Column(Numeric(15, 4), nullable=False, default=0.0000)
    po_value         = Column(Numeric(15, 2), nullable=False, default=0.00)
    billed_quantity  = Column(Numeric(15, 4), nullable=False, default=0.0000)
    billed_value     = Column(Numeric(15, 2), nullable=False, default=0.00)
    pending_quantity = Column(Numeric(15, 4), nullable=False, default=0.0000)
    pending_value    = Column(Numeric(15, 2), nullable=False, default=0.00)
    status           = Column(String(50), default="ALLOCATED")  # ALLOCATED | PARTIAL | FULLY_BILLED
    allocation_metadata = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # Relationships
    order = relationship("SalesOrder", back_populates="allocations")
    invoice = relationship("SalesInvoice")



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
    customer_id        = Column(String(50),    nullable=True, index=True)  # v1374: denorm from orig invoice
    idempotency_key    = Column(String(100), nullable=True, index=True)
    policy_id          = Column(String(100), nullable=True)
    policy_version     = Column(Integer, nullable=True)
    policy_scope       = Column(String(100), nullable=True)
    policy_snapshot    = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    # Relationships
    items = relationship("SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan")


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    return_id    = Column(String(50), ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id   = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))
    item_id      = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id   = Column(String(50), nullable=True, index=True)
    code         = Column(String(50), nullable=False)
    name         = Column(String(255), nullable=False)
    quantity     = Column(Numeric(12, 4), nullable=False, default=1.0000)
    price        = Column(Numeric(15, 2), nullable=False)
    gst_rate     = Column(Numeric(5, 2), default=18.00)
    tax_amount   = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    sales_return = relationship("SalesReturn", back_populates="items")
