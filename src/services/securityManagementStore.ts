/**
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
 * Source Module: Security Management Store & State Engine
 */

import { apiFetchV1 } from "../lib/apiFetchV1";
import {
  MenuItemPermission,
  SecurityUserEntry,
  SecurityGroupEntry,
  SecurityNodeEntry,
  PasswordSecurityConfig,
  HousekeepingSecurityConfig,
} from "../components/security/types";

export const initialSecurityUsers: SecurityUserEntry[] = [
  {
    id: "001",
    name: "Administrator",
    groupId: "001",
    companyCode: "All",
    companyName: "All Companies",
    isLocked: false,
  },
  {
    id: "002",
    name: "Ram",
    groupId: "002",
    companyCode: "All",
    companyName: "All Companies",
    isLocked: false,
  },
  {
    id: "003",
    name: "Shyam",
    groupId: "002",
    companyCode: "COMP-001",
    companyName: "Smriti Retail Mumbai",
    isLocked: false,
  },
  {
    id: "004",
    name: "Priya",
    groupId: "003",
    companyCode: "COMP-001",
    companyName: "Smriti Retail Mumbai",
    isLocked: false,
  },
];

export const initialSecurityGroups: SecurityGroupEntry[] = [
  {
    id: "001",
    name: "Administrators",
    companyCode: "All",
    companyName: "All Companies",
  },
  {
    id: "002",
    name: "Counters",
    companyCode: "All",
    companyName: "All Companies",
  },
  {
    id: "003",
    name: "Floor Supervisors",
    companyCode: "All",
    companyName: "All Companies",
  },
  {
    id: "004",
    name: "Inventory Clerks",
    companyCode: "All",
    companyName: "All Companies",
  },
];

export const initialSecurityNodes: SecurityNodeEntry[] = [
  {
    id: "NODE-POS-01",
    name: "Billing Counter 1 (Front Desk)",
    ipAddress: "192.168.1.101",
    companyCode: "All",
    companyName: "All Companies",
  },
  {
    id: "NODE-POS-02",
    name: "Billing Counter 2 (Express Lane)",
    ipAddress: "192.168.1.102",
    companyCode: "All",
    companyName: "All Companies",
  },
  {
    id: "NODE-BACKOFFICE",
    name: "Store Manager Backoffice PC",
    ipAddress: "192.168.1.100",
    companyCode: "All",
    companyName: "All Companies",
  },
];

export const initialPasswordSecurityConfig: PasswordSecurityConfig = {
  maxPasswordLength: 50,
  minPasswordLength: 6,
  minUppercase: 1,
  minLowercase: 1,
  minNumeric: 2,
  passwordsToRemember: 5,
  passwordResettingDays: 60,
  maxInvalidAttempts: 5,
};

export const initialHousekeepingSecurityConfig: HousekeepingSecurityConfig = {
  daysToRetainActivityLog: 0,
  countryCode: "+91",
  remindPatchUpdationDays: 7,
  activateCompanyWiseRestrictions: true,
  customReportsInMenuScreen: 0,
  customReportsRefreshIntervalSeconds: 0,
};

