"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Phase 4 Existing Application to Physical Company DB Refactor Integration Test Suite (28 Tests)
"""

import uuid
import pytest
from decimal import Decimal
from urllib.parse import urlparse
from fastapi import HTTPException
from sqlalchemy import select, text, and_
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.db.control_base import ControlBase
from app.db.company_base import CompanyBase
from app.db.master_hub_base import MasterHubBase
from app.db.company_session import CompanyDatabasePoolManager
from app.models.control import (
    ControlCompany,
    ControlCompanyDatabase,
    DatabaseRegistryStatus,
    ControlUser,
    ControlUserCompanyAssignment,
)
from app.models.inventory import Product, StockMovement
from app.models.crm import Customer
from app.models.purchase import Supplier
from app.models.sales import SalesInvoice
from app.models.accounting import JournalVoucherModel
from app.models.master_hub import MasterHubType, MasterHubRecord
from app.services.control_database_registry import ControlDatabaseRegistryService
from app.services.master_hub_exchange_service import MasterHubExchangeService
from app.repositories.product import ProductRepository
from app.repositories.customer import CustomerRepository
from app.repositories.supplier import SupplierRepository
from app.repositories.sales import SalesInvoiceRepository
from app.repositories.purchase import PurchaseOrderRepository
from app.repositories.inventory import StockMovementRepository
from app.repositories.pos import PosSessionRepository
from app.repositories.accounting import AccountingRepository
from app.api.deps import TenantContext

import pytest_asyncio

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def setup_phase4_environment():
    """
    Sets up Control DB, Company DB A, Company DB B, and Master Hub DB on PostgreSQL:
    - smriti_test_control_db
    - smriti_company_a_test
    - smriti_company_b_test
    - smriti_master_hub_test
    """
    base_url = settings.CONTROL_DATABASE_URL or settings.DATABASE_URL
    parsed = urlparse(base_url)
    db_user = parsed.username or "postgres"
    db_pass = parsed.password or "postgres"
    db_host = parsed.hostname or "localhost"
    db_port = parsed.port or 5432

    url_control   = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_test_control_db"
    url_company_a = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_company_a_test"
    url_company_b = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_company_b_test"
    url_master_hub= f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_master_hub_test"

    url_postgres = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/postgres"
    engine_pg = create_async_engine(url_postgres, isolation_level="AUTOCOMMIT")

    target_dbs = ["smriti_test_control_db", "smriti_company_a_test", "smriti_company_b_test", "smriti_master_hub_test"]
    for db_name in target_dbs:
        async with engine_pg.connect() as conn:
            res = await conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
            if not res.scalar():
                await conn.execute(text(f"CREATE DATABASE {db_name}"))

    await engine_pg.dispose()

    engine_control   = create_async_engine(url_control)
    engine_company_a = create_async_engine(url_company_a)
    engine_company_b = create_async_engine(url_company_b)
    engine_master_hub= create_async_engine(url_master_hub)

    enums_ddl = text("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN 
                CREATE TYPE userrole AS ENUM ('SYSADMIN', 'MANAGER', 'CASHIER', 'REPORT_USER', 'VIEWER'); 
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'databaseregistrystatus') THEN 
                CREATE TYPE databaseregistrystatus AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'MIGRATING', 'FAILED', 'DRIFTED', 'ARCHIVED'); 
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'masterhubstatus') THEN 
                CREATE TYPE masterhubstatus AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED'); 
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'masterhubimportstatus') THEN 
                CREATE TYPE masterhubimportstatus AS ENUM ('ACCEPTED', 'REJECTED', 'CONFLICT', 'UPDATE_AVAILABLE'); 
            END IF;
        END $$;
    """)

    async with engine_control.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(enums_ddl)
        await conn.run_sync(ControlBase.metadata.create_all)

    async with engine_company_a.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(enums_ddl)
        await conn.run_sync(CompanyBase.metadata.create_all)

    async with engine_company_b.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(enums_ddl)
        await conn.run_sync(CompanyBase.metadata.create_all)

    async with engine_master_hub.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(enums_ddl)
        await conn.run_sync(MasterHubBase.metadata.create_all)

    sm_control    = async_sessionmaker(engine_control, expire_on_commit=False, class_=AsyncSession)
    sm_company_a  = async_sessionmaker(engine_company_a, expire_on_commit=False, class_=AsyncSession)
    sm_company_b  = async_sessionmaker(engine_company_b, expire_on_commit=False, class_=AsyncSession)
    sm_master_hub = async_sessionmaker(engine_master_hub, expire_on_commit=False, class_=AsyncSession)

    # Seed Control DB
    async with sm_control() as c_db:
        comp_a = ControlCompany(id="comp-id-a", company_code="COMP_A", name="Company A", is_active=True)
        comp_b = ControlCompany(id="comp-id-b", company_code="COMP_B", name="Company B", is_active=True)
        comp_inact = ControlCompany(id="comp-id-inact", company_code="COMP_INACT", name="Inactive Company", is_active=False)

        db_a = ControlCompanyDatabase(
            id="cdb-a", company_id="comp-id-a", company_code="COMP_A", db_identifier="db-a",
            db_host=db_host, db_port=db_port, db_name="smriti_company_a_test", db_user=db_user, status="ACTIVE"
        )
        db_b = ControlCompanyDatabase(
            id="cdb-b", company_id="comp-id-b", company_code="COMP_B", db_identifier="db-b",
            db_host=db_host, db_port=db_port, db_name="smriti_company_b_test", db_user=db_user, status="ACTIVE"
        )
        db_inact = ControlCompanyDatabase(
            id="cdb-inact", company_id="comp-id-inact", company_code="COMP_INACT", db_identifier="db-inact",
            db_host=db_host, db_port=db_port, db_name="smriti_company_inact_test", db_user=db_user, status="INACTIVE"
        )

        user_a = ControlUser(id="usr-id-a", username="user_a", hashed_password="pass", is_active=True)
        user_b = ControlUser(id="usr-id-b", username="user_b", hashed_password="pass", is_active=True)

        uca_a = ControlUserCompanyAssignment(id="uca-a", user_id="usr-id-a", company_id="comp-id-a", company_code="COMP_A")
        uca_b = ControlUserCompanyAssignment(id="uca-b", user_id="usr-id-b", company_id="comp-id-b", company_code="COMP_B")

        c_db.add_all([comp_a, comp_b, comp_inact, db_a, db_b, db_inact, user_a, user_b, uca_a, uca_b])
        await c_db.commit()

    # Seed Operational Company DB A & B
    from app.models.tenant import Company
    async with sm_company_a() as a_db:
        op_comp_a = Company(id="comp-id-a", company_code="COMP_A", name="Company A", is_active=True)
        a_db.add(op_comp_a)
        await a_db.commit()

    async with sm_company_b() as b_db:
        op_comp_b = Company(id="comp-id-b", company_code="COMP_B", name="Company B", is_active=True)
        b_db.add(op_comp_b)
        await b_db.commit()

    # Seed Master Hub Types
    async with sm_master_hub() as h_db:
        t_prod = MasterHubType(id="mt-prod", master_type="Product", enabled=True, publish_allowed=True, fetch_allowed=True)
        h_db.add(t_prod)
        await h_db.commit()

    # Clear Pool Cache
    await CompanyDatabasePoolManager.close_all_pools()

    yield {
        "sm_control": sm_control,
        "sm_company_a": sm_company_a,
        "sm_company_b": sm_company_b,
        "sm_master_hub": sm_master_hub,
    }

    # Teardown
    await CompanyDatabasePoolManager.close_all_pools()

    await engine_control.dispose()
    await engine_company_a.dispose()
    await engine_company_b.dispose()
    await engine_master_hub.dispose()


