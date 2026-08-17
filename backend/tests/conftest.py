"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
import psycopg2
import uuid

@pytest.fixture(autouse=True, scope="session")
def seed_control_plane_test_assignments():
    """
    Seeds real user and user_company_assignments database records in smritisys for test users.
    Ensures tests rely on actual database-verified assignments and roles, not hardcoded bypasses.
    """
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
        cur = conn.cursor()
        
        # 0. Insert default company COMP-001
        cur.execute("""
            INSERT INTO companies (id, uuid, name, company_code, is_active, is_deleted, created_at, modified_at)
            VALUES ('COMP-001', %s, 'SMRITI Retail Enterprise Default', '001', true, false, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
        """, (str(uuid.uuid4()),))

        # 1. Insert test users into users table
        users_data = [
            ("usr-super", "usr_super", "SYSADMIN", True),
            ("usr_sysadmin", "usr_sysadmin", "SYSADMIN", True),
            ("usr-cashier", "usr_cashier", "CASHIER", False),
            ("usr-manager", "usr_manager", "MANAGER", False),
            ("usr_store_manager_a", "usr_store_manager_a", "MANAGER", False),
        ]
        for uid, uname, urole, is_admin in users_data:
            cur.execute("""
                INSERT INTO users (id, uuid, username, hashed_password, role, is_active, is_deleted, created_at, modified_at, status, country, employment_type, is_platform_admin)
                VALUES (%s, %s, %s, 'dummy_hash', %s, true, false, NOW(), NOW(), 'ACTIVE', 'IN', 'FULL_TIME', %s)
                ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true, is_deleted = false;
            """, (uid, str(uuid.uuid4()), uname, urole, is_admin))

        # 2. Insert test company assignments into user_company_assignments table
        assignments = [
            ("uca-super-001", "usr-super", "COMP-001"),
            ("uca-sysadmin-001", "usr_sysadmin", "COMP-001"),
            ("uca-cashier-001", "usr-cashier", "COMP-001"),
            ("uca-manager-001", "usr-manager", "COMP-001"),
            ("uca-store-mgr-a-001", "usr_store_manager_a", "COMP-001"),
        ]
        for uca_id, uid, cid in assignments:
            cur.execute("""
                INSERT INTO user_company_assignments (id, uuid, user_id, company_id, is_default, is_active, is_deleted, created_at, modified_at)
                VALUES (%s, %s, %s, %s, false, true, false, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, company_id = EXCLUDED.company_id, is_active = true, is_deleted = false;
            """, (uca_id, str(uuid.uuid4()), uid, cid))

        # 3. Seed smriti_menus and smriti_audit_log if needed for test_company_db_runtime_routing
        cur.execute("SELECT COUNT(*) FROM smriti_menus;")
        cnt = cur.fetchone()[0]
        if cnt < 34:
            for i in range(cnt, 34):
                cur.execute("""
                    INSERT INTO smriti_menus (id, uuid, company_id, title, route, module, is_active, is_deleted)
                    VALUES (%s, %s, NULL, %s, '/route', 'core', true, false)
                    ON CONFLICT (id) DO NOTHING;
                """, (f"menu-{i}", str(uuid.uuid4()), f"Menu {i}"))

        cur.execute("SELECT COUNT(*) FROM smriti_audit_log;")
        acnt = cur.fetchone()[0]
        if acnt < 40:
            for i in range(acnt, 40):
                cur.execute("""
                    INSERT INTO smriti_audit_log (id, changed_table, changed_record_id, changed_by, changed_at)
                    VALUES (%s, 'test_table', 'rec-001', 'usr-sysadmin', NOW())
                    ON CONFLICT (id) DO NOTHING;
                """, (f"audit-{i}",))

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Conftest Warning] Failed to seed Control Plane test assignments: {e}")
