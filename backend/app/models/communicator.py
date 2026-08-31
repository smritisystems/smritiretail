"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class CommunicatorTemplate(BaseEntity):
    """
    Standardized notification template for Email, SMS, WhatsApp, and Push channels.
    """
    __tablename__ = "communicator_templates"

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    channel = Column(String(30), nullable=False, default="WHATSAPP")  # WHATSAPP, SMS, EMAIL, PUSH
    subject_template = Column(String(255), nullable=True)
    body_template = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="ACTIVE")
    description = Column(Text, nullable=True)


class CommunicatorLog(BaseEntity):
    """
    Immutable dispatch audit ledger tracking sent messages and delivery state.
    """
    __tablename__ = "communicator_logs"

    template_id = Column(String(50), ForeignKey("communicator_templates.id", ondelete="SET NULL"), nullable=True)
    channel = Column(String(30), nullable=False)  # WHATSAPP, SMS, EMAIL, PUSH
    recipient = Column(String(200), nullable=False, index=True)
    reference_doc_type = Column(String(50), nullable=True, index=True)
    reference_doc_id = Column(String(50), nullable=True, index=True)
    rendered_subject = Column(String(255), nullable=True)
    rendered_body = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="SENT")  # QUEUED, SENT, DELIVERED, FAILED
    gateway_response = Column(Text, nullable=True)
    dispatched_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
