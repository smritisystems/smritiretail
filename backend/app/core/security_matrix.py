"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
from typing import Dict, Any, List, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..models.auth import User, UserRole
from ..models.role import Role
from ..models.security import SmritiPermission
from ..api.deps import TenantContext

# Canonical 34-Menu Contract Mapping
CANONICAL_34_MENU_MATRIX: Dict[str, Dict[str, Any]] = {
    # 1. Dashboard & Operations
    "menu-dashboard": {"resource": "dashboard", "view_perm": "DASHBOARD.ACCESS", "parent_id": None},
    "menu-user-profile": {"resource": "user_profile", "view_perm": "PROFILE.ACCESS", "parent_id": None},

    # 2. System & Knowledge Base
    "menu-wiki": {"resource": "wiki_docs", "view_perm": "WIKI.ACCESS", "parent_id": None},
    "menu-about-smriti": {"resource": "about_smriti", "view_perm": "ABOUT.ACCESS", "parent_id": None},
    "menu-dev-tracker": {"resource": "dev_tracker", "view_perm": "SYSTEM.DEV", "parent_id": None},

    # 3. Sales & POS (Parent: menu-pos)
    "menu-pos": {"resource": "pos_workspace", "view_perm": "POS.WORKSPACE.ACCESS", "parent_id": None},
    "menu-sales": {"resource": "sales_billing", "view_perm": "SALES.WORKSPACE.ACCESS", "parent_id": "menu-pos"},
    "menu-customer-master": {"resource": "customer_master", "view_perm": "CUSTOMER.WORKSPACE.ACCESS", "parent_id": "menu-pos"},
    "menu-crm": {"resource": "crm_studio", "view_perm": "CRM.WORKSPACE.ACCESS", "parent_id": "menu-pos"},
    "menu-loyalty": {"resource": "loyalty_rewards", "view_perm": "LOYALTY.WORKSPACE.ACCESS", "parent_id": "menu-pos"},
    "menu-profiles": {"resource": "terminal_profiles", "view_perm": "TERMINALS.MANAGE", "parent_id": "menu-pos"},

    # 4. Inventory & Purchase (Parent: menu-inventory)
    "menu-inventory": {"resource": "inventory_workspace", "view_perm": "INVENTORY.WORKSPACE.ACCESS", "parent_id": None},
    "menu-item-master": {"resource": "item_master", "view_perm": "ITEM.WORKSPACE.ACCESS", "parent_id": "menu-inventory"},
    "menu-barcode": {"resource": "barcode_studio", "view_perm": "BARCODE.WORKSPACE.ACCESS", "parent_id": "menu-inventory"},
    "menu-stock-ledger": {"resource": "stock_ledger", "view_perm": "STOCK.WORKSPACE.ACCESS", "parent_id": "menu-inventory"},
    "menu-purchase": {"resource": "purchase_studio", "view_perm": "PURCHASE.WORKSPACE.ACCESS", "parent_id": "menu-inventory"},
    "menu-supplier-mgmt": {"resource": "supplier_mgmt", "view_perm": "SUPPLIER.WORKSPACE.ACCESS", "parent_id": "menu-inventory"},

    # 5. Accounts
    "menu-business-ledger": {"resource": "business_ledger", "view_perm": "ACCOUNTS.WORKSPACE.ACCESS", "parent_id": None},
    "menu-accounting-sync": {"resource": "accounting_sync", "view_perm": "ACCOUNTS.SYNC.EXECUTE", "parent_id": None},

    # 6. Reports (Parent: menu-reports)
    "menu-reports": {"resource": "reports_portal", "view_perm": "REPORT.WORKSPACE.ACCESS", "parent_id": None},
    "menu-report-designer": {"resource": "report_designer", "view_perm": "REPORT.DESIGN.ACCESS", "parent_id": "menu-reports"},

    # 7. Configuration & Governance (Parent: menu-masters)
    "menu-masters": {"resource": "governance_masters", "view_perm": "CONFIG.GOVERNANCE.ACCESS", "parent_id": None},
    "menu-ufe": {"resource": "universal_field_explorer", "view_perm": "UFE.ACCESS", "parent_id": "menu-masters"},
    "menu-formulas": {"resource": "formula_registry", "view_perm": "FORMULA.MANAGE", "parent_id": "menu-masters"},
    "menu-psv": {"resource": "channel_visibility", "view_perm": "PSV.MANAGE", "parent_id": "menu-masters"},
    "menu-document-series": {"resource": "numbering_engine", "view_perm": "NUMBERING.MANAGE", "parent_id": "menu-masters"},
    "menu-print-studio": {"resource": "print_studio", "view_perm": "PRINT.MANAGE", "parent_id": "menu-masters"},
    "menu-print-history": {"resource": "print_history", "view_perm": "PRINT.LOG.ACCESS", "parent_id": "menu-masters"},
    "menu-terms-engine": {"resource": "terms_engine", "view_perm": "TERMS.MANAGE", "parent_id": "menu-masters"},
    "menu-data-exchange": {"resource": "data_exchange", "view_perm": "DATA.IMPORT.ACCESS", "parent_id": "menu-masters"},

    # 8. Administration
    "menu-staff-management": {"resource": "staff_mgmt", "view_perm": "STAFF.WORKSPACE.ACCESS", "parent_id": None},
    "menu-approval-matrix": {"resource": "approval_matrix", "view_perm": "APPROVAL.MANAGE", "parent_id": None},
    "menu-company-setup": {"resource": "company_setup", "view_perm": "COMPANY.SETUP.ACCESS", "parent_id": None},
    "menu-audit-logs": {"resource": "audit_logs", "view_perm": "AUDIT.WORKSPACE.ACCESS", "parent_id": None},
}

