/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SMRITI Context-Aware Navigation Sidebar (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.3.0 (SMRITI Launchpad Upgrade)
 */

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Grid,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Package,
  Users,
  Briefcase,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  Settings,
  ShieldCheck,
  Building,
  RefreshCw,
  Sliders,
  Sparkles,
  BookOpen,
  FileCode,
  Truck,
  Layers,
  Bot
} from "lucide-react";

export type DomainCategory = "Sales" | "Inventory" | "Purchase" | "Finance" | "Administration" | "Analytics";

export interface ContextualMenuItem {
  id: string;
  title: string;
  icon: React.ElementType;
  targetTab: string;
  badge?: string;
}

const DOMAIN_SUBMODULES: Record<DomainCategory, ContextualMenuItem[]> = {
  Sales: [
    { id: "pos", title: "Point of Sale", icon: ShoppingCart, targetTab: "pos", badge: "Live" },
    { id: "sales", title: "Sales Invoices", icon: Receipt, targetTab: "sales" },
    { id: "sales-returns", title: "Sales Returns", icon: RotateCcw, targetTab: "sales-returns" },
    { id: "customers", title: "Customer CRM", icon: Users, targetTab: "customers" },
  ],
  Inventory: [
    { id: "item-master", title: "Product Master", icon: Package, targetTab: "item-master" },
    { id: "stock-ledger", title: "Stock Ledger", icon: Layers, targetTab: "stock-ledger" },
    { id: "consignment", title: "Consignment Studio", icon: Truck, targetTab: "consignment" },
    { id: "barcode", title: "Barcode Studio", icon: Printer, targetTab: "barcode" },
    { id: "print-studio", title: "Label Printer Hub", icon: Printer, targetTab: "print-studio" },
    { id: "universal-label-printer", title: "Universal Label Printer", icon: Printer, targetTab: "universal-label-printer" },
  ],
  Purchase: [
    { id: "purchase", title: "Procurement POs", icon: Briefcase, targetTab: "purchase" },
    { id: "suppliers", title: "Supplier Registry", icon: Building, targetTab: "supplier-mgmt" },
  ],
  Finance: [
    { id: "ledger", title: "Financial Ledger", icon: DollarSign, targetTab: "ledger" },
    { id: "accounting-sync", title: "Tally Sync", icon: RefreshCw, targetTab: "accounting-sync" },
    { id: "audit-logs", title: "Audit Trail", icon: ShieldCheck, targetTab: "audit-logs" },
  ],
  Administration: [
    { id: "staff", title: "User & Role RBAC", icon: ShieldCheck, targetTab: "staff" },
    { id: "master-management", title: "System Config", icon: Settings, targetTab: "master-management" },
    { id: "ai-config", title: "AI Configuration", icon: Bot, targetTab: "ai-config" },
    { id: "launchpad-config", title: "Launchpad Config", icon: Grid, targetTab: "launchpad-config" },
    { id: "terms-engine", title: "Terms Engine", icon: Sliders, targetTab: "terms-engine" },
    { id: "data-exchange", title: "Data Exchange", icon: FileCode, targetTab: "data-exchange" },
  ],
  Analytics: [
    { id: "dashboard", title: "Executive Dashboard", icon: TrendingUp, targetTab: "dashboard" },
    { id: "reports", title: "Daily Summaries", icon: FileText, targetTab: "reports" },
  ],
};

interface ContextualSidebarProps {
  activeTab: string;
  activeDomain?: DomainCategory;
  onSelectTab: (tabId: string) => void;
  onReturnToLaunchpad: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const ContextualSidebar: React.FC<ContextualSidebarProps> = ({
  activeTab,
  activeDomain = "Sales",
  onSelectTab,
  onReturnToLaunchpad,
  mobileOpen = false,
  onMobileClose,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const subModules = DOMAIN_SUBMODULES[activeDomain] || DOMAIN_SUBMODULES.Sales;

  return (
    <aside
      className={`h-full bg-theme-surface-1 border-r border-theme-divider flex flex-col justify-between transition-all duration-300 select-none z-40 fixed left-0 top-12 bottom-0 md:relative md:inset-auto md:z-20 md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${collapsed ? "w-16" : "w-60"}`}
    >
      {/* Sidebar Header */}
      <div className="p-3 border-b border-theme-divider flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--c-seef-accent)" }} />
            <span className="seds-text-overline text-theme-heading truncate">
              {activeDomain} Domain
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-heading transition-colors"
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Return to Launchpad Button */}
      <div className="p-2 border-b border-theme-divider">
        <button
          onClick={onReturnToLaunchpad}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg seds-text-button border transition-all ${
            collapsed ? "justify-center px-0" : ""
          }`}
          style={{
            background: "rgba(var(--c-seef-accent-rgb, 10 110 209) / 0.10)",
            color: "var(--c-seef-accent)",
            borderColor: "rgba(var(--c-seef-accent-rgb, 10 110 209) / 0.30)",
          }}
          title="Return to SMRITI Launchpad"
        >
          <Grid size={18} className="shrink-0" />
          {!collapsed && <span>SMRITI Launchpad</span>}
        </button>
      </div>

      {/* Contextual Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
        {subModules.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.targetTab;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.targetTab);
                onMobileClose?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg seds-text-small font-medium transition-all ${
                isActive
                  ? "text-white font-bold shadow-xs"
                  : "text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2"
              } ${collapsed ? "justify-center px-0" : ""}`}
              style={isActive ? { background: "var(--c-seef-accent)" } : {}}
              title={collapsed ? item.title : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.title}</span>
                  {item.badge && (
                    <span
            className="px-1.5 py-0.2 seds-text-overline rounded"
            style={{ background: "rgba(var(--c-seef-accent-rgb, 10 110 209) / 0.20)", color: "var(--c-seef-accent)" }}
          >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-theme-divider text-[10px] text-theme-muted font-mono flex items-center justify-between">
          <span>SMRITI Fiori v5.1</span>
          <span className="text-emerald-400">● Live</span>
        </div>
      )}
    </aside>
  );
};
