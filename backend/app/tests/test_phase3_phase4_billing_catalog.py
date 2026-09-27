"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 3 & 4 Billing Catalog & Customer Exposure Test Suite
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.core.config import settings
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.auth import User
from app.api.v1.billing import list_billing_products, scan_barcode, list_billing_customers


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_tenant(session):
    s = uuid.uuid4().hex[:8]
    company_id = f"CMP-{s}"
    branch_id = f"BR-{s}"
    user_id = f"USR-{s}"

    tenant_ctx = TenantContext(
        company_id=company_id,
        branch_id=branch_id,
    )
    user = User(
        id=user_id,
        company_id=company_id,
        branch_id=branch_id,
        username=f"cashier_{s}",
        role="CASHIER",
    )
    return tenant_ctx, user


@pytest.mark.asyncio
async def test_billing_products_list_and_facets(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_products(
            page=1,
            page_size=50,
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert res.total_count >= 6
        assert len(res.items) >= 6
        assert len(res.categories) >= 7
        cat_names = [c.name for c in res.categories]
        assert "Footwear" in cat_names
        assert "Accessories" in cat_names
        assert "Bags" in cat_names
        assert "Nike" in res.brands


@pytest.mark.asyncio
async def test_billing_products_category_filter(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_products(
            category="Footwear",
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert len(res.items) >= 4
        for it in res.items:
            assert it.category.lower() == "footwear"


@pytest.mark.asyncio
async def test_billing_products_search_query(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_products(
            q="Shoe Care",
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert len(res.items) >= 1
        assert res.items[0].code == "ACC-001"


@pytest.mark.asyncio
async def test_billing_products_price_filter(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_products(
            min_price=Decimal("1500.00"),
            max_price=Decimal("2000.00"),
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert len(res.items) >= 2
        for it in res.items:
            assert Decimal("1500.00") <= it.price <= Decimal("2000.00")


@pytest.mark.asyncio
async def test_billing_scan_barcode_success(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        item = await scan_barcode(
            barcode="890123456001",
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert item.code == "SHOE-001"
        assert item.name == "Sports Shoes - Black"
        assert item.price == Decimal("1500.00")
        assert item.stock == 32


@pytest.mark.asyncio
async def test_billing_scan_barcode_not_found(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        with pytest.raises(HTTPException) as exc_info:
            await scan_barcode(
                barcode="NON_EXISTENT_BARCODE_99999",
                db=session,
                tenant=tenant_ctx,
                current_user=user,
            )
        assert exc_info.value.status_code == 404
        assert "SMRITI-BC-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_billing_customers_list_and_credit_exposure(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_customers(
            status_tab="All",
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert res.total_count >= 4
        cust_codes = [c.code for c in res.items]
        assert "CUST-001" in cust_codes
        assert "CUST-002" in cust_codes
        c1 = next(c for c in res.items if c.code == "CUST-001")
        assert c1.name == "ABC Footwear"
        assert c1.credit_limit == Decimal("200000.00")
        assert c1.balance == Decimal("64800.00")
        assert c1.available_credit == Decimal("135200.00")


@pytest.mark.asyncio
async def test_billing_customers_search_query(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_customers(
            q="Mumbai Traders",
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert len(res.items) >= 1
        assert res.items[0].code == "CUST-002"


@pytest.mark.asyncio
async def test_billing_customers_status_filter(session_factory):
    async with session_factory() as session:
        tenant_ctx, user = await _bootstrap_tenant(session)
        res = await list_billing_customers(
            status_tab="Active",
            db=session,
            tenant=tenant_ctx,
            current_user=user,
        )
        assert len(res.items) >= 4
        for c in res.items:
            assert c.status.lower() == "active"
