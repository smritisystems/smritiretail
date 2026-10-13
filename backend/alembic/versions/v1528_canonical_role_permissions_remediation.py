"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.1
Created      : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Alembic Migration: v1528_canonical_role_permissions_remediation

Remediates system role permissions alignment identified in the User/Staff Creation Audit:

1. DEFECT-001 (Severity: HIGH — staff_mgmt.CREATE and related permissions format alignment)
   Root cause: System roles (role-store-manager, role-branch-admin, role-hr-executive, and others)
   were seeded with legacy dot-notation permissions (e.g. 'staff.manage', 'pos.sell') that do not
   match the canonical security_matrix format ('resource.ACTION').
   evaluate_action_permission() checks for 'staff_mgmt.CREATE' — returning False for non-SYSADMIN/MANAGER
   callers unless role permissions match.
   Fix: Seed all system roles with canonical resource.ACTION permissions.

2. ARCHITECTURAL INVARIANT:
   Per Phase 1E RBAC decision R-3 Option B (and backend/tests/t_rbac_roles.py Scenario M),
   both 'role-sales-executive' (scoped system role) and 'role-sales_executive' (legacy baseline
   wildcard role) must remain present and active. The user creation service explicitly resolves
   UserRole.SALES_EXECUTIVE to 'role-sales-executive' via ROLE_ENUM_TO_ID.

