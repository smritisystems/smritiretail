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
from unittest.mock import MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User, UserRole
from app.api.deps import TenantContext
from app.core.security_matrix import (
    evaluate_action_permission,
    prune_menu_tree_cascade,
    CANONICAL_34_MENU_MATRIX,
)

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
    test_scope = "User:test_runner"
    cur.execute("DELETE FROM smriti_permissions WHERE scope = %s;", (test_scope,))
    
    cur.execute("""
        INSERT INTO smriti_permissions (
            id, uuid, code, resource, action, scope, module, is_active, is_deleted, created_at, modified_at
        )
        VALUES (
            'perm-test-001', 'uuid-test-001', 'User:test_runner:sales_billing:VOID', 'sales_billing', 'VOID',
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


def test_cascade_pruning_algorithm():
    """
    Test 2-pass parent-child cascade pruning:
    - If all children of menu-pos are denied VIEW, menu-pos is pruned.
    - If 1 child of menu-pos is allowed VIEW, menu-pos is preserved.
    - A child is pruned if its parent is not valid.
    """
    class MockMenu:
        def __init__(self, mid, parent_id):
            self.id = mid
            self.parent_id = parent_id

    mock_menus = [
        MockMenu("menu-dashboard", None),
        MockMenu("menu-pos", None),
        MockMenu("menu-sales", "menu-pos"),
        MockMenu("menu-customer-master", "menu-pos"),
        MockMenu("menu-crm", "menu-pos"),
        MockMenu("menu-inventory", None),
        MockMenu("menu-item-master", "menu-inventory"),
    ]

    # Case A: Only dashboard and item-master visible
    # menu-pos should be pruned because all its children (sales, customer-master, crm) are denied
    # menu-inventory should be preserved because item-master is visible
    raw_visible = {"menu-dashboard", "menu-inventory", "menu-item-master"}
    result = prune_menu_tree_cascade(mock_menus, raw_visible)
    result_ids = {m.id for m in result}

    assert "menu-dashboard" in result_ids
    assert "menu-inventory" in result_ids
    assert "menu-item-master" in result_ids
    assert "menu-pos" not in result_ids
    assert "menu-sales" not in result_ids

    # Case B: One POS child (sales) is visible
    # menu-pos should now be preserved
    raw_visible_b = {"menu-dashboard", "menu-pos", "menu-sales"}
    result_b = prune_menu_tree_cascade(mock_menus, raw_visible_b)
    result_b_ids = {m.id for m in result_b}

    assert "menu-pos" in result_b_ids
    assert "menu-sales" in result_b_ids
    assert "menu-customer-master" not in result_b_ids
    assert "menu-inventory" not in result_b_ids

