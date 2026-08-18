"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import psycopg2

COMPANY_NAME = "Tattly Threads"
COMP_ID = "COMP-001"
ADDRESS = "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003"
GST = "27AAXFT2508H1ZR"
EMAIL = "accounts@tattlythreads.com"
PHONE = ""
CITY = "Mumbai"
STATE = "Maharashtra"
PINCODE = "400003"

def inspect_and_update(db_name, skip_companies=False):
    print(f"\n{'='*60}")
    print(f"DATABASE: {db_name}")
    print(f"{'='*60}")
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    conn.autocommit = False
    cur = conn.cursor()

    # --- companies table ---
    if not skip_companies:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='companies' ORDER BY ordinal_position;
        """)
        comp_cols = [r[0] for r in cur.fetchall()]
        print(f"\ncompanies columns: {comp_cols}")

        cur.execute("SELECT id, name, gst_number FROM companies WHERE id = %s;", (COMP_ID,))
        row = cur.fetchone()
        if row:
            print(f"BEFORE companies: {row}")
            cur.execute("UPDATE companies SET name=%s, gst_number=%s WHERE id=%s;",
                        (COMPANY_NAME, GST, COMP_ID))
            print(f"  Updated companies rows: {cur.rowcount}")
            for col, val in [("address", ADDRESS), ("email", EMAIL), ("phone", PHONE),
                              ("city", CITY), ("state", STATE), ("pincode", PINCODE)]:
                if col in comp_cols:
                    cur.execute(f"UPDATE companies SET {col}=%s WHERE id=%s;", (val, COMP_ID))
                    print(f"  Updated companies.{col}")
            cur.execute("SELECT id, name, gst_number FROM companies WHERE id=%s;", (COMP_ID,))
            print(f"AFTER  companies: {cur.fetchone()}")
        else:
            print("  No companies row for COMP-001 in this DB.")

    # --- branches table ---
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='branches' ORDER BY ordinal_position;
    """)
    branch_cols = [r[0] for r in cur.fetchall()]
    if branch_cols:
        print(f"\nbranches columns: {branch_cols}")
        cur.execute("SELECT id, name FROM branches WHERE company_id = %s;", (COMP_ID,))
        branches = cur.fetchall()
        print(f"Branches: {branches}")
        for br_id, br_name in (branches or []):
            for col, val in [("address", ADDRESS), ("city", CITY), ("state", STATE),
                              ("pincode", PINCODE), ("phone", PHONE)]:
                if col in branch_cols:
                    cur.execute(f"UPDATE branches SET {col}=%s WHERE id=%s;", (val, br_id))
                    print(f"  branches[{br_id}].{col} updated")
            # Update gst_number on branch if present
            if "gst_number" in branch_cols:
                cur.execute("UPDATE branches SET gst_number=%s WHERE id=%s;", (GST, br_id))
                print(f"  branches[{br_id}].gst_number updated")
    else:
        print("  No 'branches' table in this DB.")

    conn.commit()
    conn.close()
    print(f"  COMMITTED {db_name}")

# smritisys — companies already updated for name+gst, now update branches there
inspect_and_update("smritisys", skip_companies=True)

# smriti001 — might have a companies copy
inspect_and_update("smriti001", skip_companies=False)

print("\n=== DONE ===")
