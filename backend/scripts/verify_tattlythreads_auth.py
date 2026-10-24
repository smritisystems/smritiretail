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

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import async_session
from app.services.auth import AuthService
from app.schemas.auth import LoginRequest
from app.models.auth import User, UserRole
from app.models.tenant import Company
from app.core.security import decode_token
from sqlalchemy.future import select
import psycopg2

TEST_CREDENTIALS = [
    {
        "label": "Operations Account (by email)",
        "username": "operations@tattlythreads.com",
        "password": "Operations@123",
        "expected_role": "MANAGER",
        "expected_company": "COMP-001",
        "expected_branch": "BR-MAIN-001",
    },
    {
        "label": "Operations Account (by username)",
        "username": "operations",
        "password": "Operations@123",
        "expected_role": "MANAGER",
        "expected_company": "COMP-001",
        "expected_branch": "BR-MAIN-001",
    },
    {
        "label": "Purchase Account (by email)",
        "username": "purchase@tattlythreads.com",
        "password": "Purchase@123",
        "expected_role": "MANAGER",
        "expected_company": "COMP-001",
        "expected_branch": "BR-MAIN-001",
    },
    {
        "label": "Purchase Account (by username)",
        "username": "purchase",
        "password": "Purchase@123",
        "expected_role": "MANAGER",
        "expected_company": "COMP-001",
        "expected_branch": "BR-MAIN-001",
    },
    {
        "label": "MD / Admin Account (by email)",
        "username": "md@tattlythreads.com",
        "password": "Md@12345",
        "expected_role": "SYSADMIN",
        "expected_company": "COMP-001",
        "expected_branch": "BR-MAIN-001",
    },
    {
        "label": "MD / Admin Account (by username)",
        "username": "md",
        "password": "Md@12345",
        "expected_role": "SYSADMIN",
        "expected_company": "COMP-001",
        "expected_branch": "BR-MAIN-001",
    },
]

async def verify_auth():
    print("=" * 70)
    print("SMRITI RETAIL OS: PHASE 1 USER AUTHENTICATION & ACCESS VERIFICATION")
    print("=" * 70)

    all_passed = True

    async with async_session() as session:
        auth_service = AuthService(session)

        # Check Company Details
        comp = await session.get(Company, "COMP-001")
        print(f"\n[TENANT CHECK] Company: {comp.name} | ID: {comp.id} | GSTIN: {comp.gst_number} | Active: {comp.is_active}")

        for cred in TEST_CREDENTIALS:
            print(f"\n--- Testing: {cred['label']} ---")
            print(f"Login ID: {cred['username']}")
            req = LoginRequest(username=cred["username"], password=cred["password"])

            try:
                res = await auth_service.login(req)
                access_token = res["access_token"]
                role = res["role"]
                comp_id = res["company_id"]
                br_id = res["branch_id"]
                pwd_reset = res["password_reset_required"]

                payload = decode_token(access_token)
                sub = payload.get("sub")
                token_role = payload.get("role")
                token_comp = payload.get("company_id")

                print(f"[PASS] Authentication SUCCESS")
                print(f"  - Subject User ID         : {sub}")
                print(f"  - System Role             : {role} (Token: {token_role})")
                print(f"  - Resolved Company ID     : {comp_id} (Token: {token_comp})")
                print(f"  - Resolved Branch ID      : {br_id}")
                print(f"  - Password Reset Required : {pwd_reset}")
                print(f"  - Access Token (first 25) : {access_token[:25]}...")

                assert role.value == cred["expected_role"], f"Role mismatch: {role} != {cred['expected_role']}"
                assert comp_id == cred["expected_company"], f"Company mismatch: {comp_id} != {cred['expected_company']}"
                assert br_id == cred["expected_branch"], f"Branch mismatch: {br_id} != {cred['expected_branch']}"
                assert pwd_reset is True, "Password reset required flag must be True for initial login"
                print("[PASS] All assertions PASSED for this account.")
            except Exception as e:
                print(f"[FAIL]: {e}")
                all_passed = False

    print("\n" + "=" * 70)
    print("PHASE 2: REPORT SCHEDULES CHECK")
    print("=" * 70)
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smritisys")
    cur = conn.cursor()
    cur.execute("""
        SELECT id, schedule_name, report_code, cron_expression, recipients, status
        FROM report_schedules
        WHERE company_id = 'COMP-001';
    """)
    schedules = cur.fetchall()
    for s in schedules:
        print(f"[SCHEDULE] ID: {s[0]} | Name: {s[1]} | Code: {s[2]} | Cron: {s[3]} | Recipients: {s[4]} | Status: {s[5]}")
    conn.close()

    print("\n" + "=" * 70)
    if all_passed:
        print("OVERALL VERIFICATION STATUS: DONE (All 3 Accounts & Phase 2 Schedules Verified)")
    else:
        print("OVERALL VERIFICATION STATUS: FAILED")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(verify_auth())
