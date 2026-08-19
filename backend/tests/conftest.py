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

        # 1. Insert test users into smritisys.users (Control Plane auth table)
        # users table has unique constraints on (username) and (email).
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

        # 3. Seed smriti_menus (Control Plane — exactly 34 immutable menus)
        ctrl_cur.execute("DELETE FROM smriti_menus WHERE id LIKE 'menu-%';")
        default_menus = [
            ("menu-dashboard", "Dashboard", "/dashboard", "core"),
            ("menu-inventory", "Inventory", "/inventory", "core"),
            ("menu-sales", "Sales & Billing", "/sales", "core"),
            ("menu-reports", "Reports Hub", "/reports", "core"),
        ]
        for mid, mtitle, mroute, mmodule in default_menus:
            ctrl_cur.execute("""
                INSERT INTO smriti_menus (id, uuid, company_id, title, route, module, is_active, is_deleted)
                VALUES (%s, %s, NULL, %s, %s, %s, true, false)
                ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
            """, (mid, str(uuid.uuid4()), mtitle, mroute, mmodule))

        for i in range(30):
            ctrl_cur.execute("""
                INSERT INTO smriti_menus (id, uuid, company_id, title, route, module, is_active, is_deleted)
                VALUES (%s, %s, NULL, %s, '/route', 'core', true, false)
                ON CONFLICT (id) DO NOTHING;
            """, (f"menu-{i}", str(uuid.uuid4()), f"Menu {i}"))

        # 4. Seed smriti_audit_log (Control Plane)
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