Rollback: Reverts system roles permissions_json to previous values.
"""

import json
from alembic import op

# revision identifiers, used by Alembic
revision = 'v1528_canonical_role_permissions_remediation'
down_revision = 'v1527_attendance_index_and_device_key'
branch_labels = None
depends_on = None


# ── Canonical permissions using security_matrix resource.ACTION format ─────────
CANONICAL_ROLE_PERMISSIONS = {
    "role-store-manager": ["*"],
    "role-branch-admin": [
        "pos_workspace.VIEW", "pos_workspace.NEW",
        "sales_billing.VIEW", "sales_billing.NEW", "sales_billing.EDIT", "sales_billing.RETURN",
        "inventory_workspace.VIEW", "inventory_workspace.ADD", "inventory_workspace.EDIT",
        "item_master.VIEW",
        "stock_ledger.VIEW", "stock_ledger.ADD", "stock_ledger.EDIT",
        "reports_portal.VIEW",
        "staff_mgmt.VIEW", "staff_mgmt.CREATE", "staff_mgmt.EDIT",
        "settings.VIEW",
        "purchase_studio.VIEW",
    ],
    "role-hr-executive": [
        "staff_mgmt.VIEW", "staff_mgmt.CREATE", "staff_mgmt.EDIT", "staff_mgmt.DEACTIVATE",
        "reports_portal.VIEW",
    ],
    "role-inventory-manager": [
        "inventory_workspace.VIEW", "inventory_workspace.ADD", "inventory_workspace.EDIT",
        "item_master.VIEW", "item_master.ADD", "item_master.EDIT",
        "stock_ledger.VIEW", "stock_ledger.ADD", "stock_ledger.EDIT",
        "barcode_studio.VIEW", "barcode_studio.ADD",
        "purchase_studio.VIEW", "purchase_studio.ADD", "purchase_studio.EDIT",
        "supplier_mgmt.VIEW",
        "reports_portal.VIEW",
    ],
    "role-purchase-executive": [
        "purchase_studio.VIEW", "purchase_studio.ADD", "purchase_studio.EDIT",
        "supplier_mgmt.VIEW", "supplier_mgmt.ADD", "supplier_mgmt.EDIT",
        "inventory_workspace.VIEW",
        "item_master.VIEW",
        "stock_ledger.VIEW",
        "reports_portal.VIEW",
    ],
    "role-sales-executive": [
        "pos_workspace.VIEW", "pos_workspace.NEW",
        "sales_billing.VIEW", "sales_billing.NEW", "sales_billing.EDIT", "sales_billing.RETURN",
        "customer_master.VIEW", "customer_master.ADD", "customer_master.EDIT",
        "crm_studio.VIEW",
        "loyalty_rewards.VIEW",
        "item_master.VIEW",
        "promotions_studio.VIEW",
        "reports_portal.VIEW",
    ],
    "role-cashier": [
        "pos_workspace.VIEW", "pos_workspace.NEW",
        "sales_billing.VIEW", "sales_billing.NEW", "sales_billing.RETURN",
        "item_master.VIEW",
        "inventory_workspace.VIEW",
        "promotions_studio.VIEW",
        "user_profile.VIEW",
        "dashboard.VIEW",
    ],
    "role-accountant": [
        "business_ledger.VIEW", "business_ledger.ADD", "business_ledger.EDIT",
        "accounting_sync.VIEW",
        "reports_portal.VIEW",
        "sales_billing.VIEW",
        "purchase_studio.VIEW",
    ],
    "role-auditor": [
        "audit_logs.VIEW",
        "reports_portal.VIEW",
        "inventory_workspace.VIEW",
        "business_ledger.VIEW",
        "sales_billing.VIEW",
        "purchase_studio.VIEW",
        "stock_ledger.VIEW",
    ],
    "role-report-user": [
        "reports_portal.VIEW",
        "dashboard.VIEW",
        "inventory_workspace.VIEW",
        "sales_billing.VIEW",
        "purchase_studio.VIEW",
    ],
    "role-viewer": [
        "dashboard.VIEW",
        "inventory_workspace.VIEW",
        "sales_billing.VIEW",
        "purchase_studio.VIEW",
        "reports_portal.VIEW",
        "user_profile.VIEW",
    ],
}

# ── Legacy notation for rollback ──────────────────────────────────────────────
LEGACY_ROLE_PERMISSIONS = {
    "role-store-manager": [
        "pos.sell", "inventory.view", "inventory.manage", "reports.view", "staff.manage",
        "settings.manage", "purchase.write", "roles.manage",
    ],
    "role-branch-admin": [
        "pos.sell", "inventory.manage", "reports.view", "reports.export",
        "staff.manage", "settings.manage",
    ],
    "role-hr-executive": [
        "staff.manage", "attendance.manage", "payroll.view", "reports.view",
    ],
    "role-inventory-manager": [
        "inventory.view", "inventory.manage", "inventory.transfer", "products.manage",
        "purchase.read", "reports.view",
    ],
    "role-purchase-executive": [
        "purchase.read", "purchase.write", "suppliers.manage", "grn.manage", "reports.view",
    ],
    "role-sales-executive": [
        "pos.sell", "sales.quote", "sales.order", "customers.manage", "reports.view",
    ],
    "role-cashier": [
        "pos.sell", "inventory.view", "reports.view",
    ],
    "role-accountant": [
        "accounting.view", "accounting.manage", "payments.manage", "reports.view",
        "tax.view", "ledger.view",
    ],
    "role-auditor": [
        "audit.view", "reports.view", "reports.export", "inventory.view",
        "accounting.view", "sales.view", "purchase.read",
    ],
    "role-report-user": [
        "reports.view", "reports.print", "reports.export", "reports.email", "reports.schedule",
    ],
    "role-viewer": [
        "inventory.view", "reports.view", "sales.view", "purchase.read",
    ],
}


def upgrade():
    for role_id, perms in CANONICAL_ROLE_PERMISSIONS.items():
        perms_json = json.dumps(perms).replace("'", "''")
        op.execute(
            f"UPDATE roles SET permissions_json = '{perms_json}' "
            f"WHERE id = '{role_id}' AND is_deleted = FALSE"
        )


def downgrade():
    for role_id, perms in LEGACY_ROLE_PERMISSIONS.items():
        perms_json = json.dumps(perms).replace("'", "''")
        op.execute(
            f"UPDATE roles SET permissions_json = '{perms_json}' "
            f"WHERE id = '{role_id}'"
        )
