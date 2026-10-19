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
  ChevronUp,
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
  BarChart2,
  PieChart as PieChartIcon,
  Activity,
  Grid,
  Sliders,
  Plus,
  Table as TableIcon,
  Maximize2,
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
  ScatterChart,
  Scatter,
  ZAxis,
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
  ArticleSpendItem,
  ColorSpendItem,
  SizeBreakdownItem,
  AttributeReorderAlertItem,
  ArticleColorHeatmap,
  ArticleColorHeatmapCell,
  SupplierLeadTimeScatterPoint,
  FilterOptions,
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
    purchase_order_status: true,
    top_articles_spend: true,
    spend_by_color: true,
    order_vs_receipt_by_size: true,
    reorder_alert: true,
    supplier_performance: true,
    article_color_heatmap: true,
    supplier_lead_time_vs_value: true,
  },
  chart_types: {
    purchase_spend_trend: "stacked_bar",
    purchase_order_status: "donut",
    spend_by_color: "pie",
    order_vs_receipt_by_size: "bar",
    reorder_alert: "table",
    supplier_performance: "combo",
    article_color_heatmap: "heatmap",
    supplier_lead_time_vs_value: "scatter",
  },
  tables_visible: {
    fulfillment_stream: true,
  },
  data_display: {
    default_tab: "all",
    rows_per_page: 10,
  },
  color_theme: "system",
  custom_palette_color: "#0284c7",
  selected_widget: "purchase_spend_trend",
  group_by_primary: "article",
  group_by_secondary: "color",
  selected_measures: ["Ordered Qty", "Received Qty", "Pending Qty"],
  time_grouping: "monthly",
  top_n: 10,
};

