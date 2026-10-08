"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import datetime
import psycopg2
from pathlib import Path

# Add backend directory to sys.path to access app.core.security
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.security import hash_password, verify_password

DB_URL = "postgresql://postgres:postgres@localhost:2781/smritisys"

USERS_CONFIG = [
    {
        "id": "usr-tt-ops-01",
        "username": "operations",
        "email": "operations@tattlythreads.com",
        "plain_pass": "Operations@123",
        "role": "MANAGER",
        "role_id": "role-inventory-manager",
        "display_name": "Operations Manager",
        "full_name": "Tattly Threads Operations",
        "department": "Operations & Logistics",
        "designation": "Operations Lead",
        "company_id": "COMP-001",
        "branch_id": "BR-MAIN-001",
        "status": "PendingPasswordChange",
    },
    {
        "id": "usr-tt-pur-01",
        "username": "purchase",
        "email": "purchase@tattlythreads.com",
        "plain_pass": "Purchase@123",
        "role": "MANAGER",
        "role_id": "role-purchase-executive",
        "display_name": "Purchase Executive",
        "full_name": "Tattly Threads Purchase",
        "department": "Procurement",
        "designation": "Purchase Manager",
        "company_id": "COMP-001",
        "branch_id": "BR-MAIN-001",
        "status": "PendingPasswordChange",
    },
    {
        "id": "usr-tt-md-01",
        "username": "md",
        "email": "md@tattlythreads.com",
        "plain_pass": "Md@12345",
        "role": "SYSADMIN",
        "role_id": "role-sysadmin",
        "display_name": "Managing Director",
        "full_name": "Tattly Threads MD",
        "department": "Executive Leadership",
        "designation": "Managing Director / Admin",
        "company_id": None,  # SYSADMIN is global across all companies
        "branch_id": None,
        "status": "PendingPasswordChange",
    },
]

