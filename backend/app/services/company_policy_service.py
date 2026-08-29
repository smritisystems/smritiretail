from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_policy import CompanyPolicySetting, ComplianceThreshold


class CompanyPolicyService:
    """Read and write company-scoped policy values and versioned compliance thresholds."""

    @staticmethod
    async def get_company_policy(session: AsyncSession, company_id: str, key: str) -> Optional[str]:
        rows = await session.execute(
            select(CompanyPolicySetting.value).where(
                CompanyPolicySetting.company_id == company_id,
                CompanyPolicySetting.key == key,
            )
        )
        value = rows.scalar_one_or_none()
        return value

    @staticmethod
    async def seed_company_default_policy(session: AsyncSession, company_id: str, updated_by: str = "system") -> None:
        defaults: Dict[str, str] = {
            "credit_limit_default": "50000",
            "overtime_multiplier": "1.5",
            "commission_tier_config": '{"BRONZE":{"threshold":20000},"SILVER":{"threshold":50001},"GOLD":{"threshold":80000},"PLATINUM":{"threshold":150000}}',
        }
        for key, value in defaults.items():
            existing = await session.execute(
                select(CompanyPolicySetting).where(
                    CompanyPolicySetting.company_id == company_id,
                    CompanyPolicySetting.key == key,
                )
            )
            if existing.scalar_one_or_none() is None:
                session.add(
                    CompanyPolicySetting(
                        company_id=company_id,
                        key=key,
                        value=value,
                        updated_by=updated_by,
                    )
                )

    @staticmethod
    async def get_effective_compliance_threshold(
        session: AsyncSession,
        key: str,
        invoice_date: date,
    ) -> Optional[str]:
        rows = await session.execute(
            select(ComplianceThreshold.value)
            .where(ComplianceThreshold.key == key)
            .where(ComplianceThreshold.effective_from <= invoice_date)
            .where((ComplianceThreshold.effective_to.is_(None)) | (ComplianceThreshold.effective_to >= invoice_date))
            .order_by(ComplianceThreshold.effective_from.desc())
            .limit(1)
        )
        return rows.scalar_one_or_none()

    @staticmethod
    async def resolve_credit_limit_default(session: AsyncSession, company_id: str) -> Decimal:
        value = await CompanyPolicyService.get_company_policy(session, company_id, "credit_limit_default")
        return Decimal(value or "50000")

    @staticmethod
    async def get_effective_compliance_threshold_decimal(
        session: AsyncSession,
        key: str,
        invoice_date: date,
        fallback: str = "50000",
    ) -> Decimal:
        value = await CompanyPolicyService.get_effective_compliance_threshold(session, key, invoice_date)
        return Decimal(value or fallback)
