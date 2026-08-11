"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Master Hub Exchange Models (MasterHubPublication, MasterHubImport, MasterHubMapping).
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB

from ...db.master_hub_base import MasterHubBase


class MasterHubPublication(MasterHubBase):
    """
    Log of publication events emitted from Company DBs to the Master Hub.
    """
    __tablename__ = "master_hub_publications"

    id                 = Column(String(50), primary_key=True, default=lambda: f"pub-{uuid.uuid4().hex[:12]}")
    source_company_id  = Column(String(50), nullable=False, index=True)
    source_company_code= Column(String(20), nullable=False, index=True)
    master_type        = Column(String(50), nullable=False, index=True)
    source_record_id   = Column(String(50), nullable=False)
    hub_master_id      = Column(String(50), ForeignKey("master_hub_records.id", ondelete="CASCADE"), nullable=False, index=True)
    version            = Column(Integer, nullable=False)
    status             = Column(String(30), nullable=False, default="PUBLISHED")
    published_by       = Column(String(100), nullable=False)
    published_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MasterHubImport(MasterHubBase):
    """
    Tracks master data imports per target company DB.
    """
    __tablename__ = "master_hub_imports"

    id                 = Column(String(50), primary_key=True, default=lambda: f"imp-{uuid.uuid4().hex[:12]}")
    target_company_id  = Column(String(50), nullable=False, index=True)
    target_company_code= Column(String(20), nullable=False, index=True)
    hub_master_id      = Column(String(50), ForeignKey("master_hub_records.id", ondelete="CASCADE"), nullable=False, index=True)
    version_imported   = Column(Integer, nullable=False)
    local_record_id    = Column(String(50), nullable=False)
    import_status      = Column(String(30), nullable=False, default="ACCEPTED")  # NEW, MATCHED, CONFLICT, ACCEPTED, REJECTED, SUPERSEDED, DEPRECATED
    update_status      = Column(String(30), nullable=False, default="UP_TO_DATE")  # UP_TO_DATE, UPDATE_AVAILABLE
    imported_by        = Column(String(100), nullable=False)
    imported_at        = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("target_company_id", "hub_master_id", name="uq_hub_imp_target_master"),
        Index("idx_hub_imp_target_status", "target_company_id", "import_status"),
    )


class MasterHubMapping(MasterHubBase):
    """
    Bi-directional reference mapping bridging hub_master_id and local Company DB PK.
    The Master Hub records the relationship link (H-1001 -> Company A A-123, Company B B-778),
    but does NOT own or overwrite local records in Company DBs.
    """
    __tablename__ = "master_hub_mappings"

    id                 = Column(String(50), primary_key=True, default=lambda: f"map-{uuid.uuid4().hex[:12]}")
    hub_master_id      = Column(String(50), ForeignKey("master_hub_records.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id         = Column(String(50), nullable=False, index=True)
    company_code       = Column(String(20), nullable=False, index=True)
    local_record_id    = Column(String(50), nullable=False)
    master_type        = Column(String(50), nullable=False)
    version            = Column(Integer, nullable=False)
    status             = Column(String(30), nullable=False, default="ACTIVE")
    mapped_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("company_id", "master_type", "local_record_id", name="uq_hub_map_company_local"),
        UniqueConstraint("company_id", "hub_master_id", name="uq_hub_map_company_master"),
    )