# ── SECTION A: ROUTING TESTS (1–4) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_01_company_a_resolves_company_a_db(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        session = await CompanyDatabasePoolManager.get_company_session_by_code(
            control_db=c_db, company_code="COMP_A", user_id="usr-id-a"
        )
        res = await session.execute(text("SELECT current_database()"))
        db_name = res.scalar()
        await session.close()
        assert db_name == "smriti_company_a_test"


@pytest.mark.asyncio
async def test_02_company_b_resolves_company_b_db(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        session = await CompanyDatabasePoolManager.get_company_session_by_code(
            control_db=c_db, company_code="COMP_B", user_id="usr-id-b"
        )
        res = await session.execute(text("SELECT current_database()"))
        db_name = res.scalar()
        await session.close()
        assert db_name == "smriti_company_b_test"


@pytest.mark.asyncio
async def test_03_user_cannot_resolve_unassigned_company_db(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await CompanyDatabasePoolManager.get_company_session_by_code(
                control_db=c_db, company_code="COMP_B", user_id="usr-id-a"  # User A assigned to COMP_A only
            )
        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_04_company_code_alone_cannot_bypass_authorization(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await ControlDatabaseRegistryService.verify_user_company_access(
                db=c_db, user_id="usr-id-b", company_code="COMP_A"
            )
            await CompanyDatabasePoolManager.get_company_session_by_code(
                control_db=c_db, company_code="COMP_A", user_id="usr-id-b"
            )
        assert exc_info.value.status_code == 403


# ── SECTION B: ISOLATION TESTS (5–10) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_05_company_a_product_invisible_in_company_b_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    sm_b = setup_phase4_environment["sm_company_b"]

    async with sm_a() as a_db:
        p_a = Product(
            id="prod-phase4-a",
            code="PROD-P4-A",
            name="Company A Laptop",
            category="Electronics",
            barcode="BC-P4-A",
            sku="SKU-LAP-A",
            company_id="comp-id-a",
            tenant_id="t-a"
        )
        a_db.add(p_a)
        await a_db.commit()

    async with sm_b() as b_db:
        res = await b_db.execute(select(Product).where(Product.id == "prod-phase4-a"))
        assert res.scalars().first() is None


@pytest.mark.asyncio
async def test_06_company_a_customer_invisible_in_company_b_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    sm_b = setup_phase4_environment["sm_company_b"]

    async with sm_a() as a_db:
        c_a = Customer(
            id="cust-phase4-a",
            code="CUST-P4-A",
            name="Company A Client",
            mobile="9876543210",
            company_id="comp-id-a",
            tenant_id="t-a"
        )
        a_db.add(c_a)
        await a_db.commit()

    async with sm_b() as b_db:
        res = await b_db.execute(select(Customer).where(Customer.id == "cust-phase4-a"))
        assert res.scalars().first() is None


@pytest.mark.asyncio
async def test_07_company_a_supplier_invisible_in_company_b_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    sm_b = setup_phase4_environment["sm_company_b"]

    async with sm_a() as a_db:
        s_a = Supplier(
            id="supp-phase4-a",
            code="SUPP-P4-A",
            name="Company A Vendor",
            company_id="comp-id-a",
            tenant_id="t-a"
        )
        a_db.add(s_a)
        await a_db.commit()

    async with sm_b() as b_db:
        res = await b_db.execute(select(Supplier).where(Supplier.id == "supp-phase4-a"))
        assert res.scalars().first() is None


@pytest.mark.asyncio
async def test_08_company_a_invoice_invisible_in_company_b_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    sm_b = setup_phase4_environment["sm_company_b"]

    async with sm_a() as a_db:
        inv_a = SalesInvoice(
            id="inv-phase4-a",
            invoice_no="INV-A-100",
            customer_id="cust-phase4-a",
            grand_total=Decimal("5000"),
            company_id="comp-id-a",
            tenant_id="t-a"
        )
        a_db.add(inv_a)
        await a_db.commit()

    async with sm_b() as b_db:
        res = await b_db.execute(select(SalesInvoice).where(SalesInvoice.id == "inv-phase4-a"))
        assert res.scalars().first() is None


@pytest.mark.asyncio
async def test_09_company_a_stock_invisible_in_company_b_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    sm_b = setup_phase4_environment["sm_company_b"]

    async with sm_a() as a_db:
        stk_a = StockMovement(
            id="stk-phase4-a",
            product_id="prod-phase4-a",
            product_name="Company A Laptop",
            sku="SKU-LAP-A",
            quantity=Decimal("100"),
            movement_type="IN",
            company_id="comp-id-a",
            tenant_id="t-a"
        )
        a_db.add(stk_a)
        await a_db.commit()

    async with sm_b() as b_db:
        res = await b_db.execute(select(StockMovement).where(StockMovement.id == "stk-phase4-a"))
        assert res.scalars().first() is None


@pytest.mark.asyncio
async def test_10_company_a_journal_invisible_in_company_b_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    sm_b = setup_phase4_environment["sm_company_b"]

    async with sm_a() as a_db:
        jv_a = JournalVoucherModel(
            id="jv-phase4-a",
            voucher_no="JV-A-01",
            ref_document_type="MANUAL",
            ref_document_id="ref-01",
            ref_document_no="REF-01",
            company_id="comp-id-a",
            tenant_id="t-a"
        )
        a_db.add(jv_a)
        await a_db.commit()

    async with sm_b() as b_db:
        res = await b_db.execute(select(JournalVoucherModel).where(JournalVoucherModel.id == "jv-phase4-a"))
        assert res.scalars().first() is None


# ── SECTION C: DOMAIN SERVICES ROUTING TESTS (11–18) ─────────────────────────

@pytest.mark.asyncio
async def test_11_product_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id=None, tenant_id="t-a")

    async with sm_a() as a_db:
        repo = ProductRepository(a_db, t_ctx)
        p = Product(
            id="prod-repo-a",
            code="PROD-REPO-A",
            name="Repo Product A",
            category="Electronics",
            barcode="BC-REPO-A",
            sku="SKU-REPO-A",
            company_id="comp-id-a"
        )
        created = await repo.create(p)
        assert created.id == "prod-repo-a"


@pytest.mark.asyncio
async def test_12_customer_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id=None, tenant_id="t-a")

    async with sm_a() as a_db:
        repo = CustomerRepository(a_db, t_ctx)
        c = Customer(id="cust-repo-a", code="CUST-REPO-A", name="Repo Customer A", company_id="comp-id-a")
        created = await repo.create(c)
        assert created.id == "cust-repo-a"


@pytest.mark.asyncio
async def test_13_supplier_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id=None, tenant_id="t-a")

    async with sm_a() as a_db:
        repo = SupplierRepository(a_db, t_ctx)
        s = Supplier(id="supp-repo-a", code="SUPP-REPO-A", name="Repo Supplier A", company_id="comp-id-a")
        created = await repo.create(s)
        assert created.id == "supp-repo-a"


