"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.7.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.schemas.crm import CustomerCreate, CustomerGroupCreate
from app.schemas.inventory import ProductCreate, ProductUpdate
from app.schemas.sales import SalesInvoiceCreate

def test_crm_schema_validation():
    # Valid customer group creation
    group = CustomerGroupCreate(
        id="cg-1",
        name="Standard Group",
        credit_limit=Decimal("1000.00")
    )
    assert group.id == "cg-1"
    assert group.name == "Standard Group"

    # Missing required name should fail
    with pytest.raises(ValidationError):
        CustomerGroupCreate(credit_limit=Decimal("1000.00"))

def test_inventory_schema_validation():
    product = ProductCreate(
        id="prod-1",
        code="PROD-1",
        name="Soap",
        price=Decimal("10.00"),
        category="Essentials",
        barcode="123456",
        mrp=Decimal("15.00"),
        gst_percentage=Decimal("18.00"),
        hsn_code="3401"
    )
    assert product.code == "PROD-1"
    assert product.price == Decimal("10.00")
    assert product.mrp == Decimal("15.00")

def test_product_type_is_a_distinct_optional_dimension():
    product = ProductCreate(
        code="PROD-TYPE",
        name="Sandal",
        price=Decimal("10.00"),
        category="Footwear",
        product_type="Sandal",
        barcode="123457",
        mrp=Decimal("15.00"),
        gst_percentage=Decimal("18.00"),
        hsn_code="6403",
    )
    assert product.product_type == "Sandal"
    assert ProductUpdate(product_type="  Shoe  ").product_type == "Shoe"

    with pytest.raises(ValidationError):
        ProductUpdate(product_type=None)

    with pytest.raises(ValidationError):
        ProductCreate(
            code="PROD-BLANK-TYPE",
            name="Sandal",
            price=Decimal("10.00"),
            product_type=" ",
            barcode="123458",
            mrp=Decimal("15.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="6403",
        )

def test_product_category_must_be_explicit():
    with pytest.raises(ValidationError):
        ProductCreate(
            code="PROD-NO-CATEGORY",
            name="Unclassified item",
            price=Decimal("10.00"),
            barcode="123459",
            mrp=Decimal("15.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="6403",
        )

def test_sales_schema_validation():
    # Invalid price negative value
    with pytest.raises(ValidationError):
        SalesInvoiceCreate(
            id="inv-1",
            invoice_no="INV-1",
            customer_id="cust-1",
            items=[{
                "product_id": "prod-1",
                "code": "PROD-1",
                "name": "Soap",
                "quantity": Decimal("1.00"),
                "price": Decimal("-5.00"), # Negative price
                "total_amount": Decimal("-5.00")
            }]
        )
