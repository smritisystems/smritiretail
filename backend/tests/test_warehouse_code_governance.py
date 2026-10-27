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
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.api.v1.wms import create_warehouse
from app.schemas.wms import WarehouseCreate
from app.api.deps import TenantContext
from app.models.inventory import Warehouse


@pytest.mark.asyncio
async def test_warehouse_code_invalid_format_rejected():
    """Verify warehouse codes with invalid characters (spaces, symbols) are rejected with 400."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    req = WarehouseCreate(code="WH INVALID CODE!", name="Invalid Warehouse")

    with pytest.raises(HTTPException) as exc_info:
        await create_warehouse(req=req, db=mock_db, tenant_ctx=tenant, guard=None)

    assert exc_info.value.status_code == 400
    assert "Invalid warehouse code" in exc_info.value.detail


@pytest.mark.asyncio
async def test_warehouse_code_duplicate_rejected():
    """Verify duplicate warehouse code in same company is rejected with 400."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    req = WarehouseCreate(code="WH-MAIN", name="Duplicate Main Godown")

    # Mock DB query finding existing warehouse with same code
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = "wh-existing-id"
    mock_db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await create_warehouse(req=req, db=mock_db, tenant_ctx=tenant, guard=None)

    assert exc_info.value.status_code == 400
    assert "already exists or was previously deactivated" in exc_info.value.detail


@pytest.mark.asyncio
async def test_warehouse_code_auto_generated_when_omitted():
    """Verify unique readable code WH-{BRANCH}-{SEQ} is allocated when code is omitted."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    req = WarehouseCreate(name="New Branch Godown", branch_id="BR-001")

    # Mock branch lookup returning branch code 'BR01'
    mock_branch_res = MagicMock()
    mock_branch = MagicMock()
    mock_branch.code = "BR01"
    mock_branch_res.scalars.return_value.first.return_value = mock_branch

    # Mock existing codes query returning ['WH-BR01-001']
    mock_codes_res = MagicMock()
    mock_codes_res.scalars.return_value.all.return_value = ["WH-BR01-001"]

    mock_db.execute.side_effect = [mock_branch_res, mock_codes_res]
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    res = await create_warehouse(req=req, db=mock_db, tenant_ctx=tenant, guard=None)

    assert res.code == "WH-BR01-002"
    assert res.name == "New Branch Godown"
    assert res.is_active is True
    assert res.id.startswith("wh-")


@pytest.mark.asyncio
async def test_deactivated_warehouse_code_cannot_be_reused():
    """Verify a warehouse code from a deactivated warehouse cannot be reused by a new warehouse."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
    req = WarehouseCreate(code="WH-DEACTIVATED", name="Attempted Reuse")

    # Mock query returning a warehouse that exists (even though it may be inactive)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = "wh-old-deactivated"
    mock_db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await create_warehouse(req=req, db=mock_db, tenant_ctx=tenant, guard=None)

    assert exc_info.value.status_code == 400
    assert "already exists or was previously deactivated" in exc_info.value.detail