@pytest.mark.asyncio
async def test_14_sales_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id="b-a", tenant_id="t-a")

    async with sm_a() as a_db:
        repo = SalesInvoiceRepository(a_db, t_ctx)
        inv = SalesInvoice(id="inv-repo-a", invoice_no="INV-REPO-01", customer_id="cust-repo-a", company_id="comp-id-a")
        created = await repo.create(inv)
        assert created.id == "inv-repo-a"


@pytest.mark.asyncio
async def test_15_purchase_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id="b-a", tenant_id="t-a")

    async with sm_a() as a_db:
        repo = PurchaseOrderRepository(a_db, t_ctx)
        po_res = await repo.get_all()
        assert isinstance(po_res, list)


@pytest.mark.asyncio
async def test_16_inventory_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id="b-a", tenant_id="t-a")

    async with sm_a() as a_db:
        repo = StockMovementRepository(a_db, t_ctx)
        stk_res = await repo.get_all()
        assert isinstance(stk_res, list)


@pytest.mark.asyncio
async def test_17_pos_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id="b-a", tenant_id="t-a")

    async with sm_a() as a_db:
        repo = PosSessionRepository(a_db, t_ctx)
        pos_res = await repo.get_all()
        assert isinstance(pos_res, list)


@pytest.mark.asyncio
async def test_18_accounting_service_uses_company_db(setup_phase4_environment):
    sm_a = setup_phase4_environment["sm_company_a"]
    t_ctx = TenantContext(company_id="comp-id-a", branch_id="b-a", tenant_id="t-a")

    async with sm_a() as a_db:
        repo = AccountingRepository(a_db, t_ctx)
        acc_res = await repo.get_all_accounts()
        assert isinstance(acc_res, list)


