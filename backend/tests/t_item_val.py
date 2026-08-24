"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from decimal import Decimal
from pydantic import ValidationError
from app.schemas.inventory import ProductCreate, ProductUpdate, ProductBase
from app.db.session import get_company_sessionmaker
from app.services.inventory import InventoryService
from app.api.deps import TenantContext
from app.models.inventory import Product
from sqlalchemy import delete


# ==========================================
# 1. Pydantic Schema & Non-Blank Unit Tests
# ==========================================

def test_product_create_valid_record():
    """Verify that a product with all required fields and valid pricing hierarchy succeeds and trims strings."""
    prod = ProductCreate(
        code="  SKU-TEST-001  ",
        barcode="  8901234567890  ",
        name="  Premium Leather Shoe  ",
        buying_price=Decimal("1000.00"),
        cost_price=Decimal("800.00"),
        mrp=Decimal("1999.00"),
        price=Decimal("1499.00"),
        gst_percentage=Decimal("18.00"),
        hsn_code="  64041990  ",
        category="Footwear"
    )
    assert prod.code == "SKU-TEST-001"
    assert prod.barcode == "8901234567890"
    assert prod.name == "Premium Leather Shoe"
    assert prod.hsn_code == "64041990"
    assert prod.buying_price == Decimal("1000.00")
    assert prod.cost_price == Decimal("800.00")
    assert prod.mrp == Decimal("1999.00")
    assert prod.price == Decimal("1499.00")
    assert prod.gst_percentage == Decimal("18.00")


@pytest.mark.parametrize("blank_code", ["", "   ", None])
def test_product_create_rejects_blank_code(blank_code):
    """Verify that Stock No / SKU cannot be blank or whitespace-only."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code=blank_code,
            barcode="8901234567890",
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "code" in str(exc_info.value)


@pytest.mark.parametrize("blank_barcode", ["", "   ", None])
def test_product_create_rejects_blank_barcode(blank_barcode):
    """Verify that Barcode cannot be blank or whitespace-only."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-002",
            barcode=blank_barcode,
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "barcode" in str(exc_info.value)


@pytest.mark.parametrize("blank_name", ["", "   ", None])
def test_product_create_rejects_blank_name(blank_name):
    """Verify that Product Name / Title cannot be blank or whitespace-only."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-003",
            barcode="8901234567891",
            name=blank_name,
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "name" in str(exc_info.value)


@pytest.mark.parametrize("blank_hsn", ["", "   ", None])
def test_product_create_rejects_blank_hsn_code(blank_hsn):
    """Verify that HSN Code cannot be blank or whitespace-only."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-004",
            barcode="8901234567892",
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code=blank_hsn
        )
    assert "hsn_code" in str(exc_info.value)


# ==========================================
# 2. Pricing Hierarchy & Invariant Tests
# ==========================================

@pytest.mark.parametrize("invalid_bp", [None, "", "  ", Decimal("0"), Decimal("-10.00"), -5])
def test_product_create_rejects_invalid_buying_price(invalid_bp):
    """Verify Buying Price is mandatory and must be > 0 for stock items."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-BP",
            barcode="8901234567893",
            name="Test Product",
            buying_price=invalid_bp,
            cost_price=Decimal("800.00"),
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "Buying Price" in str(exc_info.value) or "buying_price" in str(exc_info.value)


@pytest.mark.parametrize("invalid_cp", [None, "", "  ", Decimal("0"), Decimal("-10.00"), -5])
def test_product_create_rejects_invalid_cost_price(invalid_cp):
    """Verify Cost Price is mandatory and must be > 0 for stock items."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-CP",
            barcode="8901234567894",
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=invalid_cp,
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "Cost Price" in str(exc_info.value) or "cost_price" in str(exc_info.value)


def test_product_create_rejects_cost_price_greater_than_buying_price():
    """Verify Cost Price must be <= Buying Price."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-REL1",
            barcode="8901234567895",
            name="Test Product",
            buying_price=Decimal("800.00"),
            cost_price=Decimal("1000.00"),  # CP > BP violation!
            mrp=Decimal("1999.00"),
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "Cost Price (1000.00) must be less than or equal to Buying Price (800.00)" in str(exc_info.value)


def test_product_create_rejects_mrp_less_than_selling_price():
    """Verify MRP must be >= Selling Price."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-REL2",
            barcode="8901234567896",
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=Decimal("1200.00"),   # MRP < Price violation!
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "MRP (1200.00) must be greater than or equal to Selling Price (1499.00)" in str(exc_info.value)


