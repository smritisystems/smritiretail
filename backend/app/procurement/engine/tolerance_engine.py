"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.8.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import ProcurementTolerancePolicy
from app.api.deps import TenantContext


class ResolvedToleranceRules:
    def __init__(self, level: str, allowed_price_pct: float, allowed_qty_pct: float, auto_approve: bool):
        self.level = level
        self.allowed_price_pct = allowed_price_pct
        self.allowed_qty_pct = allowed_qty_pct
        self.auto_approve = auto_approve


class ToleranceEngine:
    """
    Multi-Level Procurement Tolerance Engine.
    Resolves rules in strict priority: PRODUCT -> VENDOR -> COMPANY -> SYSTEM.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def resolve_tolerance(self, product_id: Optional[str] = None, supplier_id: Optional[str] = None) -> ResolvedToleranceRules:
        # 1. Product Level
        if product_id:
            p_stmt = select(ProcurementTolerancePolicy).where(
                ProcurementTolerancePolicy.company_id == self.tenant.company_id,
                ProcurementTolerancePolicy.level == "PRODUCT",
                ProcurementTolerancePolicy.target_id == product_id,
                ProcurementTolerancePolicy.is_deleted == False
            )
            p_policy = (await self.db.execute(p_stmt)).scalars().first()
            if p_policy:
                return ResolvedToleranceRules(
                    level="PRODUCT",
                    allowed_price_pct=float(p_policy.allowed_price_variance_pct),
                    allowed_qty_pct=float(p_policy.allowed_qty_variance_pct),
                    auto_approve=p_policy.auto_approve_under_threshold
                )

        # 2. Vendor Level
        if supplier_id:
            v_stmt = select(ProcurementTolerancePolicy).where(
                ProcurementTolerancePolicy.company_id == self.tenant.company_id,
                ProcurementTolerancePolicy.level == "VENDOR",
                ProcurementTolerancePolicy.target_id == supplier_id,
                ProcurementTolerancePolicy.is_deleted == False
            )
            v_policy = (await self.db.execute(v_stmt)).scalars().first()
            if v_policy:
                return ResolvedToleranceRules(
                    level="VENDOR",
                    allowed_price_pct=float(v_policy.allowed_price_variance_pct),
                    allowed_qty_pct=float(v_policy.allowed_qty_variance_pct),
                    auto_approve=v_policy.auto_approve_under_threshold
                )

        # 3. Company Level
        c_stmt = select(ProcurementTolerancePolicy).where(
            ProcurementTolerancePolicy.company_id == self.tenant.company_id,
            ProcurementTolerancePolicy.level == "COMPANY",
            ProcurementTolerancePolicy.is_deleted == False
        )
        c_policy = (await self.db.execute(c_stmt)).scalars().first()
        if c_policy:
            return ResolvedToleranceRules(
                level="COMPANY",
                allowed_price_pct=float(c_policy.allowed_price_variance_pct),
                allowed_qty_pct=float(c_policy.allowed_qty_variance_pct),
                auto_approve=c_policy.auto_approve_under_threshold
            )

        # 4. System Default (2.0% price, 0.0% quantity)
        return ResolvedToleranceRules(
            level="SYSTEM",
            allowed_price_pct=2.0,
            allowed_qty_pct=0.0,
            auto_approve=True
        )
