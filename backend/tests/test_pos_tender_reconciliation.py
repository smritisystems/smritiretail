from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from app.schemas.pos import ShiftClose
from app.services.pos import POSService, calculate_tender_reconciliation
from app.services.outbox_service import OutboxService
from app.services.unified_ledger import UnifiedAccountingLedgerService


class FakeDatabase:
    async def flush(self):
        pass

    async def commit(self):
        pass

    async def refresh(self, _entity):
        pass


def make_close_test_service(totals):
    shift = SimpleNamespace(
        id="shift-1",
        register_id="register-1",
        status="OPEN",
        cashier_id="cashier-1",
        opening_balance=Decimal("1000.00"),
        cash_in_total=Decimal("0.00"),
        cash_drops_total=Decimal("0.00"),
        till_expenses_total=Decimal("0.00"),
    )

    class TestPOSService(POSService):
        async def get_shift(self, _shift_id, for_update=False):
            return shift

        async def _aggregate_shift_sales(self, _shift_id):
            return totals

    service = TestPOSService(
        FakeDatabase(),
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )
    return service, shift


def test_shift_close_accepts_actual_card_and_upi_totals():
    request = ShiftClose.model_validate({
        "closing_balance": "5050.00",
        "actual_card_counted": "70.00",
        "actual_upi_counted": "24.50",
    })

    assert request.actual_card_counted == Decimal("70.00")
    assert request.actual_upi_counted == Decimal("24.50")


def test_tender_reconciliation_calculates_variance_and_preserves_unrecorded_values():
    assert calculate_tender_reconciliation(
        Decimal("70.00"),
        Decimal("75.50"),
    ) == (Decimal("70.00"), Decimal("-5.50"))
    assert calculate_tender_reconciliation(
        Decimal("25.00"),
        Decimal("24.50"),
    ) == (Decimal("25.00"), Decimal("0.50"))
    assert calculate_tender_reconciliation(None, Decimal("10.00")) == (None, None)


@pytest.mark.asyncio
async def test_close_shift_persists_actual_tender_totals_and_variances(monkeypatch):
    totals = {
        "cash_sales_total": Decimal("50.00"),
        "card_sales_total": Decimal("75.50"),
        "upi_sales_total": Decimal("24.50"),
        "total_sales": Decimal("150.00"),
        "total_invoices": 2,
    }
    service, shift = make_close_test_service(totals)
    monkeypatch.setattr(
        UnifiedAccountingLedgerService,
        "post_shift_close_to_gl",
        AsyncMock(),
    )
    record_event = AsyncMock()
    monkeypatch.setattr(OutboxService, "record_event", record_event)

    closed = await service.close_shift(
        "shift-1",
        ShiftClose(
            closing_balance=Decimal("1050.00"),
            actual_card_counted=Decimal("70.00"),
            actual_upi_counted=Decimal("25.00"),
            closing_notes="Card terminal settled short; confirmed with supervisor.",
        ),
        requesting_user_id="cashier-1",
    )

    assert closed.actual_card_counted == Decimal("70.00")
    assert closed.card_variance == Decimal("-5.50")
    assert closed.actual_upi_counted == Decimal("25.00")
    assert closed.upi_variance == Decimal("0.50")
    assert record_event.await_args.kwargs["payload"]["card_variance"] == -5.5
    assert record_event.await_args.kwargs["payload"]["upi_variance"] == 0.5


@pytest.mark.parametrize(
    ("closing_balance", "actual_card", "actual_upi", "closing_notes"),
    [
        (Decimal("1050.01"), Decimal("75.50"), Decimal("24.50"), None),
        (Decimal("1050.00"), Decimal("70.00"), Decimal("24.50"), None),
        (Decimal("1050.00"), Decimal("75.50"), Decimal("24.49"), None),
        (Decimal("1050.01"), Decimal("75.50"), Decimal("24.50"), " \t "),
    ],
    ids=("cash-variance", "card-variance", "upi-cent-variance", "whitespace-notes"),
)
@pytest.mark.asyncio
async def test_close_shift_rejects_variance_without_explanation(
    closing_balance, actual_card, actual_upi, closing_notes
):
    totals = {
        "cash_sales_total": Decimal("50.00"),
        "card_sales_total": Decimal("75.50"),
        "upi_sales_total": Decimal("24.50"),
        "total_sales": Decimal("150.00"),
        "total_invoices": 2,
    }
    service, _shift = make_close_test_service(totals)

    with pytest.raises(HTTPException) as error:
        await service.close_shift(
            "shift-1",
            ShiftClose(
                closing_balance=closing_balance,
                actual_card_counted=actual_card,
                actual_upi_counted=actual_upi,
                closing_notes=closing_notes,
            ),
            requesting_user_id="cashier-1",
        )

    assert error.value.status_code == 422
    assert "explanation" in error.value.detail.lower()


@pytest.mark.asyncio
async def test_close_shift_allows_matching_tenders_without_notes(monkeypatch):
    totals = {
        "cash_sales_total": Decimal("50.00"),
        "card_sales_total": Decimal("75.50"),
        "upi_sales_total": Decimal("24.50"),
        "total_sales": Decimal("150.00"),
        "total_invoices": 2,
    }
    service, _shift = make_close_test_service(totals)
    monkeypatch.setattr(
        UnifiedAccountingLedgerService,
        "post_shift_close_to_gl",
        AsyncMock(),
    )
    monkeypatch.setattr(OutboxService, "record_event", AsyncMock())

    closed = await service.close_shift(
        "shift-1",
        ShiftClose(
            closing_balance=Decimal("1050.00"),
            actual_card_counted=Decimal("75.50"),
            actual_upi_counted=Decimal("24.50"),
        ),
        requesting_user_id="cashier-1",
    )

    assert closed.status == "CLOSED"
    assert closed.closing_notes is None
