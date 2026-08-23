"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.models.loyalty import LoyaltyTier, LoyaltyRule, LoyaltyMember, LoyaltyPointsLedger
from app.models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from app.models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger
from app.models.psv import PSVParty, PSVPartySkuTracking, PSVStockEvent, PSVStockBalance
from app.models.inventory import Product, StockMovement
from app.models.crm import Customer
from app.models.sync import POSOfflineSyncQueue
from app.services.commercial_growth_service import CommercialGrowthEngine
from app.services.pdt_analytics_service import PdtAnalyticsService
from app.services.offline_sync_service import OfflineSyncService
from app.services.psv_projection_service import PSVProjectionService


@pytest.fixture
def client():
    return TestClient(app)


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": UserRole.SYSADMIN.value,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_cge_loyalty_lifecycle_and_tier_advancement():
    """
    Verifies loyalty member enrollment, spend calculation with tier multipliers,
    points earning, redemption, and automatic tier advancement.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = None
        cust_id = f"cust_loyalty_{uuid.uuid4().hex[:8]}"

        # 1. Create Customer record first
        customer = Customer(
            id=cust_id,
            company_id=comp_id,
            branch_id=None,
            name="Loyalty Test Customer",
            mobile=f"99{uuid.uuid4().hex[:8]}",
            email=f"cust_{uuid.uuid4().hex[:4]}@smriti.test",
            is_active=True,
            is_deleted=False
        )
        session.add(customer)
        await session.flush()

        # 2. Ensure Loyalty Tiers exist
        t_silver_id = f"tier_silver_{uuid.uuid4().hex[:6]}"
        t_gold_id = f"tier_gold_{uuid.uuid4().hex[:6]}"

        silver_tier = LoyaltyTier(
            id=t_silver_id,
            company_id=comp_id,
            branch_id=branch_id,
            name=f"Silver Tier {uuid.uuid4().hex[:4]}",
            min_spend=Decimal("0.00"),
            earn_multiplier=Decimal("1.00"),
            is_active=True,
            is_deleted=False
        )
        gold_tier = LoyaltyTier(
            id=t_gold_id,
            company_id=comp_id,
            branch_id=branch_id,
            name=f"Gold Tier {uuid.uuid4().hex[:4]}",
            min_spend=Decimal("1000.00"),
            earn_multiplier=Decimal("1.50"),
            is_active=True,
            is_deleted=False
        )
        session.add(silver_tier)
        session.add(gold_tier)
        await session.flush()

        # 3. Enroll Member
        member = await CommercialGrowthEngine.get_or_create_loyalty_member(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            customer_id=cust_id
        )
        assert member.customer_id == cust_id
        assert member.current_points_balance == Decimal("0.00")

        # 4. Calculate and earn points on ₹500 spend (Silver tier -> 1 pt per ₹100 = 5 pts)
        pts_to_earn = await CommercialGrowthEngine.calculate_loyalty_points_for_spend(
            session=session,
            company_id=comp_id,
            member_id=member.id,
            spend_amount=Decimal("500.00")
        )
        assert pts_to_earn >= Decimal("5.00")

        await CommercialGrowthEngine.record_points_transaction(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            member_id=member.id,
            transaction_type="EARN",
            points=pts_to_earn,
            spend_delta=Decimal("500.00")
        )
        assert member.current_points_balance == pts_to_earn
        assert member.total_lifetime_spend == Decimal("500.00")

        # 5. Spend an additional ₹600 (Total spend ₹1100 -> crosses Gold threshold ₹1000)
        await CommercialGrowthEngine.record_points_transaction(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            member_id=member.id,
            transaction_type="EARN",
            points=Decimal("6.00"),
            spend_delta=Decimal("600.00")
        )
        assert member.total_lifetime_spend == Decimal("1100.00")
        assert member.loyalty_tier_id is not None
        
        # Verify upgraded tier has >= 1000 min_spend and 1.5x multiplier
        upgraded_tier = (await session.execute(
            select(LoyaltyTier).where(LoyaltyTier.id == member.loyalty_tier_id)
        )).scalar_one_or_none()
        assert upgraded_tier is not None
        assert upgraded_tier.min_spend >= Decimal("1000.00")
        assert upgraded_tier.earn_multiplier >= Decimal("1.50")

        # 6. Calculate points on next ₹500 spend (Gold tier 1.5x multiplier -> 5 * 1.5 = 7.50 pts)
        gold_pts = await CommercialGrowthEngine.calculate_loyalty_points_for_spend(
            session=session,
            company_id=comp_id,
            member_id=member.id,
            spend_amount=Decimal("500.00")
        )
        assert gold_pts == Decimal("7.50")

        # 7. Redeem points
        await CommercialGrowthEngine.record_points_transaction(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            member_id=member.id,
            transaction_type="REDEEM",
            points=Decimal("10.00"),
            reference_invoice_id="INV-RED-001"
        )
        assert member.current_points_balance == Decimal("1.00")
        assert member.total_points_redeemed == Decimal("10.00")
        await session.commit()


@pytest.mark.asyncio
async def test_cge_promotions_and_coupons():
    """
    Verifies campaign coupon validation, discount calculations, usage limits, and redemption recording.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"
        camp_id = f"camp_{uuid.uuid4().hex[:8]}"
        coupon_id = f"coup_{uuid.uuid4().hex[:8]}"
        coupon_code = f"DISC20_{uuid.uuid4().hex[:4].upper()}"

        # 1. Create Campaign
        campaign = PromotionCampaign(
            id=camp_id,
            company_id=comp_id,
            branch_id=branch_id,
            name=f"Festive Sale {coupon_code}",
            start_date=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1),
            end_date=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
            min_order_amount=Decimal("500.00"),
            max_discount_amount=Decimal("200.00"),
            usage_limit=10,
            is_active=True,
            is_deleted=False
        )
        session.add(campaign)
        await session.flush()

        # 2. Add rule & coupon referencing campaign
        rule = PromotionRule(
            id=f"prule_{uuid.uuid4().hex[:8]}",
            company_id=comp_id,
            branch_id=branch_id,
            campaign_id=camp_id,
            rule_type="PERCENTAGE",
            discount_percent=Decimal("20.00"),
            is_active=True,
            is_deleted=False
        )
        coupon = Coupon(
            id=coupon_id,
            company_id=comp_id,
            branch_id=branch_id,
            campaign_id=camp_id,
            code=coupon_code,
            usage_limit=5,
            usage_count=0,
            is_active=True,
            is_deleted=False
        )
        session.add(rule)
        session.add(coupon)
        await session.flush()

        # 3. Test Below Minimum Order (₹300 < ₹500 -> Invalid)
        res_invalid = await CommercialGrowthEngine.validate_and_evaluate_coupon(
            session=session,
            company_id=comp_id,
            coupon_code=coupon_code,
            cart_total=Decimal("300.00")
        )
        assert res_invalid["is_valid"] is False
        assert "Minimum cart amount" in res_invalid["reason"]

        # 4. Test Valid Order (₹800 * 20% = ₹160 discount)
        res_valid = await CommercialGrowthEngine.validate_and_evaluate_coupon(
            session=session,
            company_id=comp_id,
            coupon_code=coupon_code,
            cart_total=Decimal("800.00")
        )
        assert res_valid["is_valid"] is True
        assert res_valid["discount_amount"] == Decimal("160.00")

        # 5. Test Max Cap Order (₹2000 * 20% = ₹400 -> capped at ₹200)
        res_capped = await CommercialGrowthEngine.validate_and_evaluate_coupon(
            session=session,
            company_id=comp_id,
            coupon_code=coupon_code,
            cart_total=Decimal("2000.00")
        )
        assert res_capped["is_valid"] is True
        assert res_capped["discount_amount"] == Decimal("200.00")

        # 6. Record Redemption
        redemption = await CommercialGrowthEngine.record_coupon_redemption(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            campaign_id=camp_id,
            coupon_id=coupon_id,
            reference_invoice_id="INV-PROMO-001",
            discount_applied=Decimal("160.00")
        )
        assert redemption.discount_applied == Decimal("160.00")
        assert coupon.usage_count == 1
        await session.commit()


