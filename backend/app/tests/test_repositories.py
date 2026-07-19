"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.7.0
Created      : 2026-07-11
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from decimal import Decimal
import pytest
from app.models.inventory import Product
from app.repositories.product import ProductRepository

pytestmark = pytest.mark.asyncio

async def test_product_repository_crud(db_session):
    repo = ProductRepository(db_session)
    suffix = uuid.uuid4().hex[:8]
    prod_id = f"test-prod-{suffix}"
    prod_code = f"TCODE{suffix}"
    prod_barcode = f"BC{suffix}"

    # 1. Create
    product = Product(
        id=prod_id,
        code=prod_code,
        name="Test product",
        price=Decimal("99.99"),
        stock=10,
        category="General",
        barcode=prod_barcode,
        mrp=Decimal("120.00")
    )
    db_product = await repo.create(product)
    assert db_product.id == prod_id
    assert db_product.code == prod_code
    
    # 2. Get
    fetched = await repo.get(prod_id)
    assert fetched is not None
    assert fetched.name == "Test product"
    
    # 3. Update
    previous_version = fetched.version
    updated = await repo.update(fetched, {"price": Decimal("109.99")})
    assert updated.price == Decimal("109.99")
    assert updated.version == previous_version + 1
    assert updated.modified_at.tzinfo is not None
    
    # 4. Count
    total = await repo.count()
    assert total >= 1
    
    # 5. Delete (Soft)
    version_before_soft_delete = updated.version  # capture before session refresh below
    deleted = await repo.soft_delete(fetched)
    assert deleted.is_deleted is True
    assert deleted.version == version_before_soft_delete + 1
    assert deleted.deleted_at.tzinfo is not None
    
    # Fetching should return None now (due to soft delete check)
    fetched_deleted = await repo.get(prod_id)
    assert fetched_deleted is None

    # Soft-deleted products should not be in get_all list
    all_products = await repo.get_all()
    assert not any(p.id == prod_id for p in all_products)

