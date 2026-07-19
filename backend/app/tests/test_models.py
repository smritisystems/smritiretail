"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.7.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from decimal import Decimal
from ..models.crm import CustomerGroup, Customer
from ..models.inventory import Product
from ..models.sales import SalesInvoice, SalesInvoiceItem

def test_product_model_instantiation():
    product = Product(
        id="prod-101",
        code="PRD101",
        name="Leather Running Shoes",
        price=Decimal("1599.99"),
        stock=25,
        category="Footwear",
        barcode="8901234567890",
        mrp=Decimal("1999.00"),
        attributes={"sole_type": "Rubber", "cushioning": "High"}
    )
    assert product.id == "prod-101"
    assert product.code == "PRD101"
    assert product.price == Decimal("1599.99")
    assert product.attributes["sole_type"] == "Rubber"

def test_crm_model_instantiation():
    group = CustomerGroup(
        id="cg-vip",
        name="VIP Tier 1",
        credit_limit=Decimal("50000.00"),
        credit_days=30
    )
    customer = Customer(
        id="cust-201",
        customer_group_id="cg-vip",
        name="Rohan Sharma",
        mobile="9876543210",
        outstanding=Decimal("1500.00")
    )
    assert group.id == "cg-vip"
    assert group.name == "VIP Tier 1"
    assert customer.id == "cust-201"
    assert customer.outstanding == Decimal("1500.00")

def test_sales_model_instantiation():
    invoice = SalesInvoice(
        id="inv-1001",
        invoice_no="INV/2026/1001",
        grand_total=Decimal("2499.50")
    )
    item = SalesInvoiceItem(
        id=1,
        invoice_id="inv-1001",
        code="ITM-99",
        name="Premium Sports Cap",
        quantity=Decimal("2.0000"),
        price=Decimal("499.00"),
        total_amount=Decimal("998.00")
    )
    assert invoice.id == "inv-1001"
    assert invoice.invoice_no == "INV/2026/1001"
    assert item.code == "ITM-99"
    assert item.price == Decimal("499.00")
