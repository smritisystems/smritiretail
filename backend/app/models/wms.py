"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.db.base import BaseEntity, RowSecuredMixin


class WarehouseZone(RowSecuredMixin, BaseEntity):
    """
    WarehouseZone — Logical zone breakdown inside a physical warehouse.
    Types: STORAGE, PICKING, RECEIVING, PACKING, COLD_STORAGE
    """
    __tablename__ = "warehouse_zones"

    warehouse_id = Column(String(50), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_code    = Column(String(50), nullable=False, unique=True)
    zone_name    = Column(String(200), nullable=False)
    zone_type    = Column(String(50), nullable=False, default="STORAGE")  # STORAGE, PICKING, RECEIVING, PACKING, COLD_STORAGE
    is_active    = Column(Boolean, nullable=False, default=True)

    bins         = relationship("WarehouseBin", back_populates="zone", cascade="all, delete-orphan")


class WarehouseBin(RowSecuredMixin, BaseEntity):
    """
    WarehouseBin — Granular bin location (Aisle-Rack-Shelf-Bin) for precise stock picking and putaway.
    """
    __tablename__ = "warehouse_bins"

    warehouse_id      = Column(String(50), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id           = Column(String(50), ForeignKey("warehouse_zones.id", ondelete="SET NULL"), nullable=True, index=True)
    bin_code          = Column(String(50), nullable=False, unique=True)  # e.g. A01-R02-S03-B04
    aisle             = Column(String(20), nullable=True)
    rack              = Column(String(20), nullable=True)
    shelf             = Column(String(20), nullable=True)
    bin_type          = Column(String(50), nullable=False, default="STANDARD")  # STANDARD, PALLET, FAST_PICK, BULK
    max_weight_kg     = Column(Numeric(10, 2), nullable=False, default=Decimal("500.00"))
    current_weight_kg = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    is_occupied       = Column(Boolean, nullable=False, default=False)
    is_active         = Column(Boolean, nullable=False, default=True)

    zone              = relationship("WarehouseZone", back_populates="bins")
    assignments       = relationship("StockBinAssignment", back_populates="bin", cascade="all, delete-orphan")


class StockBinAssignment(BaseEntity):
    """
    StockBinAssignment — Maps physical inventory units of a product to specific warehouse bins.
    """
    __tablename__ = "stock_bin_assignments"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    bin_id     = Column(String(50), ForeignKey("warehouse_bins.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity   = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))

    bin        = relationship("WarehouseBin", back_populates="assignments")