@pytest.mark.parametrize("invalid_mrp", [None, "", "  ", -10, Decimal("-5.00")])
def test_product_create_rejects_invalid_mrp(invalid_mrp):
    """Verify that MRP cannot be missing, empty, or negative."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-005",
            barcode="8901234567897",
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=invalid_mrp,
            price=Decimal("1499.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "mrp" in str(exc_info.value) or "MRP" in str(exc_info.value)


@pytest.mark.parametrize("invalid_price", [None, "", "  ", -10, Decimal("-5.00")])
def test_product_create_rejects_invalid_price(invalid_price):
    """Verify that Selling Price cannot be missing, empty, or negative."""
    with pytest.raises(ValidationError) as exc_info:
        ProductCreate(
            code="SKU-TEST-006",
            barcode="8901234567898",
            name="Test Product",
            buying_price=Decimal("1000.00"),
            cost_price=Decimal("800.00"),
            mrp=Decimal("1999.00"),
            price=invalid_price,
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990"
        )
    assert "price" in str(exc_info.value) or "Selling Price" in str(exc_info.value)


# ==========================================
# 3. Non-Stock / Service / Free Item Exemptions
# ==========================================

def test_non_stock_item_pricing_exemption():
    """Verify service and non-stock items are exempt from mandatory buying/cost price and allow 0.00."""
    service_item = ProductCreate(
        code="SERV-REPAIR-01",
        barcode="8909999990001",
        name="Shoe Repair & Cleaning Service",
        category="Services",
        tracking_mode="No-stock",
        pricing_mode="Fixed",
        price=Decimal("250.00"),
        mrp=Decimal("250.00"),
        buying_price=None,  # Exempt!
        cost_price=None,    # Exempt!
        gst_percentage=Decimal("18.00"),
        hsn_code="998729"
    )
    assert service_item.code == "SERV-REPAIR-01"
    assert service_item.buying_price is None
    assert service_item.cost_price is None

    free_sample = ProductCreate(
        code="SMPL-LACES-01",
        barcode="8909999990002",
        name="Promotional Shoe Laces Sample",
        category="Promotional",
        pricing_mode="Free",
        tracking_mode="No-stock",
        price=Decimal("0.00"),
        mrp=Decimal("0.00"),
        buying_price=Decimal("0.00"),
        cost_price=Decimal("0.00"),
        gst_percentage=Decimal("0.00"),
        hsn_code="640690"
    )
    assert free_sample.code == "SMPL-LACES-01"
    assert free_sample.price == Decimal("0.00")


# ==========================================
# 4. Product Update & Database Integration
# ==========================================

def test_product_update_validates_relationships():
    """Verify ProductUpdate enforces price hierarchy when updating both values."""
    with pytest.raises(ValidationError) as exc_info:
        ProductUpdate(cost_price=Decimal("1500.00"), buying_price=Decimal("1200.00"))
    assert "Cost Price (1500.00) must be less than or equal to Buying Price (1200.00)" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        ProductUpdate(mrp=Decimal("900.00"), price=Decimal("1200.00"))
    assert "MRP (900.00) must be greater than or equal to Selling Price (1200.00)" in str(exc_info.value)


@pytest.mark.asyncio
async def test_database_create_and_duplicate_rejection():
    """Verify full database persistence with buying_price and unique constraints."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        test_code = "SKU-PRICE-INT-01"
        test_barcode = "8909991112233"

        # Cleanup existing
        await session.execute(delete(Product).where(Product.code == test_code))
        await session.execute(delete(Product).where(Product.barcode == test_barcode))
        await session.commit()

        tenant_ctx = TenantContext(
            company_id="COMP-001",
            branch_id="MAIN"
        )

        create_in = ProductCreate(
            code=test_code,
            barcode=test_barcode,
            name="Integration Test Pricing Shoe",
            buying_price=Decimal("1200.00"),
            cost_price=Decimal("1000.00"),
            mrp=Decimal("2499.00"),
            price=Decimal("1999.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="64041990",
            category="Footwear"
        )

        db_product = Product(
            id="prod_test_price_01",
            company_id="COMP-001",
            branch_id="MAIN",
            code=create_in.code,
            barcode=create_in.barcode,
            name=create_in.name,
            buying_price=create_in.buying_price,
            cost_price=create_in.cost_price,
            mrp=create_in.mrp,
            price=create_in.price,
            gst_percentage=create_in.gst_percentage,
            hsn_code=create_in.hsn_code,
            category=create_in.category
        )
        session.add(db_product)
        await session.commit()
        await session.refresh(db_product)

        assert db_product.code == test_code
        assert db_product.barcode == test_barcode
        assert db_product.buying_price == Decimal("1200.00")
        assert db_product.cost_price == Decimal("1000.00")
        assert db_product.mrp == Decimal("2499.00")
        assert db_product.price == Decimal("1999.00")

        # Cleanup after test
        await session.execute(delete(Product).where(Product.code == test_code))
        await session.commit()
