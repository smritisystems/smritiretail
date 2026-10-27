"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.125.0
Created      : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.models.inventory import Warehouse
from app.models.pos import CashRegister
from app.services.inventory_warehouse_resolver import InventoryWarehouseResolver


@pytest.mark.asyncio
async def test_resolver_level1_explicit_warehouse_id_success():
    """Level 1: Explicit warehouse_id supplied by caller takes highest precedence."""
    mock_db = MagicMock()
    wh = Warehouse(id="wh-custom-001", company_id="COMP-001", is_active=True, is_deleted=False)
    
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = wh
    mock_db.execute = AsyncMock(return_value=mock_res)

    resolver = InventoryWarehouseResolver(mock_db)
    resolved = await resolver.resolve(company_id="COMP-001", warehouse_id="wh-custom-001")
    assert resolved.id == "wh-custom-001"


@pytest.mark.asyncio
async def test_resolver_level1_explicit_warehouse_id_not_found():
    """Level 1: Explicit warehouse_id that does not exist raises ValueError."""
    mock_db = MagicMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_res)

    resolver = InventoryWarehouseResolver(mock_db)
    with pytest.raises(ValueError, match="INVENTORY_WAREHOUSE_NOT_CONFIGURED"):
        await resolver.resolve(company_id="COMP-001", warehouse_id="wh-non-existent")


@pytest.mark.asyncio
async def test_resolver_level2_register_fk_priority():
    """Level 2: CashRegister resolves via warehouse_id FK first (R-001)."""
    mock_db = MagicMock()
    reg = CashRegister(id="reg-001", company_id="COMP-001", warehouse_id="wh-fk-001", warehouse="LEGACY-CODE")
    wh_fk = Warehouse(id="wh-fk-001", company_id="COMP-001", is_active=True, is_deleted=False)

    reg_res = MagicMock()
    reg_res.scalars.return_value.first.return_value = reg

    wh_res = MagicMock()
    wh_res.scalars.return_value.first.return_value = wh_fk

    mock_db.execute = AsyncMock(side_effect=[reg_res, wh_res])

    resolver = InventoryWarehouseResolver(mock_db)
    resolved = await resolver.resolve(company_id="COMP-001", register_id="reg-001")
    assert resolved.id == "wh-fk-001"


@pytest.mark.asyncio
async def test_resolver_level2_register_legacy_text_fallback():
    """Level 2: CashRegister falls back to warehouse text code if warehouse_id FK is unset."""
    mock_db = MagicMock()
    reg = CashRegister(id="reg-002", company_id="COMP-001", warehouse_id=None, warehouse="WH-TEXT-CODE")
    wh_text = Warehouse(id="wh-matched-002", code="WH-TEXT-CODE", company_id="COMP-001", is_active=True, is_deleted=False)

    reg_res = MagicMock()
    reg_res.scalars.return_value.first.return_value = reg

    wh_res = MagicMock()
    wh_res.scalars.return_value.first.return_value = wh_text

    mock_db.execute = AsyncMock(side_effect=[reg_res, wh_res])

    resolver = InventoryWarehouseResolver(mock_db)
    resolved = await resolver.resolve(company_id="COMP-001", register_id="reg-002")
    assert resolved.id == "wh-matched-002"


@pytest.mark.asyncio
async def test_resolver_level3_branch_default_priority():
    """Level 3: Branch-level default resolution returns branch warehouse (R-007)."""
    mock_db = MagicMock()
    wh_branch = Warehouse(id="wh-branch-default", branch_id="BR-001", company_id="COMP-001", is_default_for_branch=True, is_active=True, is_deleted=False)

    wh_res = MagicMock()
    wh_res.scalars.return_value.first.return_value = wh_branch
    mock_db.execute = AsyncMock(return_value=wh_res)

    resolver = InventoryWarehouseResolver(mock_db)
    resolved = await resolver.resolve(company_id="COMP-001", branch_id="BR-001")
    assert resolved.id == "wh-branch-default"
    assert resolved.is_default_for_branch is True


@pytest.mark.asyncio
async def test_resolver_level4_company_fallback():
    """Level 4: Company fallback returns oldest active warehouse when branch has none."""
    mock_db = MagicMock()
    wh_company = Warehouse(id="wh-company-oldest", company_id="COMP-001", is_active=True, is_deleted=False)

    # Branch query returns None, Company fallback returns wh_company
    res_branch_empty = MagicMock()
    res_branch_empty.scalars.return_value.first.return_value = None

    res_company = MagicMock()
    res_company.scalars.return_value.first.return_value = wh_company

    mock_db.execute = AsyncMock(side_effect=[res_branch_empty, res_company])

    resolver = InventoryWarehouseResolver(mock_db)
    resolved = await resolver.resolve(company_id="COMP-001", branch_id="BR-EMPTY")
    assert resolved.id == "wh-company-oldest"


@pytest.mark.asyncio
async def test_resolver_all_levels_fail_raises_value_error():
    """When all resolution levels find no active warehouse, raises ValueError."""
    mock_db = MagicMock()
    res_empty = MagicMock()
    res_empty.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=res_empty)

    resolver = InventoryWarehouseResolver(mock_db)
    with pytest.raises(ValueError, match="INVENTORY_WAREHOUSE_NOT_CONFIGURED"):
        await resolver.resolve(company_id="COMP-EMPTY")
