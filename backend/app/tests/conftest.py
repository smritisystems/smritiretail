"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-11
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import os
import sys

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Pre-seed required env vars for the test process before settings loads.
# These are safe test-only values; real credentials must be set in CI secrets or .env.
os.environ.setdefault("JWT_SECRET_KEY", "smriti_test_jwt_key_do_not_use_in_production")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "smriti_test_vault_key_do_not_use_in_production")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "smriti_test_internal_key_do_not_use_in_production")

from app.core.config import settings

# Force SelectorEventLoop on Windows to avoid proactor loop lifecycle race conditions in tests
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop to prevent event loop mismatch errors."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.DATABASE_URL)
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

async def clear_db(db_session: AsyncSession):
    """
    Cleans up all database tables atomically using TRUNCATE ... RESTART IDENTITY CASCADE.
    This is the only reliable way to ensure complete isolation between tests:
    - CASCADE handles FK chains automatically regardless of deletion order
    - RESTART IDENTITY resets all sequences so ID generation is predictable
    - Single atomic statement prevents partial-clean states on error
    """
    from sqlalchemy import text

    # All first-party transactional tables — names verified from __tablename__ in models.
    # TRUNCATE ... CASCADE handles all FK chains automatically.
    # We query pg_tables first so tables not yet migrated don't crash the setup.
    wanted = {
        "sales_return_items", "sales_returns",
        "sales_invoice_items", "sales_invoices",
        "sales_order_items", "sales_orders",
        "sales_quotation_items", "sales_quotations",
        "purchase_receipt_items", "purchase_receipts",
        "purchase_order_items", "purchase_orders",
        "supplier_payments", "suppliers",
        "psv_sku_tracking", "psv_parties",
        "product_identities", "barcode_providers", "identity_rules",
        "stock_movements", "products",
        "shifts", "cash_registers",
        "customers", "customer_groups", "pricing_groups",
        "workflow_events",
        "refresh_token_blacklist",
        "print_histories", "barcode_layouts",
        "print_profiles", "print_templates",
        "system_configs",
        "document_series", "numbering_audit_logs",
        "approval_workflow_logs",
        "tally_configs",
        "terms_clauses", "terms_defaults", "terms_snapshots",
        "data_exchange_field_mappings", "data_exchange_tasks",
        "report_schedules",
        "attribute_definitions", "attribute_groups",
        "category_attribute_group_mappings", "variant_templates",
        "purchase_jurisdiction_configs", "purchase_reorder_configs",
        "user_branch_assignments", "user_company_assignments", "user_store_assignments",
        "roles",
        "users",
        "stores", "warehouses",
        "master_values", "master_types",
        "branches", "companies",
        "smriti_roles", "smriti_permissions", "smriti_policies",
        "smriti_role_policies", "smriti_policy_permissions",
        "smriti_user_roles", "smriti_menus", "smriti_security_audits",
    }

    # Find which of our wanted tables actually exist in this schema
    result = await db_session.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    )
    existing = {row[0] for row in result.fetchall()}
    to_truncate = wanted & existing

    if to_truncate:
        table_list = ", ".join(to_truncate)
        await db_session.execute(
            text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE")
        )
    await db_session.commit()

