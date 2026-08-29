"""
Company policy and compliance threshold models.

This keeps company-scoped policy values separate from system-wide regulatory
thresholds, while allowing the same key-based pattern for future configuration.
"""

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, PrimaryKeyConstraint, String, Text

from ..db.base import Base


class CompanyBankAccount(Base):
    __tablename__ = "company_bank_accounts"
    __table_args__ = (
        PrimaryKeyConstraint("id"),
    )

    id = Column(String(50), nullable=False)
    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    bank_name = Column(String(255), nullable=True)
    account_no = Column(String(50), nullable=True)
    ifsc = Column(String(20), nullable=True)
    branch = Column(String(255), nullable=True)
    is_default = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class CompanyPolicySetting(Base):
    __tablename__ = "company_policy_settings"
    __table_args__ = (
        PrimaryKeyConstraint("company_id", "key"),
    )

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    updated_by = Column(String(50), nullable=True)


class ComplianceThreshold(Base):
    __tablename__ = "compliance_thresholds"
    __table_args__ = (
        PrimaryKeyConstraint("key", "effective_from"),
    )

    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    source_reference = Column(String(255), nullable=True)
    updated_by = Column(String(50), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
