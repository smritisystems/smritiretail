"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-11
Modified     : 2026-07-19
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
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine) -> AsyncSession:
    from app.db.session import active_tenant_ctx, active_security_context
    active_tenant_ctx.set(None)
    active_security_context.set(None)
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:  # type: ignore[attr-defined]  # SQLAlchemy async sessionmaker known limitation
        yield session
        await session.rollback()
    active_tenant_ctx.set(None)
    active_security_context.set(None)

async def clear_db(db_session: AsyncSession):
    """
    Cleans up all database tables atomically using TRUNCATE ... RESTART IDENTITY CASCADE.
    """
    from sqlalchemy import text

    wanted = {
        "sales_return_items", "sales_returns",
        "sales_invoice_items", "sales_invoices",
        "sales_order_items", "sales_orders",
        "sales_quotation_items", "sales_quotations",
        "purchase_receipt_items", "purchase_receipts",
        "purchase_order_items", "purchase_orders",
        "supplier_payments",
        "supplier_contacts", "supplier_addresses", "supplier_bank_details",
        "supplier_credit_profiles", "supplier_payment_profiles",
        "supplier_compliance_profiles", "supplier_tax_profiles",
        "suppliers",
        "psv_sku_tracking", "psv_parties",
        "product_identities", "barcode_providers", "identity_rules",
        "stock_movements", "products",
        "shifts", "cash_registers",
        "customer_addresses", "customer_contacts", "customer_credit_profiles",
        "customer_tax_profiles", "customer_channel_preferences",
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
        "print_layout_settings", "store_departments", "user_auth_tokens",
        "purchase_jurisdiction_configs", "purchase_reorder_configs",
        "user_branch_assignments", "user_company_assignments", "user_store_assignments",
        "roles",
        "users",
        "stores", "warehouses",
        "master_values", "master_types",
        "branches", "companies",
        "smriti_roles", "smriti_permissions", "smriti_permission_sets",
        "smriti_role_permission_sets", "smriti_permission_set_permissions", "smriti_user_roles",
        "smriti_menus", "smriti_security_audits",
        "smriti_approval_policies", "smriti_approval_matrices", "smriti_approval_steps",
        "smriti_approval_conditions", "smriti_approval_assignments", "smriti_approval_requests",
        "smriti_approval_actions", "smriti_approval_histories", "smriti_approval_delegations",
        "smriti_approval_escalations", "smriti_approval_comments", "smriti_approval_outbox",
        "smriti_service_accounts", "smriti_api_keys", "smriti_api_key_permission_sets", "smriti_api_key_logs",
        "stock_transfer_order_items", "stock_transfer_orders", "stock_rebalancing_recommendations",
        "gst_reconciliation_records", "product_identities", "barcode_providers", "identity_rules",
        "smriti_universal_identities", "smriti_identity_rules", "smriti_identity_rule_versions", "smriti_identity_outbox",
        "gstr_filing_records", "gstr_outbox_logs", "screen_layout_templates"
    }

    # Verify which of the tables actually exist in postgres currently
    existing_res = await db_session.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    ))
    existing = {row[0] for row in existing_res.fetchall()}
    to_truncate = [t for t in wanted if t in existing]
    if to_truncate:
        tables_str = ", ".join(to_truncate)
        await db_session.execute(text(f"TRUNCATE TABLE {tables_str} RESTART IDENTITY CASCADE"))
        await db_session.commit()
    await seed_security_data(db_session)


