"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Model : KPI Definition Registry — dynamic KPI configuration for Executive Hub dashboards
"""

import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Numeric, Index,
)

from ..db.base import Base


class KPIDefinition(Base):
    """
    SMRITI KPI Definition Registry.

    Stores all Key Performance Indicator (KPI) definitions used across
    Executive Hub dashboards and SMRITI Gyan Kendra. Each KPI record
    carries a machine-readable formula reference, display metadata, and
    alert thresholds so that dashboards are data-driven rather than
    hard-coded.

    KPI Lifecycle:
        DRAFT -> ACTIVE -> DEPRECATED

    Formula References:
        formula_key is a dot-path to a registered analytics function or
        SQL view, e.g.: ``analytics.daily_sales_summary.gross_total``
        or ``reports.custom.<report_code>.<column>``.
    """

    __tablename__ = "kpi_definitions"

    # -----------------------------------------------------------------------
    # Identity
    # -----------------------------------------------------------------------
    id           = Column(String(50), primary_key=True, default=lambda: f"kpi-{_uuid.uuid4().hex[:12]}")
    uuid         = Column(String(36), nullable=False, unique=True, default=lambda: str(_uuid.uuid4()))

    # -----------------------------------------------------------------------
    # Tenant scope — company_id scopes KPIs to a tenant; NULL = platform default
    # -----------------------------------------------------------------------
    company_id   = Column(String(50), nullable=True, index=True)

    # -----------------------------------------------------------------------
    # KPI Metadata
    # -----------------------------------------------------------------------
    name         = Column(String(150), nullable=False)                  # Human-readable name, e.g. "Daily Gross Sales"
    code         = Column(String(60),  nullable=False, index=True)      # Machine code, e.g. "DAILY_GROSS_SALES"
    description  = Column(Text,        nullable=True)                   # Business description for documentation
    category     = Column(String(80),  nullable=True, index=True)       # Grouping: "Sales", "Inventory", "Finance"
    icon         = Column(String(50),  nullable=True)                   # UI icon key, e.g. "TrendingUp"
    color        = Column(String(30),  nullable=True)                   # Hex or CSS color token for dashboard card

    # -----------------------------------------------------------------------
    # Formula & Data Source
    # -----------------------------------------------------------------------
    formula_key  = Column(String(250), nullable=False)                  # Dot-path to analytics resolver
    unit         = Column(String(30),  nullable=True)                   # Display unit: "₹", "%", "units", "days"
    aggregation  = Column(String(30),  nullable=True, default="SUM")    # SUM, AVG, COUNT, LAST

    # -----------------------------------------------------------------------
    # Target & Alert Thresholds
    # -----------------------------------------------------------------------
    target_value        = Column(Numeric(18, 4), nullable=True)         # Absolute or percentage target
    alert_below         = Column(Numeric(18, 4), nullable=True)         # Trigger warning if value < this
    alert_above         = Column(Numeric(18, 4), nullable=True)         # Trigger warning if value > this
    alert_severity      = Column(String(20),     nullable=True)         # "INFO", "WARNING", "CRITICAL"

    # -----------------------------------------------------------------------
    # Dashboard Placement
    # -----------------------------------------------------------------------
    dashboard_placement = Column(String(80),  nullable=True)            # Widget slot: "executive_hub.top_row"
    sort_order          = Column(String(10),  nullable=True, default="0")  # Stored as string for flexible sort

    # -----------------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------------
    status       = Column(String(20), nullable=False, default="ACTIVE", index=True)  # DRAFT/ACTIVE/DEPRECATED
    is_active    = Column(Boolean,    nullable=False, default=True, index=True)
    is_deleted   = Column(Boolean,    nullable=False, default=False, index=True)

    # -----------------------------------------------------------------------
    # Audit trail
    # -----------------------------------------------------------------------
    created_by   = Column(String(100), nullable=True)
    updated_by   = Column(String(100), nullable=True)
    created_at   = Column(DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    # -----------------------------------------------------------------------
    # Unique constraint: one code per company (or one global code when company_id is NULL)
    # -----------------------------------------------------------------------
    __table_args__ = (
        Index("ix_kpi_definitions_company_code", "company_id", "code", unique=True),
    )

    def __repr__(self) -> str:
        return f"<KPIDefinition id={self.id!r} code={self.code!r} status={self.status!r}>"
