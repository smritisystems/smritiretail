"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Master Hub Registry & Versioning Models (MasterHubType, MasterHubRecord, MasterHubVersion).
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from ...db.master_hub_base import MasterHubBase


class MasterHubType(MasterHubBase):
    """
    Registry of exchangeable master data types.
    Canonical Types: Product, Item, Brand, Category, SubCategory, Department, UOM, Size, Color, Shade, HSN, Barcode, SupplierIdentity, CustomerIdentity.
    """
    __tablename__ = "master_hub_types"

    id                 = Column(String(50), primary_key=True)
    master_type        = Column(String(50), nullable=False, unique=True, index=True)
    description        = Column(Text, nullable=True)
    enabled            = Column(Boolean, nullable=False, default=True)
    publish_allowed    = Column(Boolean, nullable=False, default=True)
    fetch_allowed      = Column(Boolean, nullable=False, default=True)
    versioned          = Column(Boolean, nullable=False, default=True)
    conflict_policy    = Column(String(30), nullable=False, default="MANUAL_REVIEW")  # OVERWRITE_LOCAL, KEEP_LOCAL, MANUAL_REVIEW
    approval_required  = Column(Boolean, nullable=False, default=False)
    created_at         = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MasterHubRecord(MasterHubBase):
    """
    Universal identity record stored in smriti_master_hub.
    `id` is an immutable UUID (hub_master_id).
    Source company PK (source_record_id) is recorded for reference only.
    """
    __tablename__ = "master_hub_records"

    id                 = Column(String(50), primary_key=True, default=lambda: f"hub-{uuid.uuid4().hex[:12]}")
    master_type        = Column(String(50), nullable=False, index=True)
    source_company_id  = Column(String(50), nullable=False, index=True)
    source_company_code= Column(String(20), nullable=False, index=True)
    source_record_id   = Column(String(50), nullable=False, index=True)
    latest_version     = Column(Integer, nullable=False, default=1)
    status             = Column(String(30), nullable=False, default="PUBLISHED", index=True)  # PUBLISHED, DEPRECATED, UNPUBLISHED
    published_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    published_by       = Column(String(100), nullable=False)

    versions           = relationship("MasterHubVersion", back_populates="record", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("source_company_id", "master_type", "source_record_id", name="uq_hub_source_record"),
        Index("idx_hub_rec_type_status", "master_type", "status"),
    )


class MasterHubVersion(MasterHubBase):
    """
    Immutable versioned snapshot payload for a MasterHubRecord.
    """
    __tablename__ = "master_hub_versions"

    id                 = Column(String(50), primary_key=True, default=lambda: f"ver-{uuid.uuid4().hex[:12]}")
    hub_master_id      = Column(String(50), ForeignKey("master_hub_records.id", ondelete="CASCADE"), nullable=False, index=True)
    version            = Column(Integer, nullable=False)
    payload_json       = Column(JSONB, nullable=False, server_default=text("'{}'"))
    checksum           = Column(String(64), nullable=False)
    published_by       = Column(String(100), nullable=False)
    published_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    record             = relationship("MasterHubRecord", back_populates="versions")

    __table_args__ = (
        UniqueConstraint("hub_master_id", "version", name="uq_hub_ver_num"),
    )
