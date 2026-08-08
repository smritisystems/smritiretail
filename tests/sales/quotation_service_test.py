from backend.app.modules.sales.quotation.repository import InMemoryQuotationRepository
from backend.app.services.sales_quotation_service import (
    Quotation,
    QuotationItem,
    calculate_total,
    create_quotation,
    save_quotation,
    get_quotation,
    list_quotations,
    delete_quotation,
    clear_quotations,
)


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


def test_save_and_retrieve_quotation():
    clear_quotations()
    quotation = create_quotation(
        customer_code="CUST-100",
        items=[
            QuotationItem(item_code="ITEM-1", description="Widget", quantity=2, unit_price=100, discount_percent=10, tax_percent=5)
        ],
        quotation_id="SQ-TEST-001",
    )

    saved = save_quotation(quotation)
    retrieved = get_quotation("SQ-TEST-001")

    assert retrieved is not None
    assert retrieved.id == saved.id
    assert retrieved.customer_code == "CUST-100"
    assert calculate_total(retrieved) == 189.0


def test_list_and_delete_quotations():
    clear_quotations()
    q1 = create_quotation(
        customer_code="CUST-101",
        items=[QuotationItem(item_code="ITEM-2", description="Gadget", quantity=1, unit_price=200, discount_percent=0, tax_percent=10)],
        quotation_id="SQ-TEST-002",
    )
    q2 = create_quotation(
        customer_code="CUST-102",
        items=[QuotationItem(item_code="ITEM-3", description="Tool", quantity=3, unit_price=50, discount_percent=0, tax_percent=5)],
        quotation_id="SQ-TEST-003",
    )

    save_quotation(q1)
    save_quotation(q2)

    all_quotations = list_quotations()
    assert any(q.id == "SQ-TEST-002" for q in all_quotations)
    assert any(q.id == "SQ-TEST-003" for q in all_quotations)

    assert delete_quotation("SQ-TEST-002") is True
    assert get_quotation("SQ-TEST-002") is None
