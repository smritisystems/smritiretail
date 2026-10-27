"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-10-28
Modified     : 2026-10-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: WMS Phase 2 - Physical Storage Bin Matrix & Putaway Rule Engine
Validates:
1. Schema-drift resilient warehouse retrieval (_get_warehouse_resilient)
2. Priority 1: Quarantine / Damage Isolation
3. Priority 2: Dedicated Item Bin Affinity
4. Priority 3: Co-located Product Stock
5. Priority 4: Nearest Available Empty Bin Allocation (Aisle->Rack->Shelf->Bin)
6. Over-capacity and No-locations-defined handling
7. Full API endpoint wiring (/api/v1/wms/warehouses/{id}/putaway-recommendation)
"""

import pytest
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.models.inventory import Warehouse, WarehouseLocation, StockMovement
from app.models.item_master import ItemWarehouseLocation
from app.schemas.wms import (
    PutawayRecommendationRequest,
    PutawayRecommendationResponse,
    PutawayCandidateLocation,
)
from app.services.inventory_wms import InventoryWmsService
from app.api.deps import TenantContext
from app.api.v1.wms import _get_warehouse_resilient, get_putaway_recommendation


pytestmark = pytest.mark.asyncio


def _make_location(
    loc_id: str,
    warehouse_id: str,
    code: str,
    zone: str = "STORAGE",
    aisle: str = "A01",
    rack: str = "R01",
    shelf: str = "S01",
    bin_code: str = "B01",
    max_capacity_units: int = 100,
    is_locked: bool = False,
    is_active: bool = True,
) -> WarehouseLocation:
    loc = WarehouseLocation(
        id=loc_id,
        warehouse_id=warehouse_id,
        code=code,
        name=f"Location {code}",
        zone=zone,
        aisle=aisle,
        rack=rack,
        shelf=shelf,
        bin_code=bin_code,
        barcode=f"LOC-{warehouse_id}-{code}",
        max_capacity_units=max_capacity_units,
        is_locked=is_locked,
        is_active=is_active,
    )
    return loc


async def test_resilient_warehouse_lookup_handles_schema_drift():
    """Verify _get_warehouse_resilient rolls back and defers is_default_for_branch on unmigrated DB."""
    mock_db = AsyncMock()
    mock_db.execute.side_effect = [
        Exception('column warehouses.is_default_for_branch does not exist'),  # 1st attempt fails
        MagicMock(scalars=lambda: MagicMock(first=lambda: Warehouse(id="wh-01", code="WH-MAIN", name="Main Warehouse")))
    ]

    wh = await _get_warehouse_resilient(mock_db, "wh-01", "COMP-001")
    assert wh is not None
    assert wh.code == "WH-MAIN"
    assert mock_db.rollback.await_count == 1


async def test_putaway_priority_1_quarantine_isolation():
    """Verify damaged goods are routed to Priority 1 QUARANTINE zone bins."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    # Locations in warehouse: 1 storage, 1 quarantine
    loc_storage = _make_location("loc-1", "wh-01", "ST-A01-R01-S01-B01", zone="STORAGE", max_capacity_units=100)
    loc_quarantine = _make_location("loc-2", "wh-01", "QN-A01-R01-S01-B01", zone="QUARANTINE", max_capacity_units=50)

    # Mock execute results:
    # 1. all_locations query
    # 2. occupancy by code query
    # 3. occupancy by id query
    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: [loc_storage, loc_quarantine]))
    mock_occ_code_res = MagicMock(all=lambda: [])
    mock_occ_id_res = MagicMock(all=lambda: [])
    mock_db.execute.side_effect = [mock_locs_res, mock_occ_code_res, mock_occ_id_res]

    rec = await service.recommend_putaway(
        warehouse_id="wh-01",
        warehouse_code="WH-MAIN",
        product_id="prod-001",
        quantity=Decimal("10.0000"),
        is_damaged=True,
    )

    assert rec["status"] == "RECOMMENDED"
    assert rec["recommended_location"]["code"] == "QN-A01-R01-S01-B01"
    assert rec["recommended_location"]["rule_applied"] == "QUARANTINE_ISOLATION"
    assert rec["recommended_location"]["zone"] == "QUARANTINE"


