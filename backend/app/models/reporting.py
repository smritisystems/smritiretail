"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity

class ReportDefinition(BaseEntity):
    """SMRITI Reporting & Analytics Engine - Report Definition Master."""
    __tablename__ = "report_definitions"

    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # Sales, Purchase, Inventory, CRM, Loyalty, Promotions, SICE, Fulfillment, Profitability
    data_source = Column(String(100), nullable=False)  # SQL/ORM target view or table
    dimensions = Column(JSONB, server_default=text("'[]'"), default=list)  # Company, Branch, Customer, Product, Brand, Category, Date, etc.
    measures = Column(JSONB, server_default=text("'[]'"), default=list)    # Qty, Sales, Discount, COGS, Gross Profit, Net Contribution, Margin %
    default_filters = Column(JSONB, server_default=text("'{}'"), default=dict)
    query_schema = Column(JSONB, server_default=text("'{}'"), default=dict)
    is_system_report = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    saved_views = relationship("ReportSavedView", back_populates="report_definition")
    widgets = relationship("DashboardWidget", back_populates="report_definition")

class ReportSavedView(BaseEntity):
    """Excel-Style Analytical Saved Views (Filters, Columns, Sorting, Grouping, Pivot)."""
    __tablename__ = "report_saved_views"

    report_definition_id = Column(String(50), ForeignKey("report_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(50), nullable=True, index=True)
    view_name = Column(String(100), nullable=False)
    column_layout = Column(JSONB, server_default=text("'[]'"), default=list)      # Ordered column list & widths
    sort_rules = Column(JSONB, server_default=text("'[]'"), default=list)         # Multi-sort criteria
    filter_rules = Column(JSONB, server_default=text("'{}'"), default=dict)       # Active filter values
    group_by = Column(JSONB, server_default=text("'[]'"), default=list)           # Grouping fields
    pivot_config = Column(JSONB, server_default=text("'{}'"), default=dict)       # Pivot rows/columns/values
    conditional_formatting = Column(JSONB, server_default=text("'[]'"), default=list)
    is_default = Column(Boolean, default=False)
    is_shared = Column(Boolean, default=False)

    report_definition = relationship("ReportDefinition", back_populates="saved_views")

class Dashboard(BaseEntity):
    """Dashboard Manager Master (CEO, Sales, Store Manager, CRM, Profitability Dashboards)."""
    __tablename__ = "dashboards"

    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), default="General")  # Retail, Wholesale, CEO, Store, Operations
    owner_user_id = Column(String(50), nullable=True, index=True)
    is_system_dashboard = Column(Boolean, default=False)
    is_shared = Column(Boolean, default=True)
    layout_config = Column(JSONB, server_default=text("'{}'"), default=dict)  # Grid snap-to-grid layout config

    widgets = relationship("DashboardWidget", back_populates="dashboard", cascade="all, delete-orphan")

class DashboardWidget(BaseEntity):
    """Reusable Dashboard Widgets (KPI, Chart, Grid, Pivot, Ranking, Alert)."""
    __tablename__ = "dashboard_widgets"

    dashboard_id = Column(String(50), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    report_definition_id = Column(String(50), ForeignKey("report_definitions.id", ondelete="SET NULL"), nullable=True)
    widget_type = Column(String(30), nullable=False)  # KPI, CHART, GRID, PIVOT, RANKING, ALERT
    title = Column(String(100), nullable=False)
    chart_type = Column(String(30), nullable=True)     # BAR, LINE, PIE, AREA, STACKED, COMBO, SCATTER, FUNNEL
    dimensions = Column(JSONB, server_default=text("'[]'"), default=list)
    measures = Column(JSONB, server_default=text("'[]'"), default=list)
    grid_position = Column(JSONB, server_default=text("'{}'"), default=dict)   # { x: 0, y: 0, w: 4, h: 3 }
    widget_settings = Column(JSONB, server_default=text("'{}'"), default=dict)

    dashboard = relationship("Dashboard", back_populates="widgets")
    report_definition = relationship("ReportDefinition", back_populates="widgets")
