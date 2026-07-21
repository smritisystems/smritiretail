"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 21.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Franchise & Royalty Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime
from app.db.base_class import Base


class FranchiseStoreModel(Base):
    """Franchise Store Organization Model (COCO vs FOFO)."""
    __tablename__ = "franchise_stores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_code = Column(String(50), nullable=False, unique=True, index=True)
    store_name = Column(String(100), nullable=False)
    store_type = Column(String(20), nullable=False, default="FOFO")  # COCO or FOFO
    royalty_percentage = Column(Float, nullable=False, default=5.0)  # 5% default
    tech_fee_monthly = Column(Float, nullable=False, default=250.0)
    created_at = Column(DateTime, default=datetime.utcnow)
