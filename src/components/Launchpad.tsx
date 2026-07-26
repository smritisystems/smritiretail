/**
 * Project      : SMRITI Retail OS
 * Module       : SAP Fiori Workspace-First Launchpad (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.1.0 (SEEF Phase 8 — Token Upgrade)
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
    targetTab: "items",
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
    id: "print-labels",
    title: "Barcode Label Hub",
    subtitle: "Direct Thermal & Label Printing",
    category: "Masters",
    icon: Printer,
    permissionScope: "PRINT_VIEW",
    accentColor: "border-sky-500/40 text-sky-400",
    targetTab: "print-labels",
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
    const isAdmin = currentUser?.role?.toLowerCase().includes("admin") || currentUser?.role?.toLowerCase().includes("manager");
    
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

  const currentTimeStr = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-theme-base text-theme-body p-6 md:p-10 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Launchpad Top Header (SAP Fiori Header Pattern) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-theme-divider">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> SMRITI Retail OS v5.1 Fiori
              </span>
              <span className="text-xs text-theme-muted flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {currentTimeStr} IST
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-theme-heading">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {currentUser?.name || "Cashier"}
              </span>
            </h1>
            <p className="text-theme-muted text-sm mt-1">
              Role:{" "}
              <span className="text-theme-body font-medium capitalize">
                {currentUser?.role || "Staff"}
              </span>{" "}
              | Company: {currentUser?.companyId || "Default Org"} | Branch:{" "}
              {currentUser?.branchId || "HQ"}
            </p>
          </div>

          {/* Quick Search Input */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search applications (Ctrl+K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl pl-10 pr-4 py-2.5 text-sm text-theme-body placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="text-xs font-semibold text-theme-muted uppercase tracking-wider mr-2 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5" /> Domains:
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20"
                  : "bg-theme-surface-1 text-theme-muted hover:bg-theme-surface-2 hover:text-theme-heading border border-theme-divider"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dynamic Launchpad Grid (Max 12 Tiles) */}
        {displayedTiles.length === 0 ? (
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-12 text-center">
            <p className="text-theme-muted text-sm">No applications found matching "{searchQuery}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {displayedTiles.map((tile, idx) => {
              const Icon = tile.icon;
              return (
                <motion.div
                  key={tile.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  onClick={() => onSelectTab(tile.targetTab)}
                  className={`group relative cursor-pointer bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1 overflow-hidden ${tile.accentColor}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-theme-surface-2 border border-theme-divider group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-6 h-6" />
                    </div>
                    {tile.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        {tile.badge}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-theme-heading group-hover:text-cyan-400 transition-colors flex items-center justify-between">
                      {tile.title}
                      <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
                    </h3>
                    <p className="text-xs text-theme-muted mt-1 line-clamp-2 leading-relaxed">
                      {tile.subtitle}
                    </p>
                  </div>

                  {/* Tile Footer Scope Tag */}
                  <div className="mt-4 pt-3 border-t border-theme-divider flex items-center justify-between text-[11px] text-theme-muted">
                    <span>{tile.category}</span>
                    <span className="font-mono text-[10px] text-theme-muted">
                      {tile.permissionScope}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer Governance Indicator */}
        <div className="pt-6 border-t border-theme-divider flex flex-col sm:flex-row items-center justify-between text-xs text-theme-muted gap-4">
          <p>© SMRITIBooks.com — SMRITI Business OS (Governance WNG-002 Certified)</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> System Operational
            </span>
            <span>Active Apps: {displayedTiles.length} / {ALL_LAUNCHPAD_TILES.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
