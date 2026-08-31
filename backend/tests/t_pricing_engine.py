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
from app.models.item_master import Item, ItemVariant
from app.models.pricing import PriceBook, PriceBookEntry, CustomerPriceTier
from app.services.pricing_engine import PricingEngine
from app.schemas.pricing import (
    PriceBookCreateRequest,
    PriceBookEntryCreateRequest,
    CustomerPriceTierCreateRequest,
    BulkPricingRequest,
    BulkPricingLineItem,
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
async def test_base_item_and_variant_price_resolution():
    """Verify fallback price resolution from Item and ItemVariant masters."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    item_id = f"item_{unique_suffix}"
    variant_id = f"var_{unique_suffix}"

    async with sessionmaker() as session:
        # Create Item & Variant
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"ITM-{unique_suffix.upper()}",
            item_name=f"Base Item {unique_suffix}",
            category="TEST",
            hsn_code="0000",
            item_type="FINISHED_GOOD",
            selling_price=Decimal("500.00"),
            mrp=Decimal("500.00"),
            cost_price=Decimal("250.00"),
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        variant = ItemVariant(
            id=variant_id,
            company_id="COMP-001",
            item_id=item.id,
            variant_sku=f"SKU-VAR-{unique_suffix.upper()}",
            variant_name="Size L / Blue",
            selling_price=Decimal("550.00"),
            mrp=Decimal("600.00"),
            cost_price=Decimal("280.00"),
        )
        session.add(variant)
        await session.commit()

        # 1. Resolve item without variant -> Base Item selling_price
        res_item = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item.id,
            quantity=Decimal("1.00"),
        )
        assert res_item["effective_unit_price"] == 500.00
        assert res_item["base_mrp"] == 500.00
        assert res_item["pricing_source"] == "ITEM_MASTER"

        # 2. Resolve with variant -> Variant selling_price
        res_var = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item.id,
            variant_id=variant.id,
            quantity=Decimal("2.00"),
        )
        assert res_var["effective_unit_price"] == 550.00
        assert res_var["base_mrp"] == 600.00
        assert res_var["line_subtotal"] == 1100.00
        assert res_var["pricing_source"] == "VARIANT_MASTER"


@pytest.mark.asyncio
async def test_price_book_volume_breaks_resolution():
    """Verify Price Book volume breaks: higher quantity tier triggers discounted price point."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    item_id = f"item_vol_{unique_suffix}"
    pb_code = f"PB-WHOLESALE-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create base item
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"ITM-VOL-{unique_suffix.upper()}",
            item_name=f"Volume Item {unique_suffix}",
            category="TEST",
            hsn_code="0000",
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        # Create Price Book
        pb = await PricingEngine.create_price_book(
            session=session,
            company_id="COMP-001",
            req=PriceBookCreateRequest(
                name="Wholesale Volume Book",
                code=pb_code,
                currency="INR",
                channel="WHOLESALE",
                status="ACTIVE",
            ),
        )

        # Tier 1: min_qty = 1 -> 900.00
        await PricingEngine.add_price_book_entry(
            session=session,
            company_id="COMP-001",
            price_book_id=pb.id,
            req=PriceBookEntryCreateRequest(
                item_id=item.id,
                min_quantity=1.0,
                selling_price=900.0,
                mrp=1000.0,
            ),
        )

        # Tier 2: min_qty = 10 -> 800.00
        await PricingEngine.add_price_book_entry(
            session=session,
            company_id="COMP-001",
            price_book_id=pb.id,
            req=PriceBookEntryCreateRequest(
                item_id=item.id,
                min_quantity=10.0,
                selling_price=800.0,
                mrp=1000.0,
            ),
        )

        # Tier 3: min_qty = 50 -> 700.00
        await PricingEngine.add_price_book_entry(
            session=session,
            company_id="COMP-001",
            price_book_id=pb.id,
            req=PriceBookEntryCreateRequest(
                item_id=item.id,
                min_quantity=50.0,
                selling_price=700.0,
                mrp=1000.0,
            ),
        )

        # 1. Qty = 5 -> Matches Tier 1 (900.00)
        res_5 = await PricingEngine.calculate_effective_price(
            session=session, item_id=item.id, quantity=Decimal("5.00"), price_book_code=pb_code
        )
        assert res_5["effective_unit_price"] == 900.00
        assert res_5["line_subtotal"] == 4500.00
        assert res_5["applied_price_book"] == pb_code

        # 2. Qty = 25 -> Matches Tier 2 (800.00)
        res_25 = await PricingEngine.calculate_effective_price(
            session=session, item_id=item.id, quantity=Decimal("25.00"), price_book_code=pb_code
        )
        assert res_25["effective_unit_price"] == 800.00
        assert res_25["line_subtotal"] == 20000.00

        # 3. Qty = 100 -> Matches Tier 3 (700.00)
        res_100 = await PricingEngine.calculate_effective_price(
            session=session, item_id=item.id, quantity=Decimal("100.00"), price_book_code=pb_code
        )
        assert res_100["effective_unit_price"] == 700.00
        assert res_100["line_subtotal"] == 70000.00


@pytest.mark.asyncio
async def test_customer_price_tier_discount_percentage():
    """Verify Customer Price Tier applies percentage discount modifier over base price."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    item_id = f"item_tier_{unique_suffix}"
    tier_code = f"TIER-GOLD-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"ITM-TIER-{unique_suffix.upper()}",
            item_name=f"Tier Item {unique_suffix}",
            category="TEST",
            hsn_code="0000",
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        # Create 15% discount Gold Tier
        await PricingEngine.create_customer_tier(
            session=session,
            company_id="COMP-001",
            req=CustomerPriceTierCreateRequest(
                name="Gold Customer Tier",
                code=tier_code,
                discount_percentage=15.0,
                description="15% discount on all purchases",
            ),
        )

        res = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item.id,
            quantity=Decimal("2.00"),
            customer_tier_code=tier_code,
        )
        # 1000 - 15% = 850.00
        assert res["effective_unit_price"] == 850.00
        assert res["line_subtotal"] == 1700.00
        assert res["applied_tier"] == tier_code
        assert res["discount_percentage"] == 15.0


@pytest.mark.asyncio
async def test_price_book_date_validity_gating():
    """Verify date-gated price books are ignored when expired and fall back to base prices."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    item_id = f"item_date_{unique_suffix}"
    pb_code_exp = f"PB-EXP-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"ITM-DATE-{unique_suffix.upper()}",
            item_name=f"Date Gated Item {unique_suffix}",
            category="TEST",
            hsn_code="0000",
            selling_price=Decimal("500.00"),
            mrp=Decimal("500.00"),
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        now = datetime.now(timezone.utc)
        # Expired yesterday
        pb_expired = await PricingEngine.create_price_book(
            session=session,
            company_id="COMP-001",
            req=PriceBookCreateRequest(
                name="Expired Sale Book",
                code=pb_code_exp,
                currency="INR",
                valid_from=now - timedelta(days=10),
                valid_to=now - timedelta(days=1),
                status="ACTIVE",
            ),
        )

        await PricingEngine.add_price_book_entry(
            session=session,
            company_id="COMP-001",
            price_book_id=pb_expired.id,
            req=PriceBookEntryCreateRequest(
                item_id=item.id,
                min_quantity=1.0,
                selling_price=300.0,
                mrp=500.0,
            ),
        )

        # Querying today should ignore expired price book (effective price = base 500.00)
        res_today = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item.id,
            quantity=Decimal("1.00"),
            price_book_code=pb_code_exp,
            as_of_date=now,
        )
        assert res_today["effective_unit_price"] == 500.00
        assert res_today["applied_price_book"] is None

        # Querying as of 5 days ago should apply the valid price book (300.00)
        res_past = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item.id,
            quantity=Decimal("1.00"),
            price_book_code=pb_code_exp,
            as_of_date=now - timedelta(days=5),
        )
        assert res_past["effective_unit_price"] == 300.00
        assert res_past["applied_price_book"] == pb_code_exp


