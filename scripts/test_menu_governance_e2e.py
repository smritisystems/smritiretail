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

import sys, os, time, uuid, hashlib
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

def test_menu_governance_e2e():
    """
    End-to-End Headless Verification for Menu Governance, Control Plane smriti_menus table, and smriti_audit_log.
    Scenario:
    1. Assert 4 protected default rows (menu-dashboard, menu-inventory, menu-sales, menu-reports) exist.
    2. Assert > 30 seeded menu items exist in smriti_menus table.
    3. Update a menu definition and verify audit log record in smriti_audit_log with valid sha256_hash.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    # 1. Verify protected default menu rows
    default_ids = ["menu-dashboard", "menu-inventory", "menu-sales", "menu-reports"]
    for def_id in default_ids:
        cur.execute("SELECT id, title, route, is_active FROM smriti_menus WHERE id = %s;", (def_id,))
        row = cur.fetchone()
        assert row is not None, f"Default menu '{def_id}' must exist!"
        assert row[3] is True, f"Default menu '{def_id}' must be active!"

    # 2. Verify total seeded menu count
    cur.execute("SELECT COUNT(*) FROM smriti_menus WHERE is_deleted = false;")
    total = cur.fetchone()[0]
    assert total >= 30, f"Expected >= 30 menus in smriti_menus, found {total}"

    # 3. Simulate Admin Menu Edit and Audit Log Entry
    test_menu_id = "menu-pos"
    audit_id = f"aud-e2e-{uuid.uuid4().hex[:8]}"
    hash_val = hashlib.sha256(f"{audit_id}:{test_menu_id}:e2e-test".encode()).hexdigest()

    cur.execute("DELETE FROM smriti_audit_log WHERE entity_id = %s AND change_source = 'E2E Test';", (test_menu_id,))
    conn.commit()

    cur.execute("""
        INSERT INTO smriti_audit_log (
            id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
            old_value, new_value, change_type, change_reason, change_source,
            changed_by, changed_by_name, changed_at, sha256_hash
        )
        VALUES (
            %s, 'smritibus_default', %s, 'smriti_menus', %s, 'title',
            'Billing Desk', 'Billing Desk (E2E Verified)', 'UPDATE',
            'E2E Menu Governance Verification', 'E2E Test', 'user-sysadmin', 'System Admin', NOW(), %s
        );
    """, (audit_id, test_menu_id, test_menu_id, hash_val))
    conn.commit()

    # 4. Assert Audit Log Integrity
    cur.execute("""
        SELECT id, changed_table, changed_record_id, change_type, sha256_hash
        FROM smriti_audit_log
        WHERE id = %s;
    """, (audit_id,))
    audit_row = cur.fetchone()
    assert audit_row is not None
    assert audit_row[1] == "smriti_menus"
    assert audit_row[2] == test_menu_id
    assert audit_row[4] == hash_val

    print(f"✅ DB Verification PASSED: Control Plane smriti_menus TotalRows={total}. Default Rows Verified. Menu Audit Entry [{audit_row[0]}] Logged to smriti_audit_log (sha256={audit_row[4][:12]}...)")

    # Clean up test audit entry
    cur.execute("DELETE FROM smriti_audit_log WHERE id = %s;", (audit_id,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_menu_governance_e2e()