def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc)

    print("=" * 60)
    print("STEP 1: Verify & Update COMP-001 Master Record")
    print("=" * 60)
    cur.execute("SELECT id, name, gst_number FROM companies WHERE id = 'COMP-001';")
    comp_row = cur.fetchone()
    print(f"Current COMP-001: {comp_row}")

    cur.execute("""
        UPDATE companies
        SET name = 'Tattly Threads',
            gst_number = '27AAXFT2508H1ZR',
            modified_at = %s
        WHERE id = 'COMP-001';
    """, (now,))
    print(f"Updated COMP-001 to 'Tattly Threads' (rows affected: {cur.rowcount})")

    cur.execute("SELECT id, name, company_id FROM branches WHERE id = 'BR-MAIN-001';")
    br_row = cur.fetchone()
    print(f"Branch BR-MAIN-001: {br_row}")

    print("\n" + "=" * 60)
    print("STEP 2: Provision & Sync Tattly Threads User Accounts")
    print("=" * 60)

    for cfg in USERS_CONFIG:
        hashed = hash_password(cfg["plain_pass"])
        cur.execute("SELECT id, username, email, role FROM users WHERE email = %s OR username = %s;", (cfg["email"], cfg["username"]))
        existing = cur.fetchone()

        if existing:
            user_id = existing[0]
            print(f"Updating existing user {cfg['email']} (id: {user_id})...")
            cur.execute("""
                UPDATE users
                SET username = %s,
                    email = %s,
                    hashed_password = %s,
                    role = %s,
                    role_id = %s,
                    is_active = True,
                    is_deleted = False,
                    company_id = %s,
                    branch_id = %s,
                    status = %s,
                    display_name = %s,
                    full_name = %s,
                    department = %s,
                    designation = %s,
                    modified_at = %s
                WHERE id = %s;
            """, (
                cfg["username"],
                cfg["email"],
                hashed,
                cfg["role"],
                cfg["role_id"],
                cfg["company_id"],
                cfg["branch_id"],
                cfg["status"],
                cfg["display_name"],
                cfg["full_name"],
                cfg["department"],
                cfg["designation"],
                now,
                user_id,
            ))
        else:
            user_id = cfg["id"]
            print(f"Creating new user {cfg['email']} (id: {user_id})...")
            cur.execute("""
                INSERT INTO users (
                    id, uuid, username, email, hashed_password, role, role_id,
                    is_active, is_deleted, company_id, branch_id, status,
                    display_name, full_name, department, designation, country,
                    employment_type, created_at, modified_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    True, False, %s, %s, %s,
                    %s, %s, %s, %s, 'India',
                    'Full-Time', %s, %s
                );
            """, (
                user_id,
                str(uuid.uuid4()),
                cfg["username"],
                cfg["email"],
                hashed,
                cfg["role"],
                cfg["role_id"],
                cfg["company_id"],
                cfg["branch_id"],
                cfg["status"],
                cfg["display_name"],
                cfg["full_name"],
                cfg["department"],
                cfg["designation"],
                now,
                now,
            ))

        # Maintain UserCompanyAssignment
        target_company = "COMP-001"
        target_branch = "BR-MAIN-001"
        cur.execute("""
            SELECT id FROM user_company_assignments
            WHERE user_id = %s AND company_id = %s AND is_deleted = false;
        """, (user_id, target_company))
        uca_row = cur.fetchone()
        if not uca_row:
            uca_id = f"uca-{uuid.uuid4().hex[:8]}"
            cur.execute("""
                INSERT INTO user_company_assignments (
                    id, uuid, company_id, user_id, branch_id, is_default,
                    created_at, modified_at, is_active, is_deleted, version
                ) VALUES (
                    %s, %s, %s, %s, %s, True,
                    %s, %s, True, False, 1
                );
            """, (uca_id, str(uuid.uuid4()), target_company, user_id, target_branch, now, now))
            print(f"  -> Added UserCompanyAssignment {uca_id} for {target_company}")

        # Maintain UserBranchAssignment
        cur.execute("""
            SELECT id FROM user_branch_assignments
            WHERE user_id = %s AND branch_id = %s AND is_deleted = false;
        """, (user_id, target_branch))
        uba_row = cur.fetchone()
        if not uba_row:
            uba_id = f"uba-{uuid.uuid4().hex[:8]}"
            cur.execute("""
                INSERT INTO user_branch_assignments (
                    id, uuid, company_id, branch_id, user_id, is_default,
                    created_at, modified_at, is_active, is_deleted, version
                ) VALUES (
                    %s, %s, %s, %s, %s, True,
                    %s, %s, True, False, 1
                );
            """, (uba_id, str(uuid.uuid4()), target_company, target_branch, user_id, now, now))
            print(f"  -> Added UserBranchAssignment {uba_id} for {target_branch}")

    print("\n" + "=" * 60)
    print("STEP 3: Phase 2 Schedule Registration (Auto-Email Setup)")
    print("=" * 60)
    # Check if a monthly schedule for accounts@tattlythreads.com already exists
    cur.execute("""
        SELECT id, schedule_name, report_code, cron_expression, recipients
        FROM report_schedules
        WHERE company_id = 'COMP-001' AND schedule_name ILIKE '%Monthly%';
    """)
    schedules = cur.fetchall()
    if schedules:
        print(f"Found existing monthly report schedule(s): {schedules}")
    else:
        # Create Monthly Sales & Purchase Report Schedule
        sch_id_sales = f"sch-tt-sales-m-{uuid.uuid4().hex[:6]}"
        recipients_json = '{"emails": ["accounts@tattlythreads.com"], "phone_numbers": []}'
        cur.execute("""
            INSERT INTO report_schedules (
                id, uuid, company_id, branch_id, report_id, report_name,
                frequency, delivery_channel, delivery_target, delivery_format,
                schedule_name, report_code, export_format, channels, recipients,
                cron_expression, status, is_active, is_deleted, version,
                created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-MAIN-001', 'RPT-SAL-001', 'Monthly Sales Report',
                'MONTHLY', 'EMAIL', 'accounts@tattlythreads.com', 'PDF',
                'Monthly Sales Report', 'RPT-SAL-001', 'PDF', '["EMAIL"]', %s,
                '0 9 1 * *', 'ACTIVE', True, False, 1,
                %s, %s
            );
        """, (sch_id_sales, str(uuid.uuid4()), recipients_json, now, now))
        print(f"Created Monthly Sales Report schedule: {sch_id_sales} (cron: 0 9 1 * * -> accounts@tattlythreads.com)")

        sch_id_pur = f"sch-tt-pur-m-{uuid.uuid4().hex[:6]}"
        cur.execute("""
            INSERT INTO report_schedules (
                id, uuid, company_id, branch_id, report_id, report_name,
                frequency, delivery_channel, delivery_target, delivery_format,
                schedule_name, report_code, export_format, channels, recipients,
                cron_expression, status, is_active, is_deleted, version,
                created_at, modified_at
            ) VALUES (
                %s, %s, 'COMP-001', 'BR-MAIN-001', 'RPT-PUR-001', 'Monthly Purchase Report',
                'MONTHLY', 'EMAIL', 'accounts@tattlythreads.com', 'PDF',
                'Monthly Purchase Report', 'RPT-PUR-001', 'PDF', '["EMAIL"]', %s,
                '0 9 1 * *', 'ACTIVE', True, False, 1,
                %s, %s
            );
        """, (sch_id_pur, str(uuid.uuid4()), recipients_json, now, now))
        print(f"Created Monthly Purchase Report schedule: {sch_id_pur} (cron: 0 9 1 * * -> accounts@tattlythreads.com)")

    conn.commit()
    conn.close()
    print("\nSUCCESS: All accounts provisioned and database sync completed!")

if __name__ == "__main__":
    main()
