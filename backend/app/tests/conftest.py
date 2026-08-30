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
os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
import asyncio
import sys

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.ctrl_seeder import ControlPlaneSeeder
import app.models  # noqa: F401

# Force SelectorEventLoop on Windows to avoid proactor loop lifecycle race conditions in tests
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop to prevent event loop mismatch errors."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

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

async def _ensure_schema_compatibility(conn):
    """Apply all missing schema columns for backward compatibility with legacy test data."""
    from sqlalchemy import text
    schema_fixes = [
        "ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS buying_price NUMERIC(15, 2);",
        "ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2);",
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
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS po_quantity NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(15, 2) DEFAULT 0.00;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS invoice_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS pending_qty NUMERIC(15, 4) DEFAULT 0.0000;",
        "ALTER TABLE IF EXISTS sales_order_invoice_allocations ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(15, 2) DEFAULT 0.00;",
    ]
    for stmt in schema_fixes:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass

@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.DATABASE_URL)
    from app.db.base import Base
    from sqlalchemy import text
    import app.models.psv  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Apply schema compatibility fixes before any tests run
        await _ensure_schema_compatibility(conn)
        try:
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
                    await conn.execute(text(stmt))
                except Exception:
                    pass
        except Exception:
            pass
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine) -> AsyncSession:
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:  # type: ignore[attr-defined]  # SQLAlchemy async sessionmaker known limitation
        yield session
        await session.rollback()
        await clear_db(session)

@pytest.fixture(autouse=True)
async def auto_override_company_db(db_session):
    from app.main import app
    from app.api.deps import get_db, get_company_db
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_company_db, None)

async def clear_db(db_session: AsyncSession):
    """
    Cleans up all database tables in a strictly safe foreign-key order.
    Ensures that test runs across different modules do not conflict or cause integrity errors.
    """
    from sqlalchemy import text
    delete_order = [
        "sales_invoice_lines",
        "formula_definitions",
        "business_rule_definitions",
        "workflow_definitions",
        "policy_definitions",
        "loyalty_transactions",
        "loyalty_members",
        "loyalty_tiers",
        "spif_images",
        "product_images",
        "ecom_sync_logs",
        "ecom_channels",
        "bank_statement_lines",
        "general_ledger_entries",
        "journal_vouchers",
        "bank_statements",
        "fiscal_periods",
        "fiscal_years",
        "accounts",
        "integration_outbox_events",
        "approval_actions",
        "approval_requests",
        "approval_policies",
        "psv_sku_tracking",
        "psv_party_sku_tracking",
        "psv_stock_events",
        "psv_parties",
        "sales_return_items",
        "sales_returns",
        "product_identity",
        "barcode_providers",
        "identity_rules",
        "sales_order_items",
        "sales_orders",
        "sales_quotation_items",
        "sales_quotations",
        "sales_invoice_items",
        "sales_invoices",
        "shifts",
        "cash_registers",
        "purchase_order_items",
        "purchase_orders",
        "purchase_receipt_items",
        "purchase_receipts",
        "supplier_payments",
        "suppliers",
        "stock_movements",
        "inventory_batches",
        "inventory_serials",
        "inventory_stock",
        "inventory_bins",
        "inventory_zones",
        "inventory_locations",
        "warehouses",
        "stores",
        "products",
        "customers",
        "customer_groups",
        "workflow_events",
        "refresh_token_blacklist",
        "print_history",
        "barcode_layouts",
        "system_config",
        "system_settings",
        "data_exchange_tasks",
        "data_exchange_field_mappings",
        "user_preferences",
        "user_company_assignments",
        "user_branch_assignments",
        "report_schedules",
        "users",
        "master_values",
        "master_types",
        "invoice_document_artifacts",
        "tax_invoice_template_versions",
        "tax_invoice_templates",
        "branches",
        "company_financial_years",
        "company_tax_profiles",
        "company_database_registry",
        "company_center",
        "smriti_theme_variants",
        "smriti_themes",
        "smriti_workspace_profiles",
        "smriti_menus",
        "smriti_audit_log",
        "audit_logs",
        "tenants",
        "companies"
    ]
    await db_session.rollback()
    await db_session.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE;"))
    await db_session.commit()
    for tbl in delete_order:
        try:
            await db_session.execute(text(f"TRUNCATE TABLE {tbl} RESTART IDENTITY CASCADE;"))
        except Exception:
            try:
                async with db_session.begin_nested():
                    await db_session.execute(text(f"DELETE FROM {tbl};"))
            except Exception:
                pass
    await db_session.commit()