# Standard operational modules allowed by default for Cashier / Store User
CASHIER_DEFAULT_VIEW_ALLOWLIST: Set[str] = {
    "dashboard", "pos_workspace", "sales_billing", "customer_master", "item_master",
    "user_profile", "wiki_docs", "about_smriti"
}


async def evaluate_action_permission(
    db: AsyncSession,
    current_user: User,
    tenant: TenantContext,
    resource: str,
    action: str,
    baseline_perm_code: str | None = None
) -> bool:
    """
    Evaluates permission for a specific (resource, action) pair under active TenantContext.
    Precedence:
    1. SYSADMIN Superuser (Wildcard '*')
    2. User Explicit Override (smriti_permissions matching scope="User:{id}")
    3. Assigned Role Permissions (roles.permissions_json)
    4. Scoped Role Defaults:
       - MANAGER: Allowed for all standard operations (EXCEPT VOID, PURGE, SUPER_ADMIN without role grant)
       - CASHIER: Allowed for standard POS view/new operations
    """
    if current_user.role == UserRole.SYSADMIN:
        return True

    # 1. User Explicit Override in smriti_permissions (Tenant Scoped)
    user_scope = f"User:{current_user.id}"
    q_user = select(SmritiPermission).where(
        SmritiPermission.scope == user_scope,
        SmritiPermission.resource == resource,
        SmritiPermission.action == action,
        SmritiPermission.is_deleted == False,
    )
    if tenant.company_id:
        q_user = q_user.where(
            (SmritiPermission.company_id == None) | (SmritiPermission.company_id == tenant.company_id)
        )
    if tenant.branch_id:
        q_user = q_user.where(
            (SmritiPermission.branch_id == None) | (SmritiPermission.branch_id == tenant.branch_id)
        )

    res_user = await db.execute(q_user)
    user_perm = res_user.scalars().first()
    if user_perm is not None:
        return bool(user_perm.is_active)

    # 2. Role Permissions in roles.permissions_json
    if current_user.role_id:
        res_role = await db.execute(select(Role).where(Role.id == current_user.role_id, Role.is_deleted == False))
        role_obj = res_role.scalars().first()
        if role_obj and role_obj.permissions_json:
            try:
                perms = json.loads(role_obj.permissions_json)
                if (
                    "*" in perms or 
                    f"{resource}.{action}" in perms or 
                    f"{resource}.*" in perms or 
                    (baseline_perm_code and baseline_perm_code in perms)
                ):
                    return True
            except Exception:
                pass

    # 3. Scoped Role Defaults
    if current_user.role == UserRole.MANAGER:
        # Prevent dangerous destructive operations without explicit permissions
        if action in ("VOID", "PURGE", "SUPER_ADMIN"):
            return False
        return True

    if current_user.role == UserRole.CASHIER:
        if action == "VIEW" and resource in CASHIER_DEFAULT_VIEW_ALLOWLIST:
            return True
        if action == "NEW" and resource in ("pos_workspace", "sales_billing"):
            return True

    return False


def prune_menu_tree_cascade(all_active_menus: List[Any], raw_visible_ids: Set[str]) -> List[Any]:
    """
    Two-pass parent-child cascade pruning:
    - Pass 1: Identifies valid parent menus (must be visible AND if registered children exist, >= 1 child is visible).
    - Pass 2: Identifies valid child menus (must be visible AND its parent must be valid).
    """
    children_by_parent: Dict[str, List[str]] = {}
    for menu in all_active_menus:
        if menu.parent_id:
            children_by_parent.setdefault(menu.parent_id, []).append(menu.id)

    valid_parents: Set[str] = set()
    for menu in all_active_menus:
        if menu.parent_id is None:
            registered_children = children_by_parent.get(menu.id, [])
            if menu.id in raw_visible_ids:
                if not registered_children:
                    valid_parents.add(menu.id)
                elif any(child_id in raw_visible_ids for child_id in registered_children):
                    valid_parents.add(menu.id)

    final_menus: List[Any] = []
    for menu in all_active_menus:
        if menu.parent_id is None:
            if menu.id in valid_parents:
                final_menus.append(menu)
        else:
            if menu.id in raw_visible_ids and menu.parent_id in valid_parents:
                final_menus.append(menu)

    return final_menus
