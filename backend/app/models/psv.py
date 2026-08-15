"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-16
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Index
from sqlalchemy.orm import relationship
from ..db.base import Base

class PSVParty(Base):
    __tablename__ = "psv_parties"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    stock_count = Column(Integer, default=0)
    sell_through = Column(Numeric(5, 2), default=0.00)
    weeks_of_cover = Column(Numeric(5, 2), default=0.00)
    capital_locked = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default="Healthy")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    sku_tracking = relationship("PSVPartySkuTracking", back_populates="party", lazy="selectin")


class PSVPartySkuTracking(Base):
    __tablename__ = "psv_sku_tracking"

    id = Column(Integer, primary_key=True, autoincrement=True)
    party_id = Column(String(50), ForeignKey("psv_parties.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    sku = Column(String(100), nullable=False)
    invoiced_qty = Column(Integer, default=0)
    confirmed_sold_qty = Column(Integer, default=0)
    returned_qty = Column(Integer, default=0)

    party = relationship("PSVParty", back_populates="sku_tracking", lazy="selectin")
    product = relationship("Product", lazy="joined")


class PSVStockEvent(Base):
    """
    PSVStockEvent — Production Observability Immutable Event Ledger in SmritiPSV.
    """
    __tablename__ = "psv_stock_events"

    event_id = Column(String(50), primary_key=True)
    source_event_id = Column(String(100), nullable=False, unique=True) # ULID generated at event creation
    correlation_id = Column(String(100), nullable=False, index=True) # Trace ID across Order -> Inv -> PSV
    causation_id = Column(String(100), nullable=True) # Parent doc/event ID
    event_schema_version = Column(String(20), nullable=False, default="1.0")
    company_code = Column(String(50), nullable=False, index=True)
    source_database = Column(String(100), nullable=False)
    source_document_type = Column(String(50), nullable=False)
    source_document_id = Column(String(50), nullable=False)
    source_document_line_id = Column(String(50), nullable=True)
    psv_party_id = Column(String(50), nullable=False)
    destination_type = Column(String(30), default="RETAIL_STORE") # RETAIL_STORE, WAREHOUSE, DISTRIBUTION_CENTER, TRANSPORTER
    destination_id = Column(String(50), nullable=True)
    psv_store_id = Column(String(50), nullable=True) # Nullable store reference
    sku = Column(String(100), nullable=False, index=True)
    movement_type = Column(String(30), nullable=False) # GST_BILLED, DISPATCHED, IN_TRANSIT, STORE_RECEIVED, SOLD, RETURNED, TRANSFERRED
    quantity = Column(Numeric(12, 4), nullable=False)
    source_event_created_at = Column(DateTime(timezone=True), nullable=False)
    event_date = Column(DateTime(timezone=True), nullable=False)
    sync_status = Column(String(20), nullable=False, default="PENDING", index=True) # PENDING -> PROCESSING -> PROJECTED / FAILED -> DEAD_LETTER
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_psv_events_party_sku", "company_code", "psv_party_id", "sku"),
    )


class PSVStockBalance(Base):
    """
    PSVStockBalance — Stock Visibility Projection Balance in SmritiPSV.
    """
    __tablename__ = "psv_stock_balances"

    id = Column(String(50), primary_key=True)
    company_code = Column(String(50), nullable=False, index=True)
    psv_party_id = Column(String(50), nullable=False, index=True)
    psv_store_id = Column(String(50), nullable=True)
    sku = Column(String(100), nullable=False, index=True)
    billed_qty = Column(Numeric(12, 4), nullable=False, default=0.0000)
    received_qty = Column(Numeric(12, 4), nullable=False, default=0.0000)
    sold_qty = Column(Numeric(12, 4), nullable=False, default=0.0000)
    returned_qty = Column(Numeric(12, 4), nullable=False, default=0.0000)
    transferred_qty = Column(Numeric(12, 4), nullable=False, default=0.0000)
    current_balance = Column(Numeric(12, 4), nullable=False, default=0.0000)
    last_event_id = Column(String(50), nullable=True)
    last_updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
