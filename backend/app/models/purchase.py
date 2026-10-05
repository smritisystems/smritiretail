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

* Version    : 3.19.0
* Created    : 2026-07-11
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, Text, Date, DateTime, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class Supplier(BaseEntity):
    """
    Supplier master — a business entity from whom goods are procured.
    Tenant-scoped (company + branch) per BaseEntity.
    """
    __tablename__ = "suppliers"

    name       = Column(String(255), nullable=False)
    code       = Column(String(50),  nullable=False)
    identity_code = Column(String(100), nullable=True, unique=True, index=True)
    gst_number = Column(String(20),  nullable=True)
    mobile     = Column(String(20),  nullable=True)
    email      = Column(String(255), nullable=True)
    address    = Column(Text,        nullable=True)
    city       = Column(String(100), nullable=True)
    state      = Column(String(100), nullable=True)
    pincode    = Column(String(10),  nullable=True)
    # Cumulative liability owed to this supplier
    outstanding = Column(Numeric(15, 2), nullable=False, default=0.00)


class PurchaseOrder(BaseEntity):
    """
    A purchase order sent to a supplier.
    Status lifecycle: DRAFT → SUBMITTED → CONFIRMED → RECEIVED → COMPLETED | CANCELLED
    Phase A (v1508): added submitted/confirmed/cancelled audit columns and parent_order_id.
    Phase D (v1512): added amended_by, amended_at, amend_revision for amendment chain.
    """
    __tablename__ = "purchase_orders"

    order_no    = Column(String(100), nullable=False, index=True)  # unique per company via __table_args__
    identity_code = Column(String(100), nullable=True, unique=True, index=True)
    supplier_id = Column(String(50),  ForeignKey("suppliers.id",   ondelete="RESTRICT"), nullable=False)
    party_id    = Column(String(50),  ForeignKey("parties.id",     ondelete="SET NULL"), nullable=True, index=True)
    status      = Column(String(20),  nullable=False, default="DRAFT")
    notes       = Column(Text,        nullable=True)

    # Transaction Reproducibility & Governance Version Snapshots (P1.5)
    governance_snapshot_id = Column(String(50), nullable=True)
    rule_snapshots = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # Totals — populated by the service layer on create/update
    subtotal    = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(15, 2), nullable=False, default=0.00)

    # ── Lifecycle audit columns (Phase A v1508) ──────────────────────
    submitted_by        = Column(String(100), nullable=True)
    submitted_at        = Column(DateTime(timezone=True), nullable=True)
    confirmed_by        = Column(String(100), nullable=True)
    confirmed_at        = Column(DateTime(timezone=True), nullable=True)
    cancelled_by        = Column(String(100), nullable=True)
    cancelled_at        = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    # parent_order_id links an amended PO back to its predecessor (Phase D)
    parent_order_id     = Column(String(50), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    # ── Amendment audit columns (Phase D v1512) ──────────────────────────────
    amended_by          = Column(String(100), nullable=True)
    amended_at          = Column(DateTime(timezone=True), nullable=True)
    amend_revision      = Column(Integer, nullable=False, default=0, server_default="0")

    items = relationship("PurchaseOrderItem", backref="order", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        # order_no is unique per company (not globally) — supports multi-tenant same numbering
        UniqueConstraint("order_no", "company_id", name="uq_purchase_orders_order_no_company"),
    )


class PurchaseOrderItem(BaseEntity):
    """
    A line item within a purchase order.
    """
    __tablename__ = "purchase_order_items"

    order_id   = Column(String(50),   ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(50),   ForeignKey("products.id",        ondelete="RESTRICT"), nullable=False)
    item_id    = Column(String(50),   ForeignKey("items.id",            ondelete="SET NULL"), nullable=True, index=True)
    variant_id = Column(String(50),   nullable=True, index=True)
    code       = Column(String(50),   nullable=False)
    name       = Column(String(255),  nullable=False)
    quantity   = Column(Numeric(10, 2), nullable=False)
    cost_price = Column(Numeric(15, 2), nullable=False)  # agreed cost per unit
    gst_rate   = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(15, 2), nullable=False)  # qty × cost + tax