async def seed_security_data(db_session: AsyncSession):
    """
    Populates role-permission security matrices inside the active test transaction.
    """
    from sqlalchemy import text
    import uuid

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

    # 2. Insert roles
    roles = [
        ("role-sysadmin", "SYSADMIN", "System Administrator"),
        ("role-administrator", "ADMINISTRATOR", "Platform Administrator"),
        ("role-owner", "OWNER", "Company Owner"),
        ("role-company-admin", "COMPANY_ADMIN", "Company Administrator"),
        ("role-branch-admin", "BRANCH_ADMIN", "Branch Administrator"),
        ("role-manager", "MANAGER", "Branch Manager"),
        ("role-supervisor", "SUPERVISOR", "Supervisor"),
        ("role-staff", "STAFF", "Staff User"),
        ("role-cashier", "CASHIER", "Cashier Operator"),
        ("role-reporter", "REPORT_USER", "Reports Portal User"),
        ("role-viewer", "VIEWER", "Read Only Viewer")
    ]
    roles_data = [
        {"role_id": rid, "role_uuid": str(uuid.uuid4()), "role_code": code, "role_name": name}
        for rid, code, name in roles
    ]
    await db_session.execute(text(
        "INSERT INTO smriti_roles (id, uuid, code, name, description, is_system_role, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:role_id, :role_uuid, :role_code, :role_name, 'SMRITI default system role.', true, true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), roles_data)

    # 3. Insert permissions in bulk
    from app.core.permissions import MANIFEST
    permissions_data = []
    for p in MANIFEST:
        permissions_data.append({
            "p_id": f"perm-{p.code.lower().replace('.', '-')}",
            "p_uuid": str(uuid.uuid4()),
            "p_code": p.code,
            "p_resource": p.resource,
            "p_action": p.action,
            "p_scope": p.scope,
            "p_module": p.module,
            "p_desc": p.description
        })
    await db_session.execute(text(
        "INSERT INTO smriti_permissions (id, uuid, code, resource, action, scope, module, description, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:p_id, :p_uuid, :p_code, :p_resource, :p_action, :p_scope, :p_module, :p_desc, true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), permissions_data)

    # 4. Insert permission sets in bulk
    permission_sets = [
        ("pol-sales-mgmt", "POL-SALES-MGMT", "Sales Management Policy"),
        ("pol-sales-ops", "POL-SALES-OPS", "Sales Operations Policy"),
        ("pol-inventory-mgmt", "POL-INVENTORY-MGMT", "Inventory Management Policy"),
        ("pol-crm-mgmt", "POL-CRM-MGMT", "CRM Management Policy"),
        ("pol-purchase-mgmt", "POL-PURCHASE-MGMT", "Purchase Management Policy"),
        ("pol-reporting", "POL-REPORTING", "Reporting Policy"),
        ("pol-security-admin", "POL-SECURITY-ADMIN", "Security Administration Policy"),
        ("pol-core-view", "POL-CORE-VIEW", "Core View Policy")
    ]
    permission_sets_data = [
        {"ps_id": pid, "ps_uuid": str(uuid.uuid4()), "ps_code": code, "ps_name": name, "ps_desc": name}
        for pid, code, name in permission_sets
    ]
    await db_session.execute(text(
        "INSERT INTO smriti_permission_sets (id, uuid, code, name, description, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:ps_id, :ps_uuid, :ps_code, :ps_name, :ps_desc, true, false, now(), now()) "
        "ON CONFLICT (id) DO NOTHING"
    ), permission_sets_data)

    # 5. Map permissions to permission sets in bulk
    permission_set_mappings = {
        "POL-SALES-MGMT": ["SALES.CREATE", "SALES.UPDATE", "SALES.APPROVE", "SALES.VIEW", "SALES.DELETE", "POS.CHECKOUT", "POS.OPEN_SHIFT", "POS.CLOSE_SHIFT"],
        "POL-SALES-OPS": ["SALES.CREATE", "SALES.VIEW", "POS.CHECKOUT", "POS.OPEN_SHIFT", "POS.CLOSE_SHIFT"],
        "POL-INVENTORY-MGMT": ["ITEM.CREATE", "ITEM.VIEW", "ITEM.UPDATE", "ITEM.DELETE"],
        "POL-CRM-MGMT": ["CRM.MANAGE_CUSTOMERS", "CRM.VIEW_LOYALTY"],
        "POL-PURCHASE-MGMT": ["PURCHASE.CREATE", "PURCHASE.UPDATE", "PURCHASE.APPROVE", "PURCHASE.VIEW", "PURCHASE.DELETE", "SUPPLIER.MANAGE"],
        "POL-REPORTING": ["REPORT.VIEW", "REPORT.EXPORT"],
        "POL-SECURITY-ADMIN": ["SECURITY.MANAGE_ROLES", "SECURITY.MANAGE_POLICIES", "SECURITY.VIEW_SETTINGS", "SYSTEM.CONFIG"],
        "POL-CORE-VIEW": ["SALES.VIEW", "ITEM.VIEW", "REPORT.VIEW"]
    }
    
    # Pre-fetch all permission set and permission IDs to build mappings
    ps_res = await db_session.execute(text("SELECT id, code FROM smriti_permission_sets"))
    ps_id_map = {row[1]: row[0] for row in ps_res.fetchall()}
    
    perms_res = await db_session.execute(text("SELECT id, code FROM smriti_permissions"))
    perm_id_map = {row[1]: row[0] for row in perms_res.fetchall()}

    mappings_data = []
    for ps_code, perm_codes in permission_set_mappings.items():
        ps_id = ps_id_map.get(ps_code)
        if not ps_id:
            continue
        for p_code in perm_codes:
            perm_id = perm_id_map.get(p_code)
            if not perm_id:
                continue
            mappings_data.append({
                "m_id": str(uuid.uuid4()),
                "m_uuid": str(uuid.uuid4()),
                "permission_set_id": ps_id,
                "perm_id": perm_id
            })
    
    if mappings_data:
        await db_session.execute(text(
            "INSERT INTO smriti_permission_set_permissions (id, uuid, permission_set_id, permission_id, permission_type, created_at, modified_at) "
            "VALUES (:m_id, :m_uuid, :permission_set_id, :perm_id, 'ALLOW', now(), now()) "
            "ON CONFLICT DO NOTHING"
        ), mappings_data)

    # 6. Map permission sets to roles in bulk
    role_permission_set_mappings = {
        "SYSADMIN": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING", "POL-SECURITY-ADMIN"],
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

    role_ps_data = []
    for role_code, ps_codes in role_permission_set_mappings.items():
        role_id = role_id_map.get(role_code)
        if not role_id:
            continue
        for ps_code in ps_codes:
            ps_id = ps_id_map.get(ps_code)
            if not ps_id:
                continue
            role_ps_data.append({
                "rp_id": str(uuid.uuid4()),
                "rp_uuid": str(uuid.uuid4()),
                "role_id": role_id,
                "permission_set_id": ps_id
            })

    if role_ps_data:
        await db_session.execute(text(
            "INSERT INTO smriti_role_permission_sets (id, uuid, role_id, permission_set_id, created_at, modified_at) "
            "VALUES (:rp_id, :rp_uuid, :role_id, :permission_set_id, now(), now()) "
            "ON CONFLICT DO NOTHING"
        ), role_ps_data)
    
    await db_session.commit()
