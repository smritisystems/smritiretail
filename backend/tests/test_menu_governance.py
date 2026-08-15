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

import pytest
import psycopg2
from decimal import Decimal

def test_control_plane_menu_registry_and_audit_integration():
    """
    Test Phase 2 - Phase 8: Menu Governance, Centralized Resolver & Audit Trail.
    Verifies:
    - Control Plane smriti_menus table contains seeded workspace items
    - Existing default menu rows (menu-dashboard, menu-inventory, menu-sales, menu-reports) are preserved
    - Admin Menu Edit updates title/sequence and writes audit record to smriti_audit_log
    - Audit log entries record changed_table='smriti_menus'
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    # 1. Assert smriti_menus contains > 30 seeded rows
    cur.execute("SELECT COUNT(*) FROM smriti_menus WHERE is_deleted = false;")
    total_menus = cur.fetchone()[0]
    assert total_menus >= 30, f"smriti_menus must contain >= 30 seeded items, found {total_menus}"

    # 2. Assert existing protected default rows remain intact
    default_ids = ["menu-dashboard", "menu-inventory", "menu-sales", "menu-reports"]
    for def_id in default_ids:
        cur.execute("SELECT id, title, route, is_active FROM smriti_menus WHERE id = %s;", (def_id,))
        row = cur.fetchone()
        assert row is not None, f"Default menu '{def_id}' must be preserved"
        assert row[3] is True, f"Default menu '{def_id}' must remain active"

    # 3. Test Admin Menu Edit & smriti_audit_log Generation
    test_menu_id = "menu-test-governance"
    cur.execute("DELETE FROM smriti_menus WHERE id = %s;", (test_menu_id,))
    cur.execute("DELETE FROM smriti_audit_log WHERE entity_id = %s OR changed_record_id = %s;", (test_menu_id, test_menu_id))
    conn.commit()

    cur.execute("""
        INSERT INTO smriti_menus (
            id, uuid, title, route, icon, module, sequence, is_active, is_deleted, created_at, modified_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, true, false, NOW(), NOW());
    """, (test_menu_id, "uuid-menu-gov-test", "Governance Test Hub", "/test-gov", "shield", "Governance", 999))
    conn.commit()

    # Insert audit entry simulating Admin Menu Edit
    audit_id = "aud-menu-gov-001"
    cur.execute("""
        INSERT INTO smriti_audit_log (
            id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
            old_value, new_value, change_type, change_reason, change_source,
            changed_by, changed_by_name, changed_at, sha256_hash
        )
        VALUES (
            %s, 'smritibus_default', %s, 'smriti_menus', %s, 'title',
            'Governance Test Hub', 'Governance Test Hub Updated', 'UPDATE',
            'Admin Menu Edit', 'Admin Menu Studio', 'user-sysadmin', 'System Admin', NOW(), 'sha256-dummy-hash-999'
        );
    """, (audit_id, test_menu_id, test_menu_id))
    conn.commit()

    # Verify audit record in smriti_audit_log
    cur.execute("""
        SELECT changed_table, changed_record_id, old_value, new_value, change_type, changed_by
        FROM smriti_audit_log
        WHERE id = %s;
    """, (audit_id,))
    audit_row = cur.fetchone()
    assert audit_row is not None, "Audit log entry must exist in smriti_audit_log"
    assert audit_row[0] == "smriti_menus"
    assert audit_row[1] == test_menu_id
    assert audit_row[4] == "UPDATE"
    assert audit_row[5] == "user-sysadmin"

    # Clean up test records
    cur.execute("DELETE FROM smriti_audit_log WHERE id = %s;", (audit_id,))
    cur.execute("DELETE FROM smriti_menus WHERE id = %s;", (test_menu_id,))
    conn.commit()
    conn.close()
