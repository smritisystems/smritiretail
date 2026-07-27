/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SMRITI Workspace-First Launchpad (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.3.0 (SMRITI Launchpad Upgrade)
 */

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  RotateCcw,
  Receipt,
  Package,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Settings,
  ShieldCheck,
  Printer,
  Search,
  Grid,
  Sparkles,
  ChevronRight,
  Clock,
  Briefcase,
  Layers,
  Truck,
  Sliders,
  FileCode
} from "lucide-react";

export interface LaunchpadTile {
  id: string;
  title: string;
  subtitle: string;
  category: "Operations" | "Masters" | "Analytics" | "Administration";
  icon: React.ElementType;
  permissionScope: string;
  accentColor: string;
  badge?: string;
  targetTab: string;
}

interface LaunchpadProps {
  currentUser: {
    role: string;
    name: string;
    companyId?: string;
    branchId?: string;
  } | null;
  userPermissions?: string[];
  onSelectTab: (tabId: string) => void;
}

// Master Tile Catalog (Governance WNG-002 Cap: Max 12 tiles active per role)
const ALL_LAUNCHPAD_TILES: LaunchpadTile[] = [
  {
    id: "pos-terminal",
    title: "Point of Sale (POS)",
    subtitle: "Quick Checkout & Shift Management",
    category: "Operations",
    icon: ShoppingCart,
    permissionScope: "POS_VIEW",
    accentColor: "border-cyan-500/40 text-cyan-400",
    badge: "Fast Track",
    targetTab: "pos",
  },
  {
    id: "sales-studio",
    title: "Sales & Invoicing",
    subtitle: "Tax Invoices, Quotations & Deliveries",
    category: "Operations",
    icon: Receipt,
    permissionScope: "SALES_VIEW",
    accentColor: "border-emerald-500/40 text-emerald-400",
    targetTab: "sales",
  },
  {
    id: "sales-returns",
    title: "Sales Returns",
    subtitle: "Customer Credit Notes & RMA Processing",
    category: "Operations",
    icon: RotateCcw,
    permissionScope: "SALES_RETURN",
    accentColor: "border-amber-500/40 text-amber-400",
    targetTab: "sales-returns",
  },
  {
    id: "purchase-studio",
    title: "Procurement & POs",
    subtitle: "Purchase Orders, GRNs & Vendor Bills",
    category: "Operations",
    icon: Briefcase,
    permissionScope: "PURCHASE_VIEW",
    accentColor: "border-purple-500/40 text-purple-400",
    targetTab: "purchase",
  },
  {
    id: "item-master",
    title: "Product Master",
    subtitle: "Inventory SKUs, Pricing & Barcodes",
    category: "Masters",
    icon: Package,
    permissionScope: "ITEM_VIEW",
    accentColor: "border-indigo-500/40 text-indigo-400",
    targetTab: "item-master",
  },
  {
    id: "customer-master",
    title: "Customer CRM",
    subtitle: "Profiles, Credit Limits & History",
    category: "Masters",
    icon: Users,
    permissionScope: "CRM_VIEW",
    accentColor: "border-rose-500/40 text-rose-400",
    targetTab: "customers",
  },
  {
    id: "print-studio",
    title: "Barcode Label Hub",
    subtitle: "Direct Thermal & Label Printing",
    category: "Masters",
    icon: Printer,
    permissionScope: "PRINT_VIEW",
    accentColor: "border-sky-500/40 text-sky-400",
    targetTab: "print-studio",
  },
  {
    id: "daily-reports",
    title: "Reports & Analytics",
    subtitle: "Valuation, GST & Daily Summaries",
    category: "Analytics",
    icon: FileText,
    permissionScope: "REPORT_VIEW",
    accentColor: "border-yellow-500/40 text-yellow-400",
    targetTab: "reports",
  },
  {
    id: "business-ledger",
    title: "Financial Ledger",
    subtitle: "Cash Flow & Double-Entry Ledger",
    category: "Analytics",
    icon: DollarSign,
    permissionScope: "ACCOUNTING_VIEW",
    accentColor: "border-green-500/40 text-green-400",
    targetTab: "ledger",
  },
  {
    id: "dashboard-analytics",
    title: "Executive Dashboard",
    subtitle: "KPI Metrics & Sales Performance",
    category: "Analytics",
    icon: TrendingUp,
    permissionScope: "DASHBOARD_VIEW",
    accentColor: "border-teal-500/40 text-teal-400",
    targetTab: "dashboard",
  },
  {
    id: "staff-management",
    title: "User & Role RBAC",
    subtitle: "Staff Permissions & Access Control",
    category: "Administration",
    icon: ShieldCheck,
    permissionScope: "SECURITY_ADMIN",
    accentColor: "border-red-500/40 text-red-400",
    targetTab: "staff",
  },
  {
    id: "master-settings",
    title: "System Config",
    subtitle: "Company Setup & Application Flags",
    category: "Administration",
    icon: Settings,
    permissionScope: "SYSTEM_ADMIN",
    accentColor: "border-theme-divider text-theme-muted",
    targetTab: "master-management",
  },
];

