/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";

export interface FioriLaunchpadProps {
  onSelectModule: (moduleId: string) => void;
}

export interface TileData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tag?: string;
  badgeType?: "info" | "warning" | "success" | "primary";
  group: string;
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
  },
  {
    id: "sales",
    title: "Sales Studio",
    subtitle: "B2C retail billing, multi-tender transactions & invoice history register",
    icon: "receipt_long",
    tag: "Sales",
    badgeType: "success",
    group: "Retail Operations",
  },
  {
    id: "create-tax-invoice",
    title: "Create Tax Invoice (B2B)",
    subtitle: "Advanced B2B tax invoice generator with statutory reverse charge & GST rules",
    icon: "post_add",
    tag: "GST A4",
    badgeType: "primary",
    group: "Retail Operations",
  },
  {
    id: "purchase",
    title: "Purchase Studio",
    subtitle: "Vendor purchase orders, goods receipt notes (GRN) & matrix grid paste",
    icon: "shopping_cart",
    tag: "Procurement",
    badgeType: "info",
    group: "Retail Operations",
  },
  {
    id: "profiles",
    title: "POS Terminals & Counters",
    subtitle: "Configure billing counter registers, cashier operator shifts & terminal locks",
    icon: "manage_accounts",
    tag: "Registers",
    badgeType: "primary",
    group: "Retail Operations",
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
  },
  {
    id: "barcode",
    title: "Barcode Studio & Printing",
    subtitle: "Thermal label designer, EAN/UPC barcode mapping & batch label printer",
    icon: "qr_code_scanner",
    tag: "Labels",
    badgeType: "info",
    group: "Master Data & Stock",
  },
  {
    id: "stock-ledger",
    title: "Stock Movement Ledger",
    subtitle: "Real-time stock ledger movements, inward/outward logs & batch valuations",
    icon: "inventory",
    tag: "Inventory",
    badgeType: "success",
    group: "Master Data & Stock",
  },
  {
    id: "supplier-mgmt",
    title: "Supplier Directory",
    subtitle: "Vendor master profiles, GSTIN validation, commercial terms & payable balances",
    icon: "local_shipping",
    tag: "Vendors",
    badgeType: "info",
    group: "Master Data & Stock",
  },
  {
    id: "customer-master",
    title: "Customer Master Directory",
    subtitle: "Customer registry, GSTIN verification, credit limits & address directory",
    icon: "contacts",
    tag: "Directory",
    badgeType: "info",
    group: "Master Data & Stock",
  },
  {
    id: "crm",
    title: "CRM Studio (360°)",
    subtitle: "Customer 360 profile, interaction history, credit limits & account statements",
    icon: "groups",
    tag: "CRM",
    badgeType: "primary",
    group: "Master Data & Stock",
  },
  {
    id: "loyalty",
    title: "Loyalty Studio",
    subtitle: "Rewards points ledger, membership tier progression & coupon promotions",
    icon: "stars",
    tag: "Rewards",
    badgeType: "success",
    group: "Master Data & Stock",
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
  },
  {
    id: "accounting-sync",
    title: "Accounting Sync",
    subtitle: "Automated general ledger posting & external ERP accounting synchronization",
    icon: "sync_alt",
    tag: "Sync Engine",
    badgeType: "info",
    group: "Finance & Ledgers",
  },
  {
    id: "report-designer",
    title: "Report Designer & Analytics",
    subtitle: "Financial analytics, GST summary returns, margin reports & schedule triggers",
    icon: "draw",
    tag: "Analytics",
    badgeType: "primary",
    group: "Finance & Ledgers",
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
  },
  {
    id: "print-history",
    title: "Print History Logs",
    subtitle: "Audit log of all printed tax invoices, thermal slips & reprint authorizations",
    icon: "history",
    tag: "Audit Trail",
    badgeType: "info",
    group: "Documents & Print",
  },
  {
    id: "document-series",
    title: "Numbering & Series Engine",
    subtitle: "Statutory fiscal year document numbering prefixes, sequences & reset cycles",
    icon: "tag",
    tag: "Series",
    badgeType: "primary",
    group: "Documents & Print",
  },
  {
    id: "terms-engine",
    title: "Commercial Terms Engine",
    subtitle: "Legal clauses, return policies, warranty disclaimers & jurisdiction notes",
    icon: "gavel",
    tag: "Legal",
    badgeType: "info",
    group: "Documents & Print",
  },
  {
    id: "approval-matrix",
    title: "Approval Matrix Engine",
    subtitle: "Multi-tier signing authority rules, high-value thresholds & pending approvals",
    icon: "fact_check",
    tag: "Governance",
    badgeType: "warning",
    group: "Documents & Print",
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
  },
  {
    id: "data-exchange",
    title: "Data Exchange & Migration",
    subtitle: "Universal CSV bulk migration, data validation pipeline & export engine",
    icon: "swap_horiz",
    tag: "ETL / CSV",
    badgeType: "info",
    group: "Data & Config",
  },
  {
    id: "company-setup",
    title: "Company Setup Wizard",
    subtitle: "Interactive onboarding wizard for organization, branches & initial masters",
    icon: "magic_button",
    tag: "Setup",
    badgeType: "primary",
    group: "Data & Config",
  },
  {
    id: "ufe",
    title: "Field Explorer (UFE)",
    subtitle: "Universal Field Explorer for dynamic entity schemas, validation & metadata",
    icon: "search",
    tag: "Schema",
    badgeType: "info",
    group: "Data & Config",
  },
  {
    id: "formulas",
    title: "KPI & Formula Registry",
    subtitle: "Business formula definitions, gross margin calculators & KPI telemetry",
    icon: "calculate",
    tag: "Formulas",
    badgeType: "info",
    group: "Data & Config",
  },
  {
    id: "psv",
    title: "Channel Stock Visibility (PSV)",
    subtitle: "Party stock visibility, partner sell-through analytics & channel cover weeks",
    icon: "hub",
    tag: "Distribution",
    badgeType: "primary",
    group: "Data & Config",
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
    id: "audit-logs",
    title: "Security & Audit Logs",
    subtitle: "Immutable system activity audit logs, user login events & transaction traces",
    icon: "policy",
    tag: "Security",
    badgeType: "warning",
    group: "System & Operations",
  },
  {
    id: "dev-tracker",
    title: "Dev Intelligence Center",
    subtitle: "Real-time API performance health, technical debt logs & build diagnostics",
    icon: "monitoring",
    tag: "DevOps",
    badgeType: "info",
    group: "System & Operations",
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
    tag: "v4.0.0",
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
];

