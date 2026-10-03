"""Customer purchase orders used as commercial sources for sales billing."""

from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from ..db.base import BaseEntity


class CustomerPurchaseOrder(BaseEntity):
    __tablename__ = "customer_purchase_orders"
    __table_args__ = (
        UniqueConstraint("company_id", "branch_id", "customer_id", "po_number", name="uq_customer_po_company_branch_customer_number"),
        Index("ix_customer_po_company_branch_customer", "company_id", "branch_id", "customer_id"),
        Index("ix_customer_po_company_branch_number", "company_id", "branch_id", "po_number"),
        CheckConstraint("ordered_quantity >= 0", name="ck_customer_po_ordered_qty_nonnegative"),
        CheckConstraint("billed_quantity >= 0 AND billed_quantity <= ordered_quantity + cancelled_quantity", name="ck_customer_po_billed_qty_bounded"),
        CheckConstraint("remaining_quantity >= 0", name="ck_customer_po_remaining_qty_nonnegative"),
    )

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    po_number = Column(String(100), nullable=False)
    po_date = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=True)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(30), nullable=False, default="OPEN", index=True)

    ordered_value = Column(Numeric(15, 2), nullable=False, default=0)
    cancelled_value = Column(Numeric(15, 2), nullable=False, default=0)
    billed_value = Column(Numeric(15, 2), nullable=False, default=0)
    remaining_value = Column(Numeric(15, 2), nullable=False, default=0)
    ordered_quantity = Column(Numeric(15, 4), nullable=False, default=0)
    cancelled_quantity = Column(Numeric(15, 4), nullable=False, default=0)
    billed_quantity = Column(Numeric(15, 4), nullable=False, default=0)
    remaining_quantity = Column(Numeric(15, 4), nullable=False, default=0)

    billing_policy_snapshot = Column(JSONB, nullable=False, server_default="{}")
    notes = Column(Text, nullable=True)
    closed_at = Column(Date, nullable=True)
    closed_by = Column(String(100), nullable=True)

    customer = relationship("Customer")
    lines = relationship("CustomerPurchaseOrderLine", back_populates="customer_po", cascade="all, delete-orphan")
    allocations = relationship("CustomerPOInvoiceAllocation", back_populates="customer_po")


class CustomerPurchaseOrderLine(BaseEntity):
    __tablename__ = "customer_purchase_order_lines"
    __table_args__ = (
        Index("ix_customer_po_line_po", "customer_po_id", "line_number"),
        CheckConstraint("quantity_ordered >= 0", name="ck_customer_po_line_qty_nonnegative"),
        CheckConstraint("quantity_billed >= 0 AND quantity_billed <= quantity_ordered + quantity_cancelled", name="ck_customer_po_line_billed_qty_bounded"),
        CheckConstraint("quantity_remaining >= 0", name="ck_customer_po_line_remaining_qty_nonnegative"),
    )

    customer_po_id = Column(String(50), ForeignKey("customer_purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number = Column(String(20), nullable=False)
    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id = Column(String(50), nullable=True, index=True)
    code = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    quantity_ordered = Column(Numeric(15, 4), nullable=False, default=0)
    quantity_cancelled = Column(Numeric(15, 4), nullable=False, default=0)
    quantity_billed = Column(Numeric(15, 4), nullable=False, default=0)
    quantity_remaining = Column(Numeric(15, 4), nullable=False, default=0)
    unit_price = Column(Numeric(15, 2), nullable=False, default=0)
    ordered_value = Column(Numeric(15, 2), nullable=False, default=0)
    billed_value = Column(Numeric(15, 2), nullable=False, default=0)
    remaining_value = Column(Numeric(15, 2), nullable=False, default=0)
    gst_rate = Column(Numeric(5, 2), nullable=False, default=18)
    hsn_code = Column(String(15), nullable=True)
    uom = Column(String(20), nullable=False, default="EA")
    delivery_location_id = Column(String(50), ForeignKey("customer_delivery_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    line_status = Column(String(30), nullable=False, default="OPEN", index=True)

    customer_po = relationship("CustomerPurchaseOrder", back_populates="lines")


class CustomerPOInvoiceAllocation(BaseEntity):
    __tablename__ = "customer_po_invoice_allocations"
    __table_args__ = (
        Index("ix_customer_po_alloc_po_line", "customer_po_id", "customer_po_line_id"),
        Index("ix_customer_po_alloc_invoice", "invoice_id", "invoice_item_id"),
        CheckConstraint("allocated_quantity > 0", name="ck_customer_po_alloc_qty_positive"),
        CheckConstraint("allocated_value >= 0", name="ck_customer_po_alloc_value_nonnegative"),
    )

    customer_po_id = Column(String(50), ForeignKey("customer_purchase_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_po_line_id = Column(String(50), ForeignKey("customer_purchase_order_lines.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_item_id = Column(Integer, ForeignKey("sales_invoice_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_po_number = Column(String(100), nullable=False)
    invoice_number = Column(String(100), nullable=False)
    allocated_quantity = Column(Numeric(15, 4), nullable=False)
    allocated_value = Column(Numeric(15, 2), nullable=False)
    status = Column(String(30), nullable=False, default="ALLOCATED")
    allocation_metadata = Column(JSONB, nullable=False, server_default="{}")

    customer_po = relationship("CustomerPurchaseOrder", back_populates="allocations")
    invoice = relationship("SalesInvoice")
    invoice_item = relationship("SalesInvoiceItem")
