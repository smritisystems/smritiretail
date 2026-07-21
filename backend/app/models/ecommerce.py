"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 19.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for E-Commerce Multi-Channel Sync Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text
from app.db.base_class import Base


class SalesChannelModel(Base):
    """Sales Channel Integration Connector (Shopify, Amazon, WooCommerce)."""
    __tablename__ = "ecommerce_channels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel_name = Column(String(50), nullable=False, index=True)  # SHOPIFY, WOOCOMMERCE, AMAZON, QUICK_COMMERCE
    store_url = Column(String(255), nullable=False)
    sync_status = Column(String(30), nullable=False, default="CONNECTED")
    last_sync_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class OmnichannelOrderModel(Base):
    """Omnichannel E-Commerce Order Record."""
    __tablename__ = "ecommerce_orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel_order_id = Column(String(100), nullable=False, index=True)
    channel_name = Column(String(50), nullable=False)
    fulfillment_status = Column(String(30), nullable=False, default="PENDING")  # PENDING, ROUTED, SHIPPED, DELIVERED
    fulfillment_source = Column(String(50), nullable=False, default="WAREHOUSE")  # WAREHOUSE, STORE_LOCATION
    shipping_address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
