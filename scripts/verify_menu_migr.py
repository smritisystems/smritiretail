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

import sys, psycopg2

sys.stdout.reconfigure(encoding='utf-8')

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

TARGET_MODEL_V1_IDS = [
    "menu-dashboard", "menu-user-profile", "menu-wiki", "menu-about-smriti", "menu-dev-tracker",
    "menu-pos", "menu-sales", "menu-customer-master", "menu-crm", "menu-loyalty", "menu-profiles",
    "menu-inventory", "menu-item-master", "menu-barcode", "menu-stock-ledger", "menu-purchase", "menu-supplier-mgmt",
    "menu-business-ledger", "menu-accounting-sync", "menu-reports", "menu-report-designer",
    "menu-masters", "menu-ufe", "menu-formulas", "menu-psv", "menu-document-series", "menu-print-studio",
    "menu-print-history", "menu-terms-engine", "menu-data-exchange",
    "menu-staff-management", "menu-approval-matrix", "menu-company-setup", "menu-audit-logs"
]

def verify_migration():
    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    # 1. Exact 34-ID verification
    cur.execute("SELECT id FROM smriti_menus WHERE is_deleted = false ORDER BY id;")
    live_ids = sorted([r[0] for r in cur.fetchall()])
    expected_ids = sorted(TARGET_MODEL_V1_IDS)

    assert live_ids == expected_ids, f"Menu IDs mismatch! Missing: {set(expected_ids)-set(live_ids)}, Unexpected: {set(live_ids)-set(expected_ids)}"

    # 2. Orphan parent check
    cur.execute("""
        SELECT m.id, m.parent_id 
        FROM smriti_menus m 
        LEFT JOIN smriti_menus p ON m.parent_id = p.id 
        WHERE m.parent_id IS NOT NULL AND p.id IS NULL;
    """)
    orphans = cur.fetchall()
    assert len(orphans) == 0, f"Orphan parent references found: {orphans}"

    # 3. Protected defaults check
    protected = ["menu-dashboard", "menu-inventory", "menu-sales", "menu-reports"]
    for def_id in protected:
        cur.execute("SELECT id, title, route, is_active FROM smriti_menus WHERE id = %s;", (def_id,))
        row = cur.fetchone()
        assert row is not None and row[3] is True, f"Protected default '{def_id}' missing or inactive!"

    conn.close()

    print("============================================================")
    print("SMRITI MENU GOVERNANCE MIGRATION VERIFICATION PASSED")
    print("============================================================")
    print("  - Exact 34 Immutable IDs Verified (0 missing, 0 unexpected, 0 duplicate)")
    print("  - Orphan Parent Links Verified (0 orphans)")
    print("  - 4 Protected System Defaults Verified (100% intact)")
    print("STATUS: VERIFIED_PASS")

if __name__ == "__main__":
    verify_migration()
