"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : SCDM Service Unit Tests
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import AsyncMock, MagicMock

from app.services.scdm_service import SCDMService, _uid
from app.models.scdm import (
    ChannelLocation,
    ChannelDispatch,
    ChannelDispatchLine,
    ChannelStockMovement,
    SellOutImport,
    SellOutImportLine,
    ChannelDispatchStatus,
    ChannelMovementType,
    ImportStatus,
)


def test_scdm_uid_generator():
    uid1 = _uid("CD-")
    uid2 = _uid("SO-")
    assert uid1.startswith("CD-")
    assert uid2.startswith("SO-")
    assert uid1 != uid2


@pytest.mark.asyncio
async def test_create_channel_dispatch_customer_disabled():
    """If customer.channel_tracking_enabled is False, no dispatch is created."""
    mock_db = AsyncMock()

    # Mock invoice return
    mock_invoice = MagicMock()
    mock_invoice.id = "inv-123"
    mock_invoice.customer_id = "cust-456"
    mock_invoice_res = MagicMock()
    mock_invoice_res.scalars().first.return_value = mock_invoice

    # Mock customer return (channel_tracking_enabled = False)
    mock_cust = MagicMock()
    mock_cust.id = "cust-456"
    mock_cust.channel_tracking_enabled = False
    mock_cust_res = MagicMock()
    mock_cust_res.scalars().first.return_value = mock_cust

    mock_db.execute.side_effect = [mock_invoice_res, mock_cust_res]

    svc = SCDMService(db=mock_db, tenant_ctx=None)
    dispatch = await svc.create_channel_dispatch_from_invoice("inv-123")

    assert dispatch is None


@pytest.mark.asyncio
async def test_get_visibility_kpis_empty_projection():
    """KPI calculation with empty stock projection returns zeroes and default status."""
    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.execute = AsyncMock()
    svc = SCDMService(db=mock_db, tenant_ctx=None)

    # Mock empty projection
    mock_res = MagicMock()
    mock_res.mappings().all.return_value = []
    mock_db.execute.return_value = mock_res

    kpis = await svc.get_visibility_kpis("cust-999")

    assert kpis["current_qty"] == 0
    assert kpis["sell_through_pct"] == 0.0
    assert kpis["days_of_cover"] == 0
    assert kpis["stock_health"] == "No Stock"


@pytest.mark.asyncio
async def test_get_visibility_kpis_with_projection():
    """KPI calculation with active channel stock projection."""
    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.execute = AsyncMock()
    svc = SCDMService(db=mock_db, tenant_ctx=None)

    mock_row = {
        "customer_id": "cust-100",
        "channel_location_id": "loc-1",
        "product_id": "prod-1",
        "current_qty": 60,
        "total_dispatched": 100,
        "total_sellout": 40,
        "total_returned": 0,
        "total_damaged": 0,
        "current_mrp_value": 30000.0,
        "current_cost_value": 18000.0,
        "current_sales_value": 24000.0,
        "current_settlement_value": 0.0,
        "ageing_days": 10,
    }

    mock_res = MagicMock()
    mock_res.mappings().all.return_value = [mock_row]
    mock_db.execute.return_value = mock_res

    kpis = await svc.get_visibility_kpis("cust-100")

    assert kpis["current_qty"] == 60
    assert kpis["total_dispatched"] == 100
    assert kpis["total_sellout"] == 40
    assert kpis["sell_through_pct"] == 40.0
    assert kpis["avg_daily_sales"] == 4.0  # 40 / 10 days
    assert kpis["days_of_cover"] == 15    # 60 / 4 pcs per day
