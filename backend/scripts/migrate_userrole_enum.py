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

import psycopg2

new_roles = [
    "ADMIN",
    "STORE_MANAGER",
    "BRANCH_ADMIN",
    "INVENTORY_MANAGER",
    "PURCHASE_EXECUTIVE",
    "SALES_EXECUTIVE",
    "ACCOUNTANT",
    "AUDITOR",
    "HR_EXECUTIVE",
]

dbs = ["smritisys", "smriti001", "smriti002", "smriti003", "smriti004"]

def migrate():
    for db_name in dbs:
        try:
            conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:2781/{db_name}")
            conn.autocommit = True
            cur = conn.cursor()
            for r in new_roles:
                try:
                    cur.execute(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{r}'")
                except Exception as ex:
                    print(f"[{db_name}] {r} error: {ex}")
            cur.execute("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'userrole'")
            labels = [row[0] for row in cur.fetchall()]
            print(f"[{db_name}] userrole labels ({len(labels)}): {labels}")
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[{db_name}] conn error: {e}")

if __name__ == "__main__":
    migrate()
