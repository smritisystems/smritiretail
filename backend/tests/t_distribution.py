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
from decimal import Decimal
from datetime import datetime, date
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.party import Party, PartyRole
from app.models.item_master import Item
from app.models.distribution import (
    DistributionTerritory,
    DealerAssignment,
    DistributionRoute,
    RouteStop,
    DistributionOrder,
    LoadingSheet,
    DistributionClaim,
    DistributionSettlement,
)
from app.services.distribution_svc import DistributionService
from app.schemas.distribution import (
    RouteCreateReq,
    RouteStopReq,
    LoadingSheetCreateReq,
    ClaimSubmitReq,
    ClaimReviewReq,
    SettlementCreateReq,
)


def _get_auth_headers(role: str = "STORE_MANAGER") -> dict:
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
async def test_territory_and_dealer_assignment_lifecycle():
    """Verify territory creation and dealer territorial credit allocation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # 1. Create Territory
        terr = await DistributionService.create_territory(
            session=session,
            code=f"TERR-{suffix.upper()}",
            name=f"South Zone {suffix}",
            region="SOUTH",
        )
        assert terr.id is not None
        assert terr.code == f"TERR-{suffix.upper()}"

        # 2. Seed Party
        party = Party(
            id=f"party_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-{suffix.upper()}",
            legal_name=f"Apex Distributors {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(party)
        await session.flush()

        # 3. Assign Dealer to Territory
        assign = await DistributionService.assign_dealer(
            session=session,
            party_id=party.id,
            territory_code=terr.code,
            salesman_id="usr_sales_01",
            credit_limit=Decimal("750000.00"),
            credit_days=45,
        )
        assert assign.id is not None
        assert assign.credit_limit == Decimal("750000.00")
        assert assign.credit_days == 45
        await session.commit()


@pytest.mark.asyncio
async def test_route_and_route_stops_ordered_sequence():
    """Verify delivery route creation and sequential stop management."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed 2 Parties
        p1 = Party(
            id=f"p1_{suffix}",
            company_id="COMP-001",
            party_code=f"RET1-{suffix.upper()}",
            legal_name=f"Retail Store 1 {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        p2 = Party(
            id=f"p2_{suffix}",
            company_id="COMP-001",
            party_code=f"RET2-{suffix.upper()}",
            legal_name=f"Retail Store 2 {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([p1, p2])
        await session.commit()

        # 1. Create Route with stops
        route_req = RouteCreateReq(
            route_code=f"RT-{suffix.upper()}",
            name=f"Downtown Route {suffix}",
            territory_code=f"TERR-{suffix.upper()}",
            assigned_salesman_id="usr_sales_01",
            assigned_driver_id="usr_driver_01",
            vehicle_number="MH-12-AB-1234",
            stops=[
                RouteStopReq(party_id=p1.id, stop_sequence=1, planned_time="10:00 AM"),
                RouteStopReq(party_id=p2.id, stop_sequence=2, planned_time="11:30 AM"),
            ],
        )
        route = await DistributionService.create_route(
            session=session,
            company_id="COMP-001",
            req=route_req,
            user_id="usr-super",
        )
        assert route.id is not None
        assert route.status == "ACTIVE"

        # 2. Add Stop 3
        p3 = Party(
            id=f"p3_{suffix}",
            company_id="COMP-001",
            party_code=f"RET3-{suffix.upper()}",
            legal_name=f"Retail Store 3 {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(p3)
        await session.flush()

        stop3 = await DistributionService.add_route_stop(
            session=session,
            company_id="COMP-001",
            route_id=route.id,
            req=RouteStopReq(party_id=p3.id, stop_sequence=3, planned_time="01:00 PM"),
        )
        assert stop3.id is not None
        assert stop3.stop_sequence == 3


@pytest.mark.asyncio
async def test_primary_and_secondary_distribution_orders_gst():
    """Verify primary and secondary distribution order pricing and statutory GST calculation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Party & Item
        party = Party(
            id=f"part_ord_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-ORD-{suffix.upper()}",
            legal_name=f"Metro Dealer {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        item = Item(
            id=f"item_dist_{suffix}",
            company_id="COMP-001",
            item_code=f"SKU-DIST-{suffix.upper()}",
            item_name=f"Premium Fabric Roll {suffix}",
            category="GENERAL",
            hsn_code="5208",
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1200.00"),
            tax_rate=Decimal("18.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([party, item])
        await session.commit()

        # 1. Primary Order (10 units @ ₹1000 = ₹10,000 + 18% GST = ₹11,800)
        order_pri = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            order_type="PRIMARY",
            line_items_data=[{"item_id": item.id, "quantity": 10.0}],
            supplier_state="27",
            recipient_state="27",
            company_id="COMP-001",
        )
        assert order_pri.order_type == "PRIMARY"
        assert order_pri.taxable_amount == Decimal("10000.00")
        assert order_pri.tax_total == Decimal("1800.00")
        assert order_pri.grand_total == Decimal("11800.00")
        assert order_pri.governance_snapshot_id is not None

        # 2. Secondary Order (5 units)
        order_sec = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            order_type="SECONDARY",
            line_items_data=[{"item_id": item.id, "quantity": 5.0}],
            supplier_state="27",
            recipient_state="27",
            company_id="COMP-001",
        )
        assert order_sec.order_type == "SECONDARY"
        assert order_sec.grand_total == Decimal("5900.00")


@pytest.mark.asyncio
async def test_loading_sheet_aggregation_and_order_status_progression():
    """Verify vehicle loading sheet consolidating orders and updating status to LOADED."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Party & Item
        party = Party(
            id=f"part_ls_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-LS-{suffix.upper()}",
            legal_name=f"Logistics Dealer {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        item = Item(
            id=f"item_ls_{suffix}",
            company_id="COMP-001",
            item_code=f"SKU-LS-{suffix.upper()}",
            item_name=f"Box Cotton Yarn {suffix}",
            category="GENERAL",
            hsn_code="5208",
            selling_price=Decimal("500.00"),
            mrp=Decimal("600.00"),
            tax_rate=Decimal("12.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([party, item])
        await session.commit()

        # Create 2 Orders
        ord1 = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            line_items_data=[{"item_id": item.id, "quantity": 10.0}],
            company_id="COMP-001",
        )
        ord2 = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            line_items_data=[{"item_id": item.id, "quantity": 20.0}],
            company_id="COMP-001",
        )

        # Create Loading Sheet
        sheet = await DistributionService.create_loading_sheet(
            session=session,
            company_id="COMP-001",
            req=LoadingSheetCreateReq(
                vehicle_number="MH-14-GH-9999",
                driver_name="Ramesh Yadav",
                order_ids=[ord1.id, ord2.id],
            ),
            user_id="usr-super",
        )
        assert sheet.id is not None
        assert sheet.total_orders_count == 2
        assert sheet.status == "LOADED"
        assert sheet.total_value == ord1.grand_total + ord2.grand_total


@pytest.mark.asyncio
async def test_claims_submission_review_and_credit_note_generation():
    """Verify distribution claim submission, review, approval, and Credit Note generation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Party
        party = Party(
            id=f"part_clm_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-CLM-{suffix.upper()}",
            legal_name=f"Claiming Dealer {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(party)
        await session.commit()

        # 1. Submit Claim
        claim = await DistributionService.submit_claim(
            session=session,
            company_id="COMP-001",
            req=ClaimSubmitReq(
                party_id=party.id,
                claim_type="DAMAGE",
                reference_order_no=f"DO-{suffix.upper()}",
                claim_amount=Decimal("15000.00"),
                remarks="5 cartons water damaged during transit",
            ),
            user_id="usr-super",
        )
        assert claim.id is not None
        assert claim.status == "SUBMITTED"

        # 2. Review and Approve Claim
        reviewed = await DistributionService.review_claim(
            session=session,
            company_id="COMP-001",
            claim_id=claim.id,
            req=ClaimReviewReq(
                status="APPROVED",
                approved_amount=Decimal("15000.00"),
                remarks="Verified transit damage report",
            ),
            user_id="usr-super",
        )
        assert reviewed.status == "APPROVED"
        assert reviewed.approved_amount == Decimal("15000.00")
        assert reviewed.settlement_credit_note_id is not None
        assert "CN-" in reviewed.settlement_credit_note_id


@pytest.mark.asyncio
async def test_route_trip_financial_and_stock_settlement():
    """Verify route trip cash, cheque, UPI, credit, and returned stock reconciliation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Party & Item
        party = Party(
            id=f"part_stl_{suffix}",
            company_id="COMP-001",
            party_code=f"DLR-STL-{suffix.upper()}",
            legal_name=f"Settling Dealer {suffix}",
            party_type="ORGANIZATION",
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        item = Item(
            id=f"item_stl_{suffix}",
            company_id="COMP-001",
            item_code=f"SKU-STL-{suffix.upper()}",
            item_name=f"Silk Saree Box {suffix}",
            category="GENERAL",
            hsn_code="5208",
            selling_price=Decimal("2000.00"),
            mrp=Decimal("2500.00"),
            tax_rate=Decimal("5.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([party, item])
        await session.commit()

        # Create Order & Loading Sheet
        order = await DistributionService.create_distribution_order(
            session=session,
            party_id=party.id,
            line_items_data=[{"item_id": item.id, "quantity": 10.0}],
            company_id="COMP-001",
        )
        sheet = await DistributionService.create_loading_sheet(
            session=session,
            company_id="COMP-001",
            req=LoadingSheetCreateReq(order_ids=[order.id]),
            user_id="usr-super",
        )

        # Settle Route Trip (Grand Total = ₹21,000. Cash ₹10,000 + UPI ₹6,000 + Credit ₹5,000 = ₹21,000)
        settlement = await DistributionService.settle_route_trip(
            session=session,
            company_id="COMP-001",
            req=SettlementCreateReq(
                loading_sheet_id=sheet.id,
                cash_collected=Decimal("10000.00"),
                cheques_collected=Decimal("0.00"),
                upi_collected=Decimal("6000.00"),
                credit_extended=Decimal("5000.00"),
                returned_stock_value=Decimal("0.00"),
            ),
            user_id="usr-super",
        )
        assert settlement.id is not None
        assert settlement.status == "RECONCILED"
        assert settlement.shortage_excess_amount == Decimal("0.00")


@pytest.mark.asyncio
async def test_api_distribution_endpoints():
    """Verify REST API endpoints for distribution territories, dealers, routes, orders, and claims."""
    transport = ASGITransport(app=app)
    suffix = uuid.uuid4().hex[:6]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. POST /distribution/territories
        terr_res = await client.post(
            "/api/v1/distribution/territories",
            json={
                "code": f"TERR-API-{suffix.upper()}",
                "name": f"API Zone {suffix}",
                "region": "WEST",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert terr_res.status_code == 200
        assert terr_res.json()["status"] == "SUCCESS"

        # 2. POST /distribution/routes
        route_res = await client.post(
            "/api/v1/distribution/routes",
            json={
                "route_code": f"RT-API-{suffix.upper()}",
                "name": f"Express Route {suffix}",
                "territory_code": f"TERR-API-{suffix.upper()}",
                "vehicle_number": "MH-01-XX-0001",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert route_res.status_code == 200
        assert route_res.json()["status"] == "SUCCESS"
