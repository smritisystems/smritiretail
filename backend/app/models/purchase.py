"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.18.0
* Created    : 2026-07-11
* Modified   : 2026-07-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, Text
from ..db.base import BaseEntity, RowSecuredMixin


class Supplier(RowSecuredMixin, BaseEntity):
    """
    Supplier master — a business entity from whom goods are procured.
    Tenant-scoped (company + branch) per BaseEntity.
    """
    __tablename__ = "suppliers"

    name       = Column(String(255), nullable=False)
    code       = Column(String(50),  nullable=False)
    gst_number = Column(String(20),  nullable=True)
    mobile     = Column(String(20),  nullable=True)
    email      = Column(String(255), nullable=True)
    address    = Column(Text,        nullable=True)
    city       = Column(String(100), nullable=True)
    state      = Column(String(100), nullable=True)
    pincode    = Column(String(10),  nullable=True)
    # Cumulative liability owed to this supplier
    outstanding = Column(Numeric(15, 2), nullable=False, default=0.00)


class PurchaseOrder(RowSecuredMixin, BaseEntity):
    """
    A purchase order sent to a supplier.
    Status lifecycle: DRAFT → CONFIRMED → RECEIVED → CANCELLED
    """
    __tablename__ = "purchase_orders"

    order_no    = Column(String(100), nullable=False, unique=True)
    supplier_id = Column(String(50),  ForeignKey("suppliers.id",   ondelete="RESTRICT"), nullable=False)
    status      = Column(String(20),  nullable=False, default="DRAFT")
    notes       = Column(Text,        nullable=True)
    # Totals — populated by the service layer on create/update
    subtotal    = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(15, 2), nullable=False, default=0.00)


class PurchaseOrderItem(BaseEntity):
    """
    A line item within a purchase order.
    """
    __tablename__ = "purchase_order_items"

    order_id   = Column(String(50),   ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(50),   ForeignKey("products.id",        ondelete="RESTRICT"), nullable=False)
    code       = Column(String(50),   nullable=False)
    name       = Column(String(255),  nullable=False)
    quantity   = Column(Numeric(10, 2), nullable=False)
    cost_price = Column(Numeric(15, 2), nullable=False)  # agreed cost per unit
    gst_rate   = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(15, 2), nullable=False)  # qty × cost + tax


class PurchaseReceipt(BaseEntity):
    """
    A goods receipt note (GRN) — records stock physically received from a supplier.
    Linked to a PurchaseOrder (optional: a receipt can exist without a prior PO).
    Receiving a receipt triggers stock increments on the linked products.
    """
    __tablename__ = "purchase_receipts"

    receipt_no  = Column(String(100), nullable=False, unique=True)
    supplier_id = Column(String(50),  ForeignKey("suppliers.id",       ondelete="RESTRICT"), nullable=False)
    order_id    = Column(String(50),  ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    status      = Column(String(20),  nullable=False, default="PENDING")
    notes       = Column(Text,        nullable=True)
    subtotal    = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(15, 2), nullable=False, default=0.00)


class PurchaseReceiptItem(BaseEntity):
    """
    A line item within a purchase receipt (GRN).
    quantity_received drives the stock update on the product.
    """
    __tablename__ = "purchase_receipt_items"

    receipt_id         = Column(String(50),   ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    product_id         = Column(String(50),   ForeignKey("products.id",          ondelete="RESTRICT"), nullable=False)
    code               = Column(String(50),   nullable=False)
    name               = Column(String(255),  nullable=False)
    quantity_ordered   = Column(Numeric(10, 2), nullable=True)   # from PO (informational)
    quantity_received  = Column(Numeric(10, 2), nullable=False)  # actual received — drives stock
    cost_price         = Column(Numeric(15, 2), nullable=False)
    gst_rate           = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount         = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total         = Column(Numeric(15, 2), nullable=False)


class PurchaseReorderConfig(BaseEntity):
    """
    Reorder specifications configuration for a product.
    This replaces hardcoded REORDER_SPECS dictionary.
    """
    __tablename__ = "purchase_reorder_configs"

    product_id            = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    reorder_level         = Column(Numeric(12, 4), nullable=False, default=0.0000)
    reorder_quantity      = Column(Numeric(12, 4), nullable=False, default=0.0000)
    preferred_supplier_id = Column(String(50), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)


class PurchaseJurisdictionConfig(BaseEntity):
    """
    State tax jurisdiction configuration for a company/branch.
    """
    __tablename__ = "purchase_jurisdiction_configs"

    company_state = Column(String(10), nullable=False, default="DL")
