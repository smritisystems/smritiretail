/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.11
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Classic ERP Workspace Directory (Traditional, Dense, High-Efficiency)
 */

import React, { useMemo, useState, useEffect } from "react";
import {
  Search,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Star,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Plus,
  Edit,
  Trash2,
  Info,
  MoreHorizontal,
  MoreVertical,
  Copy,
  Folder,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext.tsx";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import type { TileData } from "./launchpadCatalog.ts";
import {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
  synthesizeLaunchpadCatalogWithRemoteMenus,
} from "./launchpadCatalog.ts";

export interface ClassicWorkspaceDirectoryProps {
  currentUser?: { role: string; name: string } | null;
  onSelectModule: (moduleId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ClassicWorkspaceDirectory: React.FC<ClassicWorkspaceDirectoryProps> = ({
  currentUser,
  onSelectModule,
  onNavigateTab,
}) => {
  const { popOutExternalWindow } = useWorkspace();

  // Active top tab state in Classic workspace
  const [activeClassicTab, setActiveClassicTab] = useState<"workspaces" | "dashboard">("workspaces");

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Tree Sidebar Selection & Collapse State
  const [selectedSidebarNode, setSelectedSidebarNode] = useState<string>("all-workspaces");
  const [collapsedTreeSections, setCollapsedTreeSections] = useState<Record<string, boolean>>({
    retail: false,
    finance: false,
    crm: false,
    masters: false,
    reports: true,
    tools: true,
    settings: true,
  });

  // Selected row & Details Panel tab
  const [selectedTileId, setSelectedTileId] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [detailsTab, setDetailsTab] = useState<"details" | "shortcuts" | "access">("details");
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(true);
  const [actionFeedback, setActionFeedback] = useState<string>("");

  // Live remote control plane menus
  const [remoteMenus, setRemoteMenus] = useState<any[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadControlPlaneMenus() {
      try {
        const res = await apiFetchV1<any[]>("/menus/resolved");
        if (!isMounted) return;
        const data = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
        if (Array.isArray(data) && data.length > 0) {
          setRemoteMenus(data);
        }
      } catch {
        // Retain static catalog fallback offline
      }
    }
    loadControlPlaneMenus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Synthesize catalog
  const activeCatalog = useMemo(() => {
    if (!remoteMenus || remoteMenus.length === 0) {
      return LAUNCHPAD_CATALOG;
    }
    return synthesizeLaunchpadCatalogWithRemoteMenus(remoteMenus, LAUNCHPAD_CATALOG);
  }, [remoteMenus]);

  // Permitted tiles (deny-by-default role security)
  const visibleTiles = useMemo(() => {
    return getVisibleLaunchpadTiles(currentUser?.role, activeCatalog);
  }, [currentUser?.role, activeCatalog]);

  // Select first tile by default if none selected
  useEffect(() => {
    if (visibleTiles.length > 0 && !selectedTileId) {
      setSelectedTileId(visibleTiles[0].id);
    }
  }, [visibleTiles, selectedTileId]);

  // Available groups
  const allCategories = useMemo(() => {
    return Array.from(new Set(visibleTiles.map((t) => t.group)));
  }, [visibleTiles]);

  // Filtered tiles based on search, category, and sidebar selection
  const filteredTiles = useMemo(() => {
    let list = visibleTiles;

    // Sidebar filter
    if (selectedSidebarNode === "favorites") {
      list = list.filter((t) => t.isQuickAction || t.tag === "Billing" || t.tag === "Sales");
    } else if (selectedSidebarNode === "recent") {
      list = list.slice(0, 10);
    } else if (selectedSidebarNode.startsWith("group:")) {
      const grp = selectedSidebarNode.replace("group:", "");
      list = list.filter((t) => t.group.toLowerCase().includes(grp.toLowerCase()));
    }

    // Category dropdown filter
    if (selectedCategoryFilter !== "ALL") {
      list = list.filter((t) => t.group === selectedCategoryFilter);
    }

    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.subtitle.toLowerCase().includes(q) ||
          t.group.toLowerCase().includes(q) ||
          (t.tag && t.tag.toLowerCase().includes(q)) ||
          t.id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [visibleTiles, selectedSidebarNode, selectedCategoryFilter, searchTerm]);

  // Currently active tile in details panel
  const selectedTile = useMemo(() => {
    return visibleTiles.find((t) => t.id === selectedTileId) || filteredTiles[0] || visibleTiles[0];
  }, [visibleTiles, filteredTiles, selectedTileId]);

  const toggleTreeSection = (section: string) => {
    setCollapsedTreeSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSelectAllRows = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const all: Record<string, boolean> = {};
      filteredTiles.forEach((t) => {
        all[t.id] = true;
      });
      setSelectedRows(all);
    } else {
      setSelectedRows({});
    }
  };

  const handleRowCheckbox = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLink = () => {
    if (!selectedTile) return;
    const url = `${window.location.origin}/#${selectedTile.id}`;
    navigator.clipboard?.writeText(url);
    setActionFeedback("Route copied to clipboard!");
    setTimeout(() => setActionFeedback(""), 2500);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "Enter" && selectedTile) {
        e.preventDefault();
        onSelectModule(selectedTile.id);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const currIdx = filteredTiles.findIndex((t) => t.id === selectedTileId);
        if (currIdx < filteredTiles.length - 1) {
          setSelectedTileId(filteredTiles[currIdx + 1].id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const currIdx = filteredTiles.findIndex((t) => t.id === selectedTileId);
        if (currIdx > 0) {
          setSelectedTileId(filteredTiles[currIdx - 1].id);
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        setIsDetailsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTile, selectedTileId, filteredTiles, onSelectModule]);

  // Color mapping helper for Category badges
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Retail Operations":
      case "Billing":
      case "Sales":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
      case "Master Data & Stock":
      case "Procurement":
      case "Inventory":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
      case "Inward Dock":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
      case "Finance & Ledgers":
      case "Ledger":
      case "Accounting":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
      case "GST Compliance":
      case "Day Close":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
      case "Stores":
      case "Suppliers":
        return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800";
      case "Analytics":
      case "Visual Reports":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div
      data-testid="classic-workspace-directory"
      className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#f4f6fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased select-none"
    >
      {/* 1. Sub-Header Tabs Strip (Dashboard | Workspaces) */}
      <div className="h-9 bg-[#e9edf4] dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 h-full">
          <button
            type="button"
            onClick={() => {
              setActiveClassicTab("dashboard");
              if (onNavigateTab) onNavigateTab("dashboard");
            }}
            className={`h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-t-2 transition-all cursor-pointer ${
              activeClassicTab === "dashboard"
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-blue-600 shadow-2xs font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <span>Dashboard</span>
            <span className="text-[10px] text-slate-400 hover:text-slate-600">×</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveClassicTab("workspaces")}
            className={`h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-t-2 transition-all cursor-pointer ${
              activeClassicTab === "workspaces"
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-blue-600 shadow-2xs font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <span>Workspaces</span>
            <span className="text-[10px] text-slate-400 hover:text-slate-600">×</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Enterprise Classic ERP View</span>
          <span>•</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {filteredTiles.length} of {visibleTiles.length} Workspaces
          </span>
        </div>
      </div>

      {/* 2. Main Body: Hierarchical Sidebar + Table Canvas + Details Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* =========================================================================
            LEFT HIERARCHICAL SIDEBAR TREE
           ========================================================================= */}
        <aside className="w-56 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          {/* Section: Workspace Top Level */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 font-mono flex items-center gap-1">
              <Folder size={12} />
              <span>Workspace</span>
            </div>

            <div className="space-y-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSidebarNode("all-workspaces");
                  setSelectedCategoryFilter("ALL");
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedSidebarNode === "all-workspaces"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border-l-2 border-blue-600"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-blue-600">apps</span>
                <span>All Workspaces</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSidebarNode("favorites")}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedSidebarNode === "favorites"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border-l-2 border-blue-600"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span>Favorites</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSidebarNode("recent")}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedSidebarNode === "recent"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border-l-2 border-blue-600"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Clock size={14} className="text-blue-500" />
                <span>Recent</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSidebarNode("all-workspaces")}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-600">person</span>
                <span>My Workspaces</span>
              </button>
            </div>
          </div>

          {/* Functional Trees */}
          <div className="py-2 space-y-1">
            {/* 1. Retail Operations */}
            <div>
              <button
                type="button"
                onClick={() => toggleTreeSection("retail")}
                className="w-full px-3 py-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">storefront</span>
                  <span>Retail Operations</span>
                </div>
                {collapsedTreeSections.retail ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsedTreeSections.retail && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div
                    onClick={() => onSelectModule("billing-workspace")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">point_of_sale</span>
                    <span>POS &amp; Billing</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("sales")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                    <span>Sales</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("purchase")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                    <span>Purchase</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("stock-ledger")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                    <span>Inventory</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("store-directory")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">store</span>
                    <span>Store Operations</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Finance & Ledgers */}
            <div>
              <button
                type="button"
                onClick={() => toggleTreeSection("finance")}
                className="w-full px-3 py-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-indigo-600">account_balance</span>
                  <span>Finance &amp; Ledgers</span>
                </div>
                {collapsedTreeSections.finance ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsedTreeSections.finance && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div
                    onClick={() => onSelectModule("business-ledger")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">menu_book</span>
                    <span>Accounting</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("ewaybill-management")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    <span>GST &amp; Compliance</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("report-designer")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">analytics</span>
                    <span>Reports</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. CRM & Customers */}
            <div>
              <button
                type="button"
                onClick={() => toggleTreeSection("crm")}
                className="w-full px-3 py-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">groups</span>
                  <span>CRM &amp; Customers</span>
                </div>
                {collapsedTreeSections.crm ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsedTreeSections.crm && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div
                    onClick={() => onSelectModule("customer-master")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">contacts</span>
                    <span>Customers</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("vendor-360")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">badge</span>
                    <span>Suppliers</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("crm")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">hub</span>
                    <span>CRM</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Masters */}
            <div>
              <button
                type="button"
                onClick={() => toggleTreeSection("masters")}
                className="w-full px-3 py-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-purple-600">category</span>
                  <span>Masters</span>
                </div>
                {collapsedTreeSections.masters ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsedTreeSections.masters && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div
                    onClick={() => onSelectModule("item-master")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Item Master</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("price-revision")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Price List</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("ufe")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>UOM &amp; Tax</span>
                  </div>
                  <div
                    onClick={() => onSelectModule("store-directory")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Stores &amp; Branches</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Reports */}
            <div>
              <button
                type="button"
                onClick={() => toggleTreeSection("reports")}
                className="w-full px-3 py-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">bar_chart</span>
                  <span>Reports</span>
                </div>
                {collapsedTreeSections.reports ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsedTreeSections.reports && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div
                    onClick={() => onSelectModule("report-designer")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    Sales Reports
                  </div>
                  <div
                    onClick={() => onSelectModule("procurement-visual-reports")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    Purchase Reports
                  </div>
                  <div
                    onClick={() => onSelectModule("visual-reports")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    Inventory Reports
                  </div>
                </div>
              )}
            </div>

            {/* 6. Tools & Settings */}
            <div>
              <button
                type="button"
                onClick={() => toggleTreeSection("tools")}
                className="w-full px-3 py-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-600">build</span>
                  <span>Tools &amp; Config</span>
                </div>
                {collapsedTreeSections.tools ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsedTreeSections.tools && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div
                    onClick={() => onSelectModule("data-exchange")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    Data Management
                  </div>
                  <div
                    onClick={() => onSelectModule("bulk-import-sheet")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    Import / Export
                  </div>
                  <div
                    onClick={() => onSelectModule("system-parameters")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    System Tools
                  </div>
                  <div
                    onClick={() => onSelectModule("backup-restore")}
                    className="py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                  >
                    Backup &amp; Restore
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* =========================================================================
            CENTER WORKSPACE TABLE CANVAS
           ========================================================================= */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800">
          {/* Header Title & Filter Bar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Workspaces (Classic View)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All business workspaces available in this system. Open, search and manage workspaces.
              </p>
            </div>

            {/* Search, Category & Status Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search workspaces, modules, keywords..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="active">Active Only</option>
                <option value="all">All Statuses</option>
              </select>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Left Button Group */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectModule("billing-workspace")}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus size={13} />
                <span>New Workspace (F2)</span>
              </button>

              <button
                type="button"
                disabled={!selectedTile}
                onClick={() => selectedTile && onSelectModule(selectedTile.id)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>Open (Enter)</span>
              </button>

              <button
                type="button"
                disabled={!selectedTile}
                onClick={() => {
                  setActionFeedback(`Editing properties for ${selectedTile?.title}`);
                  setTimeout(() => setActionFeedback(""), 2000);
                }}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Edit size={12} />
                <span>Edit (F4)</span>
              </button>

              <button
                type="button"
                disabled={!selectedTile}
                onClick={() => {
                  setActionFeedback(`Deactivation requires SYSADMIN confirmation`);
                  setTimeout(() => setActionFeedback(""), 2000);
                }}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={12} />
                <span>Deactivate (F5)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailsOpen((prev) => !prev)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Info size={12} />
                <span>View Details (F6)</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>More</span>
                  <ChevronDown size={12} />
                </button>
              </div>

              {actionFeedback && (
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in pl-2">
                  {actionFeedback}
                </span>
              )}
            </div>

            {/* Right: View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <TableIcon size={13} />
                <span>Table View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === "card"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <LayoutGrid size={13} />
                <span>Card View</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {viewMode === "table" ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#f8fafc] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold z-10 select-none">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center font-mono">#</th>
                    <th className="py-2 px-2 w-8 text-center">
                      <input
                        type="checkbox"
                        onChange={handleSelectAllRows}
                        checked={
                          filteredTiles.length > 0 &&
                          filteredTiles.every((t) => selectedRows[t.id])
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-3 min-w-[200px]">Workspace Name</th>
                    <th className="py-2 px-3 min-w-[280px]">Description</th>
                    <th className="py-2 px-3 w-32">Category</th>
                    <th className="py-2 px-2 w-12 text-center">Icon</th>
                    <th className="py-2 px-3 w-24 text-center">Status</th>
                    <th className="py-2 px-3 w-24">Type</th>
                    <th className="py-2 px-3 w-28 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-normal">
                  {filteredTiles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="space-y-1">
                          <p className="font-bold text-sm">No workspaces match your query.</p>
                          <p className="text-xs">Try clearing search filters or selecting All Categories.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTiles.map((tile, idx) => {
                      const isSelected = selectedTileId === tile.id;
                      const isChecked = Boolean(selectedRows[tile.id]);
                      const badgeClass = getCategoryBadgeClass(tile.tag || tile.group);

                      return (
                        <tr
                          key={tile.id}
                          onClick={() => setSelectedTileId(tile.id)}
                          onDoubleClick={() => onSelectModule(tile.id)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-[#24389c] font-medium"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          {/* 1. Number Index */}
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {idx + 1}
                          </td>

                          {/* 2. Selection Checkbox */}
                          <td className="py-2 px-2 text-center" onClick={(e) => handleRowCheckbox(tile.id, e)}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* 3. Workspace Name */}
                          <td className="py-2 px-3">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectModule(tile.id);
                              }}
                              className="font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1.5"
                            >
                              {tile.title}
                            </span>
                          </td>

                          {/* 4. Description */}
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs text-[11px]" title={tile.subtitle}>
                            {tile.subtitle}
                          </td>

                          {/* 5. Category */}
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
                              {tile.tag || tile.group}
                            </span>
                          </td>

                          {/* 6. Icon */}
                          <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">{tile.icon}</span>
                          </td>

                          {/* 7. Status */}
                          <td className="py-2 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Active
                            </span>
                          </td>

                          {/* 8. Type */}
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                            Workspace
                          </td>

                          {/* 9. Actions */}
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onSelectModule(tile.id)}
                                className="px-2.5 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-blue-600 hover:text-white border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => popOutExternalWindow(tile.id, tile.title, tile.icon)}
                                title="More options / Open in window"
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              >
                                <MoreVertical size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* Compact Grid View Alternative */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredTiles.map((tile) => (
                  <div
                    key={`card-${tile.id}`}
                    onClick={() => onSelectModule(tile.id)}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:border-blue-600 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">{tile.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {tile.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {tile.subtitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-100 dark:border-slate-700/60 font-mono">
                      <span className="text-blue-600 font-bold">{tile.tag || "Module"}</span>
                      <span>Launch ›</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* =========================================================================
            RIGHT-SIDE WORKSPACE DETAILS PANEL
           ========================================================================= */}
        {isDetailsOpen && selectedTile && (
          <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar shadow-xs">
            {/* Header: Icon, Title & Close */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                    <span className="material-symbols-outlined text-[24px]">{selectedTile.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                      {selectedTile.title}
                    </h3>
                    <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {selectedTile.tag || selectedTile.group}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                  aria-label="Close details panel"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {selectedTile.subtitle}
              </p>

              {/* Big Primary Action: Open Workspace */}
              <button
                type="button"
                onClick={() => onSelectModule(selectedTile.id)}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <ArrowUpRight size={15} />
                <span>Open Workspace</span>
              </button>
            </div>

            {/* Details Tabs: Details | Shortcuts | Access */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setDetailsTab("details")}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  detailsTab === "details"
                    ? "border-blue-600 text-blue-700 dark:text-blue-300 font-extrabold"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab("shortcuts")}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  detailsTab === "shortcuts"
                    ? "border-blue-600 text-blue-700 dark:text-blue-300 font-extrabold"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Shortcuts
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab("access")}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  detailsTab === "access"
                    ? "border-blue-600 text-blue-700 dark:text-blue-300 font-extrabold"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Access
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-4 flex-1 space-y-3 text-xs">
              {detailsTab === "details" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Category</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedTile.tag || selectedTile.group}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Type</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Workspace</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Active</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">15 Oct 2026 10:30</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">20 Oct 2026 14:22</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Workspace ID</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {`WS-${String(filteredTiles.findIndex((t) => t.id === selectedTile.id) + 1 || 1).padStart(3, "0")}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Route</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {selectedTile.id === "billing-workspace" ? "/billing/desktop" : `/${selectedTile.id}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Icon</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedTile.icon}</span>
                  </div>

                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Description
                    </span>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed border border-slate-200 dark:border-slate-700">
                      {selectedTile.subtitle}
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === "shortcuts" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span>Quick Launch</span>
                    <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                      {selectedTile.shortcut || "Enter"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span>Details Toggle</span>
                    <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      F6
                    </span>
                  </div>
                </div>
              )}

              {detailsTab === "access" && (
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
                    Authorized User Roles:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedTile.roles || ["SYSADMIN", "MANAGER", "CASHIER"]).map((r) => (
                      <span
                        key={r}
                        className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Quick Actions
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActionFeedback("Added to Favorites!");
                    setTimeout(() => setActionFeedback(""), 2000);
                  }}
                  className="py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer text-[11px]"
                >
                  <Star size={13} className="text-amber-500" />
                  <span>Add to Favorites</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy Link</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActionFeedback(`Editing workspace ${selectedTile.title}`);
                  setTimeout(() => setActionFeedback(""), 2000);
                }}
                className="w-full py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer text-xs"
              >
                <Edit size={13} />
                <span>Edit Workspace</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default ClassicWorkspaceDirectory;
