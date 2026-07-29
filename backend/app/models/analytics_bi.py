"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-24
Modified     : 2026-07-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Business Intelligence & Executive Analytics (Domain 18)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from app.db.base import Base


class DashboardDefinitionModel(Base):
    """Executive & store-level visual dashboard layout definitions."""
    __tablename__ = "dashboard_definitions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dashboard_code = Column(String(50), nullable=False, unique=True, index=True)
    title = Column(String(100), nullable=False)
    role_scope = Column(String(50), nullable=False, default="STORE_MANAGER")  # EXECUTIVE, STORE_MANAGER, CASHIER
    layout_config = Column(JSON, nullable=False)  # Grid layout & widget positions
    is_default = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KPIMetricModel(Base):
    """Standardized KPI calculation formula definitions (GMROI, Sell-Through, Stock Cover)."""
    __tablename__ = "kpi_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_code = Column(String(50), nullable=False, unique=True, index=True)
    metric_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False, default="SALES")  # SALES, INVENTORY, MARGIN, CUSTOMER
    formula_expression = Column(Text, nullable=False)  # Business logic calculation formula
    unit = Column(String(20), nullable=False, default="PERCENTAGE")  # PERCENTAGE, CURRENCY, COUNT, DAYS
    target_value = Column(Text, nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReportBuilderQueryModel(Base):
    """User-saved custom report builder queries and aggregation filters."""
    __tablename__ = "report_builder_queries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    query_name = Column(String(100), nullable=False)
    user_id = Column(String(36), nullable=False, index=True)
    base_dataset = Column(String(50), nullable=False)  # POS_SALES, STOCK_LEDGER, PURCHASE_ORDERS
    selected_columns = Column(JSON, nullable=False)
    filter_criteria = Column(JSON, nullable=True)
    group_by_columns = Column(JSON, nullable=True)
    sort_by_columns = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
