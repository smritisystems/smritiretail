/**
 * Project      : SMRITI Retail OS
 * Module       : SAP Fiori Workspace-First Launchpad (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.0.0
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
  Tag,
  Printer,
  Search,
  Grid,
  Sparkles,
  ChevronRight,
  Clock,
  Briefcase
} from "lucide-react";

export interface LaunchpadTile {
  id: string;
  title: string;
  subtitle: string;
  category: "Operations" | "Masters" | "Analytics" | "Administration";
  icon: React.ElementType;
  permissionScope: string; // e.g. "POS_VIEW", "SALES_VIEW"
  accentColor: string; // Tailored HSL gradient/border color
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
  userPermissions?: string[]; // Array of authorized permission scopes from backend RBAC
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
    accentColor: "from-blue-500/20 to-cyan-500/20 border-cyan-500/40 text-cyan-400",
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
    accentColor: "from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400",
    targetTab: "sales",
  },
  {
    id: "sales-returns",
    title: "Sales Returns",
    subtitle: "Customer Credit Notes & RMA Processing",
    category: "Operations",
    icon: RotateCcw,
    permissionScope: "SALES_RETURN",
    accentColor: "from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400",
    targetTab: "sales-returns",
  },
  {
    id: "purchase-studio",
    title: "Procurement & POs",
    subtitle: "Purchase Orders, GRNs & Vendor Bills",
    category: "Operations",
    icon: Briefcase,
    permissionScope: "PURCHASE_VIEW",
    accentColor: "from-purple-500/20 to-violet-500/20 border-purple-500/40 text-purple-400",
    targetTab: "purchase",
  },
  {
    id: "item-master",
    title: "Product Master",
    subtitle: "Inventory SKUs, Pricing & Barcodes",
    category: "Masters",
    icon: Package,
    permissionScope: "ITEM_VIEW",
    accentColor: "from-indigo-500/20 to-blue-500/20 border-indigo-500/40 text-indigo-400",
    targetTab: "items",
  },
  {
    id: "customer-master",
    title: "Customer CRM",
    subtitle: "Profiles, Credit Limits & History",
    category: "Masters",
    icon: Users,
    permissionScope: "CRM_VIEW",
    accentColor: "from-pink-500/20 to-rose-500/20 border-rose-500/40 text-rose-400",
    targetTab: "customers",
  },
  {
    id: "print-labels",
    title: "Barcode Label Hub",
    subtitle: "Direct Thermal & Label Printing",
    category: "Masters",
    icon: Printer,
    permissionScope: "PRINT_VIEW",
    accentColor: "from-sky-500/20 to-blue-500/20 border-sky-500/40 text-sky-400",
    targetTab: "print-labels",
  },
  {
    id: "daily-reports",
    title: "Reports & Analytics",
    subtitle: "Valuation, GST & Daily Summaries",
    category: "Analytics",
    icon: FileText,
    permissionScope: "REPORT_VIEW",
    accentColor: "from-yellow-500/20 to-amber-500/20 border-yellow-500/40 text-yellow-400",
    targetTab: "reports",
  },
  {
    id: "business-ledger",
    title: "Financial Ledger",
    subtitle: "Cash Flow & Double-Entry Ledger",
    category: "Analytics",
    icon: DollarSign,
    permissionScope: "ACCOUNTING_VIEW",
    accentColor: "from-emerald-500/20 to-green-500/20 border-green-500/40 text-green-400",
    targetTab: "ledger",
  },
  {
    id: "dashboard-analytics",
    title: "Executive Dashboard",
    subtitle: "KPI Metrics & Sales Performance",
    category: "Analytics",
    icon: TrendingUp,
    permissionScope: "DASHBOARD_VIEW",
    accentColor: "from-teal-500/20 to-cyan-500/20 border-teal-500/40 text-teal-400",
    targetTab: "dashboard",
  },
  {
    id: "staff-management",
    title: "User & Role RBAC",
    subtitle: "Staff Permissions & Access Control",
    category: "Administration",
    icon: ShieldCheck,
    permissionScope: "SECURITY_ADMIN",
    accentColor: "from-red-500/20 to-rose-500/20 border-red-500/40 text-red-400",
    targetTab: "staff",
  },
  {
    id: "master-settings",
    title: "System Config",
    subtitle: "Company Setup & Application Flags",
    category: "Administration",
    icon: Settings,
    permissionScope: "SYSTEM_ADMIN",
    accentColor: "from-slate-500/20 to-zinc-500/20 border-slate-500/40 text-slate-400",
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
    // Admin role has all tiles unlocked
    const isAdmin = currentUser?.role?.toLowerCase().includes("admin") || currentUser?.role?.toLowerCase().includes("manager");
    
    let filtered = ALL_LAUNCHPAD_TILES.filter((tile) => {
      if (isAdmin) return true;
      if (!userPermissions || userPermissions.length === 0) return true; // Fallback default
      return userPermissions.includes(tile.permissionScope);
    });

    // Governance Cap: Max 12 tiles
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Launchpad Top Header (SAP Fiori Header Pattern) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> SMRITI Retail OS v5.0
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {currentTimeStr} IST
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {currentUser?.name || "Cashier"}
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Role:{" "}
              <span className="text-slate-200 font-medium capitalize">
                {currentUser?.role || "Staff"}
              </span>{" "}
              | Company: {currentUser?.companyId || "Default Org"} | Branch:{" "}
              {currentUser?.branchId || "HQ"}
            </p>
          </div>

          {/* Quick Search Input */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search applications (Ctrl+K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5" /> Domains:
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20"
                  : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dynamic Launchpad Grid (Max 12 Tiles) */}
        {displayedTiles.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-sm">No applications found matching "{searchQuery}".</p>
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
                  className={`group relative cursor-pointer bg-slate-900/80 hover:bg-slate-900 border rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1 overflow-hidden backdrop-blur-md ${tile.accentColor}`}
                >
                  {/* Subtle Top Border Glow */}
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-6 h-6" />
                    </div>
                    {tile.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {tile.badge}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                      {tile.title}
                      <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {tile.subtitle}
                    </p>
                  </div>

                  {/* Tile Footer Scope Tag */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{tile.category}</span>
                    <span className="font-mono text-[10px] text-slate-600 group-hover:text-slate-400">
                      {tile.permissionScope}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer Governance Indicator */}
        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
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
