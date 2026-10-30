from datetime import date
from decimal import Decimal

from app.schemas.sales import SalesOrderCreate, SalesOrderItemCreate


def test_sales_order_line_accepts_barcode_alias():
    line = SalesOrderItemCreate(
        product_id="prod-001",
        code="SKU-001",
        name="Test item",
        quantity=Decimal("2"),
        price=Decimal("100"),
        total_amount=Decimal("200"),
        barcode="8901234567890",
    )

    assert line.ean == "8901234567890"


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
            )
        ],
    )

    assert order.po_number == "5182778164"
    assert order.site_code == "T9IM"
    assert order.items[0].ean == "8901234567890"
