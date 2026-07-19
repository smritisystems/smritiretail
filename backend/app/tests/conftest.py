"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
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

@pytest.fixture(scope="session", autouse=True)
async def seed_test_database(event_loop):
    """Seed default roles, permissions, and users once at the start of the test session."""
    from app.db.seed import seed_default_users
    await seed_default_users()

@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
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
        "smriti_user_roles", "smriti_security_audits",
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
    await seed_security_data(db_session)

async def seed_security_data(db_session: AsyncSession):
    """
    Populates role-permission security matrices inside the active test transaction.
    This restores necessary security policies immediately after truncation,
    allowing downstream REST API requests to pass RBAC/PBAC gates.
    """
    import uuid
    from sqlalchemy import text
    from app.core.permissions import MANIFEST

    # 1. Insert default company and branch
    await db_session.execute(text(
        "INSERT INTO companies (id, uuid, name, gst_number, is_active, is_deleted, created_at, modified_at) "
        "VALUES ('comp-default', :c_uuid, 'Default Company', '27ABCDE1234F1Z5', true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), {"c_uuid": str(uuid.uuid4())})
    
    await db_session.execute(text(
        "INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at) "
        "VALUES ('br-default', :b_uuid, 'comp-default', 'Default Branch', 'BR-DFT', true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), {"b_uuid": str(uuid.uuid4())})

    # 2. Insert roles in bulk
    roles = [
        ("role-sysadmin", "SYSADMIN", "System Administrator", "Global administrator with root system access", True),
        ("role-administrator", "ADMINISTRATOR", "Platform Administrator", "Platform admin managing system, security and roles", True),
        ("role-owner", "OWNER", "Business Owner", "Ultimate business owner with full company rights", True),
        ("role-company-admin", "COMPANY_ADMIN", "Company Administrator", "Company Administrator", True),
        ("role-branch-admin", "BRANCH_ADMIN", "Branch Administrator", "Branch Administrator", True),
        ("role-manager", "MANAGER", "Store Manager", "Full business manager role scoped to company and branch", True),
        ("role-supervisor", "SUPERVISOR", "Shift Supervisor", "Supervisor managing shift and cashier operations", True),
        ("role-staff", "STAFF", "General Staff", "General store staff with catalog and sales view access", True),
        ("role-cashier", "CASHIER", "Cashier Operator", "Point-of-Sale checkout terminal operator", True),
        ("role-reporter", "REPORT_USER", "Report Viewer", "Read-only auditor with report generation access", True),
        ("role-viewer", "VIEWER", "System Viewer", "Read-only guest viewer", True)
    ]
    roles_data = [
        {"r_id": rid, "r_uuid": str(uuid.uuid4()), "r_code": code, "r_name": name, "r_desc": desc, "r_is_sys": is_sys}
        for rid, code, name, desc, is_sys in roles
    ]
    await db_session.execute(text(
        "INSERT INTO smriti_roles (id, uuid, code, name, description, parent_role_id, is_system_role, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:r_id, :r_uuid, :r_code, :r_name, :r_desc, NULL, :r_is_sys, true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), roles_data)

    # 3. Insert permissions in bulk
    permissions_data = [
        {
            "p_id": f"perm-{perm.code.lower().replace('.', '-')}",
            "p_uuid": str(uuid.uuid4()),
            "p_code": perm.code,
            "p_res": perm.resource,
            "p_act": perm.action,
            "p_scope": perm.scope,
            "p_mod": perm.module,
            "p_desc": perm.description
        }
        for perm in MANIFEST
    ]
    await db_session.execute(text(
        "INSERT INTO smriti_permissions (id, uuid, code, resource, action, scope, module, description, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:p_id, :p_uuid, :p_code, :p_res, :p_act, :p_scope, :p_mod, :p_desc, true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), permissions_data)

    # 4. Insert policies in bulk
    policies = [
        ("pol-sales-mgmt", "POL-SALES-MGMT", "Sales Management Policy"),
        ("pol-sales-ops", "POL-SALES-OPS", "Sales Operations Policy"),
        ("pol-inventory-mgmt", "POL-INVENTORY-MGMT", "Inventory Management Policy"),
        ("pol-crm-mgmt", "POL-CRM-MGMT", "CRM Management Policy"),
        ("pol-purchase-mgmt", "POL-PURCHASE-MGMT", "Purchase Management Policy"),
        ("pol-reporting", "POL-REPORTING", "Reporting Policy"),
        ("pol-security-admin", "POL-SECURITY-ADMIN", "Security Administration Policy"),
        ("pol-core-view", "POL-CORE-VIEW", "Core View Policy")
    ]
    policies_data = [
        {"pol_id": pid, "pol_uuid": str(uuid.uuid4()), "pol_code": code, "pol_name": name, "pol_desc": name}
        for pid, code, name in policies
    ]
    await db_session.execute(text(
        "INSERT INTO smriti_policies (id, uuid, code, name, description, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:pol_id, :pol_uuid, :pol_code, :pol_name, :pol_desc, true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), policies_data)

    # 5. Map permissions to policies in bulk
    policy_perm_mappings = {
        "POL-SALES-MGMT": ["SALES.CREATE", "SALES.UPDATE", "SALES.APPROVE", "SALES.VIEW", "SALES.DELETE", "POS.CHECKOUT", "POS.OPEN_SHIFT", "POS.CLOSE_SHIFT"],
        "POL-SALES-OPS": ["SALES.CREATE", "SALES.VIEW", "POS.CHECKOUT", "POS.OPEN_SHIFT", "POS.CLOSE_SHIFT"],
        "POL-INVENTORY-MGMT": ["ITEM.CREATE", "ITEM.VIEW", "ITEM.UPDATE", "ITEM.DELETE"],
        "POL-CRM-MGMT": ["CRM.MANAGE_CUSTOMERS", "CRM.VIEW_LOYALTY"],
        "POL-PURCHASE-MGMT": ["PURCHASE.CREATE", "PURCHASE.UPDATE", "PURCHASE.APPROVE", "PURCHASE.VIEW", "PURCHASE.DELETE", "SUPPLIER.MANAGE"],
        "POL-REPORTING": ["REPORT.VIEW", "REPORT.EXPORT"],
        "POL-SECURITY-ADMIN": ["SECURITY.MANAGE_ROLES", "SECURITY.MANAGE_POLICIES", "SECURITY.VIEW_SETTINGS", "SYSTEM.CONFIG"],
        "POL-CORE-VIEW": ["SALES.VIEW", "ITEM.VIEW", "REPORT.VIEW"]
    }
    
    # Pre-fetch all policy and permission IDs to build mappings
    policies_res = await db_session.execute(text("SELECT id, code FROM smriti_policies"))
    policy_id_map = {row[1]: row[0] for row in policies_res.fetchall()}
    
    perms_res = await db_session.execute(text("SELECT id, code FROM smriti_permissions"))
    perm_id_map = {row[1]: row[0] for row in perms_res.fetchall()}

    mappings_data = []
    for policy_code, perm_codes in policy_perm_mappings.items():
        policy_id = policy_id_map.get(policy_code)
        if not policy_id:
            continue
        for p_code in perm_codes:
            perm_id = perm_id_map.get(p_code)
            if not perm_id:
                continue
            mappings_data.append({
                "m_id": str(uuid.uuid4()),
                "m_uuid": str(uuid.uuid4()),
                "policy_id": policy_id,
                "perm_id": perm_id
            })
    
    if mappings_data:
        await db_session.execute(text(
            "INSERT INTO smriti_policy_permissions (id, uuid, policy_id, permission_id, permission_type, created_at, modified_at) "
            "VALUES (:m_id, :m_uuid, :policy_id, :perm_id, 'ALLOW', now(), now()) "
            "ON CONFLICT DO NOTHING"
        ), mappings_data)

    # 6. Map policies to roles in bulk
    role_policy_mappings = {
        "ADMINISTRATOR": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING", "POL-SECURITY-ADMIN"],
        "OWNER": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
        "COMPANY_ADMIN": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
        "BRANCH_ADMIN": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
        "MANAGER": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
        "SUPERVISOR": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT"],
        "STAFF": ["POL-CORE-VIEW"],
        "CASHIER": ["POL-SALES-OPS", "POL-CRM-MGMT"],
        "REPORT_USER": ["POL-REPORTING"],
        "VIEWER": ["POL-CORE-VIEW"]
    }
    
    roles_res = await db_session.execute(text("SELECT id, code FROM smriti_roles"))
    role_id_map = {row[1]: row[0] for row in roles_res.fetchall()}

    role_policies_data = []
    for role_code, policy_codes in role_policy_mappings.items():
        role_id = role_id_map.get(role_code)
        if not role_id:
            continue
        for pol_code in policy_codes:
            policy_id = policy_id_map.get(pol_code)
            if not policy_id:
                continue
            role_policies_data.append({
                "rp_id": str(uuid.uuid4()),
                "rp_uuid": str(uuid.uuid4()),
                "role_id": role_id,
                "policy_id": policy_id
            })

    if role_policies_data:
        await db_session.execute(text(
            "INSERT INTO smriti_role_policies (id, uuid, role_id, policy_id, created_at, modified_at) "
            "VALUES (:rp_id, :rp_uuid, :role_id, :policy_id, now(), now()) "
            "ON CONFLICT DO NOTHING"
        ), role_policies_data)
    
    await db_session.commit()



