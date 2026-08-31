"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.services.pricing_engine import PricingEngine
from app.services.distribution_svc import DistributionService
from app.models.party import Party
from app.models.item_master import Item, ItemVariant
from app.models.pricing import PriceBook, PriceBookEntry, CustomerPriceTier
from app.models.distribution import DistributionTerritory, DealerAssignment, DistributionOrder
from app.models.inventory import StockMovement


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_unified_pricing_engine_volume_breaks_and_tiers():
    """Verify PricingEngine resolves volume break discounts and customer tiers correctly."""
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        # Create test item
        sku = f"PRC-{uuid.uuid4().hex[:6].upper()}"
        item = Item(
            id=f"itm_{uuid.uuid4().hex[:12]}",
            company_id="COMP-001",
            item_code=sku,
            item_name="Industrial Lubricant Drum",
            category="INDUSTRIAL",
            hsn_code="5208",
            tax_rate=Decimal("18.00"),
            mrp=Decimal("5000.00"),
            selling_price=Decimal("4500.00"),
            cost_price=Decimal("3000.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        # Create Wholesale Price Book with volume break (>= 10 drums -> ₹4000)
        pb_code = f"PB_WHOLESALE_{uuid.uuid4().hex[:4].upper()}"
        pb = PriceBook(
            id=f"pb_{uuid.uuid4().hex[:12]}",
            company_id="COMP-001",
            code=pb_code,
            name="Wholesale Industrial Price List",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(pb)
        await session.flush()

        pbe = PriceBookEntry(
            id=f"pbe_{uuid.uuid4().hex[:12]}",
            company_id="COMP-001",
            price_book_id=pb.id,
            item_id=item.id,
            min_quantity=Decimal("10.0000"),
            selling_price=Decimal("4000.00"),
            mrp=item.mrp,
            is_active=True,
            is_deleted=False,
        )
        session.add(pbe)

        # Create Dealer Customer Price Tier (5% additional discount)
        tier_code = f"TIER_DEALER_{uuid.uuid4().hex[:4].upper()}"
        tier = CustomerPriceTier(
            id=f"tier_{uuid.uuid4().hex[:12]}",
            company_id="COMP-001",
            code=tier_code,
            name="Gold Distributor Tier",
            discount_percentage=Decimal("5.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(tier)
        await session.commit()

        # Case 1: Single item without price book -> baseline selling price ₹4500
        p1 = await PricingEngine.calculate_effective_price(session, item.id, quantity=Decimal("1.00"))
        assert p1["effective_unit_price"] == 4500.00

        # Case 2: Quantity 10 with Wholesale Price Book -> volume break ₹4000
        p2 = await PricingEngine.calculate_effective_price(
            session, item.id, quantity=Decimal("10.00"), price_book_code=pb_code
        )
        assert p2["effective_unit_price"] == 4000.00
        assert p2["applied_price_book"] == pb_code

        # Case 3: Quantity 10 with Wholesale Price Book + Gold Dealer Tier -> ₹4000 - 5% = ₹3800
        p3 = await PricingEngine.calculate_effective_price(
            session, item.id, quantity=Decimal("10.00"), price_book_code=pb_code, customer_tier_code=tier_code
        )
        assert p3["effective_unit_price"] == 3800.00
        assert p3["discount_percentage"] == 5.00


@pytest.mark.asyncio
async def test_distribution_order_creation_gst_and_governance_snapshots():
    """Verify DistributionOrder creation, statutory GST calculation, and governance snapshot persistence."""
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        # Create dealer party
        suffix = uuid.uuid4().hex[:6]
        party = Party(
            id=f"pty_prc_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-PRC-{suffix.upper()}",
            legal_name=f"Pricing Test Dealer {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(party)

        # Create item
        item = Item(
            id=f"itm_test_{suffix}",
            company_id="COMP-001",
            item_code=f"SKU-TEST-{suffix.upper()}",
            item_name="Priced Distribution Sample Item",
            category="GENERAL",
            hsn_code="5208",
            tax_rate=Decimal("18.00"),
            mrp=Decimal("1000.00"),
            selling_price=Decimal("800.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.commit()

        # Create Distribution Order
        order = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            order_type="PRIMARY",
            territory_code="TERR_MUMBAI_METRO",
            salesman_id="usr_sales_01",
            delivery_route="ROUTE_WEST_CORRIDOR",
            line_items_data=[
                {"item_id": item.id, "quantity": 5.0}
            ],
            supplier_state="27",
            recipient_state="27",
            company_id="COMP-001",
        )

        # Query back and verify order & snapshot
        stmt = select(DistributionOrder).options(
            selectinload(DistributionOrder.lines)
        ).where(DistributionOrder.id == order.id)
        saved_order = (await session.execute(stmt)).scalars().first()

        assert saved_order is not None
        assert saved_order.status == "DRAFT"
        assert saved_order.governance_snapshot_id is not None
        assert saved_order.rule_snapshots["policy_versions"]["POLICY_GST_STANDARD"] == 1
        assert len(saved_order.lines) == 1
        assert saved_order.grand_total > Decimal("0.00")


@pytest.mark.asyncio
async def test_distribution_order_dispatch_and_authoritative_stock_movement():
    """Verify that dispatching a distribution order records an authoritative OUTWARD StockMovement."""
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        suffix = uuid.uuid4().hex[:6]
        party = Party(
            id=f"pty_dsp_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-DSP-{suffix.upper()}",
            legal_name=f"Dispatch Test Dealer {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        item = Item(
            id=f"itm_dsp_{suffix}",
            company_id="COMP-001",
            item_code=f"SKU-DSP-{suffix.upper()}",
            item_name="Priced Distribution Dispatch Item",
            category="GENERAL",
            hsn_code="5208",
            tax_rate=Decimal("18.00"),
            mrp=Decimal("1000.00"),
            selling_price=Decimal("800.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([party, item])
        await session.commit()

        order = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            order_type="SECONDARY",
            line_items_data=[{"item_id": item.id, "quantity": 3.0}],
            company_id="COMP-001",
        )

        # Dispatch order
        challan_no = f"DC-{uuid.uuid4().hex[:6].upper()}"
        dispatched_order = await DistributionService.dispatch_distribution_order(
            session=session,
            order_id=order.id,
            delivery_challan_no=challan_no
        )

        assert dispatched_order.status == "DISPATCHED"
        assert dispatched_order.delivery_challan_no == challan_no

        # Verify authoritative StockMovement was recorded
        sm_stmt = select(StockMovement).where(
            StockMovement.reference_doc_id == dispatched_order.order_no,
            StockMovement.movement_type == "OUTWARD_SALE"
        )
        mov = (await session.execute(sm_stmt)).scalars().first()
        assert mov is not None
        assert mov.sku == item.item_code
        assert float(mov.quantity) == 3.0


@pytest.mark.asyncio
async def test_api_distribution_endpoints():
    """Verify distribution REST API endpoints."""
    headers = get_auth_headers()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Territory
        t_res = await client.post(
            "/api/v1/distribution/territories",
            json={
                "code": f"TERR_TEST_{uuid.uuid4().hex[:4].upper()}",
                "name": "Northern Suburban Distribution Zone",
                "region": "NORTH",
            },
            headers=headers,
        )
        assert t_res.status_code == 200
        assert t_res.json()["status"] == "SUCCESS"

        # 2. Invalid order creation without lines -> 400
        o_res = await client.post(
            "/api/v1/distribution/orders",
            json={
                "party_id": "pty_invalid",
                "line_items": [],
            },
            headers=headers,
        )
        assert o_res.status_code == 400
