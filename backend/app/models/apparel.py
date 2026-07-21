"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 25.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Apparel & Fashion Matrix Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime
from app.db.base_class import Base


class ApparelMatrixVariantModel(Base):
    """Color-Size-Style Product Variant Grid Model."""
    __tablename__ = "apparel_matrix_variants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    style_code = Column(String(50), nullable=False, index=True)
    color = Column(String(30), nullable=False)
    size = Column(String(20), nullable=False)
    fit = Column(String(30), nullable=False, default="REGULAR")
    mrp = Column(Float, nullable=False, default=0.0)
    stock_qty = Column(Integer, nullable=False, default=0)
    barcode = Column(String(50), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SeasonalMarkdownModel(Base):
    """Seasonal Clearance Markdown Rule Model."""
    __tablename__ = "apparel_seasonal_markdowns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    season_name = Column(String(50), nullable=False)  # e.g., SUMMER_2026
    min_age_days = Column(Integer, nullable=False)
    discount_percentage = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
