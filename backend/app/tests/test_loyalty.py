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
Target Test  : Loyalty Studio & Points Ledger Automated Test Battery
"""

import asyncio
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest

from app.models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyPointsLedger
from app.services.crm_engine import CrmGrowthEngine
from app.schemas.crm_cge import (
    LoyaltyMemberEnrollRequest,
    PointsAdjustmentRequest,
)


@pytest.fixture(autouse=True)
def auto_override_company_db():
    """Override conftest auto_override_company_db to run fast standalone unit tests without Postgres."""
    yield


def test_loyalty_tier_model_attributes():
    """TC-LOY-001: LoyaltyTier properly defaults and holds multipliers and redemption ratios."""
    tier = LoyaltyTier(
        id="tier_gold",
        company_id="COMP-001",
        name="Gold Tier",
        min_spend=Decimal("25000.00"),
        earn_multiplier=Decimal("1.50"),
        redemption_ratio=Decimal("1.00"),
        benefits={"discount_percent": 5, "lounge_access": True},
        is_active=True,
    )
    assert tier.name == "Gold Tier"
    assert tier.min_spend == Decimal("25000.00")
    assert tier.earn_multiplier == Decimal("1.50")
    assert tier.benefits["discount_percent"] == 5


def test_enroll_loyalty_member_auto_card():
    """TC-LOY-002: Enrolling a member without a card number auto-generates a unique card number."""
    req = LoyaltyMemberEnrollRequest(
        customer_id="cust-101",
        loyalty_tier_id="tier_silver",
    )

    mock_session = AsyncMock()
    mock_result = MagicMock()
    # No existing member
    mock_result.scalars.return_value.first.return_value = None
    mock_session.execute.return_value = mock_result

    member = asyncio.run(
        CrmGrowthEngine.enroll_loyalty_member(
            session=mock_session,
            company_id="COMP-001",
            req=req,
            user_id="cashier_01",
        )
    )

    assert member.customer_id == "cust-101"
    assert member.card_number.startswith("CARD-")
    assert member.current_points_balance == Decimal("0.00")
    assert member.total_points_earned == Decimal("0.00")


def test_points_transaction_earn_accumulates():
    """TC-LOY-003: EARN transaction increments both current_points_balance and total_points_earned."""
    member = LoyaltyMember(
        id="lm_001",
        company_id="COMP-001",
        customer_id="cust-101",
        current_points_balance=Decimal("150.00"),
        total_points_earned=Decimal("200.00"),
        total_points_redeemed=Decimal("50.00"),
    )

    req = PointsAdjustmentRequest(
        member_id="lm_001",
        transaction_type="EARN",
        points=Decimal("50.00"),
        reference_invoice_id="INV-999",
        narration="Earned on invoice INV-999",
    )

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = member
    mock_session.execute.return_value = mock_result

    ledger_entry, new_bal = asyncio.run(
        CrmGrowthEngine.record_points_transaction(
            session=mock_session,
            company_id="COMP-001",
            req=req,
            user_id="system",
        )
    )

    assert new_bal == Decimal("200.00")
    assert member.current_points_balance == Decimal("200.00")
    assert member.total_points_earned == Decimal("250.00")
    assert ledger_entry.points == Decimal("50.00")
    assert ledger_entry.transaction_type == "EARN"


def test_points_transaction_redeem_deducts():
    """TC-LOY-004: REDEEM transaction decrements balance and increments total_points_redeemed."""
    member = LoyaltyMember(
        id="lm_002",
        company_id="COMP-001",
        customer_id="cust-102",
        current_points_balance=Decimal("300.00"),
        total_points_earned=Decimal("500.00"),
        total_points_redeemed=Decimal("200.00"),
    )

    req = PointsAdjustmentRequest(
        member_id="lm_002",
        transaction_type="REDEEM",
        points=Decimal("100.00"),
        reference_invoice_id="INV-1002",
        narration="Redeemed on bill",
    )

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = member
    mock_session.execute.return_value = mock_result

    ledger_entry, new_bal = asyncio.run(
        CrmGrowthEngine.record_points_transaction(
            session=mock_session,
            company_id="COMP-001",
            req=req,
            user_id="pos_cashier",
        )
    )

    assert new_bal == Decimal("200.00")
    assert member.current_points_balance == Decimal("200.00")
    assert member.total_points_redeemed == Decimal("300.00")
    assert ledger_entry.points == Decimal("-100.00")


def test_points_redemption_insufficient_balance_fails_closed():
    """TC-LOY-005: Attempting to redeem more points than available balance raises ValueError."""
    member = LoyaltyMember(
        id="lm_003",
        company_id="COMP-001",
        customer_id="cust-103",
        current_points_balance=Decimal("40.00"),
        total_points_earned=Decimal("100.00"),
        total_points_redeemed=Decimal("60.00"),
    )

    # Requesting to redeem 50 points when only 40 are available
    req = PointsAdjustmentRequest(
        member_id="lm_003",
        transaction_type="REDEEM",
        points=Decimal("50.00"),
        narration="Overdraft attempt",
    )

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = member
    mock_session.execute.return_value = mock_result

    with pytest.raises(ValueError, match="Insufficient loyalty points balance"):
        asyncio.run(
            CrmGrowthEngine.record_points_transaction(
                session=mock_session,
                company_id="COMP-001",
                req=req,
            )
        )



def test_manual_adjustment_audit_reason_mandatory():
    """TC-LOY-006: Manual points adjustment enforces mandatory reason string."""
    from app.api.v1.loyalty import ManualPointsAdjustmentRequest
    from pydantic import ValidationError

    # Empty reason must fail validation
    with pytest.raises(ValidationError):
        ManualPointsAdjustmentRequest(points=Decimal("100"), reason="a")  # too short
