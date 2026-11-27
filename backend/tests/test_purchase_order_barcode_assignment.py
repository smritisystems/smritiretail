from decimal import Decimal
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.inventory import ProductBase
from app.schemas.purchase import PurchaseOrderItemBarcodeRequest, PurchaseOrderItemCreate
from app.services.purchase import PurchaseService


def _query_result(*, first=None, scalar=None):
    result = MagicMock()
    scalars = MagicMock()
    scalars.first.return_value = first
    result.scalars.return_value = scalars
    result.scalar_one_or_none.return_value = scalar
    return result


def _service():
    db = AsyncMock()
    db.add = MagicMock()
    tenant = SimpleNamespace(company_id="COMP-001", branch_id="BR-001")
    return PurchaseService(db, tenant)


def test_purchase_order_line_can_have_sku_without_barcode():
    line = PurchaseOrderItemCreate(
        code="1234567890123",
        name="Unbarcoded item",
        quantity=Decimal("1"),
    )
    product = ProductBase(
        code="1234567890123",
        name="Unbarcoded item",
        price=Decimal("10"),
        mrp=Decimal("10"),
        gst_percentage=Decimal("0"),
    )

    assert line.barcode is None
    assert product.barcode is None


def test_internal_barcode_request_is_server_generated():
    request = PurchaseOrderItemBarcodeRequest(source="INTERNAL")

    assert request.barcode is None
    with pytest.raises(ValidationError):
        PurchaseOrderItemBarcodeRequest(source="SUPPLIER")
    with pytest.raises(ValidationError):
        PurchaseOrderItemBarcodeRequest(source="INTERNAL", barcode="client-provided")


@pytest.mark.asyncio
async def test_barcode_assignment_requires_confirmed_order():
    service = _service()
    service.get_purchase_order = AsyncMock(return_value=(SimpleNamespace(status="SUBMITTED"), []))

    with pytest.raises(HTTPException) as exc_info:
        await service.assign_purchase_order_item_barcode(
            "po-1",
            "line-1",
            PurchaseOrderItemBarcodeRequest(barcode="1234567890128"),
        )

    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_barcode_assignment_is_blocked_after_receiving_starts():
    service = _service()
    order = SimpleNamespace(id="po-1", status="CONFIRMED")
    line = SimpleNamespace(id="line-1")
    service.get_purchase_order = AsyncMock(return_value=(order, [line]))
    service.db.execute = AsyncMock(return_value=_query_result(scalar="receipt-1"))

    with pytest.raises(HTTPException) as exc_info:
        await service.assign_purchase_order_item_barcode(
            order.id,
            line.id,
            PurchaseOrderItemBarcodeRequest(barcode="1234567890128"),
        )

    assert exc_info.value.status_code == 409
    service.db.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_barcode_assignment_rejects_replacing_an_existing_primary_barcode():
    service = _service()
    order = SimpleNamespace(id="po-1", status="CONFIRMED")
    line = SimpleNamespace(id="line-1", product_id="product-1", variant_id="variant-1")
    primary = SimpleNamespace(barcode="9876543210128", barcode_normalized="9876543210128")
    service.db.get = AsyncMock(return_value=SimpleNamespace(
        company_id="COMP-001",
        item_id="item-1",
        item_variant_id="variant-1",
        code="SKU-1",
        barcode=None,
    ))
    service.get_purchase_order = AsyncMock(return_value=(order, [line]))
    service.db.execute = AsyncMock(side_effect=[
        _query_result(),
        _query_result(first=SimpleNamespace(id="variant-1")),
        _query_result(first=primary),
    ])

    with pytest.raises(HTTPException) as exc_info:
        await service.assign_purchase_order_item_barcode(
            order.id,
            line.id,
            PurchaseOrderItemBarcodeRequest(barcode="1234567890128"),
        )

    assert exc_info.value.status_code == 409
    service.db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_barcode_assignment_registers_and_audits_primary_barcode():
    service = _service()
    order = SimpleNamespace(id="po-1", order_no="PO-1", status="CONFIRMED")
    line = SimpleNamespace(id="line-1", product_id="product-1", variant_id="variant-1")
    product = SimpleNamespace(
        id="product-1",
        company_id="COMP-001",
        item_id="item-1",
        item_variant_id="variant-1",
        code="SKU-1",
        barcode=None,
        branch_id="BR-001",
    )
    variant = SimpleNamespace(id="variant-1", item_id="item-1")
    barcode_record = SimpleNamespace(
        id="barcode-1",
        barcode="1234567890128",
        barcode_type="EAN13",
        item_id="item-1",
        variant_id="variant-1",
        is_primary=True,
        status="ASSIGNED",
    )
    service.get_purchase_order = AsyncMock(return_value=(order, [line]))
    service.db.execute = AsyncMock(side_effect=[
        _query_result(),
        _query_result(first=variant),
        _query_result(),
        _query_result(),
    ])
    service.db.get = AsyncMock(return_value=product)

    with patch(
        "app.services.item_domain_svc.ItemDomainService.create_barcode",
        new=AsyncMock(return_value=barcode_record),
    ) as create_barcode:
        result = await service.assign_purchase_order_item_barcode(
            order.id,
            line.id,
            PurchaseOrderItemBarcodeRequest(barcode="1234567890128", reason="Supplier label received"),
            assigned_by="manager",
        )

    assert result is barcode_record
    assert product.barcode == barcode_record.barcode
    create_barcode.assert_awaited_once()
    service.db.commit.assert_awaited_once()
    audit = next(
        entity for entity in service.db.add.call_args_list[0].args
        if entity.__class__.__name__ == "BarcodeRegistryAudit"
    )
    assert audit.action == "ASSIGN"
    assert audit.details_json["purchase_order_line_id"] == line.id


