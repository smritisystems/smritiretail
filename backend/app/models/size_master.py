"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.5.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from sqlalchemy import Column, String, Integer, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity, RowSecuredMixin


class SizeScale(RowSecuredMixin, BaseEntity):
    """
    Size Scale Master — Aggregate Root for product size standards.
    Tenant-scoped (company + branch) per BaseEntity.
    """
    __tablename__ = "size_scales"

    code           = Column(String(50), nullable=False)
    name           = Column(String(200), nullable=False)
    scale_type_id  = Column(String(50), nullable=True)   # Footwear, Apparel, Jeans, Rings, etc.
    category_id    = Column(String(50), nullable=True)
    gender_id      = Column(String(50), nullable=True)     # Male, Female, Unisex, Boys, Girls, Baby
    base_region_id = Column(String(50), nullable=False, default="UK")
    description    = Column(Text, nullable=True)

    # Relationships
    size_values    = relationship("SizeValue", back_populates="size_scale", cascade="all, delete-orphan", order_by="SizeValue.sort_order")


class SizeValue(RowSecuredMixin, BaseEntity):
    """
    Individual ordered size entry within a Size Scale.
    """
    __tablename__ = "size_values"

    size_scale_id = Column(String(50), ForeignKey("size_scales.id", ondelete="CASCADE"), nullable=False)
    display_size  = Column(String(50), nullable=False)
    sort_order    = Column(Integer, nullable=False, default=0)

    # Relationships
    size_scale    = relationship("SizeScale", back_populates="size_values")
    conversions   = relationship("SizeConversion", back_populates="size_value", cascade="all, delete-orphan")


class SizeConversion(RowSecuredMixin, BaseEntity):
    """
    Normalized multi-region size conversion child entity (UK, US, EU, JP, AU, CM, etc.).
    """
    __tablename__ = "size_conversions"

    size_value_id        = Column(String(50), ForeignKey("size_values.id", ondelete="CASCADE"), nullable=False)
    region_code          = Column(String(20), nullable=False)  # e.g., "UK", "US", "EU", "JP", "CM"
    converted_size_label = Column(String(50), nullable=False)  # e.g., "42", "9", "27.0"

    # Relationships
    size_value           = relationship("SizeValue", back_populates="conversions")