class PurchaseReceipt(BaseEntity):
    """
    A goods receipt note (GRN) — records stock physically received from a supplier into a designated godown.
    Linked to a PurchaseOrder (optional: a receipt can exist without a prior PO).
    Receiving a receipt triggers atomic batch stock increments on the linked products.
    """
    __tablename__ = "purchase_receipts"

    receipt_no   = Column(String(100), nullable=False, unique=True)
    identity_code = Column(String(100), nullable=True, unique=True, index=True)
    supplier_id  = Column(String(50),  ForeignKey("suppliers.id",       ondelete="RESTRICT"), nullable=False)
    order_id     = Column(String(50),  ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    warehouse_id = Column(String(50),  ForeignKey("warehouses.id",      ondelete="RESTRICT"), nullable=True)
    status       = Column(String(20),  nullable=False, default="PENDING")
    notes        = Column(Text,        nullable=True)
    subtotal     = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total    = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total  = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    items = relationship("PurchaseReceiptItem", backref="receipt", cascade="all, delete-orphan")



class PurchaseReceiptItem(BaseEntity):
    """
    A line item within a purchase receipt (GRN).
    Captures batch, manufacturing date, expiry date, MRP, and damaged quantities.
    Multi-PO receipt support is preserved by retaining the source PO reference per line.
    """
    __tablename__ = "purchase_receipt_items"

    receipt_id            = Column(String(50),   ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    product_id            = Column(String(50),   ForeignKey("products.id",          ondelete="RESTRICT"), nullable=False)
    item_id               = Column(String(50),   ForeignKey("items.id",              ondelete="SET NULL"), nullable=True, index=True)
    variant_id            = Column(String(50),   nullable=True, index=True)
    purchase_order_id     = Column(String(50),   ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    purchase_order_no     = Column(String(100),  nullable=True, index=True)
    purchase_order_line_id = Column(String(50), ForeignKey("purchase_order_items.id", ondelete="SET NULL"), nullable=True, index=True)
    code                  = Column(String(50),   nullable=False)
    name                  = Column(String(255),  nullable=False)
    batch_no              = Column(String(100),  nullable=True)
    mfg_date              = Column(Date,         nullable=True)
    expiry_date           = Column(Date,         nullable=True)
    mrp                   = Column(Numeric(15, 2), nullable=True)
    batch_id              = Column(String(50),   ForeignKey("item_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    warehouse_location_id = Column(String(50),   ForeignKey("item_warehouse_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    quantity_ordered      = Column(Numeric(10, 2), nullable=True)   # from PO (informational)
    quantity_received     = Column(Numeric(10, 2), nullable=False)  # actual received — drives stock
    quantity_damaged      = Column(Numeric(10, 2), nullable=False, default=0.00)
    cost_price            = Column(Numeric(15, 2), nullable=False)
    gst_rate              = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount            = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total            = Column(Numeric(15, 2), nullable=False)

    # Tracking Relationships (Phase 5)
    batch                 = relationship("ItemBatch", foreign_keys=[batch_id], lazy="selectin")
    warehouse_location    = relationship("ItemWarehouseLocation", foreign_keys=[warehouse_location_id], lazy="selectin")


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


class PurchaseBill(BaseEntity):
    """
    Supplier purchase commercial bill/invoice posted against a GRN or PurchaseOrder.
    Tracks supplier liability, tax breakdown, 3-way match status, and payment eligibility.
    """
    __tablename__ = "purchase_bills"

    bill_no             = Column(String(100), nullable=False, index=True)
    identity_code       = Column(String(100), nullable=True, unique=True, index=True)
    supplier_id         = Column(String(50),  ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    receipt_id          = Column(String(50),  ForeignKey("purchase_receipts.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id            = Column(String(50),  ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    bill_date           = Column(Date,        nullable=True)
    due_date            = Column(Date,        nullable=True)
    status              = Column(String(30),  nullable=False, default="DRAFT", index=True)
    taxable_amount      = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_amount          = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount        = Column(Numeric(15, 2), nullable=False, default=0.00)
    paid_amount         = Column(Numeric(15, 2), nullable=False, default=0.00)
    notes               = Column(Text,        nullable=True)
    cancellation_reason = Column(Text,        nullable=True)

    items = relationship("PurchaseBillItem", backref="bill", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "bill_no", name="uq_purchase_bills_company_bill_no"),
    )


class PurchaseBillItem(BaseEntity):
    """
    A line item within a supplier purchase bill / commercial invoice.
    Links directly to originating PO item and GRN item for line-level 3-way variance matching.
    """
    __tablename__ = "purchase_bill_items"

    bill_id         = Column(String(50), ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id      = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id         = Column(String(50), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id      = Column(String(50), nullable=True, index=True)
    po_item_id      = Column(String(50), ForeignKey("purchase_order_items.id", ondelete="SET NULL"), nullable=True, index=True)
    receipt_item_id = Column(String(50), ForeignKey("purchase_receipt_items.id", ondelete="SET NULL"), nullable=True, index=True)
    code            = Column(String(50), nullable=False)
    name            = Column(String(255), nullable=False)
    quantity        = Column(Numeric(12, 4), nullable=False, default=0.0000)
    rate            = Column(Numeric(15, 4), nullable=False, default=0.0000)
    taxable_amount  = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_amount      = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount    = Column(Numeric(15, 2), nullable=False, default=0.00)
