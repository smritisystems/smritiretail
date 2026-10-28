# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.131.0
Created      : 2026-10-28
Modified     : 2026-10-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.models.inventory import Warehouse, WarehouseLocation, StockMovement
from app.services.inventory_wms import InventoryWmsService
from app.schemas.wms import (
    CycleCountPlanCreate, CycleCountRecordCountRequest,
    CycleCountRecountRequest, CycleCountApproveRequest
)
from app.api.v1.wms import (
    create_cycle_count_plan as api_create_cycle_count_plan,
    list_cycle_count_plans as api_list_cycle_count_plans,
    get_cycle_count_plan_details as api_get_cycle_count_plan_details,
    record_cycle_count_item as api_record_cycle_count_item,
    request_cycle_count_recount as api_request_cycle_count_recount,
    approve_cycle_count as api_approve_cycle_count,
    reconcile_cycle_count as api_reconcile_cycle_count
)

pytestmark = pytest.mark.asyncio


def _mock_db_with_warehouse():
    db = AsyncMock()
    mock_wh = Warehouse(
        id="wh-test-01",
        code="WH01",
        name="Central Hub",
        is_active=True,
    )
    mock_loc1 = WarehouseLocation(
        id="loc-01",
        company_id="comp-1",
        warehouse_id="wh-test-01",
        code="A-01-01",
        name="Bin A-01-01",
        zone="PICKING",
        aisle="A-01",
        is_deleted=False,
    )
    mock_loc2 = WarehouseLocation(
        id="loc-02",
        company_id="comp-1",
        warehouse_id="wh-test-01",
        code="A-01-02",
        name="Bin A-01-02",
        zone="PICKING",
        aisle="A-01",
        is_deleted=False,
    )

    async def side_effect(statement, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(statement).lower()
        if "from warehouses" in stmt_str or "warehouses." in stmt_str:
            res.scalars.return_value.first.return_value = mock_wh
            res.scalar_one_or_none.return_value = mock_wh
        elif "from warehouse_locations" in stmt_str or "warehouse_locations." in stmt_str:
            res.scalars.return_value.all.return_value = [mock_loc1, mock_loc2]
            res.scalars.return_value.first.return_value = mock_loc1
        else:
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
            res.scalar_one_or_none.return_value = None
        return res

    db.execute.side_effect = side_effect
    db.scalar.return_value = mock_wh
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.fixture
def mock_tenant():
    return TenantContext(
        company_id="comp-1",
        branch_id="branch-1",
    )


async def test_cycle_count_create_plan_zone_filtering(mock_tenant):
    """Test 1: Plan created scoped to Zone PICKING with blind mode active."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(
        warehouse_id="wh-test-01",
        zone="PICKING",
        is_blind=True,
        variance_threshold_value=Decimal("500.00"),
        variance_threshold_pct=Decimal("5.00"),
    )

    assert plan["plan_id"].startswith("ccp-")
    assert plan["warehouse_id"] == "wh-test-01"
    assert plan["zone"] == "PICKING"
    assert plan["is_blind"] is True
    assert plan["status"] == "IN_PROGRESS"
    assert len(plan["items"]) >= 2

    # In blind mode, floor counter cannot see expected system quantities
    for it in plan["items"]:
        assert it["system_qty"] is None
        assert it["variance_qty"] is None
        assert it["status"] == "PENDING"


async def test_cycle_count_blind_mode_masks_system_qty(mock_tenant):
    """Test 2: System quantities are masked unless reveal_blind=True is passed."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(
        warehouse_id="wh-test-01",
        is_blind=True,
    )
    plan_id = plan["plan_id"]

    # Floor view (blind)
    floor_view = await service.get_cycle_count_details(
        warehouse_id="wh-test-01",
        plan_id=plan_id,
        reveal_blind=False,
    )
    assert floor_view["items"][0]["system_qty"] is None

    # Supervisor reveal view
    super_view = await service.get_cycle_count_details(
        warehouse_id="wh-test-01",
        plan_id=plan_id,
        reveal_blind=True,
    )
    assert super_view["items"][0]["system_qty"] is not None
    assert super_view["items"][0]["system_qty"] > 0


