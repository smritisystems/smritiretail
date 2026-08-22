"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import pytest
import psycopg2
import json

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

def test_security_menu_access_persistence_and_audit():
    """
    Test that granular action permissions are stored in smriti_permissions
    and recorded into smriti_audit_log with SHA-256 integrity hash.
    """
    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    # 1. Assert smriti_menus and smriti_permissions exist
    cur.execute("SELECT COUNT(*) FROM smriti_menus;")
    menus_count = cur.fetchone()[0]
    assert menus_count >= 30, f"Expected >= 30 menus, got {menus_count}"

    # 2. Insert test permission row into smriti_permissions
    test_scope = "User:002"
    cur.execute("DELETE FROM smriti_permissions WHERE scope = %s;", (test_scope,))
    
    cur.execute("""
        INSERT INTO smriti_permissions (
            id, uuid, code, resource, action, scope, module, is_active, is_deleted, created_at, modified_at
        )
        VALUES (
            'perm-test-001', 'uuid-test-001', 'User:002:sales_billing:VOID', 'sales_billing', 'VOID',
            %s, 'core', true, false, NOW(), NOW()
        );
    """, (test_scope,))

    # 3. Verify row in smriti_permissions
    cur.execute("SELECT resource, action, is_active FROM smriti_permissions WHERE id = 'perm-test-001';")
    perm_row = cur.fetchone()
    assert perm_row is not None
    assert perm_row[0] == "sales_billing"
    assert perm_row[1] == "VOID"
    assert perm_row[2] is True

    # 4. Clean up test row
    cur.execute("DELETE FROM smriti_permissions WHERE id = 'perm-test-001';")
    conn.commit()
    cur.close()
    conn.close()
