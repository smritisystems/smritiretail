"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from app.services.promotions_engine import PromotionsEngine
from app.schemas.promotions import (
    PromotionCampaignCreateRequest,
    PromotionRuleCreateRequest,
    CouponCreateRequest,
    PromotionCartItem,
    PromotionEvaluationRequest,
    PromotionRedemptionRequest,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_percentage_and_fixed_discount_evaluation():
    """Verify percentage and fixed discount evaluation on cart items."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)

    async with sessionmaker() as session:
        # Create 10% Off Campaign
        camp = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"10 Percent Sale {unique_suffix}",
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=500.0,
                is_exclusive=False,
                allow_stacking=False,
            ),
        )

        await PromotionsEngine.add_promotion_rule(
            session=session,
            company_id="COMP-001",
            campaign_id=camp.id,
            req=PromotionRuleCreateRequest(
                rule_type="PERCENTAGE",
                discount_percent=10.0,
            ),
        )

        # Cart: 2 units of Item A @ 500 = 1000 gross
        eval_req = PromotionEvaluationRequest(
            items=[
                PromotionCartItem(item_id=f"itm_a_{unique_suffix}", unit_price=500.0, quantity=2.0),
            ],
            campaign_id=camp.id,
            channel="POS",
        )

        res = await PromotionsEngine.evaluate_promotions(session, "COMP-001", eval_req)
        assert res.gross_cart_total == 1000.00
        # 10% of 1000 = 100.00
        assert res.total_promotional_discount == 100.00
        assert res.net_cart_total == 900.00
        assert len(res.applied_promotions) == 1
        assert res.applied_promotions[0].campaign_id == camp.id


@pytest.mark.asyncio
async def test_buy_x_get_y_bogo_evaluation():
    """Verify Buy-2-Get-1-Free (BXGY) offer mechanics on cart items."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)
    item_id = f"itm_bogo_{unique_suffix}"

    async with sessionmaker() as session:
        # Create Buy 2 Get 1 Free Campaign
        camp = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"B2G1 Free Fashion {unique_suffix}",
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=0.0,
                is_exclusive=False,
                allow_stacking=False,
            ),
        )

        await PromotionsEngine.add_promotion_rule(
            session=session,
            company_id="COMP-001",
            campaign_id=camp.id,
            req=PromotionRuleCreateRequest(
                rule_type="BUY_X_GET_Y",
                buy_quantity=2,
                get_quantity=1,
                product_eligibility={"product_ids": [item_id]},
            ),
        )

        # Cart: 3 units of BOGO Item @ 300 each = 900 gross
        # 2 purchased + 1 free -> Discount = 300, Net = 600
        eval_req = PromotionEvaluationRequest(
            items=[
                PromotionCartItem(item_id=item_id, unit_price=300.0, quantity=3.0),
            ],
            campaign_id=camp.id,
            channel="POS",
        )

        res = await PromotionsEngine.evaluate_promotions(session, "COMP-001", eval_req)
        assert res.gross_cart_total == 900.00
        assert res.total_promotional_discount == 300.00
        assert res.net_cart_total == 600.00
        assert len(res.applied_promotions) == 1
        assert len(res.applied_promotions[0].free_items_granted) == 1
        assert res.applied_promotions[0].free_items_granted[0]["quantity"] == 1


