"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys, json, psycopg2
from datetime import datetime, timezone

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

TARGET_SPECIFICATIONS = {
    # 1. Dashboard & Operations
    "menu-dashboard": {"title": "Dashboard & Executive Hub", "route": "/dashboard", "module": "Dashboard & Operations", "parent_id": None, "sequence": 10, "permission": "DASHBOARD.ACCESS", "is_active": True},
    "menu-user-profile": {"title": "My Profile Dashboard", "route": "/user-profile", "module": "Dashboard & Operations", "parent_id": None, "sequence": 20, "permission": "PROFILE.ACCESS", "is_active": True},

    # 2. System & Knowledge Base
    "menu-wiki": {"title": "SMRITI Gyan Kendra", "route": "/wiki", "module": "System & Knowledge Base", "parent_id": None, "sequence": 30, "permission": "WIKI.ACCESS", "is_active": True},
    "menu-about-smriti": {"title": "About SMRITI Retail OS", "route": "/about-smriti", "module": "System & Knowledge Base", "parent_id": None, "sequence": 40, "permission": "ABOUT.ACCESS", "is_active": True},
    "menu-dev-tracker": {"title": "Dev Intelligence Center", "route": "/dev-tracker", "module": "System & Knowledge Base", "parent_id": None, "sequence": 50, "permission": "SYSTEM.DEV", "is_active": True},

    # 3. Sales & POS (Parent: menu-pos)
    "menu-pos": {"title": "Billing Desk (Universal POS)", "route": "/pos", "module": "Sales & POS", "parent_id": None, "sequence": 60, "permission": "POS.WORKSPACE.ACCESS", "is_active": True},
    "menu-sales": {"title": "Sales Studio & Ledger", "route": "/sales", "module": "Sales & POS", "parent_id": "menu-pos", "sequence": 70, "permission": "SALES.WORKSPACE.ACCESS", "is_active": True},
    "menu-customer-master": {"title": "Customer Master Directory", "route": "/customer-master", "module": "Sales & POS", "parent_id": "menu-pos", "sequence": 80, "permission": "CUSTOMER.WORKSPACE.ACCESS", "is_active": True},
    "menu-crm": {"title": "CRM & Engagement Studio", "route": "/crm", "module": "Sales & POS", "parent_id": "menu-pos", "sequence": 90, "permission": "CRM.WORKSPACE.ACCESS", "is_active": True},
    "menu-loyalty": {"title": "Loyalty & Rewards Studio", "route": "/loyalty", "module": "Sales & POS", "parent_id": "menu-pos", "sequence": 100, "permission": "LOYALTY.WORKSPACE.ACCESS", "is_active": True},
    "menu-profiles": {"title": "POS Terminal Profiles", "route": "/profiles", "module": "Sales & POS", "parent_id": "menu-pos", "sequence": 110, "permission": "TERMINALS.MANAGE", "is_active": True},

    # 4. Inventory & Purchase (Parent: menu-inventory)
    "menu-inventory": {"title": "Inventory Workspace", "route": "/inventory", "module": "Inventory & Purchase", "parent_id": None, "sequence": 120, "permission": "INVENTORY.WORKSPACE.ACCESS", "is_active": True},
    "menu-item-master": {"title": "Item Master Catalog", "route": "/item-master", "module": "Inventory & Purchase", "parent_id": "menu-inventory", "sequence": 130, "permission": "ITEM.WORKSPACE.ACCESS", "is_active": True},
    "menu-barcode": {"title": "Barcode Studio & Generator", "route": "/barcode", "module": "Inventory & Purchase", "parent_id": "menu-inventory", "sequence": 140, "permission": "BARCODE.WORKSPACE.ACCESS", "is_active": True},
    "menu-stock-ledger": {"title": "Stock Movements & Ledger", "route": "/stock-ledger", "module": "Inventory & Purchase", "parent_id": "menu-inventory", "sequence": 150, "permission": "STOCK.WORKSPACE.ACCESS", "is_active": True},
    "menu-purchase": {"title": "Purchase Studio & Orders", "route": "/purchase", "module": "Inventory & Purchase", "parent_id": "menu-inventory", "sequence": 160, "permission": "PURCHASE.WORKSPACE.ACCESS", "is_active": True},
    "menu-supplier-mgmt": {"title": "Supplier / Person Master", "route": "/supplier-mgmt", "module": "Inventory & Purchase", "parent_id": "menu-inventory", "sequence": 170, "permission": "SUPPLIER.WORKSPACE.ACCESS", "is_active": True},

    # 5. Accounts
    "menu-business-ledger": {"title": "Business Ledger & Statements", "route": "/business-ledger", "module": "Accounts", "parent_id": None, "sequence": 180, "permission": "ACCOUNTS.WORKSPACE.ACCESS", "is_active": True},
    "menu-accounting-sync": {"title": "Tally / ERP Accounting Sync", "route": "/accounting-sync", "module": "Accounts", "parent_id": None, "sequence": 190, "permission": "ACCOUNTS.SYNC.EXECUTE", "is_active": True},

    # 6. Reports (Parent: menu-reports)
    "menu-reports": {"title": "Reports Portal & Analytics", "route": "/reports", "module": "Reports", "parent_id": None, "sequence": 200, "permission": "REPORT.WORKSPACE.ACCESS", "is_active": True},
    "menu-report-designer": {"title": "Visual Report Designer", "route": "/report-designer", "module": "Reports", "parent_id": "menu-reports", "sequence": 210, "permission": "REPORT.DESIGN.ACCESS", "is_active": True},

    # 7. Configuration & Governance (Parent: menu-masters)
    "menu-masters": {"title": "Configuration & Governance Hub", "route": "/masters", "module": "Configuration & Governance", "parent_id": None, "sequence": 220, "permission": "CONFIG.GOVERNANCE.ACCESS", "is_active": True},
    "menu-ufe": {"title": "Universal Field Explorer (UFE)", "route": "/ufe", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 230, "permission": "UFE.ACCESS", "is_active": True},
    "menu-formulas": {"title": "Formula & KPI Registry", "route": "/formulas", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 240, "permission": "FORMULA.MANAGE", "is_active": True},
    "menu-psv": {"title": "Channel Visibility Matrix (PSV)", "route": "/psv", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 250, "permission": "PSV.MANAGE", "is_active": True},
    "menu-document-series": {"title": "Numbering Engine & Series", "route": "/document-series", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 260, "permission": "NUMBERING.MANAGE", "is_active": True},
    "menu-print-studio": {"title": "Print Studio & Template Designer", "route": "/print-studio", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 270, "permission": "PRINT.MANAGE", "is_active": True},
    "menu-print-history": {"title": "Print Audit & History Logs", "route": "/print-history", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 280, "permission": "PRINT.LOG.ACCESS", "is_active": True},
    "menu-terms-engine": {"title": "Terms & Conditions Engine", "route": "/terms-engine", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 290, "permission": "TERMS.MANAGE", "is_active": True},
    "menu-data-exchange": {"title": "Data Exchange & Migration Hub", "route": "/data-exchange", "module": "Configuration & Governance", "parent_id": "menu-masters", "sequence": 300, "permission": "DATA.IMPORT.ACCESS", "is_active": True},

    # 8. Administration
    "menu-staff-management": {"title": "Staff Management & Payroll", "route": "/staff-management", "module": "Administration", "parent_id": None, "sequence": 310, "permission": "STAFF.WORKSPACE.ACCESS", "is_active": True},
    "menu-approval-matrix": {"title": "Approval Matrix Governance", "route": "/approval-matrix", "module": "Administration", "parent_id": None, "sequence": 320, "permission": "APPROVAL.MANAGE", "is_active": True},
    "menu-company-setup": {"title": "Company Setup & Branch Config", "route": "/company-setup", "module": "Administration", "parent_id": None, "sequence": 330, "permission": "COMPANY.SETUP.ACCESS", "is_active": True},
    "menu-audit-logs": {"title": "System Audit Trail & Security Logs", "route": "/audit-logs", "module": "Administration", "parent_id": None, "sequence": 340, "permission": "AUDIT.WORKSPACE.ACCESS", "is_active": True},
}

