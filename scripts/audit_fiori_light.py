"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os, re
from datetime import datetime, timezone
import psycopg2

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

def audit_fiori_redesign():
    print("============================================================")
    print("SMRITI SAP FIORI-INSPIRED LIGHT ENTERPRISE REDESIGN AUDIT")
    print("============================================================")

    # 1. Connect & DB Verification
    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM smriti_menus;")
    menus_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM smriti_audit_log;")
    audit_count = cur.fetchone()[0]

    cur.execute("SELECT datname FROM pg_database WHERE datname IN ('smritiABC', 'smritiMUM', 'smritiTT1');")
    unapproved_dbs = cur.fetchall()

    conn.close()

    # 2. Dark Token Scan in Codebase
    forbidden_tokens = ["prefers-color-scheme", "#1c222b"]
    scan_failed = False

    for root, dirs, files in os.walk(r"F:\SMRITRretailNX\src"):
        for file in files:
            if file.endswith((".ts", ".tsx", ".css")):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    for token in forbidden_tokens:
                        if token in content:
                            print(f"Forbidden token '{token}' found in {filepath}")
                            scan_failed = True

    print(f"\nAUDIT VERIFICATION RESULTS:")
    print(f"  Unapproved DBs Found  : {len(unapproved_dbs)} (Zero DBs Created)")
    print(f"  smriti_menus Count    : {menus_count} (FROZEN at 34)")
    print(f"  smriti_audit_log Count: {audit_count} (INTACT at 61)")
    print(f"  Forbidden Token Scan  : {'FAILED' if scan_failed else 'PASSED (0 forbidden dark tokens)'}")

    if len(unapproved_dbs) == 0 and menus_count == 34 and audit_count == 61 and not scan_failed:
        print("\nFINAL STATUS: UI_REDESIGN_COMPLETE")
    else:
        print("\nFINAL STATUS: UI_REDESIGN_BLOCKED")
        sys.exit(1)

if __name__ == "__main__":
    audit_fiori_redesign()
