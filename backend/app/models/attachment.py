"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 17.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for SMRITI Content & Document Platform (SCDP / UDMS)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class DocumentModel(Base):
    """First-class Document Entity (SMP-014 Compliant)."""
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256_checksum = Column(String(64), nullable=False, index=True)
    category = Column(String(50), nullable=False, default="Other")
    storage_provider = Column(String(50), nullable=False, default="local")
    current_version = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="ACTIVE")
    uploaded_by = Column(String(100), nullable=False, default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

    versions = relationship("DocumentVersionModel", back_populates="document", cascade="all, delete-orphan")
    attachments = relationship("AttachmentModel", back_populates="document", cascade="all, delete-orphan")


class DocumentVersionModel(Base):
    """Immutable Document Version History."""
    __tablename__ = "document_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    sha256_checksum = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("DocumentModel", back_populates="versions")


class AttachmentModel(Base):
    """Dynamic Relationship linking a Document to any Business Record."""
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    reference_type = Column(String(50), nullable=False, index=True)  # e.g. SALES_INVOICE, PURCHASE_ORDER, ITEM_MASTER
    reference_id = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    attached_by = Column(String(100), nullable=False, default="system")
    attached_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("DocumentModel", back_populates="attachments")
