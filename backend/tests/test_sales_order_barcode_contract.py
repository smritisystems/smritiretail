from datetime import date
from decimal import Decimal

from app.schemas.sales import SalesOrderCreate, SalesOrderItemCreate
from app.services.sales_order_calculations import calculate_sales_order_line_amounts


def test_sales_order_line_accepts_barcode_alias():
    line = SalesOrderItemCreate(
        product_id="prod-001",
        code="SKU-001",
        name="Test item",
        quantity=Decimal("2"),
        price=Decimal("100"),
        total_amount=Decimal("200"),
        barcode="8901234567890",
        discountPercent=Decimal("10"),
    )

    assert line.ean == "8901234567890"
    assert line.discount_percent == Decimal("10")


def test_sales_order_preserves_reliance_po_metadata():
    order = SalesOrderCreate(
        id="so-test-001",
        order_no="SO-TEST-001",
        date=date(2026, 9, 6),
        customer_id="cust-rrl-192b561d",
        customer_name="Reliance Retail Limited",
        po_number="5182778164",
        site_code="T9IM",
        delivery_address="Reliance Retail site address",
        items=[
            SalesOrderItemCreate(
                product_id="prod-001",
                code="SKU-001",
                name="Test item",
                quantity=Decimal("1"),
                price=Decimal("100"),
                total_amount=Decimal("100"),
                ean="8901234567890",
                discount_amount=Decimal("5.00"),
            )
        ],
    )

    assert order.po_number == "5182778164"
    assert order.site_code == "T9IM"
    assert order.items[0].ean == "8901234567890"
    assert order.items[0].discount_amount == Decimal("5.00")


def test_sales_order_discount_is_applied_before_tax():
    discount, taxable, tax, total = calculate_sales_order_line_amounts(
        Decimal("2"),
        Decimal("100"),
        Decimal("10"),
        Decimal("0"),
        Decimal("18"),
    )

    assert (discount, taxable, tax, total) == (
        Decimal("20.00"),
        Decimal("180.00"),
        Decimal("32.40"),
        Decimal("212.40"),
    )


def test_sales_order_rejects_discount_larger_than_line_value():
    try:
        calculate_sales_order_line_amounts(
            Decimal("1"),
            Decimal("100"),
            Decimal("0"),
            Decimal("101"),
            Decimal("18"),
        )
    except ValueError as error:
        assert str(error) == "Discount cannot exceed the line value."
    else:
        raise AssertionError("Expected an excessive line discount to be rejected")