@pytest.mark.asyncio
async def test_coupon_validation_and_usage_limits():
    """Verify coupon code application and enforcement of usage limits."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    coupon_code = f"SAVE50-{unique_suffix.upper()}"
    now = datetime.now(timezone.utc)

    async with sessionmaker() as session:
        # Create Campaign for Coupon
        camp = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"Coupon Campaign {unique_suffix}",
                promo_code=coupon_code,
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=200.0,
            ),
        )

        await PromotionsEngine.add_promotion_rule(
            session=session,
            company_id="COMP-001",
            campaign_id=camp.id,
            req=PromotionRuleCreateRequest(
                rule_type="FIXED_DISCOUNT",
                discount_fixed_amount=50.0,
            ),
        )

        # Create coupon with usage_limit = 1
        coupon = await PromotionsEngine.create_coupon(
            session=session,
            company_id="COMP-001",
            req=CouponCreateRequest(
                campaign_id=camp.id,
                code=coupon_code,
                usage_limit=1,
            ),
        )

        # 1. First evaluation with coupon -> Should apply ₹50 discount
        eval_req = PromotionEvaluationRequest(
            items=[PromotionCartItem(item_id=f"itm_cp_{unique_suffix}", unit_price=400.0, quantity=1.0)],
            coupon_code=coupon_code,
            channel="POS",
        )
        res1 = await PromotionsEngine.evaluate_promotions(session, "COMP-001", eval_req)
        assert res1.total_promotional_discount == 50.00
        assert res1.net_cart_total == 350.00
        assert res1.applied_promotions[0].coupon_code == coupon_code

        # 2. Record redemption to exhaust usage limit (1/1)
        await PromotionsEngine.record_redemption(
            session=session,
            company_id="COMP-001",
            req=PromotionRedemptionRequest(
                campaign_id=camp.id,
                coupon_id=coupon.id,
                reference_invoice_id=f"INV-{unique_suffix.upper()}",
                discount_applied=50.0,
            ),
        )

        # 3. Second evaluation with exhausted coupon -> Should be rejected
        res2 = await PromotionsEngine.evaluate_promotions(session, "COMP-001", eval_req)
        # Coupon expired by limit -> 0 discount
        assert res2.total_promotional_discount == 0.00
        assert res2.net_cart_total == 400.00


@pytest.mark.asyncio
async def test_exclusive_promotion_override():
    """Verify exclusive promotions override and suppress all other standard promotions."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)
    item_id = f"itm_ex_{unique_suffix}"

    async with sessionmaker() as session:
        # Standard 5% campaign
        camp_std = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"Standard 5% {unique_suffix}",
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=0.0,
                is_exclusive=False,
            ),
        )
        await PromotionsEngine.add_promotion_rule(
            session=session,
            company_id="COMP-001",
            campaign_id=camp_std.id,
            req=PromotionRuleCreateRequest(
                rule_type="PERCENTAGE",
                discount_percent=5.0,
                product_eligibility={"product_ids": [item_id]},
            ),
        )

        # Exclusive 25% Mega Sale campaign
        camp_exc = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"Exclusive Mega 25% {unique_suffix}",
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=0.0,
                is_exclusive=True,
                priority=1,
            ),
        )
        await PromotionsEngine.add_promotion_rule(
            session=session,
            company_id="COMP-001",
            campaign_id=camp_exc.id,
            req=PromotionRuleCreateRequest(
                rule_type="PERCENTAGE",
                discount_percent=25.0,
                product_eligibility={"product_ids": [item_id]},
            ),
        )

        eval_req = PromotionEvaluationRequest(
            items=[PromotionCartItem(item_id=item_id, unit_price=2000.0, quantity=1.0)],
            channel="POS",
        )

        res = await PromotionsEngine.evaluate_promotions(session, "COMP-001", eval_req)
        # Exclusive 25% of 2000 = 500 discount
        assert res.total_promotional_discount >= 500.00
        assert res.conflict_resolution_strategy == "EXCLUSIVE_OVERRIDE"
        assert len(res.applied_promotions) == 1


