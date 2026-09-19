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

* Version    : 3.33.0
* Created    : 2026-09-19
* Modified   : 2026-09-19
* Copyright  : © SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..db.base import Base


class InwardCostComponentType(Base):
    """
    Master registry of supported inward landed cost types (e.g. Freight, Cartage,
    Loading, Marine Insurance, Customs Duty, Entry Toll).
    Enforces compliance regarding capitalizability and required documentation.
    """
    __tablename__ = "inward_cost_component_types"

    id = Column(String(50), primary_key=True)
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    category = Column(String(30), nullable=False, default="CAPITALIZABLE")
    is_capitalizable = Column(Boolean, nullable=False, default=True)
    default_allocation_method = Column(String(20), nullable=False, default="VALUE")
    requires_document = Column(Boolean, nullable=False, default=False)
    requires_transporter = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class InwardCostComponent(Base):
    """
    Unbounded, independently traceable cost add-on line item attached to a GRN.
    Captures freight, cartage, handling, loading, insurance, or duties with tax treatment
    (ITC eligible vs capitalized) and transporter documentation reference.
    """
    __tablename__ = "inward_cost_components"

    id = Column(String(50), primary_key=True)
    company_id = Column(String(50), nullable=True, index=True)
    branch_id = Column(String(50), nullable=True)
    grn_id = Column(String(50), ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    component_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    taxable_amount = Column(Numeric(15, 2), nullable=False)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0.00)
    itc_eligible = Column(Boolean, nullable=False, default=True)
    is_capitalizable = Column(Boolean, nullable=False, default=True)
    allocation_method = Column(String(20), nullable=False, default="VALUE")
    allocation_scope = Column(String(20), nullable=False, default="DOCUMENT")
    scope_reference_id = Column(String(50), nullable=True)
    transporter_name = Column(String(150), nullable=True)
    document_type = Column(String(30), nullable=True)
    document_no = Column(String(100), nullable=True)
    document_date = Column(Date, nullable=True)
    vehicle_no = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="ALLOCATED")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by = Column(String(50), nullable=True)

    # Relationships
    receipt = relationship("PurchaseReceipt", backref="cost_components")
    allocations = relationship("InwardCostAllocation", backref="cost_component", cascade="all, delete-orphan")


class InwardCostAllocation(Base):
    """
    Immutable ledger mapping an allocated inward cost component to a specific GRN SKU line item.
    Stores the exact base value, allocated sum, per-unit add-on, and penny rounding adjustment.
    """
    __tablename__ = "inward_cost_allocations"

    id = Column(String(50), primary_key=True)
    company_id = Column(String(50), nullable=True, index=True)
    branch_id = Column(String(50), nullable=True)
    grn_id = Column(String(50), nullable=False, index=True)
    grn_item_id = Column(String(50), ForeignKey("purchase_receipt_items.id", ondelete="CASCADE"), nullable=False, index=True)
    cost_component_id = Column(String(50), ForeignKey("inward_cost_components.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), nullable=False, index=True)
    allocation_method = Column(String(20), nullable=False)
    basis_value = Column(Numeric(15, 4), nullable=False)
    allocated_amount = Column(Numeric(15, 2), nullable=False)
    allocated_per_unit = Column(Numeric(15, 4), nullable=False)
    rounding_adjustment = Column(Numeric(15, 4), nullable=False, default=0.0000)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    grn_item = relationship("PurchaseReceiptItem", backref="cost_allocations")


class InwardCostAdjustment(Base):
    """
    Late-arriving freight invoice adjustment. Enables adjusting the capitalized cost
    and posting valuation variances after the GRN has already been finalized,
    without reopening or mutating historical records.
    """
    __tablename__ = "inward_cost_adjustments"

    id = Column(String(50), primary_key=True)
    company_id = Column(String(50), nullable=True, index=True)
    branch_id = Column(String(50), nullable=True)
    adjustment_no = Column(String(50), nullable=False, unique=True)
    grn_id = Column(String(50), ForeignKey("purchase_receipts.id", ondelete="RESTRICT"), nullable=False, index=True)
    total_adjustment_amount = Column(Numeric(15, 2), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="POSTED")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by = Column(String(50), nullable=True)

    # Relationships
    receipt = relationship("PurchaseReceipt", backref="cost_adjustments")
