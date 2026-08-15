"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity

class PackingSlip(BaseEntity):
    """SMRITI Retail OS - Order Pick & Pack Slip."""
    __tablename__ = "packing_slips"

    packing_slip_number = Column(String(50), nullable=False, unique=True, index=True)
    sales_invoice_id = Column(String(50), nullable=False, index=True)
    packed_by_user_id = Column(String(50), nullable=True)
    status = Column(String(30), default="PACKED")  # PENDING, PACKED, CANCELLED
    total_packages = Column(Integer, default=1)
    weight_kg = Column(Numeric(10, 3), default=0.000)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("PackingSlipItem", back_populates="packing_slip")

class PackingSlipItem(BaseEntity):
    """Packing Slip Item Lines."""
    __tablename__ = "packing_slip_items"

    packing_slip_id = Column(String(50), ForeignKey("packing_slips.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), nullable=False, index=True)
    sku = Column(String(100), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    batch_number = Column(String(50), nullable=True)

    packing_slip = relationship("PackingSlip", back_populates="items")

class Dispatch(BaseEntity):
    """Dispatch Manifest & Delivery Manifest."""
    __tablename__ = "dispatches"

    dispatch_number = Column(String(50), nullable=False, unique=True, index=True)
    packing_slip_id = Column(String(50), ForeignKey("packing_slips.id", ondelete="RESTRICT"), nullable=False, index=True)
    courier_partner = Column(String(100), nullable=True)  # BlueDart, Delhivery, In-House Driver
    tracking_number = Column(String(100), nullable=True, index=True)
    driver_person_id = Column(String(50), nullable=True, index=True)  # Universal Person ID for Driver
    status = Column(String(30), default="DISPATCHED")  # DISPATCHED, IN_TRANSIT, DELIVERED, RETURNED
    dispatch_date = Column(DateTime, default=datetime.utcnow)
    delivered_date = Column(DateTime, nullable=True)
    delivery_fee = Column(Numeric(15, 2), default=0.00)
    driver_commission = Column(Numeric(15, 2), default=50.00)  # ₹50 fixed driver commission

    items = relationship("DispatchItem", back_populates="dispatch")

class DispatchItem(BaseEntity):
    """Dispatch Manifest Line Items."""
    __tablename__ = "dispatch_items"

    dispatch_id = Column(String(50), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), nullable=False, index=True)
    quantity = Column(Numeric(12, 3), nullable=False)

    dispatch = relationship("Dispatch", back_populates="items")

class DeliveryCommissionSettlement(BaseEntity):
    """Settlement Ledger for Driver & Partner Commissions."""
    __tablename__ = "delivery_commission_settlements"

    settlement_number = Column(String(50), nullable=False, unique=True, index=True)
    participant_id = Column(String(50), nullable=False, index=True)
    participant_role = Column(String(50), nullable=False)  # DRIVER, SALESPERSON, REFERRER
    total_commission_amount = Column(Numeric(15, 2), nullable=False)
    settlement_status = Column(String(30), default="SETTLED")  # PENDING, SETTLED, PAID
    settled_date = Column(DateTime, default=datetime.utcnow)

class ReverseLogisticsReturn(BaseEntity):
    """Reverse Logistics & Return Pick manifest."""
    __tablename__ = "reverse_logistics_returns"

    return_manifest_number = Column(String(50), nullable=False, unique=True, index=True)
    original_dispatch_id = Column(String(50), ForeignKey("dispatches.id", ondelete="RESTRICT"), nullable=False, index=True)
    sales_return_id = Column(String(50), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    restock_status = Column(String(30), default="RESTOCKED")  # RESTOCKED, SCRAPPED, INSPECTION
    commission_reversed = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
