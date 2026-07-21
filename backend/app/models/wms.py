"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 18.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Enterprise WMS & Multi-Bin Location Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from app.db.base_class import Base


class BinLocationModel(Base):
    """Hierarchical Bin Location Model (Aisle-Rack-Shelf-Bin)."""
    __tablename__ = "wms_bin_locations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id = Column(String(50), nullable=False, index=True)
    zone = Column(String(50), nullable=False, default="MAIN")
    aisle = Column(String(20), nullable=False)
    rack = Column(String(20), nullable=False)
    shelf = Column(String(20), nullable=False)
    bin_code = Column(String(50), nullable=False, unique=True, index=True)
    max_capacity_units = Column(Integer, nullable=False, default=1000)
    current_occupancy_units = Column(Integer, nullable=False, default=0)
    is_active = Column(String(10), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)


class StockTransferModel(Base):
    """Multi-Warehouse In-Transit Stock Transfer Model."""
    __tablename__ = "wms_stock_transfers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transfer_number = Column(String(50), nullable=False, unique=True, index=True)
    from_warehouse_id = Column(String(50), nullable=False)
    to_warehouse_id = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False, default="INITIATED")  # INITIATED, SHIPPED, IN_TRANSIT, RECEIVED
    shipped_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