async def test_cycle_count_record_item_count_matched(mock_tenant):
    """Test 3: Floor scan count matching system quantity records MATCHED status."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(
        warehouse_id="wh-test-01",
        is_blind=False,  # Unblind to inspect variance in response
    )
    item = plan["items"][0]
    expected_qty = item["system_qty"]

    res = await service.record_cycle_count_item(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
        item_id=item["item_id"],
        counted_qty=Decimal(str(expected_qty)),
        scanned_barcode=item["bin_location"],
    )

    assert res["status"] == "MATCHED"
    assert res["counted_qty"] == float(expected_qty)
    assert res["variance_qty"] == 0.0
    assert res["requires_approval"] is False


async def test_cycle_count_record_item_threshold_violation_triggers_approval(mock_tenant):
    """Test 4: High variance exceeding threshold marks APPROVAL_REQUIRED."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(
        warehouse_id="wh-test-01",
        is_blind=False,
        variance_threshold_value=Decimal("500.00"),
    )
    item = plan["items"][0]

    # Count only 1 unit when system expects 50 (deficit of 49 * 250 = ₹12,250 > ₹500)
    res = await service.record_cycle_count_item(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
        item_id=item["item_id"],
        counted_qty=Decimal("1.00"),
        discrepancy_reason="THEFT_LOSS",
    )

    assert res["status"] == "APPROVAL_REQUIRED"
    assert res["requires_approval"] is True

    # Plan should transition to PENDING_APPROVAL
    plan_details = await service.get_cycle_count_details("wh-test-01", plan["plan_id"], reveal_blind=True)
    assert plan_details["status"] == "PENDING_APPROVAL"
    assert plan_details["requires_approval"] is True


async def test_cycle_count_mismatched_barcode_rejected(mock_tenant):
    """Test 5: Scanning wrong barcode/bin raises HTTP 400 validation error."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(warehouse_id="wh-test-01")
    item = plan["items"][0]

    with pytest.raises(HTTPException) as exc_info:
        await service.record_cycle_count_item(
            warehouse_id="wh-test-01",
            plan_id=plan["plan_id"],
            item_id=item["item_id"],
            counted_qty=Decimal("10.00"),
            scanned_barcode="WRONG-BARCODE-999",
        )
    assert exc_info.value.status_code == 400
    assert "does not match" in str(exc_info.value.detail)


async def test_cycle_count_recount_workflow(mock_tenant):
    """Test 6: Flagging an item for recount resets counted_qty and sets RECOUNT_REQUESTED."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(warehouse_id="wh-test-01")
    item = plan["items"][0]

    recount_res = await service.request_cycle_count_recount(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
        item_id=item["item_id"],
        reason="Discrepancy over 20% noticed; floor recheck required",
    )

    assert recount_res["status"] == "RECOUNT_REQUESTED"

    details = await service.get_cycle_count_details("wh-test-01", plan["plan_id"], reveal_blind=True)
    recounted_item = next(it for it in details["items"] if it["item_id"] == item["item_id"])
    assert recounted_item["status"] == "RECOUNT_REQUESTED"
    assert recounted_item["recount_count"] == 1
    assert recounted_item["counted_qty"] == 0.0


