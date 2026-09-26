"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-11
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
try:
    from dotenv import dotenv_values
    root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
    if os.path.exists(root_env):
        for k, v in dotenv_values(root_env).items():
            if v is not None and k not in os.environ:
                os.environ[k] = v
except ImportError:
    pass

os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "CF511BC0139A3F1AF43D6B76639E933983B187C8ECBEE080F540C943E0CDB40A")
import asyncio
import re
import sys
import subprocess
import uuid
from urllib.parse import urlparse

import psycopg2

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.ctrl_seeder import ControlPlaneSeeder
import app.models  # noqa: F401


def _test_database_name() -> str:
    configured = os.getenv("SMRITI_TEST_DATABASE_NAME")
    name = configured.strip().lower() if configured else f"smriti_test_{os.getpid()}_{uuid.uuid4().hex[:10]}"
    if (
        name in {"smritisys", "smriti001"}
        or not re.fullmatch(r"smriti_test_[a-z0-9_]+", name)
    ):
        raise RuntimeError("Refusing test database lifecycle: target is not disposable and isolated.")
    return name


def _database_connection_parts() -> dict[str, object]:
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "host": os.getenv("POSTGRES_HOST") or parsed.hostname or "localhost",
        "port": int(os.getenv("POSTGRES_PORT") or parsed.port or 5432),
        "user": os.getenv("POSTGRES_USER") or parsed.username or "postgres",
        "password": os.getenv("POSTGRES_PASSWORD") or parsed.password or "postgres",
    }


def _ensure_schema_compatibility_sync(cur):
    """Apply all missing schema columns synchronously on the template database."""
    schema_fixes = [
        "ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS buying_price NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS master_values ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS master_values ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);",
        """CREATE TABLE IF NOT EXISTS customer_credit_ledger_entries (
            id VARCHAR(50) PRIMARY KEY, uuid UUID, company_id VARCHAR(50), branch_id VARCHAR(50),
            created_at TIMESTAMPTZ, modified_at TIMESTAMPTZ, created_by VARCHAR(50), updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE, is_deleted BOOLEAN DEFAULT FALSE, deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(50), version INTEGER DEFAULT 1, customer_id VARCHAR(50) NOT NULL,
            entry_date TIMESTAMPTZ NOT NULL, entry_type VARCHAR(20) NOT NULL, amount NUMERIC(15, 2) NOT NULL,
            balance_after NUMERIC(15, 2) NOT NULL, reference_type VARCHAR(50) NOT NULL,
            reference_id VARCHAR(100) NOT NULL, due_date DATE, notes TEXT,
            UNIQUE (reference_type, reference_id)
        );""",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS po_date DATE;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS delivery_date DATE;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS site_code VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS basic_total NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS is_interstate BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS total_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS billed_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS billed_value NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS pending_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS pending_value NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'UNFULFILLED';",
        "ALTER TABLE IF EXISTS sales_orders ADD COLUMN IF NOT EXISTS po_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS sr_no INTEGER;",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS article_no VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS ean VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS vendor_style VARCHAR(100);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS color VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'EA';",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS base_cost NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS delivery_date DATE;",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS site_code VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_invoice_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_return_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_quotation_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS purchase_order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS purchase_receipt_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS product_batch_stocks ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS po_quantity NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS invoice_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS pending_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(15, 2) DEFAULT 0.00;",
    ]
    for stmt in schema_fixes:
        try:
            cur.execute(stmt)
        except Exception:
            pass


