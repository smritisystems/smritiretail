from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.api.v1 import sales as sales_api
from app.schemas.customer_po import CustomerPOBillingLine, CustomerPOBillingRequest
from app.services.billing_profile_service import BillingProfileService


def _billing_request() -> CustomerPOBillingRequest:
    return CustomerPOBillingRequest(
        invoice={"credit_override_reason": "Approved temporary limit exception"},
        lines=[CustomerPOBillingLine(customer_po_line_id="line-1", quantity=1)],
    )


@pytest.mark.asyncio
async def test_customer_po_billing_rejects_unpermissioned_credit_override(monkeypatch):
    permission_check = AsyncMock(return_value=False)
    monkeypatch.setattr("app.core.security_matrix.evaluate_action_permission", permission_check)
    service = AsyncMock()
    monkeypatch.setattr(sales_api, "CustomerPOService", lambda *_: service)

    with pytest.raises(HTTPException) as exc:
        await sales_api.bill_customer_po(
            po_id="po-1",
            payload=_billing_request(),
            db=object(),
            control_db=object(),
            tenant_ctx=TenantContext(company_id="COMP-1", branch_id="BR-1"),
            current_user=SimpleNamespace(id="user-1"),
            _user=SimpleNamespace(id="user-1"),
        )

    assert exc.value.status_code == 403
    service.bill.assert_not_awaited()


@pytest.mark.asyncio
async def test_customer_po_billing_forwards_authorized_credit_override(monkeypatch):
    permission_check = AsyncMock(return_value=True)
    monkeypatch.setattr("app.core.security_matrix.evaluate_action_permission", permission_check)
    override_policy = AsyncMock(return_value=True)
    monkeypatch.setattr(BillingProfileService, "credit_limit_override_enabled", override_policy)
    service = SimpleNamespace(bill=AsyncMock(return_value="saved-invoice"))
    monkeypatch.setattr(sales_api, "CustomerPOService", lambda *_: service)
    tenant_ctx = TenantContext(company_id="COMP-1", branch_id="BR-1")
    user = SimpleNamespace(id="user-1")
    payload = _billing_request()

    result = await sales_api.bill_customer_po(
        po_id="po-1",
        payload=payload,
        idempotency_key=None,
        db=object(),
        control_db=object(),
        tenant_ctx=tenant_ctx,
        current_user=user,
        _user=user,
    )

    assert result == "saved-invoice"
    service.bill.assert_awaited_once_with(
        "po-1",
        payload,
        idempotency_key=None,
        authorized_credit_override=True,
        credit_override_actor="user-1",
        authorized_transaction_mode_change=True,
    )