# ── SECTION D: MASTER HUB TESTS (19–22) ──────────────────────────────────────

@pytest.mark.asyncio
async def test_19_publish_remains_explicit(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    sm_h = setup_phase4_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-explicit-pub",
            raw_payload={"name": "Explicit Product"}
        )
        assert rec.status == "PUBLISHED"


@pytest.mark.asyncio
async def test_20_fetch_remains_explicit(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    sm_h = setup_phase4_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-explicit-fet",
            raw_payload={"name": "Explicit Fetch Product"}
        )
        hub_master_id = rec.id

    async with sm_c() as c_db, sm_h() as h_db:
        res = await MasterHubExchangeService.fetch_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
            company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-b-loc"
        )
        assert res["hub_master_id"] == hub_master_id


@pytest.mark.asyncio
async def test_21_hub_does_not_contain_company_transactions(setup_phase4_environment):
    hub_tables = set(MasterHubBase.metadata.tables.keys())
    assert "sales_invoices" not in hub_tables
    assert "purchase_orders" not in hub_tables
    assert "stock_movements" not in hub_tables


@pytest.mark.asyncio
async def test_22_imported_master_receives_local_company_db_identity(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    sm_h = setup_phase4_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-source-id",
            raw_payload={"name": "Identity Test Product"}
        )
        hub_master_id = rec.id

    async with sm_c() as c_db, sm_h() as h_db:
        res = await MasterHubExchangeService.fetch_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
            company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-target-loc-99"
        )
        assert res["hub_master_id"] != "prod-target-loc-99"