@pytest.mark.asyncio
async def test_pdt_inventory_velocity_and_reorder_simulation():
    """
    Verifies Predictive Distribution Twin (PDT) stock velocity calculation,
    days-of-cover projections, and suggested reorder points from StockMovement records.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"
        sku = f"SKU-PDT-{uuid.uuid4().hex[:6].upper()}"

        # 1. Create Product Master with 50 units
        prod = Product(
            id=f"prod_pdt_{uuid.uuid4().hex[:8]}",
            company_id=comp_id,
            branch_id=branch_id,
            code=sku,
            name=f"PDT Test Item {sku}",
            sku=sku,
            barcode=f"BC-{sku}",
            category="GENERAL",
            stock=50,
            price=100.0,
            cost_price=60.0,
            is_active=True,
            is_deleted=False
        )
        session.add(prod)

        # 2. Record 60 units sold in the last 30 days (2.0 units/day velocity)
        movement = StockMovement(
            id=f"smv_pdt_{uuid.uuid4().hex[:8]}",
            company_id=comp_id,
            branch_id=branch_id,
            product_id=prod.id,
            product_name=prod.name,
            sku=sku,
            quantity=-60,
            movement_type="OUTWARD_SALE",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="INV-PDT-001",
            created_at=datetime.now(timezone.utc) - timedelta(days=5),
            is_active=True,
            is_deleted=False
        )
        session.add(movement)
        await session.flush()

        # 3. Compute Velocity and Cover
        analytics = await PdtAnalyticsService.calculate_sku_velocity_and_cover(
            session=session,
            company_id=comp_id,
            sku=sku,
            lookback_days=30,
            lead_time_days=7,
            safety_stock=Decimal("10.00")
        )
        assert analytics["sku"] == sku
        assert analytics["total_units_sold"] == 60.0
        assert analytics["avg_daily_velocity"] == 2.0  # 60 / 30 = 2.0
        assert analytics["current_stock_on_hand"] == 50.0
        assert analytics["days_of_cover"] == 25.0  # 50 / 2.0 = 25 days
        assert analytics["reorder_point"] == 24.0  # (2.0 * 7 lead days) + 10 safety = 24.0
        assert analytics["is_reorder_recommended"] is False
        assert analytics["confidence_score"] >= 0.70
        assert analytics["model_metadata"]["engine_version"] == "v1.0.0-deterministic-sql"
        assert "velocity_formula" in analytics["explainability"]
        assert analytics["explainability"]["stock_status"] == "OPTIMAL_COVER"
        await session.commit()


@pytest.mark.asyncio
async def test_offline_sync_and_idempotent_deduplication():
    """
    Verifies offline sync batch ingestion, deduplication of previously processed transactions,
    durable queue persistence in pos_offline_sync_queue, and atomic posting of new sales invoices.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"
        batch_id = f"BATCH-{uuid.uuid4().hex[:8]}"
        invoice_no = f"INV-OFF-{uuid.uuid4().hex[:6].upper()}"

        # 1. Setup Product for line item
        prod_id = f"prod_sync_{uuid.uuid4().hex[:8]}"
        prod_sku = f"SKU-OFF-{uuid.uuid4().hex[:4].upper()}"
        prod = Product(
            id=prod_id,
            company_id=comp_id,
            branch_id=branch_id,
            code=prod_sku,
            name="Offline Sync Test Product",
            sku=prod_sku,
            barcode=f"BC-{prod_sku}",
            category="GENERAL",
            stock=100,
            price=250.0,
            cost_price=150.0,
            is_active=True,
            is_deleted=False
        )
        session.add(prod)
        await session.flush()

        batch_payload = [
            {
                "client_id": "cli_txn_001",
                "type": "SALES_INVOICE",
                "invoice_no": invoice_no,
                "customer_id": "CUST-WALKIN",
                "payment_mode": "CASH",
                "items": [
                    {
                        "product_id": prod_id,
                        "code": prod_sku,
                        "name": "Offline Sync Test Product",
                        "quantity": 2.0,
                        "price": 250.0,
                        "gst_rate": 18.0
                    }
                ]
            }
        ]

        # 2. First Sync Pass -> Should Commit and write to pos_offline_sync_queue
        res1 = await OfflineSyncService.process_sync_batch(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            batch_id=batch_id,
            transactions=batch_payload
        )
        assert res1["processed_count"] == 1
        assert res1["deduplicated_count"] == 0
        assert res1["results"][0]["status"] == "COMMITTED"
        assert res1["results"][0]["grand_total"] == 590.0  # 500 + 18% GST (90) = 590.0

        # 3. Second Sync Pass with Same Batch -> Should Deduplicate Idempotently
        res2 = await OfflineSyncService.process_sync_batch(
            session=session,
            company_id=comp_id,
            branch_id=branch_id,
            batch_id=batch_id,
            transactions=batch_payload
        )
        assert res2["processed_count"] == 0
        assert res2["deduplicated_count"] == 1
        assert res2["results"][0]["status"] == "ALREADY_PROCESSED"
        assert res2["results"][0]["invoice_no"] == invoice_no

        # 4. Verify durable pos_offline_sync_queue rows exist in tenant database
        queue_stmt = select(POSOfflineSyncQueue).where(
            POSOfflineSyncQueue.company_id == comp_id,
            POSOfflineSyncQueue.batch_id == batch_id
        )
        q_rows = (await session.execute(queue_stmt)).scalars().all()
        assert len(q_rows) == 2
        assert any(q.sync_status == "COMMITTED" for q in q_rows)
        assert any(q.sync_status == "ALREADY_PROCESSED" for q in q_rows)
        await session.commit()


