"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-17
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import sys, os
import pytest
import psycopg2
import uuid
import asyncio

# Force SelectorEventLoop on Windows to prevent asyncpg socket concurrency collisions
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ============================================================
# Architecture-Compliant Connection URLs
# ============================================================
# Control Plane: governance metadata, users, companies, menus, audit log
CONTROL_PLANE_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"
# Company 001 Operational DB: products, customers, suppliers, invoices, orders
COMPANY_001_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"


@pytest.fixture(autouse=True, scope="function")
def seed_control_plane_test_assignments():
    """
    Seeds Control Plane (smritisys) records: users, companies, branches,
    user_company_assignments, company_database_registries, smriti_menus, smriti_audit_log.

    ARCHITECTURE RULE:
    - smritisys = Control Plane ONLY
    - Operational data (products, customers, suppliers, invoices) goes to smriti001
    - This fixture seeds ONLY governance/routing metadata into smritisys

    FAILURE POLICY (RC3 FIX):
    - Any failure in Control Plane seeding is a hard stop — it means the test
      environment is not correctly set up. Tests MUST NOT run with broken fixtures
      and produce misleading 401/403 errors deeper in HTTP calls.
    - Uses pytest.fail() to immediately terminate the session with a clear message.
    """
    # ================================================================
    # Seed Control Plane (smritisys)
    # ================================================================
    try:
        ctrl_conn = psycopg2.connect(CONTROL_PLANE_URL)
        ctrl_cur = ctrl_conn.cursor()
    except Exception as e:
        pytest.fail(
            f"[Conftest FATAL] Cannot connect to Control Plane database (smritisys).\n"
            f"  URL: {CONTROL_PLANE_URL}\n"
            f"  Error: {e}\n"
            f"  Resolution: Ensure PostgreSQL is running and smritisys database exists. "
            f"Run: alembic upgrade head"
        )

    try:
        # 0. Insert governance companies into smritisys (Control Plane)
        ctrl_cur.execute("""
            INSERT INTO companies (id, uuid, name, gst_number, company_code, is_active, is_deleted, created_at, modified_at)
            VALUES ('COMP-001', %s, 'Tattly Threads', '27AAXFT2508H1ZR', '001', true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = 'Tattly Threads', gst_number = '27AAXFT2508H1ZR', is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        ctrl_cur.execute("""
            INSERT INTO companies (id, uuid, name, company_code, is_active, is_deleted, created_at, modified_at)
            VALUES ('comp-default', %s, 'SMRITI Default Company', 'DEF', true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        # 0a. Insert default branch MAIN for COMP-001 into smritisys.
        # The branches table has unique constraints on BOTH (id) AND (code),
        # and a foreign key from users.branch_id.
        # Strategy: if a branch with code='MAIN' already exists (any id), update it in place.
        # If no such branch exists, insert with id='MAIN'.
        # We never DELETE because existing users.branch_id FKs would be violated.
        ctrl_cur.execute("SELECT id FROM branches WHERE code = 'MAIN' LIMIT 1;")
        existing_branch = ctrl_cur.fetchone()
        if existing_branch:
            ctrl_cur.execute(
                "UPDATE branches SET company_id = 'COMP-001', is_active = true, is_deleted = false WHERE code = 'MAIN';"
            )
        else:
            ctrl_cur.execute("""
                INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at)
                VALUES ('MAIN', %s, 'COMP-001', 'Main Branch', 'MAIN', true, false, NOW(), NOW());
            """, (str(uuid.uuid4()),))

        # 0b. Seed roles with role-based permissions in smritisys
        # roles table has unique constraint on (name) via ix_roles_name.
        ctrl_cur.execute("""
            INSERT INTO roles (id, uuid, name, permissions_json, is_system, is_active, is_deleted, created_at, modified_at)
            VALUES
                ('role-sysadmin', %s, 'SYSADMIN', '["*"]', true, true, false, NOW(), NOW()),
                ('role-manager', %s, 'MANAGER', '["*"]', true, true, false, NOW(), NOW()),
                ('role-cashier', %s, 'CASHIER', '["pos.sell", "inventory.view", "reports.view"]', true, true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET permissions_json = EXCLUDED.permissions_json, is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())))

        # 0c. Seed company_database_registries for COMP-001 -> smriti001
        # RC2 FIX: This row must always be present for get_company_db to resolve COMP-001.
        # On a fresh database, this row is NOT created by Alembic migrations.
        # The conftest seeds it here as part of the test environment bootstrap.
        # This requires smriti001 to exist as a physical PostgreSQL database.
        ctrl_cur.execute("""
            INSERT INTO company_database_registries
                (company_id, database_id, database_name, database_engine, host_reference,
                 port_reference, status, schema_version, provisioning_status, migration_status,
                 created_at, updated_at)
            VALUES
                ('COMP-001', %s, 'smriti001', 'postgresql', 'localhost', 5432,
                 'READY', '3.29.0', 'COMPLETED', 'UP_TO_DATE', NOW(), NOW())
            ON CONFLICT (company_id) DO UPDATE
                SET database_name = 'smriti001', status = 'READY', updated_at = NOW();
        """, (str(uuid.uuid4()),))

        # 1. Clean and insert test users into smritisys.users (Control Plane auth table)
        ctrl_cur.execute("DELETE FROM user_company_assignments WHERE id LIKE 'uca-%';")
        ctrl_cur.execute("DELETE FROM users WHERE username IN ('usr_super', 'usr_sysadmin', 'usr_cashier', 'usr_manager', 'usr_store_manager_a');")
        users_data = [
            ("usr-super", "usr_super", "SYSADMIN", True),
            ("usr_sysadmin", "usr_sysadmin", "SYSADMIN", True),
            ("usr-cashier", "usr_cashier", "CASHIER", False),
            ("usr-manager", "usr_manager", "MANAGER", False),
            ("usr_store_manager_a", "usr_store_manager_a", "MANAGER", False),
        ]
        for uid, uname, urole, is_admin in users_data:
            ctrl_cur.execute("""
                INSERT INTO users (id, uuid, username, hashed_password, role, is_active, is_deleted, created_at, modified_at, status, country, employment_type)
                VALUES (%s, %s, %s, 'dummy_hash', %s, true, false, NOW(), NOW(), 'ACTIVE', 'IN', 'FULL_TIME')
                ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true, is_deleted = false;
            """, (uid, str(uuid.uuid4()), uname, urole))

        # 2. Insert test company assignments into smritisys.user_company_assignments (Control Plane routing)
        # user_company_assignments has a partial unique index:
        #   ix_user_company_assignments_user_id_company_id_active ON (user_id, company_id) WHERE (is_deleted = false)
        # ON CONFLICT (id) alone is insufficient — must specify the partial index for correct upsert.
        assignments = [
            ("uca-super-001", "usr-super", "COMP-001"),
            ("uca-super-def", "usr-super", "comp-default"),
            ("uca-sysadmin-001", "usr_sysadmin", "COMP-001"),
            ("uca-cashier-001", "usr-cashier", "COMP-001"),
            ("uca-cashier-def", "usr-cashier", "comp-default"),
            ("uca-manager-001", "usr-manager", "COMP-001"),
            ("uca-store-mgr-a-001", "usr_store_manager_a", "COMP-001"),
        ]
        for uca_id, uid, cid in assignments:
            ctrl_cur.execute("""
                INSERT INTO user_company_assignments (id, uuid, user_id, company_id, is_default, is_active, is_deleted, created_at, modified_at)
                VALUES (%s, %s, %s, %s, false, true, false, NOW(), NOW())
                ON CONFLICT (user_id, company_id) WHERE (is_deleted = false)
                DO UPDATE SET is_active = true, is_deleted = false;
            """, (uca_id, str(uuid.uuid4()), uid, cid))

        # 3. Seed smriti_menus (Control Plane — exactly 34 canonical immutable menus)
        ctrl_cur.execute("DELETE FROM smriti_menus WHERE id LIKE 'menu-%';")
        canonical_menus = [
            ("menu-dashboard", "Dashboard & Executive Hub", "/dashboard", "Dashboard & Operations", None, 10, "DASHBOARD.ACCESS"),
            ("menu-user-profile", "My Profile Dashboard", "/user-profile", "Dashboard & Operations", None, 20, "PROFILE.ACCESS"),
            ("menu-wiki", "SMRITI Gyan Kendra", "/wiki", "System & Knowledge Base", None, 30, "WIKI.ACCESS"),
            ("menu-about-smriti", "About SMRITI Retail OS", "/about-smriti", "System & Knowledge Base", None, 40, "ABOUT.ACCESS"),
            ("menu-dev-tracker", "Dev Intelligence Center", "/dev-tracker", "System & Knowledge Base", None, 50, "SYSTEM.DEV"),
            ("menu-pos", "Billing Desk (Universal POS)", "/pos", "Sales & POS", None, 60, "POS.WORKSPACE.ACCESS"),
            ("menu-sales", "Sales Studio & Ledger", "/sales", "Sales & POS", "menu-pos", 70, "SALES.WORKSPACE.ACCESS"),
            ("menu-customer-master", "Customer Master Directory", "/customer-master", "Sales & POS", "menu-pos", 80, "CUSTOMER.WORKSPACE.ACCESS"),
            ("menu-crm", "CRM & Engagement Studio", "/crm", "Sales & POS", "menu-pos", 90, "CRM.WORKSPACE.ACCESS"),
            ("menu-loyalty", "Loyalty & Rewards Studio", "/loyalty", "Sales & POS", "menu-pos", 100, "LOYALTY.WORKSPACE.ACCESS"),
            ("menu-profiles", "POS Terminal Profiles", "/profiles", "Sales & POS", "menu-pos", 110, "TERMINALS.MANAGE"),
            ("menu-inventory", "Inventory Workspace", "/inventory", "Inventory & Purchase", None, 120, "INVENTORY.WORKSPACE.ACCESS"),
            ("menu-item-master", "Item Master Catalog", "/item-master", "Inventory & Purchase", "menu-inventory", 130, "ITEM.WORKSPACE.ACCESS"),
            ("menu-barcode", "Barcode Studio & Generator", "/barcode", "Inventory & Purchase", "menu-inventory", 140, "BARCODE.WORKSPACE.ACCESS"),
            ("menu-stock-ledger", "Stock Movements & Ledger", "/stock-ledger", "Inventory & Purchase", "menu-inventory", 150, "STOCK.WORKSPACE.ACCESS"),
            ("menu-purchase", "Purchase Studio & Orders", "/purchase", "Inventory & Purchase", "menu-inventory", 160, "PURCHASE.WORKSPACE.ACCESS"),
            ("menu-supplier-mgmt", "Supplier / Person Master", "/supplier-mgmt", "Inventory & Purchase", "menu-inventory", 170, "SUPPLIER.WORKSPACE.ACCESS"),
            ("menu-business-ledger", "Business Ledger & Statements", "/business-ledger", "Accounts", None, 180, "ACCOUNTS.WORKSPACE.ACCESS"),
            ("menu-accounting-sync", "Tally / ERP Accounting Sync", "/accounting-sync", "Accounts", None, 190, "ACCOUNTS.SYNC.EXECUTE"),
            ("menu-reports", "Reports Portal & Analytics", "/reports", "Reports", None, 200, "REPORT.WORKSPACE.ACCESS"),
            ("menu-report-designer", "Visual Report Designer", "/report-designer", "Reports", "menu-reports", 210, "REPORT.DESIGN.ACCESS"),
            ("menu-masters", "Configuration & Governance Hub", "/masters", "Configuration & Governance", None, 220, "CONFIG.GOVERNANCE.ACCESS"),
            ("menu-ufe", "Universal Field Explorer (UFE)", "/ufe", "Configuration & Governance", "menu-masters", 230, "UFE.ACCESS"),
            ("menu-formulas", "Formula & KPI Registry", "/formulas", "Configuration & Governance", "menu-masters", 240, "FORMULA.MANAGE"),
            ("menu-psv", "Channel Visibility Matrix (PSV)", "/psv", "Configuration & Governance", "menu-masters", 250, "PSV.MANAGE"),
            ("menu-document-series", "Numbering Engine & Series", "/document-series", "Configuration & Governance", "menu-masters", 260, "NUMBERING.MANAGE"),
            ("menu-print-studio", "Print Studio & Template Designer", "/print-studio", "Configuration & Governance", "menu-masters", 270, "PRINT.MANAGE"),
            ("menu-print-history", "Print Audit & History Logs", "/print-history", "Configuration & Governance", "menu-masters", 280, "PRINT.LOG.ACCESS"),
            ("menu-terms-engine", "Terms & Conditions Engine", "/terms-engine", "Configuration & Governance", "menu-masters", 290, "TERMS.MANAGE"),
            ("menu-data-exchange", "Data Exchange & Migration Hub", "/data-exchange", "Configuration & Governance", "menu-masters", 300, "DATA.IMPORT.ACCESS"),
            ("menu-staff-management", "Staff Management & Payroll", "/staff-management", "Administration", None, 310, "STAFF.WORKSPACE.ACCESS"),
            ("menu-approval-matrix", "Approval Matrix Governance", "/approval-matrix", "Administration", None, 320, "APPROVAL.MANAGE"),
            ("menu-company-setup", "Company Setup & Branch Config", "/company-setup", "Administration", None, 330, "COMPANY.SETUP.ACCESS"),
            ("menu-audit-logs", "System Audit Trail & Security Logs", "/audit-logs", "Administration", None, 340, "AUDIT.WORKSPACE.ACCESS"),
        ]

        # Insert parents first
        for mid, mtitle, mroute, mmodule, mparent, mseq, mperm in canonical_menus:
            if mparent is None:
                ctrl_cur.execute("""
                    INSERT INTO smriti_menus (id, uuid, company_id, title, route, module, parent_id, sequence, permission, is_active, is_deleted, created_at, modified_at)
                    VALUES (%s, %s, NULL, %s, %s, %s, NULL, %s, %s, true, false, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, route = EXCLUDED.route, module = EXCLUDED.module, sequence = EXCLUDED.sequence, permission = EXCLUDED.permission, is_active = true, is_deleted = false;
                """, (mid, str(uuid.uuid4()), mtitle, mroute, mmodule, mseq, mperm))

        # Insert children next
        for mid, mtitle, mroute, mmodule, mparent, mseq, mperm in canonical_menus:
            if mparent is not None:
                ctrl_cur.execute("""
                    INSERT INTO smriti_menus (id, uuid, company_id, title, route, module, parent_id, sequence, permission, is_active, is_deleted, created_at, modified_at)
                    VALUES (%s, %s, NULL, %s, %s, %s, %s, %s, %s, true, false, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, route = EXCLUDED.route, module = EXCLUDED.module, parent_id = EXCLUDED.parent_id, sequence = EXCLUDED.sequence, permission = EXCLUDED.permission, is_active = true, is_deleted = false;
                """, (mid, str(uuid.uuid4()), mtitle, mroute, mmodule, mparent, mseq, mperm))

        # 4. Seed smriti_permissions (Control Plane — baseline action permissions)
        baseline_perms = [
            ("perm-seed-001", "User:002:sales_billing:VOID", "sales_billing", "VOID", "User:002", False),
            ("perm-seed-002", "User:002:sales_billing:NEW", "sales_billing", "NEW", "User:002", True),
            ("perm-seed-003", "User:002:stock_goods_inwards:DELETE", "stock_goods_inwards", "DELETE", "User:002", False),
            ("perm-seed-004", "User:002:pos_cash_payouts:DELETE", "pos_cash_payouts", "DELETE", "User:002", False),
            ("perm-seed-005", "User:002:item_master:ADD", "item_master", "ADD", "User:002", True),
        ]
        for pid, pcode, pres, pact, pscope, pactive in baseline_perms:
            ctrl_cur.execute("""
                INSERT INTO smriti_permissions (id, uuid, code, resource, action, scope, module, is_active, is_deleted, created_at, modified_at)
                VALUES (%s, %s, %s, %s, %s, %s, 'core', %s, false, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active, is_deleted = false;
            """, (pid, str(uuid.uuid4()), pcode, pres, pact, pscope, pactive))

        # 5. Seed system_configs (Control Plane — security & housekeeping policies)
        import json as _json
        pass_json = _json.dumps({
            "max_password_length": 50,
            "min_password_length": 8,
            "min_uppercase": 1,
            "min_lowercase": 1,
            "min_numeric": 2,
            "passwords_to_remember": 5,
            "password_resetting_days": 60,
            "max_invalid_attempts": 5
        })
        hk_json = _json.dumps({
            "days_to_retain_activity_log": 90,
            "country_code": "+91",
            "remind_patch_updation_days": 14,
            "activate_company_wise_restrictions": True,
            "custom_reports_in_menu_screen": 5,
            "custom_reports_refresh_interval_seconds": 60
        })
        ctrl_cur.execute("""
            INSERT INTO system_configs (id, uuid, key, value, category, is_active, is_deleted, created_at, modified_at)
            VALUES ('cfg-sec-pass', %s, 'sec_password_config', %s, 'Security', true, false, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()), pass_json))

        ctrl_cur.execute("""
            INSERT INTO system_configs (id, uuid, key, value, category, is_active, is_deleted, created_at, modified_at)
            VALUES ('cfg-sec-hk', %s, 'sec_housekeeping_config', %s, 'Security', true, false, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()), hk_json))

        # 6. Seed smriti_audit_log (Control Plane)
        ctrl_cur.execute("SELECT COUNT(*) FROM smriti_audit_log;")
        acnt = ctrl_cur.fetchone()[0]
        if acnt < 40:
            for i in range(acnt, 40):
                ctrl_cur.execute("""
                    INSERT INTO smriti_audit_log (id, changed_table, changed_record_id, changed_by, changed_at)
                    VALUES (%s, 'test_table', 'rec-001', 'usr-sysadmin', NOW())
                    ON CONFLICT (id) DO NOTHING;
                """, (f"audit-{i}",))

        ctrl_conn.commit()
        ctrl_conn.close()

    except pytest.fail.Exception:
        # Re-raise pytest.fail() — it is not a fixture error, it's intentional
        raise
    except Exception as e:
        # Hard fail: Control Plane seeding failed. Do not silently continue.
        try:
            ctrl_conn.rollback()
            ctrl_conn.close()
        except Exception:
            pass
        pytest.fail(
            f"[Conftest FATAL] Failed to seed Control Plane (smritisys) test data.\n"
            f"  Error: {type(e).__name__}: {e}\n"
            f"  This means the test environment is not correctly set up.\n"
            f"  Resolution: Verify smritisys schema is fully migrated (alembic upgrade head), "
            f"all required tables exist, and COMP-001 / users / roles are insertable."
        )

    # ================================================================
    # Verify Company 001 Operational DB (smriti001) is accessible
    # ================================================================
    # RC2 FIX: smriti001 must exist as a physical PostgreSQL database.
    # It is NOT created by alembic migrations — it must be provisioned separately.
    # This block checks reachability and fails loudly if smriti001 is missing,
    # rather than letting tests fail later with cryptic 500/401 errors.
    #
    # If running in CI with a fresh environment, create smriti001 first:
    #   createdb -U postgres smriti001
    #   alembic --name company upgrade head  (or equivalent company-schema migration)
    # ================================================================
    try:
        comp_conn = psycopg2.connect(COMPANY_001_DB_URL)
        comp_cur = comp_conn.cursor()

        # Seed sample products for integration tests in Company DB
        comp_cur.execute("""
            INSERT INTO products (id, uuid, code, name, barcode, category, brand, company_id, branch_id, stock, reserved_stock, price, is_active, is_deleted, created_at, modified_at)
            VALUES ('prod-ch-24-g-black-36', %s, 'CH-24-G-BLACK-36', 'CH-24-G BLACK 36', 'BAR-CH-24-G', 'Footwear', 'CH', 'COMP-001', 'MAIN', 1000, 0, 1000.00, true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET company_id = 'COMP-001', branch_id = 'MAIN', stock = 1000, reserved_stock = 0, price = 1000.00, is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        comp_cur.execute("""
            INSERT INTO products (id, uuid, code, name, barcode, category, brand, company_id, branch_id, stock, reserved_stock, price, is_active, is_deleted, created_at, modified_at)
            VALUES ('prod-ch-01-a-cream-36', %s, 'CH-01-A-CREAM-36', 'CH-01-A CREAM 36', 'BAR-CH-01-A', 'Footwear', 'CH', 'COMP-001', 'MAIN', 1000, 0, 1000.00, true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET company_id = 'COMP-001', branch_id = 'MAIN', stock = 1000, reserved_stock = 0, price = 1000.00, is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        # Seed sample customer group and customer for integration tests in Company DB
        comp_cur.execute("""
            INSERT INTO customer_groups (id, uuid, company_id, branch_id, name, credit_limit, is_active, is_deleted, created_at, modified_at)
            VALUES ('cg-default', %s, 'COMP-001', 'MAIN', 'Default Group', 1000000.00, true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        comp_cur.execute("""
            INSERT INTO customers (id, uuid, code, name, mobile, email, customer_group_id, company_id, branch_id, outstanding, is_active, is_deleted, created_at, modified_at)
            VALUES ('cust-ril-1888', %s, 'CUST-RIL-1888', 'Reliance Retail Ltd', '9876543210', 'ril@test.com', 'cg-default', 'COMP-001', 'MAIN', 0.00, true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET company_id = 'COMP-001', branch_id = 'MAIN', customer_group_id = 'cg-default', outstanding = 0.00, is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        comp_conn.commit()
        comp_conn.close()

    except pytest.fail.Exception:
        raise
    except Exception as e:
        # Hard fail: smriti001 is inaccessible. Do not silently continue.
        try:
            comp_conn.rollback()
            comp_conn.close()
        except Exception:
            pass
        pytest.fail(
            f"[Conftest FATAL] Cannot connect to or seed Company 001 operational database (smriti001).\n"
            f"  URL: {COMPANY_001_DB_URL}\n"
            f"  Error: {type(e).__name__}: {e}\n"
            f"  This database is NOT created by Alembic migrations — it must be provisioned separately.\n"
            f"  Resolution for CI/fresh environment:\n"
            f"    1. psql -U postgres -c 'CREATE DATABASE smriti001;'\n"
            f"    2. Run company-schema Alembic migration against smriti001\n"
            f"  smriti001 must have the full company operational schema (products, customers, etc.)"
        )
