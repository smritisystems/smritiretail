/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.2.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { APP_VERSION } from "../../config/version.ts";

export interface TileData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tag?: string;
  badgeType?: "info" | "warning" | "success" | "primary";
  group: string;
  roles?: string[];
  isQuickAction?: boolean;
  shortcut?: string;
  accentColor?: string;
}

export const LAUNCHPAD_CATALOG: TileData[] = [
  // 1. Retail Operations
  {
    id: "pos",
    title: "Billing Desk (POS)",
    subtitle: "High-speed retail billing, cashier shift tracking & cash drawer reconciliation",
    icon: "point_of_sale",
    tag: "Core POS",
    badgeType: "primary",
    group: "Retail Operations",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
    isQuickAction: true,
    shortcut: "F1",
    accentColor: "emerald",
  },
  {
    id: "sales",
    title: "Sales Studio",
    subtitle: "B2C retail billing, multi-tender transactions & invoice history register",
    icon: "receipt_long",
    tag: "Sales",
    badgeType: "success",
    group: "Retail Operations",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
  },
  {
    id: "create-tax-invoice",
    title: "Create Tax Invoice (B2B)",
    subtitle: "Advanced B2B tax invoice generator with statutory reverse charge & GST rules",
    icon: "post_add",
    tag: "GST A4",
    badgeType: "primary",
    group: "Retail Operations",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
    isQuickAction: true,
    shortcut: "F3",
    accentColor: "indigo",
  },
  {
    id: "purchase",
    title: "Purchase Studio",
    subtitle: "Vendor purchase orders, goods receipt notes (GRN) & matrix grid paste",
    icon: "shopping_cart",
    tag: "Procurement",
    badgeType: "info",
    group: "Retail Operations",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "profiles",
    title: "POS Terminals & Counters",
    subtitle: "Configure billing counter registers, cashier operator shifts & terminal locks",
    icon: "manage_accounts",
    tag: "Registers",
    badgeType: "primary",
    group: "Retail Operations",
    roles: ["MANAGER", "SYSADMIN"],
  },

  // 2. Master Data & Stock
  {
    id: "item-master",
    title: "Item Master & Catalog",
    subtitle: "Dynamic product catalogue, server pagination, HSN codes & GST tax slabs",
    icon: "inventory_2",
    tag: "Catalog",
    badgeType: "primary",
    group: "Master Data & Stock",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
    isQuickAction: true,
    shortcut: "F4",
    accentColor: "purple",
  },
  {
    id: "barcode",
    title: "Barcode Studio & Printing",
    subtitle: "Thermal label designer, EAN/UPC barcode mapping & batch label printer",
    icon: "qr_code_scanner",
    tag: "Labels",
    badgeType: "info",
    group: "Master Data & Stock",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
    isQuickAction: true,
    shortcut: "F5",
    accentColor: "amber",
  },
  {
    id: "stock-ledger",
    title: "Stock Movement Ledger",
    subtitle: "Real-time stock ledger movements, inward/outward logs & batch valuations",
    icon: "inventory",
    tag: "Inventory",
    badgeType: "success",
    group: "Master Data & Stock",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
    isQuickAction: true,
    shortcut: "F6",
    accentColor: "blue",
  },
  {
    id: "supplier-mgmt",
    title: "Supplier Directory",
    subtitle: "Vendor master profiles, GSTIN validation, commercial terms & payable balances",
    icon: "local_shipping",
    tag: "Vendors",
    badgeType: "info",
    group: "Master Data & Stock",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "customer-master",
    title: "Customer Master Directory",
    subtitle: "Customer registry, GSTIN verification, credit limits & address directory",
    icon: "contacts",
    tag: "Directory",
    badgeType: "info",
    group: "Master Data & Stock",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
  },
  {
    id: "crm",
    title: "CRM Studio (360°)",
    subtitle: "Customer 360 profile, interaction history, credit limits & account statements",
    icon: "groups",
    tag: "CRM",
    badgeType: "primary",
    group: "Master Data & Stock",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "loyalty",
    title: "Loyalty Studio",
    subtitle: "Rewards points ledger, membership tier progression & coupon promotions",
    icon: "stars",
    tag: "Rewards",
    badgeType: "success",
    group: "Master Data & Stock",
    roles: ["CASHIER", "MANAGER", "SYSADMIN"],
  },

  // 3. Finance & Ledgers
  {
    id: "business-ledger",
    title: "Business Accounts Ledger",
    subtitle: "Double-entry business ledger, daily sales journal & accounts reconciliation",
    icon: "account_balance_wallet",
    tag: "Ledger",
    badgeType: "primary",
    group: "Finance & Ledgers",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "accounting-sync",
    title: "Accounting Sync",
    subtitle: "Automated general ledger posting & external ERP accounting synchronization",
    icon: "sync_alt",
    tag: "Sync Engine",
    badgeType: "info",
    group: "Finance & Ledgers",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "report-designer",
    title: "Report Designer & Analytics",
    subtitle: "Financial analytics, GST summary returns, margin reports & schedule triggers",
    icon: "draw",
    tag: "Analytics",
    badgeType: "primary",
    group: "Finance & Ledgers",
    roles: ["MANAGER", "SYSADMIN"],
  },

  // 4. Documents & Print
  {
    id: "print-studio",
    title: "Print Studio & Designer",
    subtitle: "Thermal receipt & statutory A4 tax invoice template designer and styling",
    icon: "print",
    tag: "Templates",
    badgeType: "primary",
    group: "Documents & Print",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "print-history",
    title: "Print History Logs",
    subtitle: "Audit log of all printed tax invoices, thermal slips & reprint authorizations",
    icon: "history",
    tag: "Audit Trail",
    badgeType: "info",
    group: "Documents & Print",
    roles: ["MANAGER", "SYSADMIN", "AUDITOR"],
  },
  {
    id: "document-series",
    title: "Numbering & Series Engine",
    subtitle: "Statutory fiscal year document numbering prefixes, sequences & reset cycles",
    icon: "tag",
    tag: "Series",
    badgeType: "primary",
    group: "Documents & Print",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "terms-engine",
    title: "Commercial Terms Engine",
    subtitle: "Legal clauses, return policies, warranty disclaimers & jurisdiction notes",
    icon: "gavel",
    tag: "Legal",
    badgeType: "info",
    group: "Documents & Print",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "approval-matrix",
    title: "Approval Matrix Engine",
    subtitle: "Multi-tier signing authority rules, high-value thresholds & pending approvals",
    icon: "fact_check",
    tag: "Governance",
    badgeType: "warning",
    group: "Documents & Print",
    roles: ["MANAGER", "SYSADMIN"],
  },

  // 5. Data & Config
  {
    id: "masters",
    title: "System Master Management",
    subtitle: "Dynamic lookups for departments, designations, bank accounts & payment modes",
    icon: "database",
    tag: "Masters",
    badgeType: "primary",
    group: "Data & Config",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "data-exchange",
    title: "Data Exchange & Migration",
    subtitle: "Universal CSV bulk migration, data validation pipeline & export engine",
    icon: "swap_horiz",
    tag: "ETL / CSV",
    badgeType: "info",
    group: "Data & Config",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "company-setup",
    title: "Company Setup Wizard",
    subtitle: "Interactive onboarding wizard for organization, branches & initial masters",
    icon: "magic_button",
    tag: "Setup",
    badgeType: "primary",
    group: "Data & Config",
    roles: ["SYSADMIN"],
  },
  {
    id: "ufe",
    title: "Field Explorer (UFE)",
    subtitle: "Universal Field Explorer for dynamic entity schemas, validation & metadata",
    icon: "search",
    tag: "Schema",
    badgeType: "info",
    group: "Data & Config",
    roles: ["SYSADMIN"],
  },
  {
    id: "formulas",
    title: "KPI & Formula Registry",
    subtitle: "Business formula definitions, gross margin calculators & KPI telemetry",
    icon: "calculate",
    tag: "Formulas",
    badgeType: "info",
    group: "Data & Config",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "psv",
    title: "Channel Stock Visibility (PSV)",
    subtitle: "Party stock visibility, partner sell-through analytics & channel cover weeks",
    icon: "hub",
    tag: "Distribution",
    badgeType: "primary",
    group: "Data & Config",
    roles: ["MANAGER", "SYSADMIN"],
  },

  // 6. System & Operations
  {
    id: "staff-management",
    title: "Staff & HR Management",
    subtitle: "Employee directory, designation assignment, salary structures & credentials",
    icon: "badge",
    tag: "HR / Staff",
    badgeType: "info",
    group: "System & Operations",
    roles: ["MANAGER", "SYSADMIN"],
  },
  {
    id: "user-profile",
    title: "My Profile Dashboard",
    subtitle: "User preferences, security settings, password updates & active session details",
    icon: "account_circle",
    tag: "Account",
    badgeType: "primary",
    group: "System & Operations",
  },
  {
    id: "security-management",
    title: "Security Management (Menu Access)",
    subtitle: "User, Group & Node menu access control, granular operations matrix & security policies",
    icon: "admin_panel_settings",
    tag: "Security",
    badgeType: "warning",
    group: "System & Operations",
    roles: ["SYSADMIN", "MANAGER"],
    isQuickAction: true,
  },
  {
    id: "audit-logs",
    title: "Security & Audit Logs",
    subtitle: "Immutable system activity audit logs, user login events & transaction traces",
    icon: "policy",
    tag: "Security",
    badgeType: "warning",
    group: "System & Operations",
    roles: ["MANAGER", "SYSADMIN", "AUDITOR"],
  },
  {
    id: "database-manager",
    title: "Database Manager (DB Studio)",
    subtitle: "Multi-tenant PostgreSQL schema browser, table data explorer, live telemetry & SQL console",
    icon: "database",
    tag: "DB Studio",
    badgeType: "primary",
    group: "System & Operations",
    roles: ["SYSADMIN"],
  },
  {
    id: "dev-tracker",
    title: "Dev Intelligence Center",
    subtitle: "Real-time API performance health, technical debt logs & build diagnostics",
    icon: "monitoring",
    tag: "DevOps",
    badgeType: "info",
    group: "System & Operations",
    roles: ["SYSADMIN"],
  },
  {
    id: "wiki",
    title: "SMRITI Gyan Kendra",
    subtitle: "Built-in documentation hub, operator walkthroughs & statutory GST guides",
    icon: "menu_book",
    tag: "Wiki Docs",
    badgeType: "primary",
    group: "System & Operations",
  },
  {
    id: "about-smriti",
    title: "About SMRITI Retail OS",
    subtitle: "Architectural constitution, software licensing, versioning & creator credits",
    icon: "info",
    tag: `v${APP_VERSION}`,
    badgeType: "primary",
    group: "System & Operations",
  },
  {
    id: "training-academy",
    title: "Training Academy",
    subtitle: "Interactive training simulations, cashier tutorials & certification modules",
    icon: "school",
    tag: "Academy",
    badgeType: "info",
    group: "System & Operations",
  },
  {
    id: "legacy-migration",
    title: "Shoper9 → SMRITI Migration",
    subtitle: "Legacy vaMenu lineage registry: 265 entries classified, coverage tracking & workspace parity dashboard",
    icon: "alt_route",
    tag: "Migration",
    badgeType: "warning",
    group: "System & Operations",
    roles: ["MANAGER", "SYSADMIN"],
    accentColor: "violet",
  },
];

