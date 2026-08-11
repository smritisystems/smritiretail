"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Master Hub Company Policy Model (MasterHubCompanyPolicy).
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, Index, UniqueConstraint

from ...db.master_hub_base import MasterHubBase


class MasterHubCompanyPolicy(MasterHubBase):
    """
    Per-company, per-master-type policy rules governing master exchange permissions.
    Supports ALL, SELECTED, NONE publication and fetch permissions.
    """
    __tablename__ = "master_hub_policies"

    id                 = Column(String(50), primary_key=True, default=lambda: f"pol-{uuid.uuid4().hex[:12]}")
    company_id         = Column(String(50), nullable=False, index=True)
    company_code       = Column(String(20), nullable=False, index=True)
    master_type        = Column(String(50), nullable=False, index=True)
    publish_enabled    = Column(Boolean, nullable=False, default=True)
    fetch_enabled      = Column(Boolean, nullable=False, default=True)
    auto_accept        = Column(Boolean, nullable=False, default=False)
    approval_required  = Column(Boolean, nullable=False, default=False)
    conflict_policy    = Column(String(30), nullable=False, default="MANUAL_REVIEW")  # OVERWRITE_LOCAL, KEEP_LOCAL, MANUAL_REVIEW
    updated_by         = Column(String(100), nullable=False)
    updated_at         = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("company_id", "master_type", name="uq_hub_company_master_policy"),
    )
