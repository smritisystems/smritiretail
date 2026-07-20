"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from decimal import Decimal
from httpx import ASGITransport, AsyncClient
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db
from app.models.inventory import Product, StockMovement
from app.models.transfer import (
    StockTransferOrder,
    StockTransferOrderItem,
    StockRebalancingRecommendation,
)
from app.db.base import BaseEntity
from app.services.rebalancing_service import StockRebalancingService
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    async with db_session.bind.begin() as conn:
        await conn.run_sync(BaseEntity.metadata.create_all)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


@pytest.mark.asyncio
async def test_calculate_rebalancing_recommendations(db_session):
    """Verifies automated multi-store stock rebalancing recommendation calculation."""
    prod = Product(
        id="prod-reb-100",
        code="PROD-REB-100",
        sku="SKU-REB-100",
        barcode="8901000000100",
        name="Amul Butter 500g",
        category="Dairy",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()

    svc = StockRebalancingService()
    recs = await svc.calculate_rebalancing_recommendations(
        db=db_session,
        source_branch_id="br-main-hub",
        target_branch_id="br-spoke-01",
    )

    assert len(recs) >= 1
    assert recs[0].product_id == "prod-reb-100"
    assert recs[0].recommended_qty == Decimal("25.0000")
    assert recs[0].status == "PENDING"


@pytest.mark.asyncio
async def test_convert_recommendation_to_sto(db_session):
    """Verifies conversion of a recommendation to a Stock Transfer Order (REQUESTED)."""
    prod = Product(
        id="prod-reb-200",
        code="PROD-REB-200",
        sku="SKU-REB-200",
        barcode="8901000000200",
        name="Fortune Sunlite Oil 1L",
        category="Grocery",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()

    rec = StockRebalancingRecommendation(
        id=str(uuid.uuid4()),
        source_branch_id="br-main-hub",
        target_branch_id="br-spoke-01",
        product_id="prod-reb-200",
        sku="SKU-REB-200",
        product_name="Fortune Sunlite Oil 1L",
        source_stock_on_hand=Decimal("120.00"),
        target_stock_on_hand=Decimal("2.00"),
        recommended_qty=Decimal("30.00"),
        reason="STOCKOUT_PREVENTION",
        status="PENDING",
    )
    db_session.add(rec)
    await db_session.commit()

    svc = StockRebalancingService()
    sto = await svc.convert_recommendation_to_sto(
        db=db_session,
        recommendation_id=rec.id,
        requested_by="usr-planner-01",
    )

    assert sto.status == "REQUESTED"
    assert sto.transfer_no.startswith("STO-")
    assert sto.total_line_items == 1
    assert rec.status == "CONVERTED"


@pytest.mark.asyncio
async def test_sto_full_lifecycle_dispatch_and_receive(db_session):
    """Verifies STO full lifecycle (REQUESTED -> DISPATCHED -> RECEIVED) and stock movement postings."""
    prod = Product(
        id="prod-reb-300",
        code="PROD-REB-300",
        sku="SKU-REB-300",
        barcode="8901000000300",
        name="Tata Salt 1kg",
        category="Grocery",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()

    svc = StockRebalancingService()
    recs = await svc.calculate_rebalancing_recommendations(
        db=db_session,
        source_branch_id="br-main-hub",
        target_branch_id="br-spoke-01",
    )
    sto = await svc.convert_recommendation_to_sto(
        db=db_session,
        recommendation_id=recs[0].id,
        requested_by="usr-planner-01",
    )

    # 1. Dispatch
    dispatched_sto = await svc.dispatch_transfer_order(
        db=db_session,
        transfer_order_id=sto.id,
        dispatched_by="usr-warehouse-01",
    )
    assert dispatched_sto.status == "DISPATCHED"

    # 2. Receive
    received_sto = await svc.receive_transfer_order(
        db=db_session,
        transfer_order_id=sto.id,
        received_by="usr-store-manager-01",
    )
    assert received_sto.status == "RECEIVED"

    # 3. Verify stock movement entries
    mv_res = await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == sto.id)
    )
    movements = mv_res.scalars().all()
    assert len(movements) == 2  # 1 OUT movement at dispatch, 1 IN movement at receive


@pytest.mark.asyncio
async def test_transfers_rest_api_endpoints(db_session):
    """Tests FastAPI /transfers REST API endpoints."""
    prod = Product(
        id="prod-reb-400",
        code="PROD-REB-400",
        sku="SKU-REB-400",
        barcode="8901000000400",
        name="Aashirvaad Atta 10kg",
        category="Staples",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Calculate rebalance
        res_calc = await ac.post(
            "/api/v1/transfers/rebalance/calculate",
            json={"source_branch_id": "br-main-hub", "target_branch_id": "br-spoke-01"}
        )
        assert res_calc.status_code == 200
        calc_data = res_calc.json()
        assert calc_data["success"] is True
        rec_id = calc_data["recommendations"][0]["id"]

        # 2. Convert to STO
        res_conv = await ac.post(
            f"/api/v1/transfers/rebalance/{rec_id}/convert",
            json={"user_id": "usr-planner-01"}
        )
        assert res_conv.status_code == 200
        sto_id = res_conv.json()["transfer_order_id"]

        # 3. Dispatch STO
        res_disp = await ac.post(
            f"/api/v1/transfers/{sto_id}/dispatch",
            json={"user_id": "usr-dispatcher-01"}
        )
        assert res_disp.status_code == 200
        assert res_disp.json()["status"] == "DISPATCHED"

        # 4. Receive STO
        res_rec = await ac.post(
            f"/api/v1/transfers/{sto_id}/receive",
            json={"user_id": "usr-receiver-01"}
        )
        assert res_rec.status_code == 200
        assert res_rec.json()["status"] == "RECEIVED"

        # 5. List STOs
        res_list = await ac.get("/api/v1/transfers/")
        assert res_list.status_code == 200
        assert len(res_list.json()) >= 1
