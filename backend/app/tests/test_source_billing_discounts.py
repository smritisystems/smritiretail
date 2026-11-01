from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from app.core.gst_engine import calculate_line_item_tax
from app.services.invoice_pdf_service import invoice_line_discount_details
from app.services.headless_billing import resolve_line_discount
from app.services.source_billing import _allocate_fixed_line_discount, _build_source_invoice_line
from app.schemas.source_billing import SourceBillingPrepareLine


def test_sales_order_discount_wins_over_customer_default():
    amount, source = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("10.00"),
        discount_amount=Decimal("0.00"),
        customer_discount_percent=Decimal("20.00"),
        source_order_discount=True,
    )

    assert amount == Decimal("100.00")
    assert source == "SALES_ORDER"


def test_customer_default_is_used_when_source_order_has_no_discount():
    amount, source = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        customer_discount_percent=Decimal("12.50"),
        source_order_discount=True,
    )

    assert amount == Decimal("125.00")
    assert source == "CUSTOMER_POLICY"


def test_customer_default_is_not_applied_to_other_lines_when_order_has_discount():
    amount, source = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        customer_discount_percent=Decimal("12.50"),
        source_order_discount=False,
        source_document_has_discount=True,
    )

    assert amount == Decimal("0.00")
    assert source == "NONE"


def test_source_percentage_takes_precedence_over_fixed_amount():
    amount, source = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("10.00"),
        discount_amount=Decimal("50.00"),
        customer_discount_percent=Decimal("0.00"),
        source_order_discount=True,
    )

    assert amount == Decimal("100.00")
    assert source == "SALES_ORDER"


def test_source_order_and_promotion_stack_only_when_configured():
    unstacked, unstacked_source = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("10.00"),
        discount_amount=Decimal("0.00"),
        customer_discount_percent=Decimal("0.00"),
        promotion_discount_amount=Decimal("50.00"),
        source_order_discount=True,
    )
    stacked, stacked_source = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("10.00"),
        discount_amount=Decimal("0.00"),
        customer_discount_percent=Decimal("0.00"),
        promotion_discount_amount=Decimal("50.00"),
        promotion_allows_stacking=True,
        source_order_discount=True,
    )

    assert (unstacked, unstacked_source) == (Decimal("100.00"), "SALES_ORDER")
    assert (stacked, stacked_source) == (Decimal("150.00"), "SALES_ORDER_AND_PROMOTION")


def test_taxable_value_uses_source_discount_before_gst():
    discount, _ = resolve_line_discount(
        gross_amount=Decimal("1000.00"),
        discount_percent=Decimal("10.00"),
        discount_amount=Decimal("0.00"),
        customer_discount_percent=Decimal("0.00"),
        source_order_discount=True,
    )

    tax = calculate_line_item_tax(
        unit_price=Decimal("1000.00"),
        quantity=Decimal("1"),
        discount_amount=discount,
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        is_interstate=False,
    )

    assert tax["taxable_value"] == Decimal("900.00")
    assert tax["tax_amount"] == Decimal("162.00")


def test_fixed_source_discount_prorates_exactly_across_partial_quantities():
    first = _allocate_fixed_line_discount(
        Decimal("10.00"), Decimal("3"), Decimal("0"), Decimal("1")
    )
    second = _allocate_fixed_line_discount(
        Decimal("10.00"), Decimal("3"), Decimal("1"), Decimal("1")
    )
    final = _allocate_fixed_line_discount(
        Decimal("10.00"), Decimal("3"), Decimal("2"), Decimal("1")
    )

    assert (first, second, final) == (
        Decimal("3.33"),
        Decimal("3.34"),
        Decimal("3.33"),
    )


def test_source_invoice_line_preserves_exclusive_sales_order_tax_pricing():
    line = SourceBillingPrepareLine(
        source_line_id="order-line-1",
        product_id="product-1",
        code="SKU-1",
        name="Item",
        ordered_quantity=Decimal("1"),
        previously_billed_quantity=Decimal("0"),
        remaining_quantity=Decimal("1"),
        unit_price=Decimal("2499.00"),
        gst_rate=Decimal("5.00"),
        eligible=True,
    )

    invoice_line = _build_source_invoice_line(
        line,
        "order-line-1",
        Decimal("1"),
        "SALES_ORDER",
    )
    tax = calculate_line_item_tax(
        unit_price=invoice_line["price"],
        quantity=invoice_line["quantity"],
        discount_amount=invoice_line["disc_amt"],
        gst_rate=invoice_line["gst_rate"],
        is_tax_inclusive=invoice_line["is_tax_inclusive"],
        is_interstate=False,
    )

    assert invoice_line["is_tax_inclusive"] is False
    assert tax["taxable_value"] == Decimal("2499.00")
    assert tax["tax_amount"] == Decimal("124.95")
    assert tax["total_amount"] == Decimal("2623.95")


def test_invoice_discount_details_keep_resolved_source_and_amount():
    item = SimpleNamespace(
        price=Decimal("100.00"),
        quantity=Decimal("2"),
        disc_pct=Decimal("10.00"),
        source_line_type="SALES_ORDER",
    )

    details = invoice_line_discount_details(
        item,
        {
            "discount_resolution": {
                "lines": [{
                    "line_no": 1,
                    "source": "SALES_ORDER",
                    "rate_percent": "10.00",
                    "discount_amount": "20.00",
                }]
            }
        },
        1,
    )

    assert details == {
        "rate_percent": Decimal("10.00"),
        "discount_amount": Decimal("20.00"),
        "source": "SALES_ORDER",
    }


@pytest.mark.asyncio
async def test_source_backed_drafts_cannot_be_edited_or_posted_from_draft_screen():
    from app.schemas.sales import SalesInvoiceUpdate
    from app.services.sales import SalesService

    invoice = SimpleNamespace(status="Draft", source_document_type="SALES_ORDER")
    result = MagicMock()
    result.scalars.return_value.first.return_value = invoice
    session = AsyncMock()
    session.execute.return_value = result
    service = SalesService(
        session,
        SimpleNamespace(company_id="company-1", branch_id="branch-1"),
    )

    with pytest.raises(HTTPException) as edit_error:
        await service.update_sales_invoice("invoice-1", SalesInvoiceUpdate())
    assert "Source-backed drafts are immutable" in edit_error.value.detail
    with pytest.raises(HTTPException) as submit_error:
        await service.submit_draft_sales_invoice("invoice-1")
    assert "Source-backed drafts are not posted" in submit_error.value.detail