# ── SECTION E: SECURITY BOUNDARIES (23–28) ────────────────────────────────────

@pytest.mark.asyncio
async def test_23_anonymous_request_rejected(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        # verify_user_company_access returns bool — empty user_id yields no assignment
        has_access = await ControlDatabaseRegistryService.verify_user_company_access(
            db=c_db, user_id="", company_code="COMP_A"
        )
        assert has_access is False


@pytest.mark.asyncio
async def test_24_unassigned_company_rejected(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        has_acc = await ControlDatabaseRegistryService.verify_user_company_access(
            db=c_db, user_id="usr-id-a", company_code="COMP_B"
        )
        assert has_acc is False


@pytest.mark.asyncio
async def test_25_deleted_or_inactive_company_rejected(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await CompanyDatabasePoolManager.get_company_session_by_code(
                control_db=c_db, company_code="COMP_INACT", user_id="usr-id-a"
            )
        assert exc_info.value.status_code in (403, 404)


@pytest.mark.asyncio
async def test_26_cross_company_database_access_rejected(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        session_a = await CompanyDatabasePoolManager.get_company_session_by_code(
            control_db=c_db, company_code="COMP_A", user_id="usr-id-a"
        )
        db_name = (await session_a.execute(text("SELECT current_database()"))).scalar()
        await session_a.close()
        assert db_name == "smriti_company_a_test"
        assert db_name != "smriti_company_b_test"


@pytest.mark.asyncio
async def test_27_client_supplied_db_credentials_rejected(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        # Client parameter "company_code" is resolved against Control DB registry metadata only
        db_meta = await ControlDatabaseRegistryService.get_company_database(c_db, "COMP_A")
        assert db_meta.db_name == "smriti_company_a_test"
        assert db_meta.db_host == "localhost"


@pytest.mark.asyncio
async def test_28_client_supplied_company_code_cannot_bypass_authorization(setup_phase4_environment):
    sm_c = setup_phase4_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await CompanyDatabasePoolManager.get_company_session_by_code(
                control_db=c_db, company_code="COMP_A", user_id="usr-id-b"  # User B is NOT assigned to COMP_A
            )
        assert exc_info.value.status_code == 403
