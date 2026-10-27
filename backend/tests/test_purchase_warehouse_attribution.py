from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.api.v1.purchase import create_purchase_order_contract
from app.schemas.purchase import PurchaseOrderCreate
from app.services.purchase import PurchaseService


@pytest.mark.asyncio
async def test_purchase_order_endpoint_requires_receiving_warehouse():
    request = PurchaseOrderCreate(order_no="PO-TEST-1", supplier_id="supplier-1")

    with pytest.raises(HTTPException) as exc_info:
        await create_purchase_order_contract(
            order_in=request,
            db=AsyncMock(),
            tenant_ctx=TenantContext(company_id="COMP-001", branch_id="BR-001"),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "PURCHASE_WAREHOUSE_REQUIRED"


@pytest.mark.asyncio
async def test_purchase_service_resolves_explicit_company_warehouse():
    service = PurchaseService(
        AsyncMock(),
        TenantContext(company_id="COMP-001", branch_id="BR-001"),
    )
    warehouse = MagicMock(id="warehouse-1")

    with patch(
        "app.services.inventory_warehouse_resolver.InventoryWarehouseResolver.resolve",
        new=AsyncMock(return_value=warehouse),
    ) as resolve:
        result = await service._validate_receiving_warehouse("warehouse-1")

    assert result == "warehouse-1"
    resolve.assert_awaited_once_with(
        company_id="COMP-001",
        warehouse_id="warehouse-1",
    )


@pytest.mark.asyncio
async def test_purchase_service_rejects_unavailable_warehouse():
    service = PurchaseService(
        AsyncMock(),
        TenantContext(company_id="COMP-001", branch_id="BR-001"),
    )

    with patch(
        "app.services.inventory_warehouse_resolver.InventoryWarehouseResolver.resolve",
        new=AsyncMock(side_effect=ValueError("INVENTORY_WAREHOUSE_NOT_CONFIGURED")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service._validate_receiving_warehouse("warehouse-other-company")

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "PURCHASE_WAREHOUSE_INVALID"
