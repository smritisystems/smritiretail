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
from app.schemas.inventory import ProductCreate
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

    # Missing required id should fail
    with pytest.raises(ValidationError):
        CustomerGroupCreate(name="Standard Group")

def test_inventory_schema_validation():
    product = ProductCreate(
        id="prod-1",
        code="PROD-1",
        name="Soap",
        price=Decimal("10.00"),
        category="Essentials",
        barcode="123456"
    )
    assert product.code == "PROD-1"
    assert product.price == Decimal("10.00")

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