async def test_putaway_priority_2_dedicated_item_bin():
    """Verify item with configured ItemWarehouseLocation bin affinity routes to dedicated bin."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    loc1 = _make_location("loc-1", "wh-01", "ST-A01-R01-S01-B01", zone="STORAGE", max_capacity_units=100)
    loc2 = _make_location("loc-2", "wh-01", "PK-A01-R01-S01-B01", zone="PICKING", max_capacity_units=100)

    # Dedicated bin configuration
    dedicated_iwl = ItemWarehouseLocation(
        id="iwl-01",
        item_id="item-apparel-01",
        warehouse_id="wh-01",
        location_bin="PK-A01-R01-S01-B01",
    )

    # Mock DB executions:
    # 1. all_locations
    # 2. occ_code
    # 3. occ_id
    # 4. ItemWarehouseLocation lookup
    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: [loc1, loc2]))
    mock_occ_code_res = MagicMock(all=lambda: [])
    mock_occ_id_res = MagicMock(all=lambda: [])
    mock_iwl_res = MagicMock(scalars=lambda: MagicMock(first=lambda: dedicated_iwl))

    mock_db.execute.side_effect = [mock_locs_res, mock_occ_code_res, mock_occ_id_res, mock_iwl_res]

    rec = await service.recommend_putaway(
        warehouse_id="wh-01",
        warehouse_code="WH-MAIN",
        item_id="item-apparel-01",
        quantity=Decimal("15.0000"),
        is_damaged=False,
    )

    assert rec["status"] == "RECOMMENDED"
    assert rec["recommended_location"]["code"] == "PK-A01-R01-S01-B01"
    assert rec["recommended_location"]["rule_applied"] == "DEDICATED_ITEM_BIN"


async def test_putaway_priority_3_colocated_stock():
    """Verify product with existing stock in a bin routes to co-located bin."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    loc1 = _make_location("loc-1", "wh-01", "ST-A01-R01-S01-B01", zone="STORAGE", max_capacity_units=100)
    loc2 = _make_location("loc-2", "wh-01", "ST-A01-R01-S01-B02", zone="STORAGE", max_capacity_units=100)

    # Mock DB executions:
    # 1. all_locations
    # 2. occ_code: loc2 has 30 units
    # 3. occ_id
    # 4. ItemWarehouseLocation lookup: None
    # 5. Co-location query: returns loc2 code ('ST-A01-R01-S01-B02')
    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: [loc1, loc2]))
    mock_occ_code_res = MagicMock(all=lambda: [("ST-A01-R01-S01-B02", 30.0)])
    mock_occ_id_res = MagicMock(all=lambda: [])
    mock_iwl_res = MagicMock(scalars=lambda: MagicMock(first=lambda: None))
    mock_co_res = MagicMock(all=lambda: [("ST-A01-R01-S01-B02",)])

    mock_db.execute.side_effect = [mock_locs_res, mock_occ_code_res, mock_occ_id_res, mock_iwl_res, mock_co_res]

    rec = await service.recommend_putaway(
        warehouse_id="wh-01",
        warehouse_code="WH-MAIN",
        product_id="prod-existing-01",
        quantity=Decimal("20.0000"),
        is_damaged=False,
    )

    assert rec["status"] == "RECOMMENDED"
    assert rec["recommended_location"]["code"] == "ST-A01-R01-S01-B02"
    assert rec["recommended_location"]["rule_applied"] == "CO_LOCATED_STOCK"
    assert rec["recommended_location"]["current_occupancy"] == 30.0
    assert rec["recommended_location"]["available_capacity"] == 70.0