async def test_cycle_count_reconcile_blocked_when_unapproved(mock_tenant):
    """Test 7: Attempting to reconcile a plan with pending unapproved variance raises HTTP 400."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(
        warehouse_id="wh-test-01",
        variance_threshold_value=Decimal("100.00"),
    )
    item = plan["items"][0]

    # Create large deficit
    await service.record_cycle_count_item(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
        item_id=item["item_id"],
        counted_qty=Decimal("0.00"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.reconcile_cycle_count(
            warehouse_id="wh-test-01",
            plan_id=plan["plan_id"],
        )
    assert exc_info.value.status_code == 400
    assert "requires supervisor approval" in str(exc_info.value.detail)


async def test_cycle_count_approve_and_reconcile_posts_bin_movements(mock_tenant):
    """Test 8: Supervisor approves plan and reconciles; posts StockMovements with bin attribution."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    plan = await service.create_cycle_count_plan(
        warehouse_id="wh-test-01",
        variance_threshold_value=Decimal("100.00"),
    )
    item = plan["items"][0]

    # Record count causing deficit
    await service.record_cycle_count_item(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
        item_id=item["item_id"],
        counted_qty=Decimal("40.00"),  # 50 - 40 = 10 units loss
    )

    # Supervisor approves
    app_res = await service.approve_cycle_count(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
        supervisor_notes="Variance verified; shrinkage write-off authorized",
    )
    assert app_res["status"] == "APPROVED"

    # Reconcile
    recon_res = await service.reconcile_cycle_count(
        warehouse_id="wh-test-01",
        plan_id=plan["plan_id"],
    )

    assert recon_res["status"] == "RECONCILED"
    assert recon_res["adjustments_posted"] >= 1
    assert db.add.called

    # Check the StockMovement created
    created_movements = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], StockMovement)]
    assert len(created_movements) >= 1
    sm = created_movements[0]
    assert sm.reference_doc_type == "WMS_CYCLE_COUNT"
    assert sm.bin == item["bin_location"]
    assert sm.quantity < 0  # Deficit adjustment


async def test_cycle_count_api_router_endpoints(mock_tenant):
    """Test 9: FastAPI router integration for cycle count endpoints."""
    db = _mock_db_with_warehouse()

    # 1. Create Cycle Count Plan
    create_req = CycleCountPlanCreate(
        warehouse_id="wh-test-01",
        plan_name="API Test Cycle Count",
        zone="PICKING",
        is_blind=True,
        variance_threshold_value=Decimal("1000.00"),
        variance_threshold_pct=Decimal("5.00"),
    )
    plan_resp = await api_create_cycle_count_plan("wh-test-01", create_req, db, mock_tenant)
    assert plan_resp.warehouse_id == "wh-test-01"
    plan_id = plan_resp.plan_id
    assert plan_resp.is_blind is True

    # 2. List Plans
    plans_list = await api_list_cycle_count_plans("wh-test-01", None, db, mock_tenant)
    assert plans_list.total_plans >= 1

    # 3. Details (Supervisor unblind)
    details = await api_get_cycle_count_plan_details("wh-test-01", plan_id, reveal_blind=True, db=db, tenant_ctx=mock_tenant)
    assert details.items[0].system_qty is not None

    # 4. Record count
    item_id = plan_resp.items[0].item_id
    count_req = CycleCountRecordCountRequest(
        item_id=item_id,
        counted_qty=Decimal("50.0"),
    )
    count_resp = await api_record_cycle_count_item("wh-test-01", plan_id, count_req, db, mock_tenant)
    assert count_resp.counted_qty == 50.0

    # 5. Recount request
    recount_req = CycleCountRecountRequest(item_id=item_id, reason="Counter unsure of pack count")
    recount_resp = await api_request_cycle_count_recount("wh-test-01", plan_id, recount_req, db, mock_tenant)
    assert recount_resp.status == "RECOUNT_REQUESTED"

    # 6. Approve plan
    app_req = CycleCountApproveRequest(supervisor_notes="Approved via API")
    app_resp = await api_approve_cycle_count("wh-test-01", plan_id, app_req, db, mock_tenant)
    assert app_resp.status == "APPROVED"

    # 7. Reconcile plan
    recon_resp = await api_reconcile_cycle_count("wh-test-01", plan_id, db, mock_tenant)
    assert recon_resp.status == "RECONCILED"
