"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 20.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Financial Analytics & BI Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime
from app.db.base_class import Base


class FinancialSnapshotModel(Base):
    """Daily Financial KPI Snapshot Record."""
    __tablename__ = "analytics_financial_snapshots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(50), nullable=False, default="GLOBAL", index=True)
    snapshot_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    total_revenue = Column(Float, nullable=False, default=0.0)
    gross_margin = Column(Float, nullable=False, default=0.0)
    ebitda = Column(Float, nullable=False, default=0.0)
    inventory_turnover = Column(Float, nullable=False, default=0.0)
    gmroi = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
