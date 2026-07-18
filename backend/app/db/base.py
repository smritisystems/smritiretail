"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.31.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid as uuid_pkg
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.orm import DeclarativeBase, declared_attr

class Base(DeclarativeBase):
    @declared_attr
    def __tablename__(cls) -> str:
        # Automatically generate tablename from class name
        return cls.__name__.lower()

class BaseEntity(Base):
    __abstract__ = True

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    tenant_id = Column(String(50), nullable=True, index=True)
    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True)
    branch_id = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(String(100), nullable=True)
    version = Column(Integer, default=1)

    # Generic Document Workflow & Numbering fields
    workflow_status = Column(String(30), nullable=True)
    document_number = Column(String(80), nullable=True)