export const Launchpad: React.FC<LaunchpadProps> = ({
  currentUser,
  userPermissions,
  onSelectTab,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // 1. RBAC Dynamic Filtering (Governance WNG-002: max 12 tiles, disabled tiles NOT rendered)
  const authorizedTiles = useMemo(() => {
    const isAdmin =
      currentUser?.role?.toLowerCase().includes("admin") ||
      currentUser?.role?.toLowerCase().includes("manager");

    let filtered = ALL_LAUNCHPAD_TILES.filter((tile) => {
      if (isAdmin) return true;
      if (!userPermissions || userPermissions.length === 0) return true;
      return userPermissions.includes(tile.permissionScope);
    });

    return filtered.slice(0, 12);
  }, [currentUser, userPermissions]);

  // 2. Search & Category Filter
  const displayedTiles = useMemo(() => {
    return authorizedTiles.filter((tile) => {
      const matchesSearch =
        tile.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tile.subtitle.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "ALL" || tile.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [authorizedTiles, searchQuery, selectedCategory]);

  const categories = ["ALL", "Operations", "Masters", "Analytics", "Administration"];

  // Group tiles by category for authentic SAP Fiori Launchpad Group rendering
  const groupedTiles = useMemo(() => {
    const groups: { [key: string]: LaunchpadTile[] } = {};
    displayedTiles.forEach((tile) => {
      if (!groups[tile.category]) {
        groups[tile.category] = [];
      }
      groups[tile.category].push(tile);
    });
    return groups;
  }, [displayedTiles]);

  const currentTimeStr = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="w-full h-full overflow-y-auto bg-theme-base text-theme-body p-6 md:p-8 font-sans selection:bg-[#0a6ed1] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6 relative z-10 pb-12">
        {/* 1. SAP Fiori Shell Sub-Header / Welcome Banner */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-[#354a5e] text-white border border-[#4c6680] flex items-center gap-1.5 font-mono shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#6fa8dc]" /> SMRITI Launchpad v5.3
              </span>
              <span className="text-xs text-theme-muted flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5" /> {currentTimeStr} IST
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-theme-heading">
              Welcome back, {currentUser?.name || "Cashier"}
            </h1>
            <p className="text-theme-muted text-xs flex flex-wrap items-center gap-2">
              <span>Role: <strong className="text-theme-heading font-medium">{currentUser?.role || "Staff"}</strong></span>
              <span className="text-theme-divider">•</span>
              <span>Company: <strong className="text-theme-heading font-medium">{currentUser?.companyId || "Default Org"}</strong></span>
              <span className="text-theme-divider">•</span>
              <span>Branch: <strong className="text-theme-heading font-medium">{currentUser?.branchId || "HQ"}</strong></span>
            </p>
          </div>

          {/* Quick Search Input (SAP Fiori Shell Search Pattern) */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search applications (Ctrl+K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-4 py-2 text-xs text-theme-heading placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-[#0a6ed1] focus:border-[#0a6ed1] transition-all shadow-xs"
            />
          </div>
        </div>

        {/* 2. SAP Fiori Segmented Control / Category Pills Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-theme-surface-1 border border-theme-divider p-2 rounded-lg shadow-xs">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold text-theme-muted uppercase tracking-wider px-2 flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-[#0a6ed1]" /> Domains:
            </span>
            <div className="flex items-center gap-1 bg-theme-surface-2 p-1 rounded-md border border-theme-divider">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-[#0a6ed1] text-white shadow-xs"
                      : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-heading"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-mono text-theme-muted px-2 hidden sm:block">
            Governance WNG-002 Certified (Max 12 Apps)
          </div>
        </div>

        {/* 3. SAP Fiori Launchpad Tiles Grid (Grouped by Category Section) */}
        {displayedTiles.length === 0 ? (
          <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-12 text-center shadow-xs">
            <p className="text-theme-muted text-xs">No applications found matching "{searchQuery}".</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedTiles).map((catName) => (
              <div key={catName} className="space-y-3">
                {/* Section Header Banner */}
                <div className="flex items-center justify-between border-b border-theme-divider pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#0a6ed1] rounded-xs" />
                    {catName === "Operations" && "Operations & POS Transactions"}
                    {catName === "Masters" && "Master Data & Registry Hub"}
                    {catName === "Analytics" && "Analytics, Ledger & Reports"}
                    {catName === "Administration" && "Administration & System RBAC"}
                    {!["Operations", "Masters", "Analytics", "Administration"].includes(catName) && catName}
                  </h2>
                  <span className="text-[11px] font-mono text-theme-muted">
                    {groupedTiles[catName].length} {groupedTiles[catName].length === 1 ? "App" : "Apps"}
                  </span>
                </div>

                {/* Fiori Tiles Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupedTiles[catName].map((tile, idx) => {
                    const Icon = tile.icon;
                    return (
                      <motion.div
                        key={tile.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.03 }}
                        onClick={() => onSelectTab(tile.targetTab)}
                        className="group relative cursor-pointer bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider hover:border-[#0a6ed1] rounded-lg p-4 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 overflow-hidden flex flex-col justify-between"
                      >
                        {/* Top Icon & Badge Row */}
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-9 h-9 rounded-md bg-theme-surface-2 border border-theme-divider flex items-center justify-center text-[#0a6ed1] dark:text-[#6fa8dc] group-hover:scale-105 transition-transform duration-200">
                              <Icon className="w-5 h-5" />
                            </div>
                            {tile.badge && (
                              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded bg-[#0a6ed1]/15 text-[#0a6ed1] dark:text-[#6fa8dc] border border-[#0a6ed1]/30">
                                {tile.badge}
                              </span>
                            )}
                          </div>

                          {/* Title & Subtitle */}
                          <div>
                            <h3 className="text-sm font-bold text-theme-heading group-hover:text-[#0a6ed1] dark:group-hover:text-[#6fa8dc] transition-colors flex items-center justify-between">
                              {tile.title}
                              <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#0a6ed1] dark:text-[#6fa8dc]" />
                            </h3>
                            <p className="text-xs text-theme-muted mt-1 line-clamp-2 leading-relaxed font-normal">
                              {tile.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* SAP Fiori Tile Footer */}
                        <div className="mt-4 pt-2.5 border-t border-theme-divider flex items-center justify-between text-[11px] text-theme-muted">
                          <span className="font-semibold uppercase tracking-wider text-[10px]">{tile.category}</span>
                          <span className="font-mono text-[10px] text-theme-muted">
                            {tile.permissionScope}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. SAP Fiori Footer Governance Indicator */}
        <div className="pt-4 border-t border-theme-divider flex flex-col sm:flex-row items-center justify-between text-xs text-theme-muted gap-3 font-mono">
          <p>© SMRITIBooks.com — SMRITI Business OS (Governance WNG-002 Certified)</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> System Operational
            </span>
            <span>Active Apps: {displayedTiles.length} / {ALL_LAUNCHPAD_TILES.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
