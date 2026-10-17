/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.96.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical Procurement Visual Reports Dashboard Component
 * Capability    : @SmritiCapability("REPORTS", "PROCUREMENT_VISUAL_REPORTS_DASHBOARD")
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShoppingCart,
  IndianRupee,
  FileText,
  Truck,
  Package,
  Layers,
  Wallet,
  Calendar,
  Filter,
  Columns,
  Download,
  Settings,
  X,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Check,
  Eye,
  MoreHorizontal,
  ChevronRight,
  BadgeAlert,
  Building,
  Store,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from "recharts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  ProcurementKpiCard,
  PurchaseSpendTrendPoint,
  PurchaseToReceiptStage,
  TopSupplierSpend,
  PurchaseOrderStatusSlice,
  ReorderAlertItem,
  SupplierPerformanceItem,
  OpenPoReceiptItem,
  ActiveProcurementStreamItem,
  ProcurementDashboardConfigPayload,
  ProcurementReportsSummaryResponse,
} from "./procurementVisualReportsTypes.ts";

interface ProcurementVisualReportsTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigateTab?: (tab: string) => void;
}

const DEFAULT_CONFIG: ProcurementDashboardConfigPayload = {
  layout_mode: "standard",
  kpi_cards_visible: {
    purchase_orders: true,
    purchase_spend: true,
    pending_approvals: true,
    pending_receipts: true,
    received_vs_ordered: true,
    supplier_outstanding: true,
  },
  charts_visible: {
    purchase_spend_trend: true,
    purchase_to_receipt_progress: true,
    top_suppliers_spend: true,
    purchase_order_status: true,
    reorder_alert: true,
    supplier_performance: true,
  },
  chart_types: {
    purchase_spend_trend: "line",
    top_suppliers_spend: "bar",
    purchase_order_status: "donut",
    reorder_alert: "bar",
    supplier_performance: "bar",
  },
  tables_visible: {
    recent_purchase_orders: true,
    open_pos_and_receipts: true,
  },
  data_display: {
    default_tab: "all",
    rows_per_page: 10,
  },
  color_theme: "system",
  custom_palette_color: "#0284c7",
};

const PALETTE_DOTS = [
  { id: "blue", hex: "#0284c7" },
  { id: "purple", hex: "#9333ea" },
  { id: "teal", hex: "#0d9488" },
  { id: "amber", hex: "#f59e0b" },
  { id: "coral", hex: "#f43f5e" },
  { id: "pink", hex: "#ec4899" },
  { id: "slate", hex: "#64748b" },
];

