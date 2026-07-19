"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from ..db.base import BaseEntity


class SMRITIServiceAccount(BaseEntity):
    """
    Non-human service account identity representing an external system,
    POS sync agent, e-commerce integration, or background worker.
    """
    __tablename__ = "smriti_service_accounts"

    code        = Column(String(50), unique=True, nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    api_keys    = relationship("SMRITIAPIKey", back_populates="service_account", cascade="all, delete-orphan")


class SMRITIAPIKey(BaseEntity):
    """
    Scoped API Key credential belonging to a service account.
    Uses key_prefix (indexed lookup) + hashed_secret (SHA-256 HMAC digest).
    """
    __tablename__ = "smriti_api_keys"

    service_account_id    = Column(String(36), ForeignKey("smriti_service_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    name                  = Column(String(100), nullable=False)
    key_prefix            = Column(String(24), nullable=False, index=True)
    hashed_secret         = Column(String(128), nullable=False)
    
    rate_limit_per_minute = Column(Integer, default=600, nullable=False) # Default 600 req/min
    allowed_ip_cidrs      = Column(JSON, nullable=True)                  # Optional array of allowed CIDR strings e.g. ["192.168.1.0/24"]
    expires_at            = Column(DateTime(timezone=True), nullable=True)
    last_used_at          = Column(DateTime(timezone=True), nullable=True)

    service_account       = relationship("SMRITIServiceAccount", back_populates="api_keys")
    permission_sets       = relationship("SMRITIAPIKeyPermissionSet", back_populates="api_key", cascade="all, delete-orphan")
    usage_logs            = relationship("SMRITIAPIKeyLog", back_populates="api_key", cascade="all, delete-orphan")


class SMRITIAPIKeyPermissionSet(BaseEntity):
    """
    Junction table assigning Permission Sets to an API Key.
    """
    __tablename__ = "smriti_api_key_permission_sets"

    api_key_id        = Column(String(36), ForeignKey("smriti_api_keys.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_set_id = Column(String(36), ForeignKey("smriti_permission_sets.id", ondelete="CASCADE"), nullable=False, index=True)

    api_key           = relationship("SMRITIAPIKey", back_populates="permission_sets")
    permission_set    = relationship("SMRITIPermissionSet")


class SMRITIAPIKeyLog(BaseEntity):
    """
    Audit log recording requests executed via an API Key.
    """
    __tablename__ = "smriti_api_key_logs"

    api_key_id       = Column(String(36), ForeignKey("smriti_api_keys.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_address       = Column(String(45), nullable=True)
    endpoint         = Column(String(255), nullable=False)
    http_method      = Column(String(10), nullable=False)
    status_code      = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=True)

    api_key          = relationship("SMRITIAPIKey", back_populates="usage_logs")
