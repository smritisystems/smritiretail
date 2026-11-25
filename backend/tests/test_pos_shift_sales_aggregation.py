from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.pos import POSService


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class FakeDatabase:
    def __init__(self, invoices, transactions):
        self.invoices = invoices
        self.transactions = transactions

    async def execute(self, statement):
        model = statement.column_descriptions[0]["entity"]
        if model.__name__ == "SalesInvoice":
            return FakeResult(self.invoices)
        if model.__name__ == "PaymentTransaction":
            return FakeResult(self.transactions)
        raise AssertionError(f"Unexpected query model: {model.__name__}")


@pytest.mark.asyncio
async def test_shift_sales_aggregation_uses_live_invoices_and_split_tenders():
    invoices = [
        SimpleNamespace(
            id="invoice-1",
            grand_total=Decimal("100.00"),
            payment_mode="CASH",
            tax_total=Decimal("10.00"),
            discount_amount=Decimal("5.00"),
        ),
        SimpleNamespace(
            id="invoice-2",
            grand_total=Decimal("50.00"),
            payment_mode="CARD",
            tax_total=Decimal("5.00"),
            discount_amount=Decimal("0.00"),
        ),
    ]
    transactions = [
        SimpleNamespace(reference_doc_id="invoice-1", amount=Decimal("80.00"), tender_type="CASH"),
        SimpleNamespace(reference_doc_id="invoice-1", amount=Decimal("20.00"), tender_type="CARD"),
    ]
    service = POSService(
        FakeDatabase(invoices, transactions),
        SimpleNamespace(company_id="COMP-001"),
    )

    totals = await service._aggregate_shift_sales("shift-1")

    assert totals == {
        "cash_sales_total": Decimal("80.00"),
        "card_sales_total": Decimal("70.00"),
        "upi_sales_total": Decimal("0.00"),
        "total_sales": Decimal("150.00"),
        "total_invoices": 2,
        "tax_total": Decimal("15.00"),
        "discount_total": Decimal("5.00"),
    }


@pytest.mark.asyncio
async def test_cashier_cannot_view_another_cashiers_z_report():
    class ShiftLookupService(POSService):
        async def get_shift(self, shift_id):
            return SimpleNamespace(cashier_id="cashier-owner")

    service = ShiftLookupService(object(), SimpleNamespace(company_id="COMP-001"))

    with pytest.raises(HTTPException) as error:
        await service.get_z_report(
            "shift-1",
            requesting_user_id="cashier-other",
            requesting_user_role="CASHIER",
        )

    assert error.value.status_code == 403