@pytest.fixture(scope="session")
def session_template_database():
    """
    Session-scoped template database fixture.
    Runs all Alembic migrations and prerequisite DDLs ONCE at session start.
    All connections are then severed so PostgreSQL allows cloning via TEMPLATE.
    """
    template_name = f"smriti_test_template_{os.getpid()}_{uuid.uuid4().hex[:8]}"
    parts = _database_connection_parts()
    admin = psycopg2.connect(dbname="postgres", **parts)
    admin.autocommit = True
    try:
        from app.db.provisioning import provision_postgresql_database
        provision_result = asyncio.run(
            provision_postgresql_database(
                db_name=template_name,
                pg_host=parts["host"],
                pg_port=parts["port"],
                pg_user=parts["user"],
                pg_password=parts["password"],
            )
        )
        if provision_result.get("status") != "SUCCESS":
            raise RuntimeError(f"Template database provisioning failed: {provision_result}")

        from app.db.tenant_harness import EphemeralTenantHarness
        EphemeralTenantHarness.run_alembic_upgrade(template_name, "head")

        # Apply schema compatibility DDLs and default table fixes onto the template
        tmpl_conn = psycopg2.connect(dbname=template_name, **parts)
        tmpl_conn.autocommit = True
        with tmpl_conn.cursor() as cur:
            statements = [
                "ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);",
                "CREATE TABLE IF NOT EXISTS company_bank_accounts (id VARCHAR(50) PRIMARY KEY, company_id VARCHAR(50) NOT NULL, bank_name VARCHAR(255), account_no VARCHAR(50), ifsc VARCHAR(20), branch VARCHAR(255), is_default BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());",
                "CREATE TABLE IF NOT EXISTS company_policy_settings (company_id VARCHAR(50) NOT NULL, key VARCHAR(100) NOT NULL, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW(), updated_by VARCHAR(50), PRIMARY KEY (company_id, key));",
                "CREATE TABLE IF NOT EXISTS compliance_thresholds (key VARCHAR(100) NOT NULL, value TEXT NOT NULL, effective_from DATE NOT NULL, effective_to DATE NULL, source_reference VARCHAR(255), updated_by VARCHAR(50), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (key, effective_from));",
                "INSERT INTO compliance_thresholds (key, value, effective_from, source_reference, updated_by) SELECT 'EWAY_BILL_THRESHOLD_INR', '50000', DATE '2021-04-01', 'Rule 138 CGST Rules', 'system' WHERE NOT EXISTS (SELECT 1 FROM compliance_thresholds WHERE key = 'EWAY_BILL_THRESHOLD_INR' AND effective_from = DATE '2021-04-01');",
                "ALTER TABLE IF EXISTS sales_returns ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);",
                "ALTER TABLE IF EXISTS sales_returns ADD COLUMN IF NOT EXISTS policy_id VARCHAR(100);",
                "ALTER TABLE IF EXISTS sales_returns ADD COLUMN IF NOT EXISTS policy_version INTEGER;",
                "ALTER TABLE IF EXISTS sales_returns ADD COLUMN IF NOT EXISTS policy_scope VARCHAR(100);",
                "ALTER TABLE IF EXISTS sales_returns ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;",
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_idempotency_active ON sales_returns (company_id, branch_id, idempotency_key) WHERE is_deleted = false AND idempotency_key IS NOT NULL;",
                "ALTER TABLE IF EXISTS products ALTER COLUMN mrp SET DEFAULT 0.00;",
                "ALTER TABLE IF EXISTS products ALTER COLUMN gst_percentage SET DEFAULT 18.00;",
                "ALTER TABLE IF EXISTS products ALTER COLUMN hsn_code SET DEFAULT '6403';",
                "ALTER TABLE IF EXISTS products ALTER COLUMN mrp DROP NOT NULL;",
            ]
            for stmt in statements:
                try:
                    cur.execute(stmt)
                except Exception:
                    pass
            _ensure_schema_compatibility_sync(cur)
        tmpl_conn.close()

        # Sever all active connections to the template so PostgreSQL allows cloning via TEMPLATE
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid != pg_backend_pid()",
                (template_name,),
            )
        yield template_name
    finally:
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid != pg_backend_pid()",
                (template_name,),
            )
            cursor.execute(f'DROP DATABASE IF EXISTS "{template_name}"')
        admin.close()


@pytest.fixture
def disposable_company_database(session_template_database):
    """
    Function-scoped fixture: clones a genuinely fresh, uncontaminated database copy
    from the session-scoped template in milliseconds.
    """
    test_db = f"smriti_test_{os.getpid()}_{uuid.uuid4().hex[:8]}"
    parts = _database_connection_parts()
    admin = psycopg2.connect(dbname="postgres", **parts)
    admin.autocommit = True
    try:
        with admin.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE "{test_db}" WITH TEMPLATE "{session_template_database}"')
        url = (
            f"postgresql+asyncpg://{parts['user']}:{parts['password']}@"
            f"{parts['host']}:{parts['port']}/{test_db}"
        )
        yield url
    finally:
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid != pg_backend_pid()",
                (test_db,),
            )
            cursor.execute(f'DROP DATABASE IF EXISTS "{test_db}"')
        admin.close()


# Force SelectorEventLoop on Windows to avoid proactor loop lifecycle race conditions in tests
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

@pytest.fixture(scope="session", autouse=True)
def restore_baseline_after_tests():
    """Restores development baseline users and companies after pytest completes."""
    yield
    try:
        try:
            from app.db.seed_baseline_users import seed
        except ImportError:
            from backend.app.db.seed_baseline_users import seed
        import asyncio
        asyncio.run(seed())
    except Exception as e:
        print(f"[conftest] Post-test seed error: {e}")


@pytest.fixture
async def db_engine(disposable_company_database):
    """Async engine pointing to the freshly cloned test database."""
    engine = create_async_engine(disposable_company_database)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncSession:
    """Async session with automatic isolation via per-test database drop."""
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(autouse=True)
async def auto_override_company_db(db_session):
    from app.main import app
    from app.api.deps import get_db, get_company_db, get_current_user, get_tenant_context
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_company_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_tenant_context, None)


async def clear_db(db_session: AsyncSession = None):
    """
    Backward-compatibility stub for test suites.
    Since each test function now receives a genuinely fresh, isolated database
    cloned via PostgreSQL CREATE DATABASE ... TEMPLATE and dropped on teardown,
    expensive sequential table truncations are no longer required.
    """
    pass