/**
 * Filter catalog by user role with strict deny-by-default semantics.
 * - Missing/null/empty role -> only tiles with NO role restriction (tile.roles undefined or empty)
 * - SYSADMIN / ADMIN -> sees all tiles
 * - Specific role -> sees tiles explicitly allowing that role
 */
export function getVisibleLaunchpadTiles(userRoleRaw?: string | null): TileData[] {
  if (!userRoleRaw || typeof userRoleRaw !== "string" || !userRoleRaw.trim()) {
    // Deny-by-default: anonymous / unassigned users only see unrestricted tiles (if any)
    return LAUNCHPAD_CATALOG.filter((tile) => !tile.roles || tile.roles.length === 0);
  }

  const userRole = userRoleRaw.toUpperCase().trim();
  const isSysAdmin = userRole === "SYSADMIN" || userRole === "SYSTEM ADMIN" || userRole === "ADMIN";
  const isManager = userRole === "MANAGER" || userRole === "STORE MANAGER" || isSysAdmin;

  return LAUNCHPAD_CATALOG.filter((tile) => {
    if (!tile.roles || tile.roles.length === 0 || isSysAdmin) return true;
    return tile.roles.some((r) => r.toUpperCase() === userRole || (r === "MANAGER" && isManager));
  });
}

/**
 * Get primary quick action tiles.
 */
export function getQuickActionTiles(userRoleRaw?: string | null): TileData[] {
  return getVisibleLaunchpadTiles(userRoleRaw).filter((t) => t.isQuickAction);
}
