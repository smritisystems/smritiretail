import pytest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from app.services.customer_discount_policy import (
    CustomerDiscountPolicy,
    resolve_customer_discount_policy,
    validate_customer_discount_policy,
)
from app.api.deps import TenantContext
from app.schemas.pos import POSCheckoutItem, POSCheckoutRequest
from app.services.pos import POSService


def _policy(*, max_percent="10.00", can_receive=True):
    return CustomerDiscountPolicy(
        customer=object(),
        group=object(),
        max_discount_percent=Decimal(max_percent),
        can_receive_discount=can_receive,
    )


def test_group_max_discount_rejects_10_01_percent():
    with pytest.raises(HTTPException) as error:
        validate_customer_discount_policy(_policy(), Decimal("10.01"), Decimal("100.00"))

    assert error.value.status_code == 400


def test_customer_group_without_discount_permission_is_rejected():
    with pytest.raises(HTTPException) as error:
        validate_customer_discount_policy(_policy(can_receive=False), Decimal("1.00"), Decimal("100.00"))

    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_pos_bill_percent_discount_over_limit_is_rejected():
    db = AsyncMock()
    db.execute.side_effect = [
        MagicMock(scalars=lambda: MagicMock(first=lambda: SimpleNamespace(customer_group_id="group-1"))),
        MagicMock(scalars=lambda: MagicMock(first=lambda: SimpleNamespace(
            max_discount_percent=Decimal("10.00"), can_receive_discount=True
        ))),
    ]
    service = POSService(db, TenantContext(company_id="company-1", branch_id="branch-1"))
    service.get_shift = AsyncMock(return_value=SimpleNamespace(status="OPEN", cashier_id="cashier-1"))

    request = POSCheckoutRequest(
        invoice_no="POS-DISCOUNT-PERCENT",
        shift_id="shift-1",
        customer_id="customer-1",
        items=[POSCheckoutItem(product_id="p-1", code="SKU-1", name="Item", quantity=1, price=100)],
        grand_total=90,
        bill_discount_type="percent",
        bill_discount_val=Decimal("10.01"),
    )
    with pytest.raises(HTTPException) as error:
        await service.pos_checkout(request)

    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_pos_bill_flat_discount_over_limit_is_rejected():
    db = AsyncMock()
    db.execute.side_effect = [
        MagicMock(scalars=lambda: MagicMock(first=lambda: SimpleNamespace(customer_group_id="group-1"))),
        MagicMock(scalars=lambda: MagicMock(first=lambda: SimpleNamespace(
            max_discount_percent=Decimal("10.00"), can_receive_discount=True
        ))),
    ]
    service = POSService(db, TenantContext(company_id="company-1", branch_id="branch-1"))
    service.get_shift = AsyncMock(return_value=SimpleNamespace(status="OPEN", cashier_id="cashier-1"))

    request = POSCheckoutRequest(
        invoice_no="POS-DISCOUNT-FLAT",
        shift_id="shift-1",
        customer_id="customer-1",
        items=[POSCheckoutItem(product_id="p-1", code="SKU-1", name="Item", quantity=1, price=100)],
        grand_total=90,
        bill_discount_type="flat",
        bill_discount_val=Decimal("10.01"),
    )
    with pytest.raises(HTTPException) as error:
        await service.pos_checkout(request)

    assert error.value.status_code == 400


def test_allowed_discount_is_accepted():
    validate_customer_discount_policy(_policy(), Decimal("10.00"), Decimal("100.00"))


def test_flat_pos_discount_is_rejected_when_converted_percent_exceeds_limit():
    with pytest.raises(HTTPException) as error:
        validate_customer_discount_policy(_policy(), Decimal("10.01"), Decimal("100.00"))

    assert error.value.status_code == 400


def test_walk_in_policy_allows_undiscounted_sale_only():
    walk_in = CustomerDiscountPolicy(None, None, Decimal("0.00"), False)
    validate_customer_discount_policy(walk_in, Decimal("0.00"), Decimal("100.00"))


@pytest.mark.asyncio
async def test_customer_outside_active_branch_is_rejected():
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalars=lambda: MagicMock(first=lambda: None))

    with pytest.raises(HTTPException) as error:
        await resolve_customer_discount_policy(db, "customer-other-branch", "company-1", "branch-1")

    assert error.value.status_code == 404