@pytest.mark.asyncio
async def test_bulk_pricing_and_transaction_snapshot():
    """Verify multi-line bulk cart pricing resolution and immutable snapshot generation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    item1_id = f"item_bulk1_{unique_suffix}"
    item2_id = f"item_bulk2_{unique_suffix}"

    async with sessionmaker() as session:
        i1 = Item(
            id=item1_id,
            company_id="COMP-001",
            item_code=f"ITM-B1-{unique_suffix.upper()}",
            item_name="Item Bulk 1",
            category="TEST",
            hsn_code="0000",
            selling_price=Decimal("200.00"),
            mrp=Decimal("250.00"),
            status="ACTIVE",
        )
        i2 = Item(
            id=item2_id,
            company_id="COMP-001",
            item_code=f"ITM-B2-{unique_suffix.upper()}",
            item_name="Item Bulk 2",
            category="TEST",
            hsn_code="0000",
            selling_price=Decimal("400.00"),
            mrp=Decimal("500.00"),
            status="ACTIVE",
        )
        session.add_all([i1, i2])
        await session.commit()

        req = BulkPricingRequest(
            items=[
                BulkPricingLineItem(item_id=item1_id, quantity=3.0, custom_discount_percentage=10.0),
                BulkPricingLineItem(item_id=item2_id, quantity=2.0, custom_discount_percentage=0.0),
            ]
        )

        bulk_res = await PricingEngine.calculate_bulk_pricing(session, req)
        assert bulk_res.total_quantity == 5.0
        # Line 1: 200 - 10% = 180 * 3 = 540
        # Line 2: 400 * 2 = 800
        # Total subtotal: 540 + 800 = 1340
        # Total MRP: (250*3) + (500*2) = 750 + 1000 = 1750
        # Total Savings: 1750 - 1340 = 410
        assert bulk_res.total_subtotal == 1340.00
        assert bulk_res.total_mrp == 1750.00
        assert bulk_res.total_savings == 410.00

        # Generate Snapshot
        snapshot = await PricingEngine.generate_pricing_snapshot(session, req)
        assert snapshot.pricing_engine_version == 1
        assert snapshot.total_subtotal == 1340.00
        assert len(snapshot.lines) == 2


@pytest.mark.asyncio
async def test_api_pricing_endpoints():
    """Verify REST API pricing endpoints: books, entries, tiers, resolve, bulk, and snapshot."""
    unique_suffix = uuid.uuid4().hex[:4]
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Price Book via API
        pb_res = await client.post(
            "/api/v1/pricing/books",
            json={
                "name": f"API Test Book {unique_suffix}",
                "code": f"PB-API-{unique_suffix.upper()}",
                "currency": "INR",
                "channel": "POS",
                "status": "ACTIVE",
            },
            headers=_get_auth_headers(),
        )
        assert pb_res.status_code == 201
        pb_id = pb_res.json()["id"]

        # 2. List Price Books
        list_res = await client.get(
            "/api/v1/pricing/books",
            headers=_get_auth_headers(),
        )
        assert list_res.status_code == 200
        assert len(list_res.json()) >= 1

        # 3. Create Customer Tier via API
        tier_res = await client.post(
            "/api/v1/pricing/tiers",
            json={
                "name": f"API Platinum {unique_suffix}",
                "code": f"TIER-API-{unique_suffix.upper()}",
                "discount_percentage": 20.0,
            },
            headers=_get_auth_headers(),
        )
        assert tier_res.status_code == 201

        # 4. List Tiers via API
        tiers_res = await client.get(
            "/api/v1/pricing/tiers",
            headers=_get_auth_headers(),
        )
        assert tiers_res.status_code == 200
        assert len(tiers_res.json()) >= 1
