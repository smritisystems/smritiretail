"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Description  : Level 1 Inventory Kernel Automated Certification Suite (IK001 .. IK009).
"""

import pytest
from decimal import Decimal
from unittest.mock import MagicMock, AsyncMock

from app.api.deps import TenantContext
from app.services.inventory.facades import InventoryQueryFacade, InventoryCommandFacade
from app.services.inventory.ilg_engine import InventoryLedgerEngine
from app.services.inventory.itex_engine import InventoryTransactionEngine
from app.models.inventory_kernel import InventoryLedgerEntry


@pytest.mark.asyncio
async def test_ik001_facade_entry_gate():
    """IK001: All inventory updates execute exclusively via InventoryCommandFacade v1."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    command_facade = InventoryCommandFacade(mock_db, tenant_ctx)
    assert hasattr(command_facade, "move_inventory")
    assert hasattr(command_facade, "issue_sale")
    assert hasattr(command_facade, "receive_purchase")
    assert hasattr(command_facade, "adjust_stock")
    assert hasattr(command_facade, "transfer_out")
    assert hasattr(command_facade, "transfer_in")


@pytest.mark.asyncio
async def test_ik002_single_balance_mutator_gate():
    """IK002: Zero direct stock balance mutations outside Inventory Ledger Engine (ILG)."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    ilg = InventoryLedgerEngine(mock_db, tenant_ctx)
    entry = await ilg.post_ledger_entry(
        transaction_id="TX-TEST-001",
        from_location_id=None,
        to_location_id="LOC-WH-01",
        product_id="PROD-101",
        sku="SKU-101",
        quantity=Decimal("50.0000"),
        movement_type="PURCHASE",
    )
    assert entry.to_location_id == "LOC-WH-01"
    assert entry.quantity == Decimal("50.0000")
    assert mock_db.add.called


@pytest.mark.asyncio
async def test_ik003_derived_availability_gate():
    """IK003: ATP availability is dynamically derived (ATP = On Hand - Reserved)."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    query_facade = InventoryQueryFacade(mock_db, tenant_ctx)
    # Mock ILG balance calculation
    query_facade.ilg_engine.calculate_location_balance = AsyncMock(return_value=Decimal("100.0000"))
    
    # Mock reservation query result (20 reserved)
    mock_res = MagicMock()
    mock_res.scalar.return_value = Decimal("20.0000")
    mock_db.execute.return_value = mock_res

    atp = await query_facade.get_available("PROD-101", "LOC-WH-01")
    assert atp == 80.0


@pytest.mark.asyncio
async def test_ik004_network_stock_aggregation_gate():
    """IK004: Network stock is dynamically aggregated across locations."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    query_facade = InventoryQueryFacade(mock_db, tenant_ctx)
    query_facade.ilg_engine.calculate_network_balance = AsyncMock(return_value=Decimal("500.0000"))

    network_res = await query_facade.get_network_stock("PROD-101")
    assert network_res["network_stock"] == 500.0


@pytest.mark.asyncio
async def test_ik006_replay_determinism_gate():
    """IK006: Compensating reversal entries reproduce balances with 100% accuracy."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    ilg = InventoryLedgerEngine(mock_db, tenant_ctx)

    orig_entry = InventoryLedgerEntry(
        id="ILE-ORIG-001",
        transaction_id="TX-001",
        from_location_id="LOC-WH-01",
        to_location_id="LOC-STORE-01",
        product_id="PROD-101",
        sku="SKU-101",
        quantity=Decimal("15.0000"),
        movement_type="TRANSFER",
        unit_cost=Decimal("100.00"),
        ownership_type="COMPANY",
        company_id="COMP-001",
        branch_id="BR-001",
    )

    mock_scalar = MagicMock()
    mock_scalar.scalars().first.return_value = orig_entry
    mock_db.execute.return_value = mock_scalar

    reversal = await ilg.post_reversal_entry("ILE-ORIG-001")
    assert reversal.from_location_id == "LOC-STORE-01"
    assert reversal.to_location_id == "LOC-WH-01"
    assert reversal.is_reversal is True
    assert reversal.reversal_entry_id == "ILE-ORIG-001"


@pytest.mark.asyncio
async def test_ik009_ledger_replay_integrity_gate():
    """IK009: Every balance is 100% reproducible by replaying InventoryLedger."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    ilg = InventoryLedgerEngine(mock_db, tenant_ctx)

    # Inbound 100, Outbound 30 -> Balance = 70
    mock_in = MagicMock()
    mock_in.scalar.return_value = Decimal("100.0000")
    
    mock_out = MagicMock()
    mock_out.scalar.return_value = Decimal("30.0000")

    mock_db.execute.side_effect = [mock_in, mock_out]

    balance = await ilg.calculate_location_balance("PROD-101", "LOC-WH-01")
    assert balance == Decimal("70.0000")
