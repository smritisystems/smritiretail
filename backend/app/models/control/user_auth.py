"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control DB — User Auth & Multi-Tenant Company Assignment Models
"""

from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.control_base import ControlBase


class ControlUser(ControlBase):
    """
    Control DB Central Identity User Entity.
    Single authoritative authentication identity across all assigned company databases.
    """
    __tablename__ = "control_users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    company_assignments: Mapped[List["ControlUserCompanyAssignment"]] = relationship(
        "ControlUserCompanyAssignment", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ControlUser(id='{self.id}', username='{self.username}', is_active={self.is_active})>"


class ControlUserCompanyAssignment(ControlBase):
    """
    Control DB User-to-Company Access Authorization Mapping.
    Determines exactly which companies a user is permitted to access.
    """
    __tablename__ = "control_user_company_assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("control_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("control_companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    role_name: Mapped[str] = mapped_column(String(64), default="VIEWER", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user: Mapped["ControlUser"] = relationship("ControlUser", back_populates="company_assignments")

    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_control_user_company"),
        Index("idx_control_uca_user_code", "user_id", "company_code"),
    )

    def __repr__(self) -> str:
        return f"<ControlUserCompanyAssignment(user_id='{self.user_id}', company_code='{self.company_code}', role='{self.role_name}')>"