export const getCanonicalMenuTree = (): MenuItemPermission[] => [
  {
    menuId: "sales",
    menuName: "Sales",
    isAccessible: true,
    children: [
      {
        menuId: "sales_billing",
        menuName: "Billing",
        isAccessible: true,
        supportedOperations: ["NEW", "VOID", "RETURN", "VOID RETURN", "REPRINT", "HOLD"],
        allowedOperations: {
          NEW: true,
          VOID: false,
          RETURN: true,
          "VOID RETURN": true,
          REPRINT: true,
          HOLD: true,
        },
      },
      {
        menuId: "sales_advice",
        menuName: "Sales Advice Slips",
        isAccessible: true,
      },
      {
        menuId: "sales_service_order",
        menuName: "Service Order",
        isAccessible: false,
      },
      {
        menuId: "sales_order",
        menuName: "Sales Order",
        isAccessible: false,
      },
      {
        menuId: "sales_order_conversion",
        menuName: "Sales Order Conversion",
        isAccessible: true,
      },
      {
        menuId: "sales_walkin",
        menuName: "Walk-in Entry",
        isAccessible: true,
      },
      {
        menuId: "sales_change_payment",
        menuName: "Change Payment Mode",
        isAccessible: false,
      },
      {
        menuId: "sales_pending_closure",
        menuName: "Pending Order/Trn Closure",
        isAccessible: true,
      },
      {
        menuId: "sales_excise_invoice",
        menuName: "Excise Invoice Generation",
        isAccessible: true,
      },
      {
        menuId: "sales_transport_receipt",
        menuName: "Transport Receipt Entry",
        isAccessible: true,
      },
    ],
  },
  {
    menuId: "cash",
    menuName: "Cash",
    isAccessible: true,
    children: [
      {
        menuId: "cash_payouts",
        menuName: "Cash Payouts",
        isAccessible: true,
      },
      {
        menuId: "cash_receipts",
        menuName: "Cash Receipts",
        isAccessible: true,
      },
      {
        menuId: "cash_cc_mgmt",
        menuName: "Credit Card Management",
        isAccessible: true,
      },
      {
        menuId: "cash_franchisee_ac",
        menuName: "Franchisee A/C",
        isAccessible: false,
      },
    ],
  },
  {
    menuId: "stock",
    menuName: "Stock",
    isAccessible: true,
    children: [
      {
        menuId: "stock_import_pt",
        menuName: "Import DC / Master from PT File",
        isAccessible: true,
      },
      {
        menuId: "stock_physical_verification",
        menuName: "Physical Verification",
        isAccessible: true,
      },
      {
        menuId: "stock_goods_inwards",
        menuName: "Goods Inwards",
        isAccessible: true,
        supportedOperations: ["ADD", "EDIT", "DELETE", "VIEW"],
        allowedOperations: {
          ADD: true,
          EDIT: true,
          DELETE: false,
          VIEW: true,
        },
      },
      {
        menuId: "stock_transfer",
        menuName: "Stock Transfer Outward",
        isAccessible: true,
      },
      {
        menuId: "stock_adjustment",
        menuName: "Stock Adjustment / Write-Off",
        isAccessible: false,
      },
      {
        menuId: "stock_ledger",
        menuName: "Stock Ledger Register",
        isAccessible: true,
      },
    ],
  },
  {
    menuId: "reports",
    menuName: "Reports",
    isAccessible: true,
    children: [
      { menuId: "rep_daily_sales", menuName: "Daily Sales Summary", isAccessible: true },
      { menuId: "rep_tax_register", menuName: "Tax & GSTR-1 Register", isAccessible: true },
      { menuId: "rep_stock_valuation", menuName: "Stock Valuation by Classification", isAccessible: true },
      { menuId: "rep_shift_summary", menuName: "Cashier Shift Settlement Log", isAccessible: true },
    ],
  },
  {
    menuId: "housekeeping",
    menuName: "Housekeeping",
    isAccessible: true,
    children: [
      { menuId: "hk_backup", menuName: "Database Backup", isAccessible: true },
      { menuId: "hk_restore", menuName: "Database Restore", isAccessible: false },
      { menuId: "hk_reindex", menuName: "Re-index PostgreSQL Sequences", isAccessible: true },
      { menuId: "hk_purge_logs", menuName: "Purge Temporary Audit Files", isAccessible: true },
    ],
  },
  {
    menuId: "catalogue",
    menuName: "Catalogue",
    isAccessible: true,
    children: [
      {
        menuId: "cat_item_master",
        menuName: "Item Master Management",
        isAccessible: true,
        supportedOperations: ["ADD", "EDIT", "DELETE", "VIEW"],
        allowedOperations: { ADD: true, EDIT: true, DELETE: false, VIEW: true },
      },
      { menuId: "cat_price_groups", menuName: "Customer Price Groups", isAccessible: true },
      { menuId: "cat_barcodes", menuName: "Barcode Studio & Label Printer", isAccessible: true },
      { menuId: "cat_hsn", menuName: "HSN / GST Rate Configuration", isAccessible: true },
    ],
  },
  {
    menuId: "setup",
    menuName: "Setup",
    isAccessible: true,
    children: [
      { menuId: "setup_company", menuName: "Company & Store Profile", isAccessible: true },
      { menuId: "setup_branch", menuName: "Branch Master", isAccessible: true },
      { menuId: "setup_security", menuName: "Security Management", isAccessible: true },
      { menuId: "setup_printers", menuName: "Thermal / Document Printer Setup", isAccessible: true },
      { menuId: "setup_parameters", menuName: "POS Terminal Parameters", isAccessible: true },
    ],
  },
  {
    menuId: "help",
    menuName: "Help",
    isAccessible: true,
    children: [
      { menuId: "help_manual", menuName: "SMRITI Online User Manual", isAccessible: true },
      { menuId: "help_shortcuts", menuName: "POS Keyboard Shortcuts Guide", isAccessible: true },
      { menuId: "help_diagnostics", menuName: "Network & Hardware Diagnostics", isAccessible: true },
      { menuId: "help_about", menuName: "About SMRITI Retail OS", isAccessible: true },
    ],
  },
];

const STORAGE_KEY_PASS_CONFIG = "smriti_security_password_config";
const STORAGE_KEY_HK_CONFIG = "smriti_security_housekeeping_config";
const STORAGE_KEY_PERMISSIONS = "smriti_security_menu_permissions";

function getStorage(): Storage | null {
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function triggerEvent(name: string) {
  try {
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(name));
    }
  } catch {}
}

export function getPasswordSecurityConfig(): PasswordSecurityConfig {
  const storage = getStorage();
  if (storage) {
    const saved = storage.getItem(STORAGE_KEY_PASS_CONFIG);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    storage.setItem(STORAGE_KEY_PASS_CONFIG, JSON.stringify(initialPasswordSecurityConfig));
  }
  return initialPasswordSecurityConfig;
}

export function savePasswordSecurityConfig(config: PasswordSecurityConfig) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY_PASS_CONFIG, JSON.stringify(config));
    triggerEvent("smriti_security_config_updated");
  }
}

export function getHousekeepingSecurityConfig(): HousekeepingSecurityConfig {
  const storage = getStorage();
  if (storage) {
    const saved = storage.getItem(STORAGE_KEY_HK_CONFIG);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    storage.setItem(STORAGE_KEY_HK_CONFIG, JSON.stringify(initialHousekeepingSecurityConfig));
  }
  return initialHousekeepingSecurityConfig;
}

export function saveHousekeepingSecurityConfig(config: HousekeepingSecurityConfig) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY_HK_CONFIG, JSON.stringify(config));
    triggerEvent("smriti_security_config_updated");
  }
}

export function getPermissionsForSubject(
  subjectType: "User" | "Group" | "Node",
  subjectId: string
): MenuItemPermission[] {
  const storage = getStorage();
  if (storage) {
    const saved = storage.getItem(`${STORAGE_KEY_PERMISSIONS}_${subjectType}_${subjectId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
  }
  return getCanonicalMenuTree();
}

export function savePermissionsForSubject(
  subjectType: "User" | "Group" | "Node",
  subjectId: string,
  permissions: MenuItemPermission[]
) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(
      `${STORAGE_KEY_PERMISSIONS}_${subjectType}_${subjectId}`,
      JSON.stringify(permissions)
    );
    triggerEvent("smriti_menu_permissions_updated");
  }
}