@pytest.mark.asyncio
async def test_multi_campaign_stacking_and_safety_cap():
    """Verify combining stackable promotions and adhering to max_stacked_discount_percent safety cap."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)
    item_id = f"itm_stk_{unique_suffix}"

    async with sessionmaker() as session:
        # Stackable Campaign 1: 15% discount (allow_stacking=True)
        c1 = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"Stackable 15% {unique_suffix}",
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=0.0,
                allow_stacking=True,
                max_stacked_discount_percent=30.0,  # Max 30% total
            ),
        )
        await PromotionsEngine.add_promotion_rule(
            session=session, company_id="COMP-001", campaign_id=c1.id,
            req=PromotionRuleCreateRequest(
                rule_type="PERCENTAGE",
                discount_percent=15.0,
                product_eligibility={"product_ids": [item_id]},
            )
        )

        # Stackable Campaign 2: 20% discount (allow_stacking=True)
        c2 = await PromotionsEngine.create_campaign(
            session=session,
            company_id="COMP-001",
            req=PromotionCampaignCreateRequest(
                name=f"Stackable 20% {unique_suffix}",
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=30),
                min_order_amount=0.0,
                allow_stacking=True,
                max_stacked_discount_percent=30.0,
            ),
        )
        await PromotionsEngine.add_promotion_rule(
            session=session, company_id="COMP-001", campaign_id=c2.id,
            req=PromotionRuleCreateRequest(
                rule_type="PERCENTAGE",
                discount_percent=20.0,
                product_eligibility={"product_ids": [item_id]},
            )
        )

        # Cart: 1 unit @ 1000 gross
        # 15% + 20% = 35%, capped at 30% max = 300 discount
        eval_req = PromotionEvaluationRequest(
            items=[PromotionCartItem(item_id=item_id, unit_price=1000.0, quantity=1.0)],
            campaign_ids=[c1.id, c2.id],
            channel="POS",
        )

        res = await PromotionsEngine.evaluate_promotions(session, "COMP-001", eval_req)
        assert res.gross_cart_total == 1000.00
        assert res.total_promotional_discount == 300.00
        assert res.net_cart_total == 700.00
        assert len(res.applied_promotions) >= 1


@pytest.mark.asyncio
async def test_api_promotions_endpoints():
    """Verify REST API promotions endpoints: campaigns, rules, coupons, evaluate, and redeem."""
    unique_suffix = uuid.uuid4().hex[:4]
    transport = ASGITransport(app=app)
    now = datetime.now(timezone.utc)
    item_id = f"itm_api_{unique_suffix}"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Campaign via API
        camp_res = await client.post(
            "/api/v1/promotions/campaigns",
            json={
                "name": f"API Festive Sale {unique_suffix}",
                "start_date": (now - timedelta(days=1)).isoformat(),
                "end_date": (now + timedelta(days=30)).isoformat(),
                "min_order_amount": 100.0,
                "allow_stacking": True,
            },
            headers=_get_auth_headers(),
        )
        assert camp_res.status_code == 201
        camp_id = camp_res.json()["id"]

        # 2. Add Rule via API
        rule_res = await client.post(
            f"/api/v1/promotions/campaigns/{camp_id}/rules",
            json={
                "rule_type": "PERCENTAGE",
                "discount_percent": 12.0,
                "product_eligibility": {"product_ids": [item_id]},
            },
            headers=_get_auth_headers(),
        )
        assert rule_res.status_code == 201

        # 3. Create Coupon via API
        coupon_res = await client.post(
            "/api/v1/promotions/coupons",
            json={
                "campaign_id": camp_id,
                "code": f"FESTIVE-{unique_suffix.upper()}",
                "usage_limit": 50,
            },
            headers=_get_auth_headers(),
        )
        assert coupon_res.status_code == 201
        coupon_id = coupon_res.json()["id"]

        # 4. Evaluate Cart via API
        eval_res = await client.post(
            "/api/v1/promotions/evaluate",
            json={
                "items": [
                    {"item_id": item_id, "unit_price": 1000.0, "quantity": 1.0}
                ],
                "campaign_id": camp_id,
                "channel": "POS",
            },
            headers=_get_auth_headers(),
        )
        assert eval_res.status_code == 200
        eval_data = eval_res.json()
        assert eval_data["gross_cart_total"] == 1000.0
        assert eval_data["total_promotional_discount"] == 120.0

        # 5. Record Redemption via API
        redeem_res = await client.post(
            "/api/v1/promotions/redeem",
            json={
                "campaign_id": camp_id,
                "coupon_id": coupon_id,
                "reference_invoice_id": f"INV-API-{unique_suffix.upper()}",
                "discount_applied": 120.0,
            },
            headers=_get_auth_headers(),
        )
        assert redeem_res.status_code == 201
        assert redeem_res.json()["status"] == "RECORDED"
