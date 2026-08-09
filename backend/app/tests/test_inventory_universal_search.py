"""
Project      : SMRITI Retail OS v7.0
Module       : Unit Tests — InventoryUniversalSearchService
Description  : Pure unit tests for InventoryUniversalSearchService.search().
               All SQLAlchemy async DB calls are mocked — no live database required.
Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.inventory_universal_search import InventoryUniversalSearchService


def _make_tenant_ctx(company_id="comp-001", branch_id="br-001"):
    ctx = MagicMock()
    ctx.company_id = company_id
    ctx.branch_id = branch_id
    return ctx


def _make_movement(
    id="mov-1",
    product_id="prod-1",
    product_name="Nike Air Zoom",
    sku="SKU-100001",
    movement_type="INWARD",
    reference_doc_type="PURCHASE_ORDER",
    reference_doc_id="PO-2026-001",
    warehouse="Main Warehouse",
    batch="BATCH-A",
    serial="SRL-001",
    remarks="GRN receipt",
    quantity=10.0,
):
    m = MagicMock()
    m.id = id
    m.product_id = product_id
    m.product_name = product_name
    m.sku = sku
    m.movement_type = movement_type
    m.reference_doc_type = reference_doc_type
    m.reference_doc_id = reference_doc_id
    m.warehouse = warehouse
    m.batch = batch
    m.serial = serial
    m.remarks = remarks
    m.quantity = quantity
    return m


def _make_db_with_movements(movements: list):
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = movements
    db.execute.return_value = result
    return db


class TestInventoryUniversalSearchService:

    @pytest.mark.asyncio
    async def test_empty_query_returns_empty_list(self):
        """Blank query string must return [] without hitting the database."""
        db = AsyncMock()
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        result = await svc.search("")
        assert result == []
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_whitespace_only_query_returns_empty_list(self):
        """Whitespace-only query must be treated as blank and return []."""
        db = AsyncMock()
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        result = await svc.search("   ")
        assert result == []

    @pytest.mark.asyncio
    async def test_valid_query_returns_correct_structure(self):
        """Valid query → results include all required fields with correct types."""
        movement = _make_movement()
        db = _make_db_with_movements([movement])
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        result = await svc.search("Nike")

        assert len(result) == 1
        row = result[0]
        assert row["id"] == "mov-1"
        assert row["product_id"] == "prod-1"
        assert row["product_name"] == "Nike Air Zoom"
        assert row["sku"] == "SKU-100001"
        assert row["movement_type"] == "INWARD"
        assert row["reference_doc_type"] == "PURCHASE_ORDER"
        assert row["reference_doc_id"] == "PO-2026-001"
        assert row["warehouse"] == "Main Warehouse"
        assert row["batch"] == "BATCH-A"
        assert row["serial"] == "SRL-001"
        assert row["remarks"] == "GRN receipt"
        assert row["quantity"] == 10.0

    @pytest.mark.asyncio
    async def test_quantity_none_is_serialized_as_none(self):
        """StockMovement.quantity=None must serialize to None, not raise TypeError."""
        movement = _make_movement(quantity=None)
        db = _make_db_with_movements([movement])
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        result = await svc.search("PO-2026-001")

        assert result[0]["quantity"] is None

    @pytest.mark.asyncio
    async def test_no_db_results_returns_empty_list(self):
        """DB returns 0 movements → service returns []."""
        db = _make_db_with_movements([])
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        result = await svc.search("unknown_term_xyz")

        assert result == []

    @pytest.mark.asyncio
    async def test_multiple_movements_all_returned(self):
        """DB returns multiple movements → all are returned in result list."""
        movements = [
            _make_movement(id="mov-1", sku="SKU-001"),
            _make_movement(id="mov-2", sku="SKU-002"),
            _make_movement(id="mov-3", sku="SKU-003"),
        ]
        db = _make_db_with_movements(movements)
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        result = await svc.search("SKU")

        assert len(result) == 3
        returned_ids = [r["id"] for r in result]
        assert "mov-1" in returned_ids
        assert "mov-2" in returned_ids
        assert "mov-3" in returned_ids

    @pytest.mark.asyncio
    async def test_db_execute_is_called_exactly_once_per_search(self):
        """A single search call must execute exactly one DB query."""
        db = _make_db_with_movements([])
        svc = InventoryUniversalSearchService(db, _make_tenant_ctx())

        await svc.search("barcode-scan")

        db.execute.assert_called_once()