@pytest.mark.asyncio
async def test_internal_barcode_assignment_generates_a_custom_code128_identifier():
    service = _service()
    order = SimpleNamespace(id="po-1", order_no="PO-1", status="CONFIRMED")
    line = SimpleNamespace(id="line-1", product_id="product-1", variant_id="variant-1")
    product = SimpleNamespace(
        id="product-1",
        company_id="COMP-001",
        item_id="item-1",
        item_variant_id="variant-1",
        code="SKU-1",
        barcode=None,
        branch_id="BR-001",
    )
    variant = SimpleNamespace(id="variant-1", item_id="item-1")
    service.get_purchase_order = AsyncMock(return_value=(order, [line]))
    service.db.execute = AsyncMock(side_effect=[
        _query_result(),
        _query_result(first=variant),
        _query_result(),
        _query_result(),
    ])
    service.db.get = AsyncMock(return_value=product)
    created_request = {}

    async def create_internal_barcode(_db, req, **_kwargs):
        created_request["request"] = req
        return SimpleNamespace(
            id="barcode-internal",
            barcode=req.barcode,
            barcode_type=req.barcode_type,
            item_id="item-1",
            variant_id="variant-1",
            is_primary=True,
            status="ASSIGNED",
        )

    with patch(
        "app.services.item_domain_svc.ItemDomainService.create_barcode",
        new=AsyncMock(side_effect=create_internal_barcode),
    ):
        result = await service.assign_purchase_order_item_barcode(
            order.id,
            line.id,
            PurchaseOrderItemBarcodeRequest(source="INTERNAL"),
            assigned_by="manager",
        )

    request = created_request["request"]
    assert request.barcode_type == "CODE128"
    assert request.barcode_purpose == "INTERNAL"
    assert re.fullmatch(r"INT[0-9A-F]{32}", request.barcode)
    assert result.barcode == product.barcode
    audit = next(
        entity for entity in service.db.add.call_args_list[0].args
        if entity.__class__.__name__ == "BarcodeRegistryAudit"
    )
    assert audit.details_json["source"] == "INTERNAL"