def reconcile():
    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    try:
        cur.execute("BEGIN;")

        # Delete any existing placeholder menus menu-0 to menu-29
        cur.execute("DELETE FROM smriti_menus WHERE id LIKE 'menu-%' AND id NOT IN ('menu-dashboard', 'menu-inventory', 'menu-reports', 'menu-sales');")

        # Upsert root parent menus first (where parent_id is NULL)
        for mid, spec in TARGET_SPECIFICATIONS.items():
            if spec["parent_id"] is None:
                cur.execute("""
                    INSERT INTO smriti_menus (id, uuid, title, route, module, parent_id, sequence, permission, is_active, is_deleted, created_at, modified_at)
                    VALUES (%s, gen_random_uuid(), %s, %s, %s, NULL, %s, %s, %s, false, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        route = EXCLUDED.route,
                        module = EXCLUDED.module,
                        parent_id = NULL,
                        sequence = EXCLUDED.sequence,
                        permission = EXCLUDED.permission,
                        is_active = EXCLUDED.is_active,
                        is_deleted = false,
                        modified_at = NOW();
                """, (mid, spec["title"], spec["route"], spec["module"], spec["sequence"], spec["permission"], spec["is_active"]))

        # Upsert child menus next (where parent_id is NOT NULL)
        for mid, spec in TARGET_SPECIFICATIONS.items():
            if spec["parent_id"] is not None:
                cur.execute("""
                    INSERT INTO smriti_menus (id, uuid, title, route, module, parent_id, sequence, permission, is_active, is_deleted, created_at, modified_at)
                    VALUES (%s, gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, false, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        route = EXCLUDED.route,
                        module = EXCLUDED.module,
                        parent_id = EXCLUDED.parent_id,
                        sequence = EXCLUDED.sequence,
                        permission = EXCLUDED.permission,
                        is_active = EXCLUDED.is_active,
                        is_deleted = false,
                        modified_at = NOW();
                """, (mid, spec["title"], spec["route"], spec["module"], spec["parent_id"], spec["sequence"], spec["permission"], spec["is_active"]))

        conn.commit()
        print("Reconciliation complete! Canonical 34 menus upserted successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Error during reconciliation: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    reconcile()
