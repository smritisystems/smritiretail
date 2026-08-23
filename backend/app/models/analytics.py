"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import date, datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, Boolean, text
from ..db.base import BaseEntity


class AnalyticsDailySalesFact(BaseEntity):
    """
    Downstream analytical daily sales fact aggregate table (Section 11).
    Caches pre-aggregated business metrics without mutating transactional ledgers.
    """
    __tablename__ = "analytics_daily_sales_facts"

    fact_date = Column(Date, nullable=False, index=True)
    total_revenue = Column(Numeric(15, 2), nullable=False, default=0.00)
    invoice_count = Column(Integer, nullable=False, default=0)
    total_tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_discount_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    cash_revenue = Column(Numeric(15, 2), nullable=False, default=0.00)
    digital_revenue = Column(Numeric(15, 2), nullable=False, default=0.00)
    credit_revenue = Column(Numeric(15, 2), nullable=False, default=0.00)
    estimated_cost_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    gross_margin_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    gross_margin_percent = Column(Numeric(5, 2), nullable=False, default=0.00)
    computed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
