"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-24
Modified     : 2026-07-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Integration Hub & Event Gateway (Domain 17)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from app.db.base import Base


class WebhookSubscriptionModel(Base):
    """External listener webhook registration for system event notifications."""
    __tablename__ = "webhook_subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subscriber_name = Column(String(100), nullable=False)
    target_url = Column(String(500), nullable=False)
    secret_key = Column(String(255), nullable=False)  # For HMAC-SHA256 payload signature verification
    event_topics = Column(JSON, nullable=False)  # e.g., ["smriti.sales.pos_invoice.created.v1"]
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OutboundMessageQueueModel(Base):
    """Transactional Outbox Pattern message queue for reliable event delivery."""
    __tablename__ = "outbound_message_queue"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(100), nullable=False, unique=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    aggregate_type = Column(String(50), nullable=False, index=True)  # POS_INVOICE, STOCK_TRANSFER, PO
    aggregate_id = Column(String(100), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    status = Column(String(30), nullable=False, default="PENDING")  # PENDING, PUBLISHED, FAILED, DLQ
    retry_count = Column(Integer, nullable=False, default=0)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)


class ConnectorRegistryModel(Base):
    """Registry of integration connectors (Tally, SAP, Razorpay, PineLabs, Shopify)."""
    __tablename__ = "connector_registry"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    connector_code = Column(String(50), nullable=False, unique=True, index=True)  # TALLY_ERP9, RAZORPAY_POS
    connector_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # ACCOUNTING, PAYMENT_GATEWAY, MARKETPLACE, LOGISTICS
    auth_type = Column(String(30), nullable=False, default="API_KEY")  # API_KEY, OAUTH2, BASIC
    config_schema = Column(JSON, nullable=True)  # JSON schema for required parameters
    is_enabled = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
