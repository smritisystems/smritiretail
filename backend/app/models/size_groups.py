"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-09-12
Modified     : 2026-09-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from ..db.base import BaseEntity


class SizeGroup(BaseEntity):
    """Canonical size definitions for apparel, footwear, and other dimension-based categories."""

    __tablename__ = "size_groups"

    id = Column(String(100), primary_key=True)
    code = Column(String(100), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, default="GENERAL")
    dimension = Column(String(100), nullable=False, default="size")

    values = relationship(
        "SizeGroupValue",
        back_populates="size_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class SizeGroupValue(BaseEntity):
    """Ordered values that belong to a canonical size group."""

    __tablename__ = "size_group_values"
    __table_args__ = (
        UniqueConstraint("size_group_id", "value", name="uq_size_group_values_group_value"),
    )

    id = Column(String(50), primary_key=True)
    size_group_id = Column(String(100), ForeignKey("size_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    value = Column(String(50), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    size_group = relationship("SizeGroup", back_populates="values")
