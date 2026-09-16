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
    settled_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class EWayBill(BaseEntity):
    """
    Canonical E-Way Bill entity for GST compliance and goods transit governance (2026 NIC Schema).
    """
    __tablename__ = "eway_bills"

    # Core Identifiers & Document Linkage
    eway_bill_no = Column(String(50), nullable=True, unique=True, index=True)
    document_type = Column(String(50), nullable=True, default="INVOICE")  # INVOICE, DELIVERY_CHALLAN, CREDIT_NOTE
    document_id = Column(String(50), nullable=True, index=True)
    document_no = Column(String(50), nullable=True)
    document_date = Column(Date, nullable=True)
    invoice_id = Column(String(50), nullable=True, index=True)

    # Statutory Transaction & Supply Classification
    supply_type = Column(String(10), nullable=True, default="O")  # O = Outward, I = Inward
    sub_supply_type = Column(Integer, nullable=True, default=1)  # 1 = Supply, 3 = Export, 4 = Job Work, etc.
    sub_supply_desc = Column(String(100), nullable=True)
    trans_type = Column(Integer, nullable=True, default=1)  # 1 = Regular, 2 = Bill To-Ship To, 3 = Bill From-Dispatch From, 4 = Combination

    # Bill From / Consignor
    gstin_from = Column(String(15), nullable=True)
    trade_name_from = Column(String(200), nullable=True)
    state_code_from = Column(Integer, nullable=True)

    # Bill To / Consignee
    gstin_to = Column(String(15), nullable=True)
    trade_name_to = Column(String(200), nullable=True)
    state_code_to = Column(Integer, nullable=True)

    # Dispatch From / Physical Origin Snapshot
    dispatch_from_gstin = Column(String(15), nullable=True)
    dispatch_from_trade_name = Column(String(200), nullable=True)
    dispatch_from_place = Column(String(100), nullable=True)
    dispatch_from_pincode = Column(String(10), nullable=True)
    dispatch_from_state_code = Column(Integer, nullable=True)
    dispatch_from_addr1 = Column(Text, nullable=True)
    dispatch_from_addr2 = Column(Text, nullable=True)

    # Ship To / Physical Delivery Site Snapshot
    ship_to_gstin = Column(String(15), nullable=True)
    ship_to_trade_name = Column(String(200), nullable=True)
    ship_to_place = Column(String(100), nullable=True)
    ship_to_pincode = Column(String(10), nullable=True)
    ship_to_state_code = Column(Integer, nullable=True)
    ship_to_addr1 = Column(Text, nullable=True)
    ship_to_addr2 = Column(Text, nullable=True)

    # Consignment Commercials & Tax Breakdown
    total_taxable_amount = Column(Numeric(15, 2), nullable=True, default=0.00)
    cgst_amount = Column(Numeric(15, 2), nullable=True, default=0.00)
    sgst_amount = Column(Numeric(15, 2), nullable=True, default=0.00)
    igst_amount = Column(Numeric(15, 2), nullable=True, default=0.00)
    cess_amount = Column(Numeric(15, 2), nullable=True, default=0.00)
    other_amount = Column(Numeric(15, 2), nullable=True, default=0.00)
    consignment_value = Column(Numeric(15, 2), nullable=True, default=0.00)
    document_value = Column(Numeric(15, 2), nullable=True, default=0.00)
    main_hsn_code = Column(String(20), nullable=True)

    # Transport Logistics (Part-B)
    transporter_id = Column(String(50), nullable=True)
    transporter_name = Column(String(200), nullable=True)
    transport_mode = Column(String(10), nullable=True, default="1")  # 1 = Road, 2 = Rail, 3 = Air, 4 = Ship
    trans_doc_no = Column(String(50), nullable=True)
    trans_doc_date = Column(Date, nullable=True)
    vehicle_no = Column(String(30), nullable=True)
    vehicle_number = Column(String(30), nullable=True)
    vehicle_type = Column(String(10), nullable=True, default="R")  # R = Regular, O = Over Dimensional
    distance_km = Column(Numeric(10, 2), nullable=True, default=0.00)
    part_b_status = Column(String(20), nullable=True, default="PENDING")  # PENDING, UPDATED, EXEMPT_50KM

    # Statutory Lifecycle, Validity & Verification
    irn = Column(String(64), nullable=True, index=True)
    ewb_date = Column(DateTime(timezone=True), nullable=True)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=True, default="GENERATED")  # GENERATED, CANCELLED, REJECTED, EXPIRED
    signed_qr_code = Column(Text, nullable=True)
    cancel_date = Column(DateTime(timezone=True), nullable=True)
    cancel_reason_code = Column(String(20), nullable=True)
    cancel_remarks = Column(Text, nullable=True)
    nic_payload_snapshot = Column(JSONB, nullable=True)
    nic_response_snapshot = Column(JSONB, nullable=True)