export const FioriLaunchpad: React.FC<FioriLaunchpadProps> = ({ onSelectModule }) => {
  const groups = Array.from(new Set(LAUNCHPAD_CATALOG.map((t) => t.group)));

  return (
    <div className="flex-1 bg-theme-surface-1 overflow-y-auto p-4 md:p-6 space-y-6 select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">
            SMRITI Retail OS Launchpad
          </h1>
          <p className="text-xs md:text-sm text-indigo-100 mt-1 max-w-xl">
            Unified operational launcher and workspace director for enterprise retail workflows.
          </p>
        </div>

        {/* System Summary Badge Box */}
        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/20 self-start md:self-auto font-mono">
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-indigo-200 uppercase font-semibold text-[10px]">Workspaces</div>
            <div className="text-base font-bold text-white">{LAUNCHPAD_CATALOG.length}</div>
          </div>
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-indigo-200 uppercase font-semibold text-[10px]">Architecture</div>
            <div className="text-base font-bold text-emerald-300">FastAPI + PG</div>
          </div>
          <div className="text-center px-3">
            <div className="text-indigo-200 uppercase font-semibold text-[10px]">Edition</div>
            <div className="text-base font-bold text-white">Enterprise</div>
          </div>
        </div>
      </div>

      {/* Grouped Tiles */}
      {groups.map((groupName) => {
        const tiles = LAUNCHPAD_CATALOG.filter((t) => t.group === groupName);

        return (
          <section key={groupName} className="space-y-3">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2">
              <h2 className="text-xs font-bold text-theme-primary uppercase tracking-wider flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{groupName}</span>
              </h2>
              <span className="text-[11px] text-theme-muted font-mono">{tiles.length} Workspaces</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => onSelectModule(tile.id)}
                  className="group bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider hover:border-blue-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  {/* Subtle Top Accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Icon & Tag Header */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 group-hover:bg-blue-600 text-blue-400 group-hover:text-white flex items-center justify-center transition-colors shadow-xs shrink-0 border border-blue-500/20">
                        <span className="material-symbols-outlined text-[20px]">{tile.icon}</span>
                      </div>

                      {tile.tag && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border ${
                            tile.badgeType === "success"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : tile.badgeType === "warning"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}
                        >
                          {tile.tag}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-theme-primary group-hover:text-blue-400 transition-colors mt-1 font-display">
                      {tile.title}
                    </h3>
                    <p className="text-xs text-theme-muted mt-1 leading-snug line-clamp-2">
                      {tile.subtitle}
                    </p>
                  </div>

                  {/* Tile Footer Link Indicator */}
                  <div className="mt-3.5 pt-2 border-t border-theme-divider flex items-center justify-between text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform font-mono">
                    <span>Open Workspace</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