const ARTICLE_PALETTE: Record<string, string> = {
  "SHOE-41": "#0284c7",
  "SAND-03": "#f97316",
  "FORM-40": "#ec4899",
  "KIDS-32": "#8b5cf6",
  "SPORT-05": "#10b981",
  "CH-09-B": "#f59e0b",
  "CH-02-A": "#06b6d4",
  "Others": "#94a3b8",
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

  // Drawer
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(false);
  const [drawerConfig, setDrawerConfig] = useState<ProcurementDashboardConfigPayload>(config);
  const [drawerTab, setDrawerTab] = useState<"charts" | "filters" | "layout" | "theme">("charts");
  const [drawerWidget, setDrawerWidget] = useState<string>("purchase_spend_trend");

  // Row 1 Global Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("COMP-001");
  const [selectedCompany, setSelectedCompany] = useState<string>("SMRIITI FOOTWEAR PVT LTD");
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedPreset, setSelectedPreset] = useState<"Today" | "Last 7 Days" | "MTD" | "QTD" | "YTD" | "Custom">("MTD");
  const [dateRangeStr, setDateRangeStr] = useState<string>("01 Apr 2025 - 30 Apr 2025");

  // Row 2 Attribute Filters
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("Footwear");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");

  // Dropdown UI toggles
  const [articleDropdownOpen, setArticleDropdownOpen] = useState<boolean>(false);
  const [colorDropdownOpen, setColorDropdownOpen] = useState<boolean>(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState<boolean>(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState<boolean>(false);

  // Search in dropdowns
  const [articleSearchText, setArticleSearchText] = useState<string>("");
  const [colorSearchText, setColorSearchText] = useState<string>("");
  const [sizeSearchText, setSizeSearchText] = useState<string>("");

  // Spend Trend View Mode
  const [spendTrendMode, setSpendTrendMode] = useState<"value" | "qty">("value");
  const [spendTrendPeriod, setSpendTrendPeriod] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [spendTrendChartType, setSpendTrendChartType] = useState<"stacked_bar" | "grouped_bar" | "line" | "area">("stacked_bar");

  // Purchase-to-Receipt Mode
  const [p2rMode, setP2rMode] = useState<"qty" | "value">("qty");

  // Stream Tab & Search
  const [streamTab, setStreamTab] = useState<"all" | "po" | "gr" | "pi">("all");
  const [streamSearch, setStreamSearch] = useState<string>("");
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // Document Details Modal
  const [selectedDoc, setSelectedDoc] = useState<ActiveProcurementStreamItem | null>(null);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedLocation !== "All Locations") count++;
    if (selectedPreset !== "Custom") count++;
    count += selectedArticles.length;
    count += selectedColors.length;
    count += selectedSizes.length;
    if (selectedSupplier !== "all") count++;
    if (selectedCategory !== "all") count++;
    if (selectedBrand !== "all") count++;
    if (selectedSeason !== "all" && selectedSeason !== "All Seasons") count++;
    return count;
  }, [
    selectedLocation,
    selectedPreset,
    selectedArticles,
    selectedColors,
    selectedSizes,
    selectedSupplier,
    selectedCategory,
    selectedBrand,
    selectedSeason,
  ]);

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

      if (selectedPreset === "Today") {
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
      } else if (selectedPreset === "QTD") {
        const now = new Date();
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), quarterMonth, 1);
        params.append("start_date", start.toISOString().split("T")[0]);
        params.append("end_date", now.toISOString().split("T")[0]);
      } else if (selectedPreset === "YTD") {
        params.append("start_date", "2026-04-01");
        params.append("end_date", "2027-03-31");
      }

      if (selectedArticles.length > 0) {
        params.append("articles", selectedArticles.join(","));
      }
      if (selectedColors.length > 0) {
        params.append("colors", selectedColors.join(","));
      }
      if (selectedSizes.length > 0) {
        params.append("sizes", selectedSizes.join(","));
      }
      if (selectedSupplier && selectedSupplier !== "all") {
        params.append("supplier_id", selectedSupplier);
      }
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (selectedBrand && selectedBrand !== "all") {
        params.append("brand", selectedBrand);
      }
      if (selectedSeason && selectedSeason !== "all" && selectedSeason !== "All Seasons") {
        params.append("season", selectedSeason);
      }
      params.append("top_n", String(drawerConfig.top_n || 10));

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
  }, [
    selectedCompanyId,
    selectedLocation,
    selectedPreset,
    selectedArticles,
    selectedColors,
    selectedSizes,
    selectedSupplier,
    selectedCategory,
    selectedBrand,
    selectedSeason,
  ]);

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

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedArticles([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedSupplier("all");
    setSelectedCategory("all");
    setSelectedBrand("all");
    setSelectedSeason("all");
    setSelectedLocation("All Locations");
    setSelectedPreset("MTD");
    setDateRangeStr("01 Apr 2025 - 30 Apr 2025");
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

  // Article breakdown keys from spend trend points
  const dynamicArticleKeys = useMemo(() => {
    if (!data?.spend_trend) return [];
    const keys = new Set<string>();
    data.spend_trend.forEach((pt) => {
      if (pt.article_breakdown) {
        Object.keys(pt.article_breakdown).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [data?.spend_trend]);

  // Heatmap lookup map
  const heatmapCellMap = useMemo(() => {
    const map = new Map<string, ArticleColorHeatmapCell>();
    if (data?.article_color_heatmap?.cells) {
      data.article_color_heatmap.cells.forEach((cell) => {
        map.set(`${cell.article}___${cell.color}`, cell);
      });
    }
    return map;
  }, [data?.article_color_heatmap]);

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
              Home <span className="text-slate-600 mx-1">&gt;</span> Procurement <span className="text-slate-600 mx-1">&gt;</span>{" "}
              <span className="text-slate-200 font-semibold">Visual Reports</span>
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
              placeholder="Search PO / Supplier / Item / Invoice / GRN... (Ctrl+K)"
              className="w-full bg-[#162746] text-slate-200 placeholder-slate-400 text-xs rounded-md pl-9 pr-8 py-1.5 border border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all"
            />
            <kbd className="absolute right-2.5 top-1.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700 pointer-events-none">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* User / Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 bg-[#162746] px-2.5 py-1 rounded text-xs text-slate-200 border border-slate-700">
            <Store size={13} className="text-blue-400" />
            <span>My Retail Store</span>
            <span className="text-slate-400 text-[10px]">Main Store (MAIN)</span>
            <ChevronDown size={12} className="text-slate-400 ml-1" />
          </div>
          <button
            type="button"
            className="relative p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center">
              3
            </span>
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
          </div>
        </div>
      </header>

      {/* ── Title Banner Strip ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Procurement Visual Reports</h1>
          <p className="text-xs text-slate-500">Real-time purchasing insights by article, color, size and other attributes</p>
        </div>
        <button
          type="button"
          id="procurement-customize-dashboard-btn"
          onClick={() => setIsConfigDrawerOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 rounded shadow-xs transition-colors cursor-pointer"
        >
          <Settings size={14} />
          <span>Customize Dashboard</span>
        </button>
      </div>

      {/* ── 2-Row Filter Strip (Matching Visual Reference) ─────────────── */}
      <section className="bg-white border-b border-slate-200 px-5 py-2.5 space-y-2.5 shadow-xs">
        {/* Row 1: Company, Store, Date Range, Presets, Filters Count, Clear All */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                <option value="COMP-001">SMRIITI FOOTWEAR PVT LTD</option>
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
                <ChevronDown size={12} className="text-slate-400 ml-1" />
              </div>
            </div>

            {/* Preset Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/80 text-xs">
              {(["Today", "Last 7 Days", "MTD", "QTD", "YTD", "Custom"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset);
                    if (preset === "Today") setDateRangeStr("Today");
                    else if (preset === "Last 7 Days") setDateRangeStr("Last 7 Days");
                    else if (preset === "MTD") setDateRangeStr("01 Apr 2025 - 30 Apr 2025");
                    else if (preset === "QTD") setDateRangeStr("Current Quarter (Q1)");
                    else if (preset === "YTD") setDateRangeStr("FY 2025-26");
                    else setDateRangeStr("Custom Date Range");
                  }}
                  className={`px-3 py-1 font-semibold rounded transition-colors ${
                    selectedPreset === preset
                      ? "bg-blue-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Applied Filters Badge */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
              <Filter size={12} className="text-blue-600" />
              <span>Filters: {activeFiltersCount} applied</span>
            </div>

            {/* Clear All */}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Row 2: Attribute Filters & Pills (Article, Color, Size, Supplier, Category, Brand, Season, More Filters) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          {/* Article / Style Multi-Select */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-slate-400 text-[11px] font-semibold">Article / Style:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {selectedArticles.length === 0 ? (
                  <span
                    onClick={() => setArticleDropdownOpen(!articleDropdownOpen)}
                    className="text-slate-500 font-semibold cursor-pointer"
                  >
                    All Articles
                  </span>
                ) : (
                  selectedArticles.map((art) => (
                    <span
                      key={art}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-bold"
                    >
                      {art}
                      <X
                        size={11}
                        className="cursor-pointer hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedArticles(selectedArticles.filter((a) => a !== art));
                        }}
                      />
                    </span>
                  ))
                )}
              </div>
              <ChevronDown
                size={13}
                className="text-slate-400 cursor-pointer ml-1"
                onClick={() => setArticleDropdownOpen(!articleDropdownOpen)}
              />
            </div>

            {articleDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={articleSearchText}
                  onChange={(e) => setArticleSearchText(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 rounded mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="space-y-1">
                  {(data?.filter_options?.articles || ["SHOE-41", "SAND-03", "FORM-40", "KIDS-32", "SPORT-05"])
                    .filter((a) => a.toLowerCase().includes(articleSearchText.toLowerCase()))
                    .map((art) => (
                      <label key={art} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedArticles.includes(art)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedArticles([...selectedArticles, art]);
                            else setSelectedArticles(selectedArticles.filter((a) => a !== art));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-400"
                        />
                        <span className="font-semibold text-slate-800">{art}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Color Multi-Select */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-slate-400 text-[11px] font-semibold">Color:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {selectedColors.length === 0 ? (
                  <span
                    onClick={() => setColorDropdownOpen(!colorDropdownOpen)}
                    className="text-slate-500 font-semibold cursor-pointer"
                  >
                    All Colors
                  </span>
                ) : (
                  selectedColors.map((clr) => (
                    <span
                      key={clr}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold"
                    >
                      {clr}
                      <X
                        size={11}
                        className="cursor-pointer hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColors(selectedColors.filter((c) => c !== clr));
                        }}
                      />
                    </span>
                  ))
                )}
              </div>
              <ChevronDown
                size={13}
                className="text-slate-400 cursor-pointer ml-1"
                onClick={() => setColorDropdownOpen(!colorDropdownOpen)}
              />
            </div>

            {colorDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                <input
                  type="text"
                  placeholder="Search colors..."
                  value={colorSearchText}
                  onChange={(e) => setColorSearchText(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 rounded mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="space-y-1">
                  {(data?.filter_options?.colors || ["Black", "White", "Tan", "Blue", "Red", "Brown", "Cream"])
                    .filter((c) => c.toLowerCase().includes(colorSearchText.toLowerCase()))
                    .map((clr) => (
                      <label key={clr} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedColors.includes(clr)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedColors([...selectedColors, clr]);
                            else setSelectedColors(selectedColors.filter((c) => c !== clr));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-400"
                        />
                        <span className="font-semibold text-slate-800">{clr}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Size Multi-Select */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-slate-400 text-[11px] font-semibold">Size:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {selectedSizes.length === 0 ? (
                  <span
                    onClick={() => setSizeDropdownOpen(!sizeDropdownOpen)}
                    className="text-slate-500 font-semibold cursor-pointer"
                  >
                    All Sizes
                  </span>
                ) : (
                  selectedSizes.map((sz) => (
                    <span
                      key={sz}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-bold"
                    >
                      {sz}
                      <X
                        size={11}
                        className="cursor-pointer hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSizes(selectedSizes.filter((s) => s !== sz));
                        }}
                      />
                    </span>
                  ))
                )}
              </div>
              <ChevronDown
                size={13}
                className="text-slate-400 cursor-pointer ml-1"
                onClick={() => setSizeDropdownOpen(!sizeDropdownOpen)}
              />
            </div>

            {sizeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                <input
                  type="text"
                  placeholder="Search sizes..."
                  value={sizeSearchText}
                  onChange={(e) => setSizeSearchText(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 rounded mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="space-y-1">
                  {(data?.filter_options?.sizes || ["36", "37", "38", "39", "40", "41", "42", "43"])
                    .filter((s) => s.toLowerCase().includes(sizeSearchText.toLowerCase()))
                    .map((sz) => (
                      <label key={sz} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedSizes.includes(sz)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSizes([...selectedSizes, sz]);
                            else setSelectedSizes(selectedSizes.filter((s) => s !== sz));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-400"
                        />
                        <span className="font-semibold text-slate-800">{sz}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Supplier Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 text-[11px] font-semibold">Supplier:</span>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="font-semibold text-slate-800 bg-transparent cursor-pointer focus:outline-none text-xs"
            >
              <option value="all">All Suppliers</option>
              {data?.filter_options?.suppliers?.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 text-[11px] font-semibold">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="font-semibold text-slate-800 bg-transparent cursor-pointer focus:outline-none text-xs"
            >
              <option value="all">All Categories</option>
              <option value="Footwear">Footwear</option>
              {data?.filter_options?.categories?.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 text-[11px] font-semibold">Brand:</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="font-semibold text-slate-800 bg-transparent cursor-pointer focus:outline-none text-xs"
            >
              <option value="all">All Brands</option>
              {data?.filter_options?.brands?.map((br) => (
                <option key={br} value={br}>
                  {br}
                </option>
              ))}
            </select>
          </div>

          {/* Season Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 text-[11px] font-semibold">Season:</span>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="font-semibold text-slate-800 bg-transparent cursor-pointer focus:outline-none text-xs"
            >
              <option value="all">All Seasons</option>
              <option value="Summer 2026">Summer 2026</option>
              <option value="Winter 2026">Winter 2026</option>
              <option value="Festive">Festive</option>
              <option value="Core / Evergreen">Core / Evergreen</option>
            </select>
          </div>

          {/* More Filters */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
              className="flex items-center gap-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors"
            >
              <span>More Filters</span>
              <ChevronDown size={12} className="text-slate-500" />
            </button>
            {moreFiltersOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3 space-y-2 text-xs">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">Additional Dimensions</div>
                <div>
                  <span className="text-slate-500 block mb-1">Top N Limit</span>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={drawerConfig.top_n || 10}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrawerConfig((prev) => ({ ...prev, top_n: val }));
                    }}
                    className="w-full border border-slate-200 rounded p-1 text-xs"
                  />
                </div>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreFiltersOpen(false);
                      fetchDashboardData();
                    }}
                    className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded text-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Main Dashboard Body ─────────────────────────────────────────── */}
      <main className="flex-1 px-5 pt-4 space-y-4 max-w-[1780px] mx-auto w-full">
        {/* Loading Skeleton */}
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
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-4 h-72">
                <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
              <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-4 h-72">
                <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
              <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 p-4 h-72">
                <div className="h-4 w-36 bg-slate-200 rounded mb-4" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* API / Service Error */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-8 my-8 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-rose-900">Procurement Visual Reports Unavailable</h3>
            <p className="text-xs text-rose-700 mt-2 mb-5 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
            >
              <RotateCcw size={14} />
              <span>Retry Database Connection</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && data && data.total_pos_for_status === 0 && data.fulfillment_stream.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 my-8 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Procurement Records Found</h3>
            <p className="text-xs text-slate-500 mt-2 mb-5 leading-relaxed">
              No purchase orders or inward goods receipts match the selected filters for &quot;{selectedCompany}&quot;.
            </p>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
            >
              <span>Reset to All Available Data</span>
            </button>
          </div>
        )}

        {/* Active Dashboard */}
        {!loading && !error && data && (data.total_pos_for_status > 0 || data.fulfillment_stream.length > 0) && (
          <>
            {/* ── Deck 0: 6 KPI Cards ─────────────────────────────────────── */}
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

            {/* ── Deck 1: Purchase Spend Trend | Purchase-to-Receipt | PO Status ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* 1. Purchase Spend Trend (By Article) (lg:col-span-5) */}
              {config.charts_visible.purchase_spend_trend !== false && (
                <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-slate-100 mb-2 gap-2">
                    <h3 className="font-bold text-sm text-slate-900">Purchase Spend Trend (By Article)</h3>
                    <div className="flex items-center gap-1.5 text-xs">
                      {/* Metric Toggle */}
                      <select
                        value={spendTrendMode}
                        onChange={(e) => setSpendTrendMode(e.target.value as "value" | "qty")}
                        className="bg-slate-50 border border-slate-200 font-semibold text-slate-700 px-2 py-1 rounded text-xs focus:outline-none"
                      >
                        <option value="value">Value (₹)</option>
                        <option value="qty">Quantity</option>
                      </select>
                      {/* Period Toggle */}
                      <select
                        value={spendTrendPeriod}
                        onChange={(e) => setSpendTrendPeriod(e.target.value as "monthly" | "weekly" | "daily")}
                        className="bg-slate-50 border border-slate-200 font-semibold text-slate-700 px-2 py-1 rounded text-xs focus:outline-none"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                      </select>
                      {/* Chart Style Toggle */}
                      <select
                        value={spendTrendChartType}
                        onChange={(e) => setSpendTrendChartType(e.target.value as any)}
                        className="bg-slate-50 border border-slate-200 font-semibold text-slate-700 px-2 py-1 rounded text-xs focus:outline-none"
                      >
                        <option value="stacked_bar">Stacked Bar</option>
                        <option value="grouped_bar">Grouped Bar</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Article Inline Legend */}
                  <div className="flex items-center justify-center flex-wrap gap-3 text-[10px] font-semibold text-slate-600 mb-2">
                    {dynamicArticleKeys.slice(0, 5).map((art) => (
                      <div key={art} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: ARTICLE_PALETTE[art] || "#0284c7" }} />
                        <span>{art}</span>
                      </div>
                    ))}
                    {dynamicArticleKeys.length > 5 && (
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" />
                        <span>Others</span>
                      </div>
                    )}
                  </div>

                  {/* Chart Canvas */}
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {spendTrendChartType === "stacked_bar" || spendTrendChartType === "grouped_bar" ? (
                        <BarChart data={data?.spend_trend || []} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month_label" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" Lakh" domain={[0, "auto"]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                            formatter={(val: any, name: any) => [`₹ ${val} Lakh`, name]}
                          />
                          {dynamicArticleKeys.length > 0 ? (
                            dynamicArticleKeys.map((art) => (
                              <Bar
                                key={art}
                                dataKey={(pt) => pt.article_breakdown?.[art] || 0}
                                name={art}
                                stackId={spendTrendChartType === "stacked_bar" ? "article_stack" : undefined}
                                fill={ARTICLE_PALETTE[art] || "#0284c7"}
                                barSize={spendTrendChartType === "stacked_bar" ? 22 : 8}
                                radius={spendTrendChartType === "stacked_bar" ? undefined : [2, 2, 0, 0]}
                              />
                            ))
                          ) : (
                            <Bar
                              dataKey="ordered_value"
                              name="Total Spend"
                              fill="#0284c7"
                              barSize={20}
                              radius={[4, 4, 0, 0]}
                            />
                          )}
                        </BarChart>
                      ) : spendTrendChartType === "area" ? (
                        <AreaChart data={data?.spend_trend || []} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month_label" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" Lakh" domain={[0, "auto"]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                            formatter={(val: any, name: any) => [`₹ ${val} Lakh`, name]}
                          />
                          <Area type="monotone" dataKey="ordered_value" name="Ordered Value" stroke="#0284c7" fill="#0284c7" fillOpacity={0.2} />
                          <Area type="monotone" dataKey="received_value" name="Received Value" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                        </AreaChart>
                      ) : (
                        <LineChart data={data?.spend_trend || []} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month_label" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" Lakh" domain={[0, "auto"]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                            formatter={(val: any, name: any) => [`₹ ${val} Lakh`, name]}
                          />
                          <Line type="monotone" dataKey="ordered_value" name="Ordered Value" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="received_value" name="Received Value" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="invoiced_value" name="Invoiced Value" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 2. Purchase-to-Receipt Progress (lg:col-span-4) */}
              {config.charts_visible.purchase_to_receipt_progress !== false && (
                <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Purchase-to-Receipt Progress</h3>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setP2rMode("qty")}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          p2rMode === "qty" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Quantity
                      </button>
                      <button
                        type="button"
                        onClick={() => setP2rMode("value")}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          p2rMode === "value" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Value
                      </button>
                    </div>
                  </div>

                  {/* 4 Connected Stages */}
                  <div className="grid grid-cols-4 gap-2 my-auto py-2">
                    {data?.workflow_stages.map((stg, idx) => (
                      <div key={stg.stage_id} className="relative flex flex-col items-center text-center">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs mb-2"
                          style={{ backgroundColor: stg.color }}
                        >
                          {idx === 0 && <ShoppingCart size={18} />}
                          {idx === 1 && <CheckCircle2 size={18} />}
                          {idx === 2 && <Truck size={18} />}
                          {idx === 3 && <FileText size={18} />}
                        </div>

                        <div className="text-[11px] font-bold text-slate-700 leading-tight mb-0.5">
                          {stg.stage_name}
                        </div>

                        <div className="text-base font-extrabold text-slate-900 leading-tight">
                          {stg.count}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 mb-2">
                          {stg.percentage}%
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${stg.percentage}%`, backgroundColor: stg.color }}
                          />
                        </div>

                        <div className="text-[9px] text-slate-500 leading-tight">
                          <div>{stg.subtext_left}</div>
                          <div>{stg.subtext_right}</div>
                        </div>

                        {idx < 3 && (
                          <div className="absolute -right-2 top-4 text-slate-300 hidden md:block">
                            <ArrowRight size={13} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
                    Calculated across active purchase orders, inward GRNs, and supplier bills.
                  </div>
                </div>
              )}

              {/* 3. Purchase Order Status (By Article) Donut (lg:col-span-3) */}
              {config.charts_visible.purchase_order_status !== false && (
                <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Purchase Order Status (By Article)</h3>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-1">
                    {/* Donut Container */}
                    <div className="w-32 h-32 relative flex items-center justify-center shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data?.po_status_breakdown || []}
                            dataKey="count"
                            nameKey="status_name"
                            cx="50%"
                            cy="50%"
                            innerRadius={38}
                            outerRadius={56}
                            paddingAngle={2}
                          >
                            {data?.po_status_breakdown.map((entry) => (
                              <Cell key={entry.status_id} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Centered Count */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-lg font-extrabold text-slate-900 leading-none">
                          {data?.total_pos_for_status ?? 0}
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium leading-none mt-1">
                          Purchase Orders
                        </span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-1 text-xs w-full">
                      {data?.po_status_breakdown.map((st) => (
                        <div key={st.status_id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                            <span className="text-slate-600 font-medium text-[11px] truncate">{st.status_name}</span>
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
            </div>

            {/* ── Deck 2: Top Articles | Spend by Color | Qty by Size | Reorder Alerts ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Top Articles by Spend (MTD) */}
              {config.charts_visible.top_articles_spend !== false && (
                <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Top Articles by Spend (MTD)</h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Article / Style</span>
                      <span>Value (₹)</span>
                    </div>
                    {(data?.top_articles && data.top_articles.length > 0
                      ? data.top_articles
                      : [
                          { article: "SHOE-41", formatted_spend: "₹ 8,44,930", percentage: 85, bar_color: "#0284c7" },
                          { article: "SAND-03", formatted_spend: "₹ 3,33,726", percentage: 50, bar_color: "#0d9488" },
                          { article: "FORM-40", formatted_spend: "₹ 2,79,385", percentage: 42, bar_color: "#06b6d4" },
                          { article: "KIDS-32", formatted_spend: "₹ 1,66,150", percentage: 28, bar_color: "#f97316" },
                          { article: "SPORT-05", formatted_spend: "₹ 1,35,530", percentage: 22, bar_color: "#ef4444" },
                        ]
                    ).map((art) => (
                      <div key={art.article} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-700 w-20 truncate">{art.article}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden mx-1">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, art.percentage)}%`, backgroundColor: art.bar_color }}
                          />
                        </div>
                        <span className="font-extrabold text-slate-900 text-right w-20 text-[11px]">
                          {art.formatted_spend}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Spend by Color (Top 5) */}
              {config.charts_visible.spend_by_color !== false && (
                <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Spend by Color (Top 5)</h3>
                  </div>

                  <div className="flex items-center justify-center gap-3 py-1">
                    <div className="w-28 h-28 relative flex items-center justify-center shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data?.spend_by_color || []}
                            dataKey="spend_value"
                            nameKey="color"
                            cx="50%"
                            cy="50%"
                            outerRadius={50}
                            paddingAngle={2}
                          >
                            {data?.spend_by_color?.map((entry, idx) => (
                              <Cell key={`color-slice-${idx}`} fill={entry.color_code || "#0284c7"} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-1 text-xs w-full">
                      {data?.spend_by_color?.map((clr) => (
                        <div key={clr.color} className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: clr.color_code }} />
                            <span className="text-slate-700 font-medium text-[11px]">{clr.color}</span>
                          </div>
                          <span className="font-bold text-slate-900 text-[11px]">{clr.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Order vs Receipt Qty (By Size) */}
              {config.charts_visible.order_vs_receipt_by_size !== false && (
                <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Order vs Receipt Qty (By Size)</h3>
                  </div>

                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.order_vs_receipt_by_size || []} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="size" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                        />
                        <Legend verticalAlign="top" height={22} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "10px" }} />
                        <Bar dataKey="ordered_qty" name="Ordered" fill="#0284c7" barSize={7} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="received_qty" name="Received" fill="#10b981" barSize={7} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="pending_qty" name="Pending" fill="#06b6d4" barSize={7} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 4. Reorder Alert (By Article / Color / Size) */}
              {config.charts_visible.reorder_alert !== false && (
                <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Reorder Alert (By Attribute)</h3>
                    <button
                      type="button"
                      onClick={() => onNavigateTab?.("stock-ledger")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      View All &rarr;
                    </button>
                  </div>

                  <div className="overflow-x-auto text-[10px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[9px]">
                          <th className="pb-1 font-bold">ARTICLE</th>
                          <th className="pb-1 font-bold">CLR</th>
                          <th className="pb-1 font-bold">SZ</th>
                          <th className="pb-1 text-right font-bold">OH</th>
                          <th className="pb-1 text-right font-bold">REO</th>
                          <th className="pb-1 text-right font-bold">PEND</th>
                          <th className="pb-1 text-right font-bold text-blue-600">SUGG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data?.reorder_alerts_detailed?.map((item) => (
                          <tr key={item.sku} className="hover:bg-slate-50 transition-colors">
                            <td className="py-1 font-bold text-slate-700">{item.article}</td>
                            <td className="py-1 text-slate-600">{item.color}</td>
                            <td className="py-1 text-slate-600">{item.size}</td>
                            <td className="py-1 text-right font-bold text-slate-800">{item.on_hand}</td>
                            <td className="py-1 text-right text-slate-500">{item.reorder_level}</td>
                            <td className="py-1 text-right text-slate-500">{item.pending_qty}</td>
                            <td className="py-1 text-right font-extrabold text-blue-600">{item.suggested_po_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Deck 3: Supplier Performance | Article-Color Heatmap | Lead Time vs Value ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* 1. Supplier Performance Combo Chart (lg:col-span-4) */}
              {config.charts_visible.supplier_performance !== false && (
                <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Supplier Performance (Last 6 Months)</h3>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data?.supplier_performance || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="supplier_name"
                          stroke="#64748b"
                          fontSize={9}
                          tickLine={false}
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={9} tickLine={false} domain={[0, 100]} unit="%" />
                        <YAxis yAxisId="right" orientation="right" stroke="#f97316" fontSize={9} tickLine={false} domain={[0, "auto"]} unit="d" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                        />
                        <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: "10px" }} />
                        <Bar yAxisId="left" dataKey="on_time_delivery_pct" name="On-Time Delivery %" fill="#0284c7" barSize={14} radius={[3, 3, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="lead_time_days" name="Lead Time (Days)" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 2. Article-Color Heatmap (Ordered Qty) (lg:col-span-4) */}
              {config.charts_visible.article_color_heatmap !== false && (
                <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Article-Color Heatmap (Ordered Qty)</h3>
                  </div>

                  <div className="flex items-center justify-between gap-2 overflow-x-auto py-1">
                    <div className="flex-1">
                      <table className="w-full text-center text-[10px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                            <th className="p-1 text-left">Style</th>
                            {(data?.article_color_heatmap?.colors || ["Black", "White", "Tan", "Blue", "Red"]).map((clr) => (
                              <th key={clr} className="p-1">
                                {clr}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(data?.article_color_heatmap?.articles || ["SHOE-41", "SAND-03", "FORM-40", "KIDS-32", "SPORT-05"]).map((art) => (
                            <tr key={art}>
                              <td className="p-1 text-left font-bold text-slate-700 whitespace-nowrap">{art}</td>
                              {(data?.article_color_heatmap?.colors || ["Black", "White", "Tan", "Blue", "Red"]).map((clr) => {
                                const cell = heatmapCellMap.get(`${art}___${clr}`);
                                const qty = cell?.ordered_qty ?? 0;
                                const maxQty = data?.article_color_heatmap?.max_qty || 1;
                                const ratio = maxQty > 0 ? qty / maxQty : 0;

                                let bgClass = "bg-slate-50 text-slate-400";
                                if (qty > 0) {
                                  if (ratio > 0.75) bgClass = "bg-sky-600 text-white font-extrabold";
                                  else if (ratio > 0.5) bgClass = "bg-sky-500 text-white font-bold";
                                  else if (ratio > 0.25) bgClass = "bg-sky-300 text-slate-900 font-semibold";
                                  else bgClass = "bg-sky-100 text-sky-900 font-medium";
                                }

                                return (
                                  <td key={clr} className={`p-1.5 rounded-xs transition-colors ${bgClass}`}>
                                    {qty}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Gradient Legend */}
                    <div className="flex flex-col items-center justify-between h-36 w-8 shrink-0 ml-1">
                      <span className="text-[9px] font-bold text-amber-600">High</span>
                      <div className="w-2.5 h-24 rounded-full bg-gradient-to-t from-sky-200 via-sky-500 to-amber-500 shadow-inner" />
                      <span className="text-[9px] font-bold text-sky-600">Low</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Supplier Lead Time vs Order Value Scatter Plot (lg:col-span-4) */}
              {config.charts_visible.supplier_lead_time_vs_value !== false && (
                <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-sm text-slate-900">Supplier Lead Time vs Order Value</h3>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 15, bottom: 15, left: -15 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          type="number"
                          dataKey="avg_lead_time_days"
                          name="Avg Lead Time"
                          unit="d"
                          stroke="#64748b"
                          fontSize={9}
                          tickLine={false}
                          label={{ value: "Avg Lead Time (Days)", position: "insideBottom", offset: -8, fontSize: 9, fill: "#64748b" }}
                        />
                        <YAxis
                          type="number"
                          dataKey="order_value_lakh"
                          name="Order Value"
                          unit="L"
                          stroke="#64748b"
                          fontSize={9}
                          tickLine={false}
                          label={{ value: "Order Value (₹ Lakh)", angle: -90, position: "insideLeft", offset: 15, fontSize: 9, fill: "#64748b" }}
                        />
                        <ZAxis type="number" dataKey="po_count" range={[50, 180]} name="Orders" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "none", color: "#fff", fontSize: "11px" }}
                          formatter={(val: any, name: any) => [name === "Order Value" ? `₹ ${val} Lakh` : val, name]}
                        />
                        <Scatter name="Suppliers" data={data?.supplier_lead_time_vs_value || []} fill="#0284c7">
                          {data?.supplier_lead_time_vs_value?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.bubble_color || "#0284c7"} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* ── Deck 4: Bottom Active Procurement Stream (12 Columns) ─────── */}
            <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs overflow-hidden">
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
                        <td
                          className="py-2.5 px-3 font-bold text-blue-600 hover:underline cursor-pointer"
                          onClick={() => setSelectedDoc(item)}
                        >
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
                                if (item.next_action === "create_grn" && onNavigateTab) {
                                  onNavigateTab("grn-studio");
                                } else {
                                  setSelectedDoc(item);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                            >
                              <Eye size={11} className="text-blue-600" />
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

      {/* ── Customize Dashboard Right Drawer (4 Tabs Matching Visual Reference) ── */}
      {isConfigDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
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
                    <h2 className="font-bold text-base text-slate-900">Customize Dashboard</h2>
                    <p className="text-xs text-slate-500">Configure visual analytics widgets and charts</p>
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

              {/* 4 Tabs: Charts & Data | Filters | Layout | Theme */}
              <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex items-center gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDrawerTab("charts")}
                  className={`px-3 py-1 rounded transition-colors ${
                    drawerTab === "charts"
                      ? "bg-blue-600 text-white font-bold"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Charts & Data
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("filters")}
                  className={`px-3 py-1 rounded transition-colors ${
                    drawerTab === "filters"
                      ? "bg-blue-600 text-white font-bold"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Filters
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("layout")}
                  className={`px-3 py-1 rounded transition-colors ${
                    drawerTab === "layout"
                      ? "bg-blue-600 text-white font-bold"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Layout
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("theme")}
                  className={`px-3 py-1 rounded transition-colors ${
                    drawerTab === "theme"
                      ? "bg-blue-600 text-white font-bold"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Theme
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
                {drawerTab === "charts" && (
                  <>
                    {/* 1. Select Widget */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">1. Select Widget</label>
                      <select
                        value={drawerWidget}
                        onChange={(e) => setDrawerWidget(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="purchase_spend_trend">Purchase Spend Trend</option>
                        <option value="purchase_to_receipt_progress">Purchase-to-Receipt Progress</option>
                        <option value="purchase_order_status">Purchase Order Status</option>
                        <option value="top_articles_spend">Top Articles by Spend</option>
                        <option value="spend_by_color">Spend by Color</option>
                        <option value="order_vs_receipt_by_size">Order vs Receipt Qty (By Size)</option>
                        <option value="reorder_alert">Reorder Alert (By Attribute)</option>
                        <option value="supplier_performance">Supplier Performance</option>
                        <option value="article_color_heatmap">Article-Color Heatmap</option>
                        <option value="supplier_lead_time_vs_value">Supplier Lead Time vs Order Value</option>
                      </select>
                    </div>

                    {/* 2. Chart Type (8-Grid Buttons matching reference image) */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1.5">2. Chart Type</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: "bar", label: "Bar", icon: <BarChart2 size={16} /> },
                          { id: "line", label: "Line", icon: <TrendingUp size={16} /> },
                          { id: "area", label: "Area", icon: <Activity size={16} /> },
                          { id: "donut", label: "Donut", icon: <PieChartIcon size={16} /> },
                          { id: "treemap", label: "Treemap", icon: <Grid size={16} /> },
                          { id: "heatmap", label: "Heatmap", icon: <Layers size={16} /> },
                          { id: "scatter", label: "Scatter", icon: <Sliders size={16} /> },
                          { id: "table", label: "Table", icon: <TableIcon size={16} /> },
                        ].map((chart) => {
                          const isActive =
                            drawerConfig.chart_types[drawerWidget] === chart.id ||
                            (drawerWidget === "purchase_spend_trend" && chart.id === "bar");
                          return (
                            <button
                              key={chart.id}
                              type="button"
                              onClick={() => {
                                setDrawerConfig((prev) => ({
                                  ...prev,
                                  chart_types: { ...prev.chart_types, [drawerWidget]: chart.id },
                                }));
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                                isActive
                                  ? "border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-xs"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <div className="mb-1">{chart.icon}</div>
                              <span className="text-[10px]">{chart.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Group By (Primary) */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">3. Group By (Primary)</label>
                      <select
                        value={drawerConfig.group_by_primary || "article"}
                        onChange={(e) => setDrawerConfig((prev) => ({ ...prev, group_by_primary: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="article">Article / Style</option>
                        <option value="color">Color</option>
                        <option value="size">Size</option>
                        <option value="category">Category</option>
                        <option value="supplier">Supplier</option>
                      </select>
                    </div>

                    {/* 4. Group By (Secondary) */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">4. Group By (Secondary)</label>
                      <select
                        value={drawerConfig.group_by_secondary || "color"}
                        onChange={(e) => setDrawerConfig((prev) => ({ ...prev, group_by_secondary: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="none">None</option>
                        <option value="color">Color</option>
                        <option value="size">Size</option>
                        <option value="article">Article / Style</option>
                      </select>
                    </div>

                    {/* 5. Measure (Y-axis) */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">5. Measure (Y-axis)</label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(drawerConfig.selected_measures || ["Ordered Qty", "Received Qty", "Pending Qty"]).map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold"
                          >
                            {m}
                            <X
                              size={12}
                              className="cursor-pointer hover:text-rose-600"
                              onClick={() => {
                                const updated = (drawerConfig.selected_measures || []).filter((item) => item !== m);
                                setDrawerConfig((prev) => ({ ...prev, selected_measures: updated }));
                              }}
                            />
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newM = prompt("Enter measure name (e.g., Spend Value, Invoice Qty):");
                            if (newM && newM.trim()) {
                              setDrawerConfig((prev) => ({
                                ...prev,
                                selected_measures: [...(prev.selected_measures || []), newM.trim()],
                              }));
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Add Measure</span>
                        </button>
                      </div>
                    </div>

                    {/* 6. Time Grouping */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">6. Time Grouping</label>
                      <div className="flex items-center gap-1">
                        {(["daily", "weekly", "monthly", "quarterly"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setDrawerConfig((prev) => ({ ...prev, time_grouping: t }))}
                            className={`flex-1 py-1 text-center rounded border capitalize text-xs font-semibold transition-colors ${
                              (drawerConfig.time_grouping || "monthly") === t
                                ? "bg-blue-600 text-white border-blue-600 font-bold"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 7. Top N */}
                    <div>
                      <label className="font-bold text-slate-900 block mb-1">7. Top N (Optional)</label>
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={drawerConfig.top_n || 10}
                        onChange={(e) => setDrawerConfig((prev) => ({ ...prev, top_n: Number(e.target.value) }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-semibold"
                      />
                    </div>
                  </>
                )}

                {drawerTab === "filters" && (
                  <div className="space-y-3">
                    <div className="font-bold text-slate-900 pb-1 border-b border-slate-100">Default Attribute Filters</div>
                    <p className="text-slate-500 text-[11px]">
                      Configure persistent default attribute selections when opening Procurement Visual Reports.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-700 font-semibold block mb-1">Default Category</span>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full border border-slate-200 rounded p-1.5 text-xs"
                        >
                          <option value="all">All Categories</option>
                          <option value="Footwear">Footwear</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-slate-700 font-semibold block mb-1">Default Date Period</span>
                        <select
                          value={selectedPreset}
                          onChange={(e) => setSelectedPreset(e.target.value as any)}
                          className="w-full border border-slate-200 rounded p-1.5 text-xs"
                        >
                          <option value="Today">Today</option>
                          <option value="Last 7 Days">Last 7 Days</option>
                          <option value="MTD">MTD</option>
                          <option value="QTD">QTD</option>
                          <option value="YTD">YTD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {drawerTab === "layout" && (
                  <div className="space-y-4">
                    <div>
                      <div className="font-bold text-slate-900 pb-1 border-b border-slate-100 mb-2">KPI Cards Visibility</div>
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

                    <div>
                      <div className="font-bold text-slate-900 pb-1 border-b border-slate-100 mb-2">Widget Visibility</div>
                      <div className="space-y-1.5">
                        {[
                          { id: "purchase_spend_trend", label: "Purchase Spend Trend" },
                          { id: "purchase_to_receipt_progress", label: "Purchase-to-Receipt Progress" },
                          { id: "purchase_order_status", label: "Purchase Order Status" },
                          { id: "top_articles_spend", label: "Top Articles by Spend" },
                          { id: "spend_by_color", label: "Spend by Color" },
                          { id: "order_vs_receipt_by_size", label: "Order vs Receipt Qty (By Size)" },
                          { id: "reorder_alert", label: "Reorder Alert (By Attribute)" },
                          { id: "supplier_performance", label: "Supplier Performance" },
                          { id: "article_color_heatmap", label: "Article-Color Heatmap" },
                          { id: "supplier_lead_time_vs_value", label: "Supplier Lead Time vs Order Value" },
                        ].map((w) => (
                          <label key={w.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={drawerConfig.charts_visible[w.id] !== false}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setDrawerConfig((prev) => ({
                                  ...prev,
                                  charts_visible: { ...prev.charts_visible, [w.id]: val },
                                }));
                              }}
                              className="rounded text-blue-600 focus:ring-blue-400"
                            />
                            <span>{w.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {drawerTab === "theme" && (
                  <div className="space-y-3">
                    <div className="font-bold text-slate-900 pb-1 border-b border-slate-100 mb-2">Color Palette</div>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="color_theme"
                        value="system"
                        checked={drawerConfig.color_theme === "system"}
                        onChange={() => setDrawerConfig((prev) => ({ ...prev, color_theme: "system" }))}
                        className="text-blue-600"
                      />
                      <span>System Theme</span>
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
                      <span>Custom Theme</span>
                    </label>
                    {drawerConfig.color_theme === "custom" && (
                      <div className="flex items-center gap-2 pl-5 pt-1">
                        {PALETTE_DOTS.map((dot) => (
                          <button
                            key={dot.id}
                            type="button"
                            onClick={() => setDrawerConfig((prev) => ({ ...prev, custom_palette_color: dot.hex }))}
                            className={`w-6 h-6 rounded-full transition-transform ${
                              drawerConfig.custom_palette_color === dot.hex ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""
                            }`}
                            style={{ backgroundColor: dot.hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer Buttons */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  id="procurement-apply-config-btn"
                  onClick={handleApplyConfig}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-1.5 rounded shadow-xs transition-colors cursor-pointer"
                >
                  Apply to Dashboard
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
                  <div className="font-bold text-slate-800">
                    {selectedDoc.qty} {selectedDoc.unit}
                  </div>
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