export const ProcurementVisualReportsTab: React.FC<ProcurementVisualReportsTabProps> = ({
  currentUser,
  onNotification,
  onNavigateTab,
}) => {
  // ── States ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcurementReportsSummaryResponse | null>(null);
  const [config, setConfig] = useState<ProcurementDashboardConfigPayload>(() => {
    try {
      const local = localStorage.getItem("smriti_procurement_visual_dashboard_config");
      if (local) return JSON.parse(local);
    } catch {}
    return DEFAULT_CONFIG;
  });
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(false);
  const [drawerConfig, setDrawerConfig] = useState<ProcurementDashboardConfigPayload>(config);

  // Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("COMP-001");
  const [selectedCompany, setSelectedCompany] = useState<string>("My Retail Store");
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedPreset, setSelectedPreset] = useState<"FY 2026-27" | "Today" | "Last 7 Days" | "MTD" | "All Dates">("FY 2026-27");
  const [dateRangeStr, setDateRangeStr] = useState<string>("01 Apr 2026 - 31 Mar 2027");
  const [activeFiltersCount, setActiveFiltersCount] = useState<number>(3);

  // Spend Trend View Mode
  const [spendTrendMode, setSpendTrendMode] = useState<"value" | "qty">("value");
  const [spendTrendPeriod, setSpendTrendPeriod] = useState<"monthly" | "weekly" | "daily">("monthly");

  // Stream Tab & Search
  const [streamTab, setStreamTab] = useState<"all" | "po" | "gr" | "pi">("all");
  const [streamSearch, setStreamSearch] = useState<string>("");
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // Document Details Modal
  const [selectedDoc, setSelectedDoc] = useState<ActiveProcurementStreamItem | null>(null);

  // ── Fetch Initial Data ─────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId && selectedCompanyId !== "all") {
        params.append("company_id", selectedCompanyId);
      }
      if (selectedLocation && selectedLocation !== "All Locations") {
        params.append("store_location_id", selectedLocation);
      }
      if (selectedPreset === "FY 2026-27") {
        params.append("start_date", "2026-04-01");
        params.append("end_date", "2027-03-31");
      } else if (selectedPreset === "Today") {
        const today = new Date().toISOString().split("T")[0];
        params.append("start_date", today);
        params.append("end_date", today);
      } else if (selectedPreset === "Last 7 Days") {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        params.append("start_date", start.toISOString().split("T")[0]);
        params.append("end_date", end.toISOString().split("T")[0]);
      } else if (selectedPreset === "MTD") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        params.append("start_date", start.toISOString().split("T")[0]);
        params.append("end_date", now.toISOString().split("T")[0]);
      }

      const queryString = params.toString();
      const endpoint = `/reports/procurement-dashboard/summary${queryString ? `?${queryString}` : ""}`;
      const res = await apiFetchV1(endpoint);
      if (res && res.kpi_cards) {
        setData(res);
        if (res.company_name) {
          setSelectedCompany(res.company_name);
        }
        if (res.config) {
          const merged = { ...DEFAULT_CONFIG, ...res.config };
          setConfig(merged);
          setDrawerConfig(merged);
        }
      } else {
        throw new Error("Unable to parse procurement visual reports data structure from backend.");
      }
    } catch (err: any) {
      console.error("Procurement visual dashboard fetch error:", err);
      setError(err?.message || "Failed to load procurement visual reports from authoritative database.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedCompanyId, selectedLocation, selectedPreset]);

  // Sync drawer config when drawer opens
  useEffect(() => {
    if (isConfigDrawerOpen) {
      setDrawerConfig(config);
    }
  }, [isConfigDrawerOpen, config]);

  // Keyboard shortcut '/' focuses global search
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Apply & Reset Drawer ───────────────────────────────────────────────
  const handleApplyConfig = async () => {
    setConfig(drawerConfig);
    try {
      localStorage.setItem("smriti_procurement_visual_dashboard_config", JSON.stringify(drawerConfig));
      await apiFetchV1("/reports/procurement-dashboard/config", {
        method: "POST",
        body: JSON.stringify(drawerConfig),
      });
    } catch (e) {
      console.warn("Failed to persist dashboard config to backend:", e);
    }
    setIsConfigDrawerOpen(false);
    onNotification?.("Configuration Saved", "Procurement dashboard layout updated successfully.", "success");
  };

  const handleResetConfig = async () => {
    setDrawerConfig(DEFAULT_CONFIG);
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.setItem("smriti_procurement_visual_dashboard_config", JSON.stringify(DEFAULT_CONFIG));
      await apiFetchV1("/reports/procurement-dashboard/config", {
        method: "POST",
        body: JSON.stringify(DEFAULT_CONFIG),
      });
    } catch (e) {}
    setIsConfigDrawerOpen(false);
    onNotification?.("Reset to Default", "Procurement dashboard preferences restored to canonical defaults.", "info");
  };

  // ── Filter Stream Rows ─────────────────────────────────────────────────
  const filteredStream = useMemo(() => {
    if (!data?.fulfillment_stream) return [];
    return data.fulfillment_stream.filter((item) => {
      // Tab filter
      if (streamTab === "po" && item.doc_type !== "PO") return false;
      if (streamTab === "gr" && item.doc_type !== "GR") return false;
      if (streamTab === "pi" && item.doc_type !== "PI") return false;

      // Text search
      if (streamSearch.trim()) {
        const q = streamSearch.toLowerCase();
        const matches =
          item.doc_no.toLowerCase().includes(q) ||
          item.supplier.toLowerCase().includes(q) ||
          item.item_sku.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data?.fulfillment_stream, streamTab, streamSearch]);

  // Status Badge Helper
  const renderStatusBadge = (status: string, badgeColor: string) => {
    let bg = "bg-slate-100 text-slate-700 border-slate-200";
    let dot = "bg-slate-400";

    const s = status.toLowerCase();
    if (s.includes("partially") || badgeColor === "cyan") {
      bg = "bg-cyan-50 text-cyan-700 border-cyan-200";
      dot = "bg-cyan-500";
    } else if (s.includes("approved") || s.includes("received") || badgeColor === "green") {
      bg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      dot = "bg-emerald-500";
    } else if (s.includes("pending") || badgeColor === "amber") {
      bg = "bg-amber-50 text-amber-700 border-amber-200";
      dot = "bg-amber-500";
    } else if (s.includes("closed") || badgeColor === "slate") {
      bg = "bg-slate-100 text-slate-700 border-slate-200";
      dot = "bg-slate-500";
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {status}
      </span>
    );
  };

  // Doc Type Badge Helper
  const renderDocTypeBadge = (type: string) => {
    if (type === "PO") {
      return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800">PO</span>;
    }
    if (type === "GR") {
      return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">GR</span>;
    }
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">PI</span>;
  };

  // KPI Card Icon Resolver
  const renderKpiIcon = (iconName: string) => {
    switch (iconName) {
      case "shopping_cart":
        return <ShoppingCart size={18} className="text-sky-600" />;
      case "currency_rupee":
        return <IndianRupee size={18} className="text-purple-600" />;
      case "description":
        return <FileText size={18} className="text-amber-600" />;
      case "local_shipping":
        return <Truck size={18} className="text-sky-600" />;
      case "inventory_2":
        return <Layers size={18} className="text-emerald-600" />;
      case "account_balance_wallet":
        return <Wallet size={18} className="text-rose-600" />;
      default:
        return <Package size={18} className="text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans select-none pb-12">
      {/* ── Top Navigation Bar (Navy #0d1e3a) ────────────────────────────── */}
      <header className="bg-[#0d1e3a] text-white px-5 py-2.5 flex items-center justify-between border-b border-slate-800 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              SMRITI Retail OS
            </span>
            <span className="text-slate-400 text-xs font-medium ml-2">
              Procurement <span className="text-slate-600 mx-1">&gt;</span> <span className="text-slate-200 font-semibold">Visual Reports</span>
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xl mx-8 relative">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search PO / Supplier / Item / Invoice / GRN..."
              className="w-full bg-[#162746] text-slate-200 placeholder-slate-400 text-xs rounded-md pl-9 pr-8 py-1.5 border border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all"
            />
            <kbd className="absolute right-2.5 top-1.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700 pointer-events-none">
              /
            </kbd>
          </div>
        </div>

        {/* User / Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center">
              5
            </span>
          </button>
          <button
            type="button"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Help & Documentation"
          >
            <HelpCircle size={16} />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <div className="flex items-center gap-2 pl-1 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              JR
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold leading-tight text-slate-100">Jawahar</div>
              <div className="text-[10px] text-slate-400 leading-tight">Company Admin</div>
            </div>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>
      </header>

      {/* ── Global Filter Strip ─────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Company Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Company</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCompanyId(newId);
                const opt = e.target.selectedOptions[0]?.text || newId;
                setSelectedCompany(opt);
              }}
              className="font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
            >
              <option value="COMP-001">My Retail Store (COMP-001)</option>
              <option value="comp-default">SMRITI Control Plane</option>
              <option value="all">All Companies</option>
            </select>
          </div>

          {/* Store / Location Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Store / Location</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
            >
              <option value="All Locations">All Locations</option>
              <option value="Main Store">Main Store</option>
              <option value="Central Warehouse">Central Warehouse</option>
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Date Range</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded cursor-pointer hover:bg-slate-100 transition-colors">
              <Calendar size={13} className="text-slate-500" />
              <span>{dateRangeStr}</span>
            </div>
          </div>

          {/* Preset Pills */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/80 text-xs">
            {(["FY 2026-27", "Today", "Last 7 Days", "MTD", "All Dates"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset);
                  if (preset === "FY 2026-27") setDateRangeStr("01 Apr 2026 - 31 Mar 2027");
                  else if (preset === "Today") setDateRangeStr("Today");
                  else if (preset === "Last 7 Days") setDateRangeStr("Last 7 Days");
                  else if (preset === "MTD") setDateRangeStr("Month to Date");
                  else setDateRangeStr("All Recorded Dates");
                }}
                className={`px-3 py-1 font-semibold rounded transition-colors ${
                  selectedPreset === preset
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Applied Filters Badge */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
            <Filter size={12} className="text-blue-600" />
            <span>Filters: {activeFiltersCount} applied</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedPreset("FY 2026-27");
              setDateRangeStr("01 Apr 2026 - 31 Mar 2027");
              setSelectedCompanyId("COMP-001");
              setSelectedCompany("My Retail Store");
              setSelectedLocation("All Locations");
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        {/* Customize Dashboard Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="procurement-customize-dashboard-btn"
            onClick={() => setIsConfigDrawerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3.5 py-1.5 rounded shadow-xs transition-colors cursor-pointer"
          >
            <Settings size={14} />
            <span>Customize Dashboard</span>
          </button>
        </div>
      </section>

      {/* ── Main Dashboard Body ─────────────────────────────────────────── */}
      <main className="flex-1 px-5 pt-4 space-y-4 max-w-[1780px] mx-auto w-full">
        {/* Loading Skeleton State */}
        {loading && !data && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 h-28 flex flex-col justify-between">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="h-6 w-28 bg-slate-200 rounded" />
                  <div className="h-2 w-full bg-slate-100 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-4 h-72">
                <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-4 h-72">
                <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4 h-64">
              <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 rounded" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API / Service Error State with Explicit Retry */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-8 my-8 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-rose-900">Procurement Visual Reports Unavailable</h3>
            <p className="text-xs text-rose-700 mt-2 mb-5 leading-relaxed">{error}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={fetchDashboardData}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
              >
                <RotateCcw size={14} />
                <span>Retry Database Connection</span>
              </button>
            </div>
          </div>
        )}

        {/* Truthful Empty State (Zero Records Found in Database) */}
        {!loading && !error && data && (data.total_pos_for_status === 0 && data.fulfillment_stream.length === 0) && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 my-8 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Procurement Records Found</h3>
            <p className="text-xs text-slate-500 mt-2 mb-5 leading-relaxed">
              No purchase orders, inward goods receipts, or supplier bills match company &quot;{selectedCompany}&quot; for the active period ({dateRangeStr}).
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCompanyId("COMP-001");
                setSelectedCompany("My Retail Store");
                setSelectedPreset("FY 2026-27");
                setDateRangeStr("01 Apr 2026 - 31 Mar 2027");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
            >
              <span>Load My Retail Store (FY 2026-27)</span>
            </button>
          </div>
        )}

        {/* Full Active Dashboard: Rendered Only From Authoritative Records */}
        {!loading && !error && data && (data.total_pos_for_status > 0 || data.fulfillment_stream.length > 0) && (
          <>
            {/* ── A. 6 Horizontal KPI Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {data?.kpi_cards.map((card) => {
            const isVisible = config.kpi_cards_visible[card.id] !== false;
            if (!isVisible) return null;

            return (
              <div
                key={card.id}
                className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {card.title}
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
                      {card.value}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    {renderKpiIcon(card.icon_name)}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  {card.progress_percentage !== undefined && card.progress_percentage !== null ? (
                    <div className="w-full">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${card.progress_percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">{card.subtext}</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-500 font-medium truncate">{card.subtext}</span>
                      <span
                        className={`font-bold flex items-center gap-0.5 shrink-0 ${
                          card.trend_direction === "up"
                            ? card.color === "amber"
                              ? "text-amber-600"
                              : "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {card.trend_direction === "up" ? "▲" : "▼"} {card.trend_percentage}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── B. Primary Analytics Row ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Purchase Spend Trend Chart (~58% / col-span-7) */}
          {config.charts_visible.purchase_spend_trend !== false && (
            <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">Purchase Spend Trend</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {/* Metric Toggle */}
                  <div className="relative">
                    <select
                      value={spendTrendMode}
                      onChange={(e) => setSpendTrendMode(e.target.value as "value" | "qty")}
                      className="bg-slate-50 border border-slate-200 font-semibold text-slate-700 px-2.5 py-1 rounded text-xs pr-6 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                    >
                      <option value="value">Value (₹)</option>
                      <option value="qty">Quantity (Pairs)</option>
                    </select>
                  </div>
                  {/* Period Toggle */}
                  <div className="relative">
                    <select
                      value={spendTrendPeriod}
                      onChange={(e) => setSpendTrendPeriod(e.target.value as "monthly" | "weekly" | "daily")}
                      className="bg-slate-50 border border-slate-200 font-semibold text-slate-700 px-2.5 py-1 rounded text-xs pr-6 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Chart Canvas */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data?.spend_trend || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month_label" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit=" Lakh"
                      domain={[0, "auto"]}
                    />
                    <YAxis yAxisId="right" orientation="right" hide domain={[0, "auto"]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "12px" }}
                      formatter={(val: any, name: any) => [
                        name === "PO Count" ? `${val} orders` : `₹ ${val} Lakh`,
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="po_count"
                      name="PO Count"
                      fill="#bfdbfe"
                      barSize={20}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="ordered_value"
                      name="Ordered Value"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#2563eb" }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="received_value"
                      name="Received Value"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#16a34a" }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="invoiced_value"
                      name="Invoiced Value"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#f97316" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Purchase-to-Receipt Progress (~42% / col-span-5) */}
          {config.charts_visible.purchase_to_receipt_progress !== false && (
            <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <h3 className="font-bold text-sm text-slate-900">Purchase-to-Receipt Progress</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("purchase")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  View Details &rarr;
                </button>
              </div>

              {/* 4 Connected Stages with Chevron / Arrow */}
              <div className="grid grid-cols-4 gap-2 my-auto py-2">
                {data?.workflow_stages.map((stg, idx) => (
                  <div key={stg.stage_id} className="relative flex flex-col items-center text-center">
                    {/* Circle Icon */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs mb-2"
                      style={{ backgroundColor: stg.color }}
                    >
                      {idx === 0 && <ShoppingCart size={18} />}
                      {idx === 1 && <CheckCircle2 size={18} />}
                      {idx === 2 && <Truck size={18} />}
                      {idx === 3 && <FileText size={18} />}
                    </div>

                    {/* Stage Name */}
                    <div className="text-[11px] font-bold text-slate-700 leading-tight mb-0.5">
                      {stg.stage_name}
                    </div>

                    {/* Stage Count & % */}
                    <div className="text-base font-extrabold text-slate-900 leading-tight">
                      {stg.count}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mb-2">
                      {stg.percentage}%
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${stg.percentage}%`, backgroundColor: stg.color }}
                      />
                    </div>

                    {/* Subtexts */}
                    <div className="text-[10px] text-slate-500 leading-tight">
                      <div>{stg.subtext_left}</div>
                      <div>{stg.subtext_right}</div>
                    </div>

                    {/* Arrow to Next Stage */}
                    {idx < 3 && (
                      <div className="absolute -right-2 top-4 text-slate-300 hidden md:block">
                        <ArrowRight size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-100">
                Authoritative conversion rates calculated across active purchase orders, inward GRNs, and supplier bills.
              </div>
            </div>
          )}
        </div>

        {/* ── C. Secondary Analytics Row 2A (3 Cards) ──────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* 1. Top Suppliers by Spend (MTD) */}
          {config.charts_visible.top_suppliers_spend !== false && (
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                <h3 className="font-bold text-sm text-slate-900">Top Suppliers by Spend (MTD)</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("supplier-mgmt")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="space-y-2.5">
                {data?.top_suppliers.map((sup) => (
                  <div key={sup.supplier_id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700 w-36 truncate">{sup.supplier_name}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden mx-1">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${sup.percentage}%`, backgroundColor: sup.bar_color }}
                      />
                    </div>
                    <span className="font-extrabold text-slate-900 text-right w-24">{sup.formatted_spend}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Purchase Order Status Donut */}
          {config.charts_visible.purchase_order_status !== false && (
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                <h3 className="font-bold text-sm text-slate-900">Purchase Order Status</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("purchase")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 py-1">
                {/* Donut Container */}
                <div className="w-36 h-36 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.po_status_breakdown || []}
                        dataKey="count"
                        nameKey="status_name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={2}
                      >
                        {data?.po_status_breakdown.map((entry) => (
                          <Cell key={entry.status_id} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">
                      {data?.total_pos_for_status ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none mt-1">
                      Purchase Orders
                    </span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="space-y-1.5 text-xs">
                  {data?.po_status_breakdown.map((st) => (
                    <div key={st.status_id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                        <span className="text-slate-600 font-medium text-[11px]">{st.status_name}</span>
                      </div>
                      <span className="font-bold text-slate-900 text-[11px]">
                        {st.count} ({st.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. Reorder Alert (Low Stock) Table */}
          {config.charts_visible.reorder_alert !== false && (
            <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                <h3 className="font-bold text-sm text-slate-900">Reorder Alert (Low Stock)</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("stock-ledger")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="overflow-x-auto text-[11px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="pb-1.5 font-bold">SKU</th>
                      <th className="pb-1.5 font-bold">Product Name</th>
                      <th className="pb-1.5 text-right font-bold">On-Hand</th>
                      <th className="pb-1.5 text-right font-bold">Reorder Level</th>
                      <th className="pb-1.5 text-right font-bold text-blue-600">Suggested PO Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.reorder_alerts.map((item) => (
                      <tr key={item.sku} className="hover:bg-slate-50 transition-colors">
                        <td className="py-1 font-bold text-slate-700">{item.sku}</td>
                        <td className="py-1 text-slate-600 truncate max-w-[120px]">{item.product_name}</td>
                        <td className="py-1 text-right font-bold text-slate-800">{item.on_hand}</td>
                        <td className="py-1 text-right text-slate-500">{item.reorder_level}</td>
                        <td className="py-1 text-right font-extrabold text-blue-600">{item.suggested_po_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── D. Secondary Analytics Row 2B (2 Cards) ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* 4. Supplier Performance Combo Chart (~45% / col-span-5) */}
          {config.charts_visible.supplier_performance !== false && (
            <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                <h3 className="font-bold text-sm text-slate-900">Supplier Performance (Last 6 Months)</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("supplier-mgmt")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data?.supplier_performance || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="supplier_name"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#f97316"
                      fontSize={10}
                      tickLine={false}
                      domain={[0, "auto"]}
                      unit="d"
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                      formatter={(val: any, name: any) => {
                        if (name === "On-Time Delivery %") {
                          return [val === null || val === undefined ? "N/A (Untracked)" : `${val}%`, name];
                        }
                        return [`${val} days`, name];
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={24}
                      wrapperStyle={{ fontSize: "11px" }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="on_time_delivery_pct"
                      name="On-Time Delivery %"
                      fill="#0284c7"
                      barSize={16}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="lead_time_days"
                      name="Lead Time (Days)"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f97316" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 italic">
                Note: On-Time Delivery % is displayed as N/A where historical PO promised delivery dates were not recorded.
              </div>
            </div>
          )}

          {/* 5. Open POs & Pending Receipts Table (~55% / col-span-7) */}
          {config.tables_visible.open_pos_and_receipts !== false && (
            <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                <h3 className="font-bold text-sm text-slate-900">Open POs & Pending Receipts</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("purchase")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="overflow-x-auto text-[11px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="pb-1.5 font-bold">PO No.</th>
                      <th className="pb-1.5 font-bold">Date</th>
                      <th className="pb-1.5 font-bold">Supplier</th>
                      <th className="pb-1.5 text-right font-bold">Ordered (Pairs)</th>
                      <th className="pb-1.5 text-right font-bold">Received</th>
                      <th className="pb-1.5 text-right font-bold">Pending</th>
                      <th className="pb-1.5 text-right font-bold">Value (₹)</th>
                      <th className="pb-1.5 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.open_pos_and_receipts.map((row) => (
                      <tr key={row.po_no} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 font-bold text-blue-600 cursor-pointer hover:underline">
                          {row.po_no}
                        </td>
                        <td className="py-2 text-slate-500 whitespace-nowrap">{row.po_date}</td>
                        <td className="py-2 font-semibold text-slate-700 truncate max-w-[140px]">
                          {row.supplier_name}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-800">{row.ordered_qty}</td>
                        <td className="py-2 text-right text-slate-600">{row.received_qty}</td>
                        <td className="py-2 text-right font-bold text-amber-600">{row.pending_qty}</td>
                        <td className="py-2 text-right font-extrabold text-slate-900">
                          {row.formatted_value}
                        </td>
                        <td className="py-2 text-center">
                          {renderStatusBadge(row.status, row.status_badge)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── E. Bottom Active Procurement Stream ───────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header & Tabs */}
          <div className="px-4 py-3 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Active Procurement Stream</h3>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 ml-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStreamTab("all")}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    streamTab === "all"
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All ({data?.stream_counts.all ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStreamTab("po")}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    streamTab === "po"
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Purchase Orders ({data?.stream_counts.purchase_orders ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStreamTab("gr")}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    streamTab === "gr"
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Goods Receipts ({data?.stream_counts.goods_receipts ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStreamTab("pi")}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    streamTab === "pi"
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Supplier Invoices ({data?.stream_counts.supplier_invoices ?? 0})
                </button>
              </div>
            </div>

            {/* Actions: Search, Filters, Columns, Export */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  value={streamSearch}
                  onChange={(e) => setStreamSearch(e.target.value)}
                  placeholder="Search by PO No. / Supplier / Item..."
                  className="bg-slate-50 border border-slate-200 rounded text-xs pl-8 pr-3 py-1 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <button
                type="button"
                className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <Filter size={12} className="text-slate-500" />
                <span>Filters</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <Columns size={12} className="text-slate-500" />
                <span>Columns</span>
              </button>
              <button
                type="button"
                onClick={() => onNotification?.("Export Triggered", "Downloading active procurement stream CSV...", "info")}
                className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download size={12} className="text-slate-500" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* 12-Column Table */}
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Doc No.</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Item / SKU</th>
                  <th className="py-2.5 px-3 text-right">Qty (Pairs) ▽</th>
                  <th className="py-2.5 px-3 text-right">Value (₹) ▽</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Next Action</th>
                  <th className="py-2.5 px-3">Updated By</th>
                  <th className="py-2.5 px-3">Updated On</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStream.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-3">{renderDocTypeBadge(item.doc_type)}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedDoc(item)}>
                      {item.doc_no}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{item.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.supplier}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{item.item_sku}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.qty}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{item.formatted_value}</td>
                    <td className="py-2.5 px-3 text-center">{renderStatusBadge(item.status, item.status_badge)}</td>
                    <td className="py-2.5 px-3">
                      {item.next_action_label ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.next_action === "create_grn") onNavigateTab?.("grn-studio");
                            else onNotification?.("Action Initiated", `Opening workflow for ${item.next_action_label}`, "info");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                        >
                          <FileText size={11} className="text-blue-600" />
                          <span>{item.next_action_label}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.updated_by}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">{item.updated_on}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(item)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </main>

      {/* ── F. Right-Side Dashboard Configuration Drawer ────────────────── */}
      {isConfigDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsConfigDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200">
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-blue-600" />
                  <div>
                    <h2 className="font-bold text-base text-slate-900">Dashboard Configuration</h2>
                    <p className="text-xs text-slate-500">Customize your dashboard view</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigDrawerOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scope Switcher Pills */}
              <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex items-center gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("visual-reports")}
                  className="px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Inventory
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold"
                >
                  Procurement
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("visual-reports")}
                  className="px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Fulfillment
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("billing-workspace")}
                  className="px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Billing
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
                {/* 1. KPI Cards */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">KPI Cards</span>
                    <label className="flex items-center gap-1.5 font-semibold text-blue-600 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Object.values(drawerConfig.kpi_cards_visible).every(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            kpi_cards_visible: {
                              purchase_orders: val,
                              purchase_spend: val,
                              pending_approvals: val,
                              pending_receipts: val,
                              received_vs_ordered: val,
                              supplier_outstanding: val,
                            },
                          }));
                        }}
                        className="rounded text-blue-600 focus:ring-blue-400"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { id: "purchase_orders", label: "Purchase Orders" },
                      { id: "purchase_spend", label: "Purchase Spend" },
                      { id: "pending_approvals", label: "Pending Approvals" },
                      { id: "pending_receipts", label: "Pending Receipts" },
                      { id: "received_vs_ordered", label: "Received vs Ordered" },
                      { id: "supplier_outstanding", label: "Supplier Outstanding" },
                    ].map((kpi) => (
                      <label key={kpi.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.kpi_cards_visible[kpi.id] !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              kpi_cards_visible: { ...prev.kpi_cards_visible, [kpi.id]: val },
                            }));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-400"
                        />
                        <span>{kpi.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. Charts & Widgets */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Charts & Widgets</span>
                    <label className="flex items-center gap-1.5 font-semibold text-blue-600 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Object.values(drawerConfig.charts_visible).every(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            charts_visible: {
                              purchase_spend_trend: val,
                              purchase_to_receipt_progress: val,
                              top_suppliers_spend: val,
                              purchase_order_status: val,
                              reorder_alert: val,
                              supplier_performance: val,
                            },
                          }));
                        }}
                        className="rounded text-blue-600 focus:ring-blue-400"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="space-y-2">
                    {/* Purchase Spend Trend */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.charts_visible.purchase_spend_trend !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              charts_visible: { ...prev.charts_visible, purchase_spend_trend: val },
                            }));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>Purchase Spend Trend</span>
                      </label>
                      <select
                        value={drawerConfig.chart_types.purchase_spend_trend || "line"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            chart_types: { ...prev.chart_types, purchase_spend_trend: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px]"
                      >
                        <option value="line">Line Chart</option>
                        <option value="area">Area Chart</option>
                        <option value="bar">Bar Chart</option>
                      </select>
                    </div>

                    {/* Purchase-to-Receipt Progress */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.charts_visible.purchase_to_receipt_progress !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              charts_visible: { ...prev.charts_visible, purchase_to_receipt_progress: val },
                            }));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>Purchase-to-Receipt Progress</span>
                      </label>
                    </div>

                    {/* Top Suppliers by Spend */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.charts_visible.top_suppliers_spend !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              charts_visible: { ...prev.charts_visible, top_suppliers_spend: val },
                            }));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>Top Suppliers by Spend</span>
                      </label>
                      <select
                        value={drawerConfig.chart_types.top_suppliers_spend || "bar"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            chart_types: { ...prev.chart_types, top_suppliers_spend: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px]"
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="list">Horizontal List</option>
                      </select>
                    </div>

                    {/* Purchase Order Status */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.charts_visible.purchase_order_status !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              charts_visible: { ...prev.charts_visible, purchase_order_status: val },
                            }));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>Purchase Order Status</span>
                      </label>
                      <select
                        value={drawerConfig.chart_types.purchase_order_status || "donut"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            chart_types: { ...prev.chart_types, purchase_order_status: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px]"
                      >
                        <option value="donut">Donut Chart</option>
                        <option value="pie">Pie Chart</option>
                      </select>
                    </div>

                    {/* Reorder Alert */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.charts_visible.reorder_alert !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              charts_visible: { ...prev.charts_visible, reorder_alert: val },
                            }));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>Reorder Alert (Low Stock)</span>
                      </label>
                      <select
                        value={drawerConfig.chart_types.reorder_alert || "bar"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            chart_types: { ...prev.chart_types, reorder_alert: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px]"
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="table">Table View</option>
                      </select>
                    </div>

                    {/* Supplier Performance */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drawerConfig.charts_visible.supplier_performance !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDrawerConfig((prev) => ({
                              ...prev,
                              charts_visible: { ...prev.charts_visible, supplier_performance: val },
                            }));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>Supplier Performance</span>
                      </label>
                      <select
                        value={drawerConfig.chart_types.supplier_performance || "bar"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            chart_types: { ...prev.chart_types, supplier_performance: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px]"
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Tables */}
                <div>
                  <div className="pb-1.5 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Tables</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={drawerConfig.tables_visible.recent_purchase_orders !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            tables_visible: { ...prev.tables_visible, recent_purchase_orders: val },
                          }));
                        }}
                        className="rounded text-blue-600"
                      />
                      <span>Recent Purchase Orders</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={drawerConfig.tables_visible.open_pos_and_receipts !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            tables_visible: { ...prev.tables_visible, open_pos_and_receipts: val },
                          }));
                        }}
                        className="rounded text-blue-600"
                      />
                      <span>Open POs & Pending Receipts</span>
                    </label>
                  </div>
                </div>

                {/* 4. Layout Style */}
                <div>
                  <div className="pb-1.5 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Layout Style</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="layout_mode"
                        value="standard"
                        checked={drawerConfig.layout_mode === "standard"}
                        onChange={() => setDrawerConfig((prev) => ({ ...prev, layout_mode: "standard" }))}
                        className="text-blue-600"
                      />
                      <span>Standard (3 Deck)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="layout_mode"
                        value="compact"
                        checked={drawerConfig.layout_mode === "compact"}
                        onChange={() => setDrawerConfig((prev) => ({ ...prev, layout_mode: "compact" }))}
                        className="text-blue-600"
                      />
                      <span>Compact (2 Deck)</span>
                    </label>
                  </div>
                </div>

                {/* 5. Data Display */}
                <div>
                  <div className="pb-1.5 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Data Display</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Default Tab</span>
                      <select
                        value={drawerConfig.data_display.default_tab || "all"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrawerConfig((prev) => ({
                            ...prev,
                            data_display: { ...prev.data_display, default_tab: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 rounded text-xs"
                      >
                        <option value="all">All Purchase Orders</option>
                        <option value="gr">Goods Receipts</option>
                        <option value="pi">Supplier Invoices</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Rows Per Page</span>
                      <select
                        value={drawerConfig.data_display.rows_per_page || 10}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDrawerConfig((prev) => ({
                            ...prev,
                            data_display: { ...prev.data_display, rows_per_page: val },
                          }));
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 rounded text-xs"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 6. Color Theme */}
                <div>
                  <div className="pb-1.5 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Color Theme</span>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="color_theme"
                        value="system"
                        checked={drawerConfig.color_theme === "system"}
                        onChange={() => setDrawerConfig((prev) => ({ ...prev, color_theme: "system" }))}
                        className="text-blue-600"
                      />
                      <span>Use System Theme</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="color_theme"
                        value="custom"
                        checked={drawerConfig.color_theme === "custom"}
                        onChange={() => setDrawerConfig((prev) => ({ ...prev, color_theme: "custom" }))}
                        className="text-blue-600"
                      />
                      <span>Custom</span>
                    </label>
                    {drawerConfig.color_theme === "custom" && (
                      <div className="flex items-center gap-2 pl-5 pt-1">
                        {PALETTE_DOTS.map((dot) => (
                          <button
                            key={dot.id}
                            type="button"
                            onClick={() => setDrawerConfig((prev) => ({ ...prev, custom_palette_color: dot.hex }))}
                            className={`w-5 h-5 rounded-full transition-transform ${
                              drawerConfig.custom_palette_color === dot.hex ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""
                            }`}
                            style={{ backgroundColor: dot.hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Buttons */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Reset to Default</span>
                </button>
                <button
                  type="button"
                  id="procurement-apply-config-btn"
                  onClick={handleApplyConfig}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-1.5 rounded shadow-xs transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Details Modal ─────────────────────────────────────── */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {renderDocTypeBadge(selectedDoc.doc_type)}
                <h3 className="font-bold text-sm text-slate-900">
                  Document Preview: {selectedDoc.doc_no}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 font-semibold">Supplier:</span>
                  <div className="font-bold text-slate-800">{selectedDoc.supplier}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Date:</span>
                  <div className="text-slate-800">{selectedDoc.date}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Item/SKU:</span>
                  <div className="font-mono text-slate-800">{selectedDoc.item_sku}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Quantity:</span>
                  <div className="font-bold text-slate-800">{selectedDoc.qty} {selectedDoc.unit}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Total Value:</span>
                  <div className="font-extrabold text-blue-700">₹ {selectedDoc.formatted_value}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Current Status:</span>
                  <div className="mt-0.5">{renderStatusBadge(selectedDoc.status, selectedDoc.status_badge)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Updated By:</span>
                  <div className="text-slate-800">{selectedDoc.updated_by}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Updated On:</span>
                  <div className="text-slate-800">{selectedDoc.updated_on}</div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Close
              </button>
              {selectedDoc.next_action_label && (
                <button
                  type="button"
                  onClick={() => {
                    const action = selectedDoc.next_action;
                    setSelectedDoc(null);
                    if (action === "create_grn") onNavigateTab?.("grn-studio");
                    else onNotification?.("Action Triggered", `Navigating to ${selectedDoc.next_action_label}`, "success");
                  }}
                  className="px-3 py-1.5 rounded text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs"
                >
                  {selectedDoc.next_action_label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
