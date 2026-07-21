"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-14
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, CHAR, TIMESTAMP, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ..db.base import Base


class MasterType(Base):
    __tablename__ = "master_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=False, unique=True)
    label = Column(String(100), nullable=False)
    category_type = Column(String(20), default="SYSTEM", nullable=False)  # 'SYSTEM' | 'REFERENCE' | 'BUSINESS'
    is_system = Column(Boolean, default=True, nullable=False)
    field_schema = Column(JSONB, nullable=False)
    ui_schema = Column(JSONB, nullable=True)
    used_in_modules = Column(ARRAY(String), nullable=True)
    depends_on = Column(String(50), ForeignKey("master_types.code"), nullable=True)
    version = Column(Integer, default=1, nullable=False)
    evidence_level = Column(CHAR(1), default='D', nullable=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)


class MasterValue(Base):
    __tablename__ = "master_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_type_id = Column(UUID(as_uuid=True), ForeignKey("master_types.id"), nullable=False)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    parent_value_id = Column(UUID(as_uuid=True), ForeignKey("master_values.id"), nullable=True)
    supersedes_id = Column(UUID(as_uuid=True), ForeignKey("master_values.id"), nullable=True)
    data = Column(JSONB, default=dict, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=True)
    effective_from = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    effective_to = Column(TIMESTAMP(timezone=True), nullable=True)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)

    # Soft delete columns
    is_deleted = Column(Boolean, default=False, nullable=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    deleted_by = Column(String(100), nullable=True)

    master_type = relationship("MasterType", backref="values")
    parent_value = relationship("MasterValue", remote_side=[id], foreign_keys=[parent_value_id], backref="children")
    supersedes = relationship("MasterValue", remote_side=[id], foreign_keys=[supersedes_id], backref="superseded_by")

