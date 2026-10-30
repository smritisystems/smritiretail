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
from fastapi import HTTPException
from app.models.inventory import TransferStatus, StockTransfer
from app.models.purchase import PurchaseReceipt
from app.services.inventory_wms import InventoryWmsService
from app.api.deps import TenantContext


def test_r003_purchase_receipt_model_warehouse_not_null():
    """Verify R-003: PurchaseReceipt.warehouse_id is configured with nullable=False."""
    col = PurchaseReceipt.__table__.columns["warehouse_id"]
    assert col.nullable is False, "PurchaseReceipt.warehouse_id must be NOT NULL per R-003"


def test_r005_transfer_status_enum_members():
    """Verify R-005: TransferStatus includes REQUESTED, APPROVED, and REJECTED states."""
    expected_members = [
        "DRAFT", "REQUESTED", "APPROVED", "REJECTED",
        "DISPATCHED", "IN_TRANSIT", "RECEIVED", "PARTIAL", "CANCELLED"
    ]
    for member in expected_members:
        assert hasattr(TransferStatus, member), f"TransferStatus must include member '{member}'"
        assert getattr(TransferStatus, member).value == member


@pytest.mark.asyncio
async def test_r005_dispatch_blocks_requested_status():
    """Verify R-005: dispatching a transfer in REQUESTED status is blocked until APPROVED."""
    mock_db = MagicMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    fake_transfer = MagicMock(spec=StockTransfer)
    fake_transfer.id = "st-001"
    fake_transfer.status = TransferStatus.REQUESTED.value
    fake_transfer.items = []

    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = fake_transfer
    mock_db.execute = AsyncMock(return_value=mock_res)

    with pytest.raises(HTTPException) as exc_info:
        await service.dispatch_stock_transfer("st-001", bypass_approval=True)

    assert exc_info.value.status_code == 400
    assert "pending approval" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_r005_dispatch_blocks_draft_when_bypass_false():
    """Verify R-005: dispatching a DRAFT transfer with bypass_approval=False is blocked."""
    mock_db = MagicMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    fake_transfer = MagicMock(spec=StockTransfer)
    fake_transfer.id = "st-002"
    fake_transfer.status = TransferStatus.DRAFT.value
    fake_transfer.items = []

    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = fake_transfer
    mock_db.execute = AsyncMock(return_value=mock_res)

    with pytest.raises(HTTPException) as exc_info:
        await service.dispatch_stock_transfer("st-002", bypass_approval=False)

    assert exc_info.value.status_code == 400
    assert "approval required" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_r005_request_approve_reject_transitions():
    """Verify R-005: State transitions for request, approve, and reject."""
    mock_db = MagicMock()
    mock_db.flush = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    service = InventoryWmsService(mock_db, tenant)

    # 1. DRAFT -> REQUESTED
    st = StockTransfer(id="st-003", company_id="COMP-001", status=TransferStatus.DRAFT.value)
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = st
    mock_db.execute = AsyncMock(return_value=mock_res)

    res_req = await service.request_stock_transfer("st-003")
    assert res_req.status == TransferStatus.REQUESTED.value

    # 2. REQUESTED -> APPROVED
    res_app = await service.approve_stock_transfer("st-003")
    assert res_app.status == TransferStatus.APPROVED.value

    # 3. REQUESTED -> REJECTED
    st.status = TransferStatus.REQUESTED.value
    res_rej = await service.reject_stock_transfer("st-003", reason="Insufficient quota")
    assert res_rej.status == TransferStatus.REJECTED.value
    assert "[REJECTED]: Insufficient quota" in (res_rej.notes or "")


def test_r008_wms_router_exposes_branches():
    """Verify R-008: WMS router defines /branches endpoint."""
    from app.api.v1.wms import router
    branch_routes = [r for r in router.routes if r.path == "/branches"]
    assert len(branch_routes) > 0, "WMS router must expose /branches endpoint for R-008"
    assert "GET" in branch_routes[0].methods
