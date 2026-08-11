"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control DB — Capability & Feature Entitlement Assignment Models
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.control_base import ControlBase


class ControlCapabilityAssignment(ControlBase):
    """
    Control DB Company Feature Entitlement Registry.
    Controls enabled business modules (POS, Inventory, WMS, CRM, Manufacturing, etc.) per company.
    """
    __tablename__ = "control_capability_assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    company_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    capability_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("company_id", "capability_code", name="uq_control_company_capability"),
        Index("idx_control_cap_code_enabled", "company_code", "capability_code", "is_enabled"),
    )

    def __repr__(self) -> str:
        return f"<ControlCapabilityAssignment(company_code='{self.company_code}', capability='{self.capability_code}', enabled={self.is_enabled})>"
