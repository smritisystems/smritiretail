"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-12
Classification: Phase 5 Multi-Company Consolidation, Migration Fan-Out & Backup Integration Test Suite (15 Tests)
"""

import os
import uuid
import tempfile
import pytest
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, text
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
from app.models.sales import SalesInvoice
from app.models.accounting import JournalVoucherModel, JournalLedgerEntryModel
from app.services.multi_company_consolidation_service import MultiCompanyConsolidationService
from app.services.company_migration_fanout_service import (
    CompanyMigrationFanoutService,
    CompanySchemaDriftDetector,
)
from app.services.company_database_backup_service import CompanyDatabaseBackupService

import pytest_asyncio


@pytest_asyncio.fixture
async def setup_phase5_environment():
    """
    Sets up isolated test databases:
    - smriti_test_control_db
    - smriti_company_a_test
    - smriti_company_b_test
    - smriti_master_hub_test
    """
    base_url = settings.DATABASE_URL
    if base_url.startswith("postgresql+asyncpg://"):
        raw_url = base_url.replace("postgresql+asyncpg://", "postgresql://")
    else:
        raw_url = base_url

    from urllib.parse import urlparse
    parsed = urlparse(raw_url)
    user = parsed.username or "postgres"
    password = parsed.password or "postgres"
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432

    pg_admin_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/postgres"
    admin_engine = create_async_engine(pg_admin_url, isolation_level="AUTOCOMMIT")

    async with admin_engine.connect() as conn:
        for db_name in ["smriti_test_control_db", "smriti_company_a_test", "smriti_company_b_test", "smriti_master_hub_test"]:
            res = await conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
            if not res.scalar():
                await conn.execute(text(f"CREATE DATABASE {db_name}"))

    await admin_engine.dispose()

    control_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/smriti_test_control_db"
    comp_a_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/smriti_company_a_test"
    comp_b_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/smriti_company_b_test"
    hub_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/smriti_master_hub_test"

    e_control = create_async_engine(control_url)
    e_comp_a = create_async_engine(comp_a_url)
    e_comp_b = create_async_engine(comp_b_url)
    e_hub = create_async_engine(hub_url)

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

    for engine in [e_control, e_comp_a, e_comp_b, e_hub]:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.execute(enums_ddl)

    async with e_control.begin() as conn:
        await conn.run_sync(ControlBase.metadata.create_all)

    async with e_comp_a.begin() as conn:
        await conn.run_sync(CompanyBase.metadata.create_all)

    async with e_comp_b.begin() as conn:
        await conn.run_sync(CompanyBase.metadata.create_all)

    async with e_hub.begin() as conn:
        await conn.run_sync(MasterHubBase.metadata.create_all)

    sm_control = async_sessionmaker(e_control, expire_on_commit=False, class_=AsyncSession)
    sm_company_a = async_sessionmaker(e_comp_a, expire_on_commit=False, class_=AsyncSession)
    sm_company_b = async_sessionmaker(e_comp_b, expire_on_commit=False, class_=AsyncSession)
    sm_master_hub = async_sessionmaker(e_hub, expire_on_commit=False, class_=AsyncSession)

    # Seed Control DB Metadata
    async with sm_control() as c_db:
        comp_a = ControlCompany(id="comp-id-a", company_code="COMP_A", name="Company A Corp")
        comp_b = ControlCompany(id="comp-id-b", company_code="COMP_B", name="Company B Corp")
        c_db.add_all([comp_a, comp_b])

        db_a = ControlCompanyDatabase(
            id="db-meta-a", company_id="comp-id-a", company_code="COMP_A",
            db_identifier="db-ident-a", db_name="smriti_company_a_test", db_host=host, db_port=port,
            db_user=user, encrypted_credentials=password, status=DatabaseRegistryStatus.ACTIVE.value
        )
        db_b = ControlCompanyDatabase(
            id="db-meta-b", company_id="comp-id-b", company_code="COMP_B",
            db_identifier="db-ident-b", db_name="smriti_company_b_test", db_host=host, db_port=port,
            db_user=user, encrypted_credentials=password, status=DatabaseRegistryStatus.ACTIVE.value
        )
        c_db.add_all([db_a, db_b])

        user_a = ControlUser(id="usr-id-a", username="user_a", email="user_a@smriti.com", hashed_password="dummy_hash_a", is_active=True)
        c_db.add(user_a)

        uca_a1 = ControlUserCompanyAssignment(id="uca-a1", user_id="usr-id-a", company_id="comp-id-a", company_code="COMP_A")
        uca_a2 = ControlUserCompanyAssignment(id="uca-a2", user_id="usr-id-a", company_id="comp-id-b", company_code="COMP_B")
        c_db.add_all([uca_a1, uca_a2])
        await c_db.commit()

    await CompanyDatabasePoolManager.close_all_pools()

    yield {
        "sm_control": sm_control,
        "sm_company_a": sm_company_a,
        "sm_company_b": sm_company_b,
        "sm_master_hub": sm_master_hub,
        "control_url": control_url,
    }

    await CompanyDatabasePoolManager.close_all_pools()
    for engine in [e_control, e_comp_a, e_comp_b, e_hub]:
        await engine.dispose()


# ── SECTION A: FINANCIAL CONSOLIDATION TESTS (1–4) ─────────────────────────

@pytest.mark.asyncio
async def test_01_financial_consolidation_fanout(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]
    sm_b = setup_phase5_environment["sm_company_b"]

    async with sm_a() as a_db:
        jv_a = JournalVoucherModel(id="jv-a1", voucher_no="JV-A1", ref_document_type="MANUAL", ref_document_id="ref-a1", ref_document_no="REF-A1", company_id=None)
        e_a1 = JournalLedgerEntryModel(id="le-a1", voucher_id="jv-a1", account_code="1001", account_name="Cash", debit=Decimal("50000"), credit=Decimal("0"))
        e_a2 = JournalLedgerEntryModel(id="le-a2", voucher_id="jv-a1", account_code="4001", account_name="Sales", debit=Decimal("0"), credit=Decimal("50000"))
        a_db.add_all([jv_a, e_a1, e_a2])
        await a_db.commit()

    async with sm_b() as b_db:
        jv_b = JournalVoucherModel(id="jv-b1", voucher_no="JV-B1", ref_document_type="MANUAL", ref_document_id="ref-b1", ref_document_no="REF-B1", company_id=None)
        e_b1 = JournalLedgerEntryModel(id="le-b1", voucher_id="jv-b1", account_code="1001", account_name="Cash", debit=Decimal("30000"), credit=Decimal("0"))
        e_b2 = JournalLedgerEntryModel(id="le-b2", voucher_id="jv-b1", account_code="4001", account_name="Sales", debit=Decimal("0"), credit=Decimal("30000"))
        b_db.add_all([jv_b, e_b1, e_b2])
        await b_db.commit()

    async with sm_c() as c_db:
        tb_res = await MultiCompanyConsolidationService.consolidate_financial_trial_balance(
            control_db=c_db, user_id="usr-id-a", company_codes=["COMP_A", "COMP_B"]
        )
        assert tb_res["participating_company_codes"] == ["COMP_A", "COMP_B"]
        assert tb_res["consolidated_balances"]["1001"] == 80000.0
        assert tb_res["consolidated_balances"]["4001"] == -80000.0


@pytest.mark.asyncio
async def test_02_sales_summary_consolidation_fanout(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]
    sm_b = setup_phase5_environment["sm_company_b"]

    async with sm_a() as a_db:
        inv_a = SalesInvoice(id="inv-a1", invoice_no="INV-A1", subtotal=Decimal("10000"), tax_total=Decimal("1800"), grand_total=Decimal("11800"), company_id=None)
        a_db.add(inv_a)
        await a_db.commit()

    async with sm_b() as b_db:
        inv_b = SalesInvoice(id="inv-b1", invoice_no="INV-B1", subtotal=Decimal("20000"), tax_total=Decimal("3600"), grand_total=Decimal("23600"), company_id=None)
        b_db.add(inv_b)
        await b_db.commit()

    async with sm_c() as c_db:
        sales_res = await MultiCompanyConsolidationService.consolidate_sales_summary(
            control_db=c_db, user_id="usr-id-a"
        )
        assert sales_res["group_total_invoices"] == 2
        assert sales_res["group_subtotal"] == Decimal("30000.00")
        assert sales_res["group_tax_total"] == Decimal("5400.00")
        assert sales_res["group_grand_total"] == Decimal("35400.00")


@pytest.mark.asyncio
async def test_03_inventory_summary_consolidation_fanout(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]
    sm_b = setup_phase5_environment["sm_company_b"]

    async with sm_a() as a_db:
        p_a = Product(id="prod-a1", code="PA1", name="Product A1", category="Elec", barcode="BC-A1", sku="SKU-A1", stock=50, company_id=None)
        a_db.add(p_a)
        await a_db.commit()

    async with sm_b() as b_db:
        p_b1 = Product(id="prod-b1", code="PB1", name="Product B1", category="Elec", barcode="BC-B1", sku="SKU-B1", stock=150, company_id=None)
        p_b2 = Product(id="prod-b2", code="PB2", name="Product B2", category="Elec", barcode="BC-B2", sku="SKU-B2", stock=200, company_id=None)
        b_db.add_all([p_b1, p_b2])
        await b_db.commit()

    async with sm_c() as c_db:
        inv_res = await MultiCompanyConsolidationService.consolidate_inventory_summary(
            control_db=c_db, user_id="usr-id-a"
        )
        assert inv_res["group_total_products"] == 3
        assert inv_res["group_total_stock_units"] == 400


@pytest.mark.asyncio
async def test_04_customer_balances_consolidation_fanout(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]
    sm_b = setup_phase5_environment["sm_company_b"]

    async with sm_a() as a_db:
        c_a = Customer(id="cust-a1", code="CUST-GLOBAL", name="Global Client", outstanding=Decimal("15000"), company_id=None)
        a_db.add(c_a)
        await a_db.commit()

    async with sm_b() as b_db:
        c_b = Customer(id="cust-b1", code="CUST-GLOBAL", name="Global Client", outstanding=Decimal("25000"), company_id=None)
        b_db.add(c_b)
        await b_db.commit()

    async with sm_c() as c_db:
        cust_res = await MultiCompanyConsolidationService.consolidate_customer_balances(
            control_db=c_db, user_id="usr-id-a"
        )
        assert cust_res["group_total_customers"] == 1
        assert cust_res["group_total_outstanding"] == Decimal("40000.00")
        assert len(cust_res["customer_summaries"][0]["company_breakdown"]) == 2


# ── SECTION B: SECURITY & BOUNDARY TESTS (5–6) ─────────────────────────────

@pytest.mark.asyncio
async def test_05_unassigned_company_code_rejected_in_fanout(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await MultiCompanyConsolidationService.consolidate_sales_summary(
                control_db=c_db, user_id="usr-id-a", company_codes=["COMP_UNASSIGNED"]
            )
        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_06_anonymous_user_fanout_rejected(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await MultiCompanyConsolidationService.consolidate_sales_summary(
                control_db=c_db, user_id="usr-nonexistent", company_codes=["COMP_A"]
            )
        assert exc_info.value.status_code == 403


# ── SECTION C: MIGRATION FANOUT & DRIFT TESTS (7–9) ─────────────────────────

@pytest.mark.asyncio
async def test_07_migration_fanout_synchronizes_all_company_dbs(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    async with sm_c() as c_db:
        results = await CompanyMigrationFanoutService.run_migration_fanout(control_db=c_db)
        assert len(results) == 2, f"Expected 2 results, got {len(results)}"
        assert all(r.success is True for r in results), f"Migration fanout errors: {[(r.company_code, r.success, r.message) for r in results]}"


@pytest.mark.asyncio
async def test_08_schema_drift_detector_reports_in_sync(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    async with sm_c() as c_db:
        report = await CompanySchemaDriftDetector.inspect_company_database_drift(
            control_db=c_db, company_code="COMP_A"
        )
        assert report.is_in_sync is True
        assert report.status == "IN_SYNC"
        assert len(report.missing_tables) == 0
        assert len(report.missing_columns) == 0


@pytest.mark.asyncio
async def test_09_schema_drift_detector_detects_missing_table(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]

    async with sm_a() as a_db:
        await a_db.execute(text("DROP TABLE customers CASCADE"))
        await a_db.commit()

    async with sm_c() as c_db:
        report = await CompanySchemaDriftDetector.inspect_company_database_drift(
            control_db=c_db, company_code="COMP_A"
        )
        assert report.is_in_sync is False
        assert report.status == "DRIFTED"
        assert "customers" in report.missing_tables


# ── SECTION D: ISOLATED BACKUP & RESTORE TESTS (10–13) ──────────────────────

@pytest.mark.asyncio
async def test_10_isolated_company_database_backup_generation(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]

    async with sm_a() as a_db:
        p = Product(id="prod-bk1", code="PBK1", name="Backup Prod", category="Elec", barcode="BC-BK1", sku="SKU-BK1", company_id=None)
        a_db.add(p)
        await a_db.commit()

    with tempfile.TemporaryDirectory() as tmp_dir:
        async with sm_c() as c_db:
            bk_meta = await CompanyDatabaseBackupService.backup_company_database(
                control_db=c_db, company_code="COMP_A", backup_dir=tmp_dir
            )
            assert os.path.exists(bk_meta.backup_file_path)
            assert bk_meta.file_size_bytes > 0
            assert len(bk_meta.sha256_checksum) == 64
            assert bk_meta.table_row_counts["products"] >= 1


@pytest.mark.asyncio
async def test_11_isolated_company_database_restore(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]

    async with sm_a() as a_db:
        p = Product(id="prod-rst1", code="PRST1", name="Restore Prod", category="Elec", barcode="BC-RST1", sku="SKU-RST1", company_id=None)
        a_db.add(p)
        await a_db.commit()

    with tempfile.TemporaryDirectory() as tmp_dir:
        async with sm_c() as c_db:
            bk_meta = await CompanyDatabaseBackupService.backup_company_database(
                control_db=c_db, company_code="COMP_A", backup_dir=tmp_dir
            )

        async with sm_a() as a_db:
            await a_db.execute(text("DELETE FROM products WHERE id='prod-rst1'"))
            await a_db.commit()

        async with sm_c() as c_db:
            res = await CompanyDatabaseBackupService.restore_company_database(
                control_db=c_db, company_code="COMP_A", backup_file_path=bk_meta.backup_file_path
            )
            assert res.success is True
            assert res.restored_tables_count > 0

        async with sm_a() as a_db:
            p_res = await a_db.execute(select(Product).where(Product.id == "prod-rst1"))
            assert p_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_12_backup_restore_does_not_affect_company_b_db(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]
    sm_b = setup_phase5_environment["sm_company_b"]

    async with sm_b() as b_db:
        p_b = Product(id="prod-b-safe", code="PBSAFE", name="Safe B Prod", category="Elec", barcode="BC-BSAFE", sku="SKU-BSAFE", company_id=None)
        b_db.add(p_b)
        await b_db.commit()

    with tempfile.TemporaryDirectory() as tmp_dir:
        async with sm_c() as c_db:
            bk_meta = await CompanyDatabaseBackupService.backup_company_database(
                control_db=c_db, company_code="COMP_A", backup_dir=tmp_dir
            )
            await CompanyDatabaseBackupService.restore_company_database(
                control_db=c_db, company_code="COMP_A", backup_file_path=bk_meta.backup_file_path
            )

    async with sm_b() as b_db:
        p_check = await b_db.execute(select(Product).where(Product.id == "prod-b-safe"))
        assert p_check.scalars().first() is not None


@pytest.mark.asyncio
async def test_13_backup_restore_does_not_affect_control_db(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]

    with tempfile.TemporaryDirectory() as tmp_dir:
        async with sm_c() as c_db:
            bk_meta = await CompanyDatabaseBackupService.backup_company_database(
                control_db=c_db, company_code="COMP_A", backup_dir=tmp_dir
            )
            await CompanyDatabaseBackupService.restore_company_database(
                control_db=c_db, company_code="COMP_A", backup_file_path=bk_meta.backup_file_path
            )

    async with sm_c() as c_db:
        comp_check = await c_db.execute(select(ControlCompany).where(ControlCompany.company_code == "COMP_A"))
        assert comp_check.scalars().first() is not None


# ── SECTION E: ADVANCED FILTERING & NONEXISTENT DB TESTS (14–15) ─────────────

@pytest.mark.asyncio
async def test_14_single_company_filtered_consolidation(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    sm_a = setup_phase5_environment["sm_company_a"]

    async with sm_a() as a_db:
        inv_a = SalesInvoice(id="inv-filt-a", invoice_no="INV-FILT-A", subtotal=Decimal("5000"), grand_total=Decimal("5000"), company_id=None)
        a_db.add(inv_a)
        await a_db.commit()

    async with sm_c() as c_db:
        res = await MultiCompanyConsolidationService.consolidate_sales_summary(
            control_db=c_db, user_id="usr-id-a", company_codes=["COMP_A"]
        )
        assert len(res["per_company_breakdown"]) == 1
        assert res["per_company_breakdown"][0]["company_code"] == "COMP_A"


@pytest.mark.asyncio
async def test_15_drift_detector_handles_nonexistent_company(setup_phase5_environment):
    sm_c = setup_phase5_environment["sm_control"]
    async with sm_c() as c_db:
        with pytest.raises(HTTPException) as exc_info:
            await CompanySchemaDriftDetector.inspect_company_database_drift(
                control_db=c_db, company_code="NONEXISTENT_COMP"
            )
        assert exc_info.value.status_code == 404
