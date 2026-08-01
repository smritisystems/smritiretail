from backend.app.modules.sales.quotation.repository import InMemoryQuotationRepository
from backend.app.services.sales_quotation_service import Quotation, QuotationItem, calculate_total, create_quotation


def test_calculate_total_with_discount_and_tax():
    quotation = create_quotation(
        customer_code="CUST-100",
        items=[
            QuotationItem(item_code="ITEM-1", description="Widget", quantity=2, unit_price=100, discount_percent=10, tax_percent=5)
        ],
    )

    total = calculate_total(quotation)

    assert total == 189.0


def test_create_quotation_defaults_to_draft():
    quotation = create_quotation(customer_code="CUST-100", items=[])

    assert quotation.status == "draft"
    assert quotation.currency == "INR"
