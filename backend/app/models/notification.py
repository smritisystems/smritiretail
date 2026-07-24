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
Classification: Database Models for Centralized Communication Engine (Domain 20)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from app.db.base import Base


class NotificationTemplateModel(Base):
    """Dynamic multi-channel notification template master (Email, SMS, WhatsApp, In-App)."""
    __tablename__ = "notification_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_code = Column(String(50), nullable=False, unique=True, index=True)  # e.g., POS_DIGITAL_RECEIPT
    channel = Column(String(30), nullable=False, index=True)  # EMAIL, SMS, WHATSAPP, IN_APP, PUSH
    subject = Column(String(255), nullable=True)
    body_template = Column(Text, nullable=False)  # Jinja2 / Merge Tag string
    dlt_template_id = Column(String(100), nullable=True)  # DLT registration ID for Indian SMS
    language_code = Column(String(10), nullable=False, default="en")
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationDispatchModel(Base):
    """Log of outbound notifications sent via external gateways (Twilio, Gupshup, SES)."""
    __tablename__ = "notification_dispatches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_code = Column(String(50), nullable=True, index=True)
    channel = Column(String(30), nullable=False, index=True)
    recipient = Column(String(255), nullable=False, index=True)  # Phone number or Email address
    payload_data = Column(JSON, nullable=True)  # Dynamic variables passed
    status = Column(String(30), nullable=False, default="PENDING")  # PENDING, SENT, DELIVERED, FAILED
    provider = Column(String(50), nullable=True)  # GUPSHUP, TWILIO, AWS_SES, WHATSAPP_CLOUD
    provider_message_id = Column(String(255), nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)


class InAppNotificationModel(Base):
    """In-app alert notification bell items for SMRITI Workspace users."""
    __tablename__ = "in_app_notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False, default="INFO")  # INFO, WARNING, APPROVAL, ALERT
    action_url = Column(String(500), nullable=True)
    is_read = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
