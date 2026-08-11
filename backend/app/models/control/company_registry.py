"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control DB — Company Registry & Database Registry Models
"""

import enum
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import String, Boolean, DateTime, Integer, Text, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.control_base import ControlBase


class DatabaseRegistryStatus(str, enum.Enum):
    """
    Standardized Database Registry Status Enum for Physical Company Databases.
    """
    PROVISIONING = "PROVISIONING"
    ACTIVE       = "ACTIVE"
    SUSPENDED    = "SUSPENDED"
    MIGRATING    = "MIGRATING"
    FAILED       = "FAILED"
    DRIFTED      = "DRIFTED"
    ARCHIVED     = "ARCHIVED"


class ControlCompany(ControlBase):
    """
    Control DB Legal Company Entity.
    Acts as central legal business registry.
    """
    __tablename__ = "control_companies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", nullable=False)
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
    database_registry: Mapped[Optional["ControlCompanyDatabase"]] = relationship(
        "ControlCompanyDatabase", back_populates="company", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ControlCompany(id='{self.id}', company_code='{self.company_code}', name='{self.name}')>"


class ControlCompanyDatabase(ControlBase):
    """
    Control DB Company Database Registry.
    Tracks physical database connections, secrets references, schema revisions,
    and schema fingerprints for every provisioned company database.
    """
    __tablename__ = "control_company_databases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("control_companies.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    company_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    db_identifier: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    db_host: Mapped[str] = mapped_column(String(128), nullable=False)
    db_port: Mapped[int] = mapped_column(Integer, default=5432, nullable=False)
    db_name: Mapped[str] = mapped_column(String(64), nullable=False)
    db_user: Mapped[str] = mapped_column(String(64), nullable=False)
    
    # Credentials & Secret References — NEVER EXPOSED TO CLIENT API
    encrypted_credentials: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    secrets_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Registry Status & Governance
    status: Mapped[str] = mapped_column(
        String(32), default=DatabaseRegistryStatus.PROVISIONING.value, nullable=False, index=True
    )
    schema_revision: Mapped[str] = mapped_column(String(64), nullable=False, default="head")
    schema_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, default="PENDING")
    
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    company: Mapped["ControlCompany"] = relationship("ControlCompany", back_populates="database_registry")

    __table_args__ = (
        Index("idx_control_db_company_code_status", "company_code", "status"),
    )

    def to_public_dict(self) -> Dict[str, Any]:
        """
        Public Safe Serialization.
        Explicitly Strips encrypted_credentials, secrets_ref, db_user, and connection details.
        """
        return {
            "id": self.id,
            "company_id": self.company_id,
            "company_code": self.company_code,
            "db_identifier": self.db_identifier,
            "status": self.status,
            "schema_revision": self.schema_revision,
            "schema_fingerprint": self.schema_fingerprint,
            "last_verified_at": self.last_verified_at.isoformat() if self.last_verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<ControlCompanyDatabase(company_code='{self.company_code}', db_identifier='{self.db_identifier}', status='{self.status}')>"