async def test_putaway_priority_4_empty_bin_allocation():
    """Verify new product without dedicated/co-located bin allocates to nearest empty bin in target zone."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    # loc1 has 80 units occupied, loc2 is completely empty
    loc1 = _make_location("loc-1", "wh-01", "ST-A01-R01-S01-B01", zone="STORAGE", max_capacity_units=100)
    loc2 = _make_location("loc-2", "wh-01", "ST-A01-R01-S01-B02", zone="STORAGE", max_capacity_units=100)

    # Mock DB executions:
    # 1. all_locations
    # 2. occ_code: loc1 has 80 units
    # 3. occ_id
    # 4. ItemWarehouseLocation lookup: None
    # 5. Co-location query: None
    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: [loc1, loc2]))
    mock_occ_code_res = MagicMock(all=lambda: [("ST-A01-R01-S01-B01", 80.0)])
    mock_occ_id_res = MagicMock(all=lambda: [])
    mock_iwl_res = MagicMock(scalars=lambda: MagicMock(first=lambda: None))
    mock_co_res = MagicMock(all=lambda: [])

    mock_db.execute.side_effect = [mock_locs_res, mock_occ_code_res, mock_occ_id_res, mock_iwl_res, mock_co_res]

    rec = await service.recommend_putaway(
        warehouse_id="wh-01",
        warehouse_code="WH-MAIN",
        product_id="prod-brand-new",
        quantity=Decimal("10.0000"),
        is_damaged=False,
        preferred_zone="STORAGE",
    )

    assert rec["status"] == "RECOMMENDED"
    assert rec["recommended_location"]["code"] == "ST-A01-R01-S01-B02"
    assert rec["recommended_location"]["rule_applied"] == "EMPTY_BIN_ALLOCATION"
    assert rec["recommended_location"]["current_occupancy"] == 0.0


async def test_putaway_handles_over_capacity():
    """Verify OVER_CAPACITY is returned when requested quantity exceeds available bin capacity."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    loc1 = _make_location("loc-1", "wh-01", "ST-A01-R01-S01-B01", zone="STORAGE", max_capacity_units=50)

    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: [loc1]))
    mock_occ_code_res = MagicMock(all=lambda: [("ST-A01-R01-S01-B01", 45.0)])
    mock_occ_id_res = MagicMock(all=lambda: [])
    mock_iwl_res = MagicMock(scalars=lambda: MagicMock(first=lambda: None))
    mock_co_res = MagicMock(all=lambda: [])

    mock_db.execute.side_effect = [mock_locs_res, mock_occ_code_res, mock_occ_id_res, mock_iwl_res, mock_co_res]

    # Requesting 20 units when only 5 units are available
    rec = await service.recommend_putaway(
        warehouse_id="wh-01",
        warehouse_code="WH-MAIN",
        product_id="prod-big-batch",
        quantity=Decimal("20.0000"),
        is_damaged=False,
    )

    assert rec["status"] == "OVER_CAPACITY"
    assert rec["recommended_location"] is None
    assert len(rec["alternatives"]) == 1
    assert "exceed capacity" in rec["message"]


async def test_putaway_handles_no_locations_configured():
    """Verify NO_LOCATIONS_DEFINED is returned when warehouse has 0 physical locations."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: []))
    mock_db.execute.return_value = mock_locs_res

    rec = await service.recommend_putaway(
        warehouse_id="wh-empty",
        warehouse_code="WH-EMPTY",
        product_id="prod-any",
        quantity=Decimal("5.0000"),
    )

    assert rec["status"] == "NO_LOCATIONS_DEFINED"
    assert rec["recommended_location"] is None
    assert "No physical locations configured" in rec["message"]


async def test_api_endpoint_get_putaway_recommendation():
    """Verify FastAPI router endpoint /warehouses/{id}/putaway-recommendation integrates with engine."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")

    # Mock warehouse lookup
    wh_obj = Warehouse(id="wh-01", code="WH-MAIN", name="Main Warehouse")
    mock_wh_res = MagicMock(scalars=lambda: MagicMock(first=lambda: wh_obj))

    # Mock service recommendation
    loc1 = _make_location("loc-1", "wh-01", "ST-A01-R01-S01-B01", zone="STORAGE", max_capacity_units=100)
    mock_locs_res = MagicMock(scalars=lambda: MagicMock(all=lambda: [loc1]))
    mock_occ_code_res = MagicMock(all=lambda: [])
    mock_occ_id_res = MagicMock(all=lambda: [])
    mock_iwl_res = MagicMock(scalars=lambda: MagicMock(first=lambda: None))
    mock_co_res = MagicMock(all=lambda: [])

    mock_db.execute.side_effect = [
        mock_wh_res,
        mock_locs_res,
        mock_occ_code_res,
        mock_occ_id_res,
        mock_iwl_res,
        mock_co_res,
    ]

    req = PutawayRecommendationRequest(
        product_id="prod-001",
        quantity=Decimal("5.0000"),
        is_damaged=False,
    )

    resp = await get_putaway_recommendation(
        warehouse_id="wh-01",
        req=req,
        db=mock_db,
        tenant_ctx=tenant,
        guard=None,
    )

    assert isinstance(resp, PutawayRecommendationResponse)
    assert resp.warehouse_id == "wh-01"
    assert resp.warehouse_code == "WH-MAIN"
    assert resp.status == "RECOMMENDED"
    assert resp.recommended_location.code == "ST-A01-R01-S01-B01"
