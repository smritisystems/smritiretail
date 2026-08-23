"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class DistributionTerritory(BaseEntity):
    """
    Distribution Territory Master governing geographic sales zones and dealer allocations.
    """
    __tablename__ = "distribution_territories"

    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    region = Column(String(50), nullable=False, default="WEST")  # NORTH, SOUTH, EAST, WEST, CENTRAL
    parent_territory_code = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")


class DealerAssignment(BaseEntity):
    """
    Dealer, Distributor & Salesman territorial assignments and credit allocations.
    """
    __tablename__ = "dealer_assignments"
    __table_args__ = (
        UniqueConstraint("party_id", "territory_code", name="uq_dealer_territory_assignment"),
    )

    party_id = Column(String(50), ForeignKey("parties.id", ondelete="CASCADE"), nullable=False, index=True)
    territory_code = Column(String(50), nullable=False, index=True)
    salesman_id = Column(String(50), nullable=True, index=True)
    credit_limit = Column(Numeric(15, 2), nullable=False, default=0.00)
    credit_days = Column(Integer, nullable=False, default=30)
    is_active = Column(Boolean, nullable=False, default=True)


class DistributionOrder(BaseEntity):
    """
    Distribution Order Master covering Primary Sales (Mfg -> Distributor)
    and Secondary Sales (Distributor -> Retailer).
    """
    __tablename__ = "distribution_orders"

    order_no = Column(String(100), nullable=False, unique=True, index=True)
    party_id = Column(String(50), ForeignKey("parties.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_type = Column(String(30), nullable=False, default="PRIMARY")  # PRIMARY, SECONDARY
    status = Column(String(30), nullable=False, default="DRAFT")  # DRAFT, CONFIRMED, DISPATCHED, DELIVERED, SETTLED, CANCELLED
    
    territory_code = Column(String(50), nullable=True, index=True)
    salesman_id = Column(String(50), nullable=True, index=True)
    delivery_route = Column(String(100), nullable=True)
    delivery_challan_no = Column(String(100), nullable=True)
    
    taxable_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(15, 2), nullable=False, default=0.00)
    
    # Transaction Reproducibility & Governance Version Snapshots (P1.5)
    governance_snapshot_id = Column(String(50), nullable=True)
    rule_snapshots = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # Relationships
    lines = relationship("DistributionOrderItem", back_populates="order", cascade="all, delete-orphan")


class DistributionOrderItem(BaseEntity):
    """
    Distribution Order Line Items.
    """
    __tablename__ = "distribution_order_items"

    order_id = Column(String(50), ForeignKey("distribution_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="SET NULL"), nullable=True)
    
    quantity = Column(Numeric(12, 4), nullable=False, default=1.0000)
    unit_price = Column(Numeric(15, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    order = relationship("DistributionOrder", back_populates="lines")
