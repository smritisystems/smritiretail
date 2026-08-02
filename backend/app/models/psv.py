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

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
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