@pytest.mark.asyncio
async def test_psv_stock_event_projection():
    """
    Verifies PSV (Public Stock Verification) projection service idempotency and party balance accumulation.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        party_id = f"psv_pty_{uuid.uuid4().hex[:6]}"
        sku = f"SKU-PSV-{uuid.uuid4().hex[:4].upper()}"
        src_event_id = f"evt_src_{uuid.uuid4().hex[:8]}"

        payload = {
            "source_event_id": src_event_id,
            "correlation_id": "corr-psv-01",
            "company_code": comp_id,
            "source_database": "smriti001",
            "source_document_type": "DELIVERY_CHALLAN",
            "source_document_id": "DC-9901",
            "psv_party_id": party_id,
            "sku": sku,
            "movement_type": "DISPATCHED",
            "quantity": 25.0,
            "source_event_created_at": datetime.now(timezone.utc),
            "event_date": datetime.now(timezone.utc)
        }

        # 1. First Projection -> Should create event and update balance
        res1 = await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload=payload
        )
        assert res1["status"] == "PROJECTED"
        assert res1["source_event_id"] == src_event_id

        # 2. Second Projection with identical source_event_id -> Should be idempotent
        res2 = await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload=payload
        )
        assert res2["status"] == "SKIPPED_ALREADY_PROJECTED"
        await session.commit()


def test_api_cge_and_sync_endpoints(client):
    """
    Verifies FastAPI REST API endpoints for CGE loyalty, coupons, PDT, and offline sync.
    """
    headers = get_auth_headers()

    # 1. Enroll Loyalty Member
    res = client.post(
        "/api/v1/cge/loyalty/enroll",
        params={"customer_id": f"cust_api_{uuid.uuid4().hex[:6]}"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "member_id" in data
    assert "current_points_balance" in data

    # 2. Validate Coupon Endpoint
    res_coup = client.post(
        "/api/v1/cge/promotions/validate-coupon",
        json={
            "coupon_code": "NONEXISTENT",
            "cart_total": 500.0
        },
        headers=headers
    )
    assert res_coup.status_code == 200
    assert res_coup.json()["is_valid"] is False

    # 3. Offline Sync Push Endpoint
    res_sync = client.post(
        "/api/v1/sync/push",
        json={
            "batch_id": f"BATCH-API-{uuid.uuid4().hex[:6]}",
            "transactions": []
        },
        headers=headers
    )
    assert res_sync.status_code == 200
    assert res_sync.json()["total_received"] == 0
