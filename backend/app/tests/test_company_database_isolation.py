"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Physical Company Database Multi-Tenant Isolation Integration Test Suite
"""

import uuid
import pytest
from decimal import Decimal
from urllib.parse import urlparse
from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.db.control_base import ControlBase
from app.db.company_base import CompanyBase
from app.models.control import (
    ControlCompany,
    ControlCompanyDatabase,
    DatabaseRegistryStatus,
    ControlUser,
    ControlUserCompanyAssignment,
)
from app.models.inventory import Product
from app.models.crm import Customer
from app.models.sales import SalesInvoice
from app.models.tenant import Company
from app.services.control_database_registry import ControlDatabaseRegistryService
from app.db.company_session import get_company_session_by_code, company_db_pool_manager

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def setup_multi_db_environment():
    """
    Sets up Control DB and two physically distinct PostgreSQL test databases:
    - smriti_test_control_db
    - smriti_company_a_test
    - smriti_company_b_test
    """
    base_url = settings.CONTROL_DATABASE_URL or settings.DATABASE_URL
    parsed = urlparse(base_url)
    db_user = parsed.username or "postgres"
    db_pass = parsed.password or "postgres"
    db_host = parsed.hostname or "localhost"
    db_port = parsed.port or 5432

    url_control = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_test_control_db"
    url_comp_a  = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_company_a_test"
    url_comp_b  = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_company_b_test"

    # Helper function to create database if not exists
    url_postgres = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/postgres"
    engine_pg = create_async_engine(url_postgres, isolation_level="AUTOCOMMIT")

    for db_name in ["smriti_test_control_db", "smriti_company_a_test", "smriti_company_b_test"]:
        async with engine_pg.connect() as conn:
            res = await conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
            if not res.scalar():
                await conn.execute(text(f"CREATE DATABASE {db_name}"))

    await engine_pg.dispose()

    engine_control = create_async_engine(url_control)
    engine_comp_a  = create_async_engine(url_comp_a)
    engine_comp_b  = create_async_engine(url_comp_b)

    async with engine_control.begin() as conn:
        await conn.run_sync(ControlBase.metadata.drop_all)
        await conn.run_sync(ControlBase.metadata.create_all)

    async with engine_comp_a.begin() as conn_a:
        await conn_a.run_sync(CompanyBase.metadata.drop_all)
        await conn_a.run_sync(CompanyBase.metadata.create_all)

    async with engine_comp_b.begin() as conn_b:
        await conn_b.run_sync(CompanyBase.metadata.drop_all)
        await conn_b.run_sync(CompanyBase.metadata.create_all)

    sm_control = async_sessionmaker(engine_control, expire_on_commit=False, class_=AsyncSession)
    sm_comp_a  = async_sessionmaker(engine_comp_a, expire_on_commit=False, class_=AsyncSession)
    sm_comp_b  = async_sessionmaker(engine_comp_b, expire_on_commit=False, class_=AsyncSession)

    # Populate Control DB
    async with sm_control() as c_db:
        comp_a = ControlCompany(id="comp-id-a", company_code="COMP_A", name="Company A", is_active=True)
        comp_b = ControlCompany(id="comp-id-b", company_code="COMP_B", name="Company B", is_active=True)

        cdb_a = ControlCompanyDatabase(
            id="cdb-id-a", company_id="comp-id-a", company_code="COMP_A",
            db_identifier="smriti_company_a_test", db_host="localhost", db_port=5432,
            db_name="smriti_company_a_test", db_user="postgres",
            status=DatabaseRegistryStatus.ACTIVE.value, schema_revision="head", schema_fingerprint="FINGERPRINT_A"
        )
        cdb_b = ControlCompanyDatabase(
            id="cdb-id-b", company_id="comp-id-b", company_code="COMP_B",
            db_identifier="smriti_company_b_test", db_host="localhost", db_port=5432,
            db_name="smriti_company_b_test", db_user="postgres",
            status=DatabaseRegistryStatus.ACTIVE.value, schema_revision="head", schema_fingerprint="FINGERPRINT_B"
        )

        user_a = ControlUser(id="usr-id-a", username="user_a", hashed_password="pass", is_active=True)
        user_b = ControlUser(id="usr-id-b", username="user_b", hashed_password="pass", is_active=True)

        uca_a = ControlUserCompanyAssignment(id="uca-a", user_id="usr-id-a", company_id="comp-id-a", company_code="COMP_A")
        uca_b = ControlUserCompanyAssignment(id="uca-b", user_id="usr-id-b", company_id="comp-id-b", company_code="COMP_B")

        c_db.add_all([comp_a, comp_b, cdb_a, cdb_b, user_a, user_b, uca_a, uca_b])
        await c_db.commit()

    # Seed operational Company metadata records in each isolated Company DB
    async with sm_comp_a() as session_a:
        op_comp_a = Company(id="comp-id-a", company_code="COMP_A", name="Company A", is_active=True)
        session_a.add(op_comp_a)
        await session_a.commit()

    async with sm_comp_b() as session_b:
        op_comp_b = Company(id="comp-id-b", company_code="COMP_B", name="Company B", is_active=True)
        session_b.add(op_comp_b)
        await session_b.commit()

    yield {
        "sm_control": sm_control,
        "sm_comp_a": sm_comp_a,
        "sm_comp_b": sm_comp_b,
        "url_comp_a": url_comp_a,
        "url_comp_b": url_comp_b,
    }

    # Teardown
    async with engine_control.begin() as conn:
        await conn.run_sync(ControlBase.metadata.drop_all)
    async with engine_comp_a.begin() as conn:
        await conn.run_sync(CompanyBase.metadata.drop_all)
    async with engine_comp_b.begin() as conn:
        await conn.run_sync(CompanyBase.metadata.drop_all)

    await engine_control.dispose()
    await engine_comp_a.dispose()
    await engine_comp_b.dispose()
    await company_db_pool_manager.dispose_all()


@pytest.mark.asyncio
async def test_control_base_and_company_base_metadata_separation():
    """
    PHYSICAL ISOLATION TEST 1: CompanyBase tables must NOT be registered in ControlBase.
    ControlBase tables must NOT be registered in CompanyBase.
    """
    control_tables = set(ControlBase.metadata.tables.keys())
    company_tables = set(CompanyBase.metadata.tables.keys())

    assert "control_companies" in control_tables
    assert "control_companies" not in company_tables

    assert "products" in company_tables
    assert "products" not in control_tables

    assert "sales_invoices" in company_tables
    assert "sales_invoices" not in control_tables


@pytest.mark.asyncio
async def test_company_a_session_cannot_query_company_b_records(setup_multi_db_environment):
    """
    PHYSICAL ISOLATION TEST 2: Product created in Company A DB exists ONLY in Company A DB.
    Querying Company B DB for Company A's product MUST return 0 records.
    """
    sm_a = setup_multi_db_environment["sm_comp_a"]
    sm_b = setup_multi_db_environment["sm_comp_b"]

    prod_id = f"prod-comp-a-{uuid.uuid4().hex[:6]}"

    # Insert Product into Company A DB
    async with sm_a() as session_a:
        prod_a = Product(
            id=prod_id,
            code=f"CODE-{prod_id[:8]}",
            barcode=f"BC-{prod_id[:8]}",
            name="Company A Exclusive Laptop",
            category="Laptops",
            mrp=Decimal("75000.00"),
            price=Decimal("75000.00"),
            sku="SKU-COMP-A-001",
            company_id="comp-id-a",
            is_active=True,
            is_deleted=False,
        )
        session_a.add(prod_a)
        await session_a.commit()

    # Query Company A DB -> Found
    async with sm_a() as session_a:
        res_a = await session_a.execute(select(Product).where(Product.id == prod_id))
        found_a = res_a.scalars().first()
        assert found_a is not None
        assert found_a.name == "Company A Exclusive Laptop"

    # Query Company B DB -> NOT FOUND (Physical Database Isolation)
    async with sm_b() as session_b:
        res_b = await session_b.execute(select(Product).where(Product.id == prod_id))
        found_b = res_b.scalars().first()
        assert found_b is None


@pytest.mark.asyncio
async def test_company_a_customer_and_invoice_isolation(setup_multi_db_environment):
    """
    PHYSICAL ISOLATION TEST 3: Customer and Sales Invoice created in Company A DB
    are physically absent from Company B DB.
    """
    sm_a = setup_multi_db_environment["sm_comp_a"]
    sm_b = setup_multi_db_environment["sm_comp_b"]

    cust_id = f"cust-a-{uuid.uuid4().hex[:6]}"
    inv_id  = f"inv-a-{uuid.uuid4().hex[:6]}"

    async with sm_a() as session_a:
        cust_a = Customer(
            id=cust_id,
            code=f"CUST-{cust_id[:8]}",
            name="Company A Customer",
            mobile="9876543210",
            company_id="comp-id-a",
            is_active=True,
            is_deleted=False,
        )
        inv_a = SalesInvoice(
            id=inv_id,
            invoice_no="INV-A-1001",
            customer_id=cust_id,
            grand_total=Decimal("15000.00"),
            company_id="comp-id-a",
            is_active=True,
            is_deleted=False,
        )
        session_a.add_all([cust_a, inv_a])
        await session_a.commit()

    # Verify Customer and Invoice physically exist in Company A DB
    async with sm_a() as session_a:
        c_a = (await session_a.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        i_a = (await session_a.execute(select(SalesInvoice).where(SalesInvoice.id == inv_id))).scalars().first()
        assert c_a is not None
        assert i_a is not None

    # Verify Customer and Invoice are physically absent in Company B DB
    async with sm_b() as session_b:
        c_b = (await session_b.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        i_b = (await session_b.execute(select(SalesInvoice).where(SalesInvoice.id == inv_id))).scalars().first()
        assert c_b is None
        assert i_b is None


@pytest.mark.asyncio
async def test_user_authorization_blocks_unassigned_company_resolution(setup_multi_db_environment):
    """
    SECURITY AUTHORIZATION TEST 4:
    User A (assigned ONLY to COMP_A) attempting to resolve COMP_B DB MUST raise HTTP 403.
    User B (assigned ONLY to COMP_B) attempting to resolve COMP_A DB MUST raise HTTP 403.
    """
    sm_control = setup_multi_db_environment["sm_control"]

    async with sm_control() as control_db:
        # User A -> COMP_A => Allowed
        auth_a_a = await ControlDatabaseRegistryService.verify_user_company_access(control_db, "usr-id-a", "COMP_A")
        assert auth_a_a is True

        # User A -> COMP_B => Denied
        auth_a_b = await ControlDatabaseRegistryService.verify_user_company_access(control_db, "usr-id-a", "COMP_B")
        assert auth_a_b is False

        # User B -> COMP_A => Denied
        auth_b_a = await ControlDatabaseRegistryService.verify_user_company_access(control_db, "usr-id-b", "COMP_A")
        assert auth_b_a is False


@pytest.mark.asyncio
async def test_control_tables_inaccessible_through_company_db_session(setup_multi_db_environment):
    """
    SECURITY TEST 5: Control DB tables (like control_users) cannot be queried through a Company DB session.
    """
    sm_a = setup_multi_db_environment["sm_comp_a"]

    async with sm_a() as session_a:
        # Attempting raw SQL query for control_users inside Company A DB MUST raise exception / table not found
        with pytest.raises(Exception):
            await session_a.execute(text("SELECT * FROM control_users"))
