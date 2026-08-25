"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, date, timezone
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


class DistributionRoute(BaseEntity):
    """
    Delivery Route definition for van sales and scheduled retailer dispatch.
    """
    __tablename__ = "distribution_routes"

    route_code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    territory_code = Column(String(50), nullable=False, index=True)
    assigned_salesman_id = Column(String(50), nullable=True, index=True)
    assigned_driver_id = Column(String(50), nullable=True, index=True)
    vehicle_number = Column(String(30), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")

    # Relationships
    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan")


class RouteStop(BaseEntity):
    """
    Sequential retailer stops on a distribution delivery route.
    """
    __tablename__ = "distribution_route_stops"

    route_id = Column(String(50), ForeignKey("distribution_routes.id", ondelete="CASCADE"), nullable=False, index=True)
    party_id = Column(String(50), ForeignKey("parties.id", ondelete="RESTRICT"), nullable=False, index=True)
    stop_sequence = Column(Integer, nullable=False, default=1)
    planned_time = Column(String(10), nullable=True)  # e.g., "10:30 AM"
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    route = relationship("DistributionRoute", back_populates="stops")


class DistributionOrder(BaseEntity):
    """
    Distribution Order Master covering Primary Sales (Mfg -> Distributor)
    and Secondary Sales (Distributor -> Retailer).
    """
    __tablename__ = "distribution_orders"

    order_no = Column(String(100), nullable=False, unique=True, index=True)
    party_id = Column(String(50), ForeignKey("parties.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_type = Column(String(30), nullable=False, default="PRIMARY")  # PRIMARY, SECONDARY
    status = Column(String(30), nullable=False, default="DRAFT")  # DRAFT, CONFIRMED, LOADED, DISPATCHED, DELIVERED, SETTLED, CANCELLED
    
    territory_code = Column(String(50), nullable=True, index=True)
    salesman_id = Column(String(50), nullable=True, index=True)
    route_id = Column(String(50), nullable=True, index=True)
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


class LoadingSheet(BaseEntity):
    """
    Warehouse vehicle loading sheet consolidating multiple distribution orders for a route.
    """
    __tablename__ = "loading_sheets"

    sheet_no = Column(String(50), nullable=False, unique=True, index=True)
    route_id = Column(String(50), ForeignKey("distribution_routes.id", ondelete="SET NULL"), nullable=True, index=True)
    vehicle_number = Column(String(30), nullable=True)
    driver_name = Column(String(100), nullable=True)
    dispatch_date = Column(Date, default=date.today)
    status = Column(String(30), default="PLANNED")  # PLANNED, LOADED, DISPATCHED, RECONCILED
    total_orders_count = Column(Integer, default=0)
    total_boxes = Column(Integer, default=0)
    total_value = Column(Numeric(15, 2), default=0.00)

    # Relationships
    items = relationship("LoadingSheetItem", back_populates="loading_sheet", cascade="all, delete-orphan")


class LoadingSheetItem(BaseEntity):
    """
    Consolidated item lines on a loading sheet.
    """
    __tablename__ = "loading_sheet_items"

    loading_sheet_id = Column(String(50), ForeignKey("loading_sheets.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(String(50), ForeignKey("distribution_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    loaded_quantity = Column(Numeric(12, 4), default=0.0000)
    returned_quantity = Column(Numeric(12, 4), default=0.0000)

    # Relationships
    loading_sheet = relationship("LoadingSheet", back_populates="items")


class DistributionClaim(BaseEntity):
    """
    Dealer / Distributor Claims (Damaged stock, price differential, scheme incentives, expired items).
    """
    __tablename__ = "distribution_claims"

    claim_no = Column(String(50), nullable=False, unique=True, index=True)
    party_id = Column(String(50), ForeignKey("parties.id", ondelete="RESTRICT"), nullable=False, index=True)
    claim_type = Column(String(50), nullable=False)  # DAMAGE, EXPIRY, PRICE_DIFF, SCHEME_INCENTIVE, SHORTAGE
    reference_order_no = Column(String(100), nullable=True, index=True)
    claim_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    approved_amount = Column(Numeric(15, 2), nullable=True)
    status = Column(String(30), default="SUBMITTED")  # SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, SETTLED
    reviewed_by = Column(String(50), nullable=True)
    settlement_credit_note_id = Column(String(50), nullable=True)
    remarks = Column(Text, nullable=True)


class DistributionSettlement(BaseEntity):
    """
    Final route trip / van sales delivery and financial cash/cheque/credit settlement.
    """
    __tablename__ = "distribution_settlements"

    settlement_no = Column(String(50), nullable=False, unique=True, index=True)
    loading_sheet_id = Column(String(50), ForeignKey("loading_sheets.id", ondelete="RESTRICT"), nullable=True, index=True)
    route_id = Column(String(50), nullable=True, index=True)
    driver_id = Column(String(50), nullable=True)
    salesman_id = Column(String(50), nullable=True)
    
    total_sales_value = Column(Numeric(15, 2), default=0.00)
    cash_collected = Column(Numeric(15, 2), default=0.00)
    cheques_collected = Column(Numeric(15, 2), default=0.00)
    upi_collected = Column(Numeric(15, 2), default=0.00)
    credit_extended = Column(Numeric(15, 2), default=0.00)
    returned_stock_value = Column(Numeric(15, 2), default=0.00)
    shortage_excess_amount = Column(Numeric(15, 2), default=0.00)
    
    status = Column(String(30), default="DRAFT")  # DRAFT, RECONCILED, APPROVED, POSTED
    settled_at = Column(DateTime, default=datetime.utcnow)
