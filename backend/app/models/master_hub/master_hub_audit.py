"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Master Hub Immutable Audit Trail Model (MasterHubAuditEvent).
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, Index, text
from sqlalchemy.dialects.postgresql import JSONB

from ...db.master_hub_base import MasterHubBase


class MasterHubAuditEvent(MasterHubBase):
    """
    Immutable security audit trail for all Master Exchange Hub operations:
    PUBLISH, FETCH, ACCEPT, REJECT, UPDATE, UNPUBLISH, DEPRECATE.
    """
    __tablename__ = "master_hub_audits"

    id                 = Column(String(50), primary_key=True, default=lambda: f"aud-{uuid.uuid4().hex[:12]}")
    actor_user_id      = Column(String(50), nullable=False, index=True)
    actor_username     = Column(String(100), nullable=False)
    source_company_id  = Column(String(50), nullable=True, index=True)
    source_company_code= Column(String(20), nullable=True)
    target_company_id  = Column(String(50), nullable=True, index=True)
    target_company_code= Column(String(20), nullable=True)
    master_type        = Column(String(50), nullable=False, index=True)
    hub_master_id      = Column(String(50), nullable=True, index=True)
    version            = Column(Integer, nullable=True)
    operation          = Column(String(30), nullable=False, index=True)  # PUBLISH, FETCH, ACCEPT, REJECT, UPDATE, UNPUBLISH, DEPRECATE
    result             = Column(String(30), nullable=False, default="SUCCESS")  # SUCCESS, REJECTED, DENIED, FAILED
    timestamp          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    metadata_json      = Column(JSONB, server_default=text("'{}'"))
