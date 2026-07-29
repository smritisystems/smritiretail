"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Customer Loyalty Tiers & Rewards Redemption Engine (Task H-1 to H-5)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 22.2.0
Created      : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Purpose:
    Handles loyalty points earning, redemption, and automatic tier calculation
    (BRONZE < ₹50k, SILVER < ₹2L, GOLD < ₹5L, PLATINUM >= ₹5L).
"""

import uuid
import logging
from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ..models.loyalty import CustomerLoyaltyModel, LoyaltyTransactionModel
from ..models.crm import Customer
from ..api.deps import TenantContext

logger = logging.getLogger("smriti.loyalty")


class LoyaltyEngineService:
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx

    def calculate_tier(self, total_spend: float) -> str:
        """
        Determines customer loyalty tier based on lifetime spend thresholds.
        BRONZE < ₹50,000 | SILVER < ₹200,000 | GOLD < ₹500,000 | PLATINUM >= ₹500,000
        """
        if total_spend >= 500000.0:
            return "PLATINUM"
        elif total_spend >= 200000.0:
            return "GOLD"
        elif total_spend >= 50000.0:
            return "SILVER"
        return "BRONZE"

    async def get_or_create_account(self, customer_id: str, customer_name: str = "Valued Customer") -> CustomerLoyaltyModel:
        stmt = select(CustomerLoyaltyModel).where(CustomerLoyaltyModel.customer_id == customer_id)
        res = await self.db.execute(stmt)
        acc = res.scalars().first()
        if not acc:
            acc = CustomerLoyaltyModel(
                id=str(uuid.uuid4()),
                customer_id=customer_id,
                customer_name=customer_name,
                tier="BRONZE",
                points_balance=0,
                total_lifetime_spend=0.0,
            )
            self.db.add(acc)
            await self.db.flush()
        return acc

    async def earn_points(self, customer_id: str, invoice_amount: float, reference_doc_no: str) -> Dict[str, Any]:
        """
        Accrues loyalty points on a purchase (Rule: ₹100 spent = 1 point earned).
        Auto-evaluates tier upgrade on lifetime spend threshold.
        """
        acc = await self.get_or_create_account(customer_id)
        points_earned = int(invoice_amount // 100)
        acc.points_balance += points_earned
        acc.total_lifetime_spend += invoice_amount

        # Check for tier upgrade
        new_tier = self.calculate_tier(acc.total_lifetime_spend)
        tier_upgraded = new_tier != acc.tier
        if tier_upgraded:
            logger.info("Customer %s upgraded from tier %s to %s!", customer_id, acc.tier, new_tier)
            acc.tier = new_tier

        # Log point transaction
        tx = LoyaltyTransactionModel(
            id=f"LTX-{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            customer_id=customer_id,
            tx_type="EARN",
            points=points_earned,
            reference_doc_no=reference_doc_no,
            narration=f"Earned {points_earned} points on invoice {reference_doc_no}",
        )
        self.db.add(tx)

        # Update Customer aggregate cache
        cust_stmt = select(Customer).where(Customer.id == customer_id)
        cust_res = await self.db.execute(cust_stmt)
        customer = cust_res.scalars().first()
        if customer:
            customer.loyalty_tier = acc.tier
            customer.loyalty_points_balance = Decimal(str(acc.points_balance))
            customer.lifetime_points = Decimal(str(acc.points_balance))

        await self.db.flush()

        return {
            "customer_id": customer_id,
            "points_earned": points_earned,
            "current_balance": acc.points_balance,
            "tier": acc.tier,
            "tier_upgraded": tier_upgraded,
        }

    async def redeem_points(self, customer_id: str, points_to_redeem: int, reference_doc_no: str) -> Dict[str, Any]:
        """
        Redeems loyalty points against a purchase (Rule: 1 point = ₹1 discount).
        """
        acc = await self.get_or_create_account(customer_id)
        if acc.points_balance < points_to_redeem:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient loyalty points: Requested {points_to_redeem}, available balance is {acc.points_balance}.",
            )

        acc.points_balance -= points_to_redeem
        discount_amount = float(points_to_redeem)

        tx = LoyaltyTransactionModel(
            id=f"LTX-{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            customer_id=customer_id,
            tx_type="REDEEM",
            points=-points_to_redeem,
            reference_doc_no=reference_doc_no,
            narration=f"Redeemed {points_to_redeem} points for ₹{discount_amount:.2f} discount on invoice {reference_doc_no}",
        )
        self.db.add(tx)
        await self.db.flush()

        return {
            "customer_id": customer_id,
            "points_redeemed": points_to_redeem,
            "discount_amount": discount_amount,
            "remaining_balance": acc.points_balance,
        }
