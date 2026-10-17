/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.94.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical Visual Reports Dashboard Component
 * Capability    : @SmritiCapability("REPORTS", "VISUAL_REPORTS_DASHBOARD")
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Package,
  Boxes,
  Layers,
  Lock,
  FileText,
  Truck,
  Receipt,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Sliders,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Download,
  Columns as ColumnsIcon,
  Settings,
  X,
  ExternalLink,
  ChevronDown,
  Calendar,
  Share2,
  Printer,
  ChevronRight,
  Check,
  Bell,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  PieChart as PieIcon,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  VisualReportsSummaryResponse,
  DashboardConfigPayload,
  VisualKpiCard,
  StockFlowDataPoint,
  WorkflowStageProgress,
  CategoryStockPosition,
  TopReservedSku,
  PackingSlipStatusSlice,
  DispatchInvoiceSummaryRow,
  FulfillmentStreamItem,
} from "./visualReportsTypes.ts";

interface VisualReportsDashboardTabProps {
  currentUser?: { role?: string; name?: string; id?: string } | null;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
  onNavigateTab?: (tabId: string) => void;
}

const DEFAULT_CONFIG: DashboardConfigPayload = {
  layout_mode: "focused",
  kpi_cards_visible: {
    on_hand: true,
    reserved: true,
    available: true,
    sales_orders: true,
    packing_slips: true,
    dispatches: true,
  },
  charts_visible: {
    stock_flow: true,
    order_to_invoice: true,
    category_stock: true,
    top_skus: true,
    packing_status: true,
  },
  stock_flow_chart_type: "line",
  table_view: "active_stream",
  default_tab: "all",
  rows_per_page: 10,
  color_theme_mode: "system",
  custom_accent_color: "#2563eb",
};

export const VisualReportsDashboardTab: React.FC<VisualReportsDashboardTabProps> = ({
  currentUser,
  onNotification,
  onNavigateTab,
}) => {
  // ── Global Filter States ──────────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState<string>("SMRITI FOOTWEAR PVT LTD");
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [dateRangePreset, setDateRangePreset] = useState<"Today" | "Last 7 Days" | "MTD" | "Custom">("MTD");
  const [dateRangeLabel, setDateRangeLabel] = useState<string>("01 Apr 2025 - 30 Apr 2025");
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // ── Dashboard Configuration Panel States ──────────────────────────────────
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(true);
  const [config, setConfig] = useState<DashboardConfigPayload>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<DashboardConfigPayload>(DEFAULT_CONFIG);

  // ── Active Fulfillment Stream Table States ────────────────────────────────
  const [streamTab, setStreamTab] = useState<"all" | "so" | "ps" | "ds" | "inv">("all");
  const [streamSearch, setStreamSearch] = useState<string>("");
  const [selectedDocPreview, setSelectedDocPreview] = useState<FulfillmentStreamItem | null>(null);
  const [flowViewMode, setFlowViewMode] = useState<"quantity" | "value">("quantity");

  // ── Live Data States ──────────────────────────────────────────────────────
  const [dashboardData, setDashboardData] = useState<VisualReportsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasAppliedSavedConfig, setHasAppliedSavedConfig] = useState<boolean>(false);

  // Load config from localStorage on init
  useEffect(() => {
    try {
      const stored = localStorage.getItem("smriti_visual_reports_dashboard_config_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig(parsed);
        setDraftConfig(parsed);
        if (parsed.default_tab) {
          setStreamTab(parsed.default_tab);
        }
      }
    } catch (e) {
      console.warn("Failed to read dashboard config from storage", e);
    }
  }, []);

  // Fetch data from backend
  useEffect(() => {
    loadDashboardData();
  }, [selectedCompany, selectedLocation, dateRangePreset]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetchV1<VisualReportsSummaryResponse>("/reports/visual-dashboard/summary");
      if (res) {
        setDashboardData(res);
        if (res.config && !hasAppliedSavedConfig) {
          setConfig(res.config);
          setDraftConfig(res.config);
          setHasAppliedSavedConfig(true);
        }
      }
    } catch (err) {
      console.error("Failed to load visual dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Configuration Actions ─────────────────────────────────────────────────
  const handleApplyConfig = async () => {
    setConfig(draftConfig);
    try {
      localStorage.setItem("smriti_visual_reports_dashboard_config_v1", JSON.stringify(draftConfig));
      await apiFetchV1<DashboardConfigPayload>("/reports/visual-dashboard/config", {
        method: "POST",
        body: JSON.stringify(draftConfig),
      });
      onNotification?.("Configuration Applied", "Dashboard layout preferences have been saved.", "success");
    } catch (err) {
      onNotification?.("Configuration Saved Locally", "Settings saved locally.", "info");
    }
  };

  const handleResetConfig = () => {
    setDraftConfig(DEFAULT_CONFIG);
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem("smriti_visual_reports_dashboard_config_v1");
      onNotification?.("Configuration Reset", "Dashboard settings restored to default.", "info");
    } catch (e) {}
  };

  const handleQuickDateSelect = (preset: "Today" | "Last 7 Days" | "MTD" | "Custom") => {
    setDateRangePreset(preset);
    if (preset === "Today") setDateRangeLabel("30 Apr 2025");
    else if (preset === "Last 7 Days") setDateRangeLabel("24 Apr 2025 - 30 Apr 2025");
    else if (preset === "MTD") setDateRangeLabel("01 Apr 2025 - 30 Apr 2025");
    else setDateRangeLabel("Custom Date Range");
  };

  // ── Derived Filtered Fulfillment Stream ───────────────────────────────────
  const filteredStreamItems = useMemo(() => {
    if (!dashboardData?.fulfillment_stream) return [];
    return dashboardData.fulfillment_stream.filter((item) => {
      // Tab filter
      if (streamTab === "so" && item.doc_type !== "SO") return false;
      if (streamTab === "ps" && item.doc_type !== "PS") return false;
      if (streamTab === "ds" && item.doc_type !== "DS") return false;
      if (streamTab === "inv" && item.doc_type !== "INV") return false;

      // Search filter
      if (streamSearch.trim()) {
        const q = streamSearch.toLowerCase();
        const match =
          item.doc_number.toLowerCase().includes(q) ||
          item.customer_name.toLowerCase().includes(q) ||
          item.item_summary.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q) ||
          item.updated_by.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [dashboardData, streamTab, streamSearch]);

  const kpis = dashboardData?.kpis || [];
  const stockFlow = dashboardData?.stock_flow_timeline || [];
  const workflowStages = dashboardData?.workflow_stages || [];
  const categoryPositions = dashboardData?.category_positions || [];
  const topSkus = dashboardData?.top_reserved_skus || [];
  const packingDonut = dashboardData?.packing_slip_donut || [];
  const dispatchInvoiceSummary = dashboardData?.dispatch_invoice_summary || [];

  return (
    <div className="flex flex-col min-h-screen bg-[#f1f5f9] text-slate-800 font-sans antialiased select-none">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* A. Top Navigation Bar (Approved Dark Navy Design)                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <header className="h-14 bg-[#0d1e3a] text-white px-4 flex items-center justify-between border-b border-slate-800 shadow-md shrink-0 z-30">
        {/* Left Branding & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Boxes size={20} className="stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">SMRITI Retail OS</span>
          </div>
          <span className="text-slate-500 font-light text-sm">|</span>
          <nav className="hidden md:flex items-center gap-1.5 text-xs text-slate-300">
            <span className="text-slate-400">Inventory, Orders, Packing, Dispatch &amp; Billing</span>
            <ChevronRight size={14} className="text-slate-500" />
            <span className="font-bold text-white tracking-wide">Visual Reports</span>
          </nav>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xl mx-6 hidden sm:block">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search by Order No. / Packing Slip / Invoice / Customer / SKU..."
              className="w-full pl-9 pr-10 py-1.5 bg-[#13284d] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
              data-field-key="global-visual-reports-search"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
              /
            </kbd>
          </div>
        </div>

        {/* Right Tools & User Info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Notifications"
            className="relative p-2 rounded-lg hover:bg-slate-800/80 text-slate-300 transition"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              5
            </span>
          </button>
          <button
            type="button"
            title="Help & Documentation"
            className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-300 transition"
          >
            <HelpCircle size={18} />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/80">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              JR
            </div>
            <div className="hidden lg:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-white">{currentUser?.name || "Jawahar"}</span>
              <span className="text-[10px] text-slate-400">{currentUser?.role || "Company Admin"}</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          {/* Toggle Configuration Panel Button */}
          <button
            type="button"
            onClick={() => setIsConfigDrawerOpen((prev) => !prev)}
            title="Toggle Dashboard Configuration Panel"
            className={`p-2 rounded-lg border transition ml-2 ${
              isConfigDrawerOpen
                ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Main Workspace + Right Configuration Panel Container               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Scrollable Dashboard Region */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* B. Global Filter Strip                                            */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Company Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Company</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-800 outline-none focus:border-blue-500"
                  data-field-key="dash-company-select"
                >
                  <option value="SMRITI FOOTWEAR PVT LTD">SMRITI FOOTWEAR PVT LTD</option>
                  <option value="RELIANCE RETAIL LTD">RELIANCE RETAIL LTD</option>
                  <option value="TATTLY THREADS PVT LTD">TATTLY THREADS PVT LTD</option>
                </select>
              </div>

              {/* Store / Location Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Store / Location</span>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-semibold text-slate-800 outline-none focus:border-blue-500"
                  data-field-key="dash-location-select"
                >
                  <option value="All Locations">All Locations</option>
                  <option value="Main Central Warehouse (WH-01)">Main Central Warehouse (WH-01)</option>
                  <option value="Mumbai Distribution Hub (WH-02)">Mumbai Distribution Hub (WH-02)</option>
                  <option value="Andheri Retail Outlet">Andheri Retail Outlet</option>
                </select>
              </div>

              {/* Date Range Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Date Range</span>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-mono font-medium text-slate-800 hover:bg-slate-100 transition"
                  data-field-key="dash-date-range-btn"
                >
                  <Calendar size={13} className="text-slate-500" />
                  <span>{dateRangeLabel}</span>
                  <ChevronDown size={13} className="text-slate-400" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {(["Today", "Last 7 Days", "MTD", "Custom"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickDateSelect(preset)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      dateRangePreset === preset
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Filter Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold transition"
              >
                <Filter size={13} className="text-blue-600" />
                <span>Filters: 3 applied</span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation("All Locations");
                  handleQuickDateSelect("MTD");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium transition"
              >
                <RotateCcw size={12} />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* C. KPI Cards Row (6 Horizontal Cards)                             */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map((card) => {
              if (config.kpi_cards_visible && config.kpi_cards_visible[card.id] === false) {
                return null;
              }

              // Color token derivation matching reference
              let badgeBg = "bg-blue-600 text-white";
              if (card.color === "amber") badgeBg = "bg-amber-500 text-white";
              if (card.color === "green") badgeBg = "bg-emerald-600 text-white";
              if (card.color === "purple") badgeBg = "bg-purple-600 text-white";
              if (card.color === "cyan") badgeBg = "bg-sky-500 text-white";
              if (card.color === "orange") badgeBg = "bg-orange-500 text-white";

              return (
                <div
                  key={card.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${badgeBg} flex items-center justify-center shrink-0 shadow-xs`}>
                      {card.id === "on_hand" && <Package size={20} className="stroke-[2.2]" />}
                      {card.id === "reserved" && <Lock size={20} className="stroke-[2.2]" />}
                      {card.id === "available" && <Layers size={20} className="stroke-[2.2]" />}
                      {card.id === "sales_orders" && <FileText size={20} className="stroke-[2.2]" />}
                      {card.id === "packing_slips" && <Boxes size={20} className="stroke-[2.2]" />}
                      {card.id === "dispatches" && <Truck size={20} className="stroke-[2.2]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-extrabold text-slate-900 tracking-tight font-mono leading-none">
                        {card.value}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 mt-1 truncate">
                        {card.title}
                      </div>
                      {card.unit && (
                        <div className="text-[11px] text-slate-400 font-medium">
                          {card.unit}
                        </div>
                      )}
                      {card.subtext && (
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                          {card.subtext}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Trend Indicator */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center text-[11px] font-bold">
                    {card.trend_direction === "up" ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <span>▲</span>
                        <span>{card.trend_percentage}</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <span>▼</span>
                        <span>{card.trend_percentage}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* D. Primary Analytics Row                                          */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left: Stock Flow (Last 14 Days) */}
            {config.charts_visible?.stock_flow !== false && (
              <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight">Stock Flow (Last 14 Days)</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={flowViewMode}
                      onChange={(e) => setFlowViewMode(e.target.value as any)}
                      className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 bg-slate-50 font-medium text-slate-700 outline-none"
                    >
                      <option value="quantity">View: Quantity</option>
                      <option value="value">View: Value (₹)</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Recharts Visualization */}
                <div className="w-full h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    {config.stock_flow_chart_type === "area" ? (
                      <AreaChart data={stockFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day_label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toLocaleString()}`} />
                        <Tooltip />
                        <Area type="monotone" dataKey="on_hand" name="On-Hand" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
                        <Area type="monotone" dataKey="available" name="Available" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="reserved" name="Reserved" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                      </AreaChart>
                    ) : config.stock_flow_chart_type === "bar" ? (
                      <BarChart data={stockFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day_label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toLocaleString()}`} />
                        <Tooltip />
                        <Bar dataKey="on_hand" name="On-Hand" fill="#2563eb" />
                        <Bar dataKey="available" name="Available" fill="#10b981" />
                        <Bar dataKey="reserved" name="Reserved" fill="#f59e0b" />
                      </BarChart>
                    ) : (
                      <LineChart data={stockFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day_label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toLocaleString()}`} />
                        <Tooltip />
                        <Line type="monotone" dataKey="on_hand" name="On-Hand" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="available" name="Available" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="reserved" name="Reserved" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="dispatched" name="Dispatched" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Bottom Legend */}
                <div className="flex items-center justify-center gap-6 mt-3 pt-2 border-t border-slate-100 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span>On-Hand</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Reserved</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    <span>Dispatched</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sky-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                    <span>Invoiced</span>
                  </div>
                </div>
              </div>
            )}

            {/* Right: Order to Invoice Progress */}
            {config.charts_visible?.order_to_invoice !== false && (
              <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight">Order to Invoice Progress</h3>
                  <button
                    type="button"
                    onClick={() => onNotification?.("Workflow Pipeline", "Viewing full order-to-dispatch pipeline details.", "info")}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                  >
                    <span>View Details</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                {/* Connected Stages */}
                <div className="grid grid-cols-4 gap-2 items-center text-center my-auto">
                  {workflowStages.map((stage, idx) => {
                    let colorClass = "text-purple-600 bg-purple-100";
                    let barClass = "bg-purple-600";
                    if (stage.color === "blue") {
                      colorClass = "text-blue-600 bg-blue-100";
                      barClass = "bg-blue-600";
                    } else if (stage.color === "orange") {
                      colorClass = "text-orange-600 bg-orange-100";
                      barClass = "bg-orange-500";
                    } else if (stage.color === "green") {
                      colorClass = "text-emerald-600 bg-emerald-100";
                      barClass = "bg-emerald-600";
                    }

                    return (
                      <div key={stage.id} className="relative flex flex-col items-center">
                        {/* Connecting Arrow */}
                        {idx < workflowStages.length - 1 && (
                          <div className="absolute top-5 -right-3 text-slate-300 font-bold hidden sm:block z-10">
                            &rarr;
                          </div>
                        )}

                        {/* Stage Icon */}
                        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center mb-2 shadow-2xs`}>
                          {stage.icon === "document" && <FileText size={18} />}
                          {stage.icon === "box" && <Boxes size={18} />}
                          {stage.icon === "truck" && <Truck size={18} />}
                          {stage.icon === "receipt" && <Receipt size={18} />}
                        </div>

                        {/* Title & Stats */}
                        <div className="text-[11px] font-semibold text-slate-600">{stage.title}</div>
                        <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">{stage.count}</div>
                        <div className="text-[10px] font-bold text-slate-400">{stage.percentage}%</div>

                        {/* Horizontal Progress Bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-2">
                          <div className={`h-full ${barClass}`} style={{ width: `${stage.progress_bar_percentage}%` }}></div>
                        </div>

                        {/* Subtext */}
                        <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                          {stage.subtext}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Actual workflow stage fulfillment metrics</span>
                  <span className="font-semibold text-emerald-600">100% Reconciled</span>
                </div>
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* E. Secondary Analytics Row (4 widgets)                             */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* 1. Stock Position by Category */}
            {config.charts_visible?.category_stock !== false && (
              <div className="lg:col-span-3 bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-xs text-slate-900 tracking-tight">Stock Position by Category</h4>
                  <button type="button" className="text-[11px] text-blue-600 font-bold hover:underline">
                    View All &rarr;
                  </button>
                </div>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      <th className="py-1">Category</th>
                      <th className="py-1 text-right">On-Hand</th>
                      <th className="py-1 text-right">Reserved</th>
                      <th className="py-1 text-right">Available</th>
                      <th className="py-1 text-right">Reserved %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryPositions.map((row) => (
                      <tr key={row.category} className="hover:bg-slate-50">
                        <td className="py-1.5 font-medium text-slate-800">{row.category}</td>
                        <td className="py-1.5 text-right font-mono">{row.on_hand.toLocaleString()}</td>
                        <td className="py-1.5 text-right font-mono text-amber-600">{row.reserved.toLocaleString()}</td>
                        <td className="py-1.5 text-right font-mono text-emerald-600">{row.available.toLocaleString()}</td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-700">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-10 bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-blue-600 h-full" style={{ width: `${row.reserved_pct}%` }}></div>
                            </div>
                            <span>{row.reserved_pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Top 10 SKUs by Reserved Quantity */}
            {config.charts_visible?.top_skus !== false && (
              <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-xs text-slate-900 tracking-tight">Top 10 SKUs by Reserved Quantity</h4>
                  <button type="button" className="text-[11px] text-blue-600 font-bold hover:underline">
                    View All &rarr;
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold">
                        <th className="py-1">#</th>
                        <th className="py-1">SKU</th>
                        <th className="py-1">Product Name</th>
                        <th className="py-1 text-right">On-Hand</th>
                        <th className="py-1 text-right">Reserved</th>
                        <th className="py-1 text-right">Reserved %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topSkus.map((sku) => (
                        <tr key={sku.sku} className="hover:bg-slate-50">
                          <td className="py-1 text-slate-400 font-mono">{sku.rank}</td>
                          <td className="py-1 font-mono font-bold text-blue-700">{sku.sku}</td>
                          <td className="py-1 text-slate-800 truncate max-w-[110px]">{sku.product_name}</td>
                          <td className="py-1 text-right font-mono">{sku.on_hand}</td>
                          <td className="py-1 text-right font-mono font-bold text-amber-600">{sku.reserved}</td>
                          <td className="py-1 text-right font-mono">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-8 bg-slate-100 h-1 rounded-full overflow-hidden">
                                <div className="bg-orange-500 h-full" style={{ width: `${sku.reserved_pct}%` }}></div>
                              </div>
                              <span className="font-bold">{sku.reserved_pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Packing Slip Status (Donut Chart) */}
            {config.charts_visible?.packing_status !== false && (
              <div className="lg:col-span-3 bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-xs text-slate-900 tracking-tight">Packing Slip Status</h4>
                  <button type="button" className="text-[11px] text-blue-600 font-bold hover:underline">
                    View All &rarr;
                  </button>
                </div>

                <div className="flex items-center justify-between my-auto">
                  {/* Donut with center text */}
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={packingDonut}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={56}
                          paddingAngle={3}
                        >
                          {packingDonut.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-extrabold text-slate-900 font-mono leading-none">62</span>
                      <span className="text-[9px] font-medium text-slate-400 mt-0.5">Packing Slips</span>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="space-y-1.5 text-[11px]">
                    {packingDonut.map((slice) => (
                      <div key={slice.status} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }}></span>
                          <span className="text-slate-600">{slice.status}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800">
                          {slice.count} ({slice.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Dispatch & Invoice Summary */}
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs text-slate-900 tracking-tight">Dispatch &amp; Invoice Summary</h4>
                <button type="button" className="text-[11px] text-blue-600 font-bold hover:underline">
                  View All &rarr;
                </button>
              </div>

              <div className="overflow-x-auto my-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      <th className="py-1">Document</th>
                      <th className="py-1 text-center">Today</th>
                      <th className="py-1 text-center">This Week</th>
                      <th className="py-1 text-center">This Month</th>
                      <th className="py-1 text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dispatchInvoiceSummary.map((row) => (
                      <tr key={row.document_type} className="hover:bg-slate-50">
                        <td className="py-2 font-bold text-slate-800">{row.document_type}</td>
                        <td className="py-2 text-center font-mono">{row.today}</td>
                        <td className="py-2 text-center font-mono">{row.this_week}</td>
                        <td className="py-2 text-center font-mono font-bold">{row.this_month}</td>
                        <td className="py-2 text-right font-mono font-bold text-emerald-700">{row.formatted_value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* F. Active Fulfillment Stream (Bottom Wide Table)                  */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
            {/* Table Header & Controls */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm text-slate-900 tracking-tight">Active Fulfillment Stream</h3>

                {/* Tabs */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setStreamTab("all")}
                    className={`px-3 py-1 rounded-md font-bold transition ${
                      streamTab === "all" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All (162)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamTab("so")}
                    className={`px-3 py-1 rounded-md font-bold transition ${
                      streamTab === "so" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Sales Orders (48)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamTab("ps")}
                    className={`px-3 py-1 rounded-md font-bold transition ${
                      streamTab === "ps" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Packing (62)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamTab("ds")}
                    className={`px-3 py-1 rounded-md font-bold transition ${
                      streamTab === "ds" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Dispatched (28)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamTab("inv")}
                    className={`px-3 py-1 rounded-md font-bold transition ${
                      streamTab === "inv" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Invoices (24)
                  </button>
                </div>
              </div>

              {/* Search, Filters, Columns, Export */}
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={streamSearch}
                    onChange={(e) => setStreamSearch(e.target.value)}
                    placeholder="Search by Order / Document / Customer..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 outline-none focus:border-blue-500"
                    data-field-key="stream-search"
                  />
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Filter size={13} className="text-slate-500" />
                  <span>Filters</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <ColumnsIcon size={13} className="text-slate-500" />
                  <span>Columns</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNotification?.("Export Started", "Exporting Active Fulfillment Stream to Excel.", "success")}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Download size={13} className="text-slate-500" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Doc No.</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Item / SKU</th>
                    <th className="py-2.5 px-3 text-right">Qty (Pairs)</th>
                    <th className="py-2.5 px-3 text-right">Value (₹)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Next Action</th>
                    <th className="py-2.5 px-3">Updated By</th>
                    <th className="py-2.5 px-3">Updated On</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredStreamItems.map((item) => {
                    let typeBadge = "bg-blue-100 text-blue-800 border-blue-200";
                    if (item.doc_type === "PS") typeBadge = "bg-sky-100 text-sky-800 border-sky-200";
                    if (item.doc_type === "DS") typeBadge = "bg-orange-100 text-orange-800 border-orange-200";
                    if (item.doc_type === "INV") typeBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${typeBadge}`}>
                            {item.doc_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedDocPreview(item)}
                            className="font-mono font-bold text-blue-600 hover:underline hover:text-blue-800 text-left"
                          >
                            {item.doc_number}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{item.doc_date}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.customer_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{item.item_summary}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{item.formatted_value}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === "Open" || item.status === "Invoiced"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : item.status === "Pending"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : item.status === "Ready to Dispatch"
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : item.status === "Partially Packed"
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{item.status}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => onNotification?.("Action Triggered", `Executed "${item.next_action}" for ${item.doc_number}`, "info")}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition shadow-2xs"
                          >
                            {item.next_action_icon === "box" && <Package size={12} className="text-blue-600" />}
                            {item.next_action_icon === "check" && <Check size={12} className="text-emerald-600" />}
                            {item.next_action_icon === "receipt" && <Receipt size={12} className="text-purple-600" />}
                            {item.next_action_icon === "share" && <Share2 size={12} className="text-blue-600" />}
                            {item.next_action_icon === "arrow-right" && <ArrowRight size={12} className="text-sky-600" />}
                            {item.next_action_icon === "truck" && <Truck size={12} className="text-orange-600" />}
                            <span>{item.next_action}</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.updated_by}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.updated_on}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* G. Right-side Dashboard Configuration Panel                         */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {isConfigDrawerOpen && (
          <aside className="w-80 bg-white border-l border-slate-200/90 shadow-lg flex flex-col justify-between shrink-0 z-20 overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-tight">Dashboard Configuration</h3>
                    <p className="text-[11px] text-slate-500">Customize your dashboard view</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Group 1: Layout */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Layout</label>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="dash_layout"
                      value="standard"
                      checked={draftConfig.layout_mode === "standard"}
                      onChange={() => setDraftConfig((prev) => ({ ...prev, layout_mode: "standard" }))}
                      className="text-blue-600 focus:ring-blue-500"
                      data-field-key="config-layout-standard"
                    />
                    <span>Standard (3 Deck)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900">
                    <input
                      type="radio"
                      name="dash_layout"
                      value="focused"
                      checked={draftConfig.layout_mode === "focused"}
                      onChange={() => setDraftConfig((prev) => ({ ...prev, layout_mode: "focused" }))}
                      className="text-blue-600 focus:ring-blue-500"
                      data-field-key="config-layout-focused"
                    />
                    <span>Focused (2 Deck)</span>
                  </label>
                </div>
              </div>

              {/* Group 2: Charts & Widgets */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Charts &amp; Widgets</label>
                <div className="space-y-2 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.charts_visible?.stock_flow !== false}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          charts_visible: { ...prev.charts_visible, stock_flow: e.target.checked },
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                      data-field-key="config-widget-stock-flow"
                    />
                    <span>Stock Flow (Large)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.charts_visible?.order_to_invoice !== false}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          charts_visible: { ...prev.charts_visible, order_to_invoice: e.target.checked },
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                      data-field-key="config-widget-order-progress"
                    />
                    <span>Order to Invoice Progress (Right)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.charts_visible?.category_stock !== false}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          charts_visible: { ...prev.charts_visible, category_stock: e.target.checked },
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                      data-field-key="config-widget-cat-stock"
                    />
                    <span>Stock Position by Category</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.charts_visible?.top_skus !== false}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          charts_visible: { ...prev.charts_visible, top_skus: e.target.checked },
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                      data-field-key="config-widget-top-skus"
                    />
                    <span>Top 10 SKUs by Reserved Quantity</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.charts_visible?.packing_status !== false}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          charts_visible: { ...prev.charts_visible, packing_status: e.target.checked },
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                      data-field-key="config-widget-packing-status"
                    />
                    <span>Packing Slip Status</span>
                  </label>
                </div>

                {/* Stock Flow Chart Type Sub-Select */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Stock Flow Chart Type</label>
                  <select
                    value={draftConfig.stock_flow_chart_type}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        stock_flow_chart_type: e.target.value as any,
                      }))
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold text-slate-800 outline-none"
                    data-field-key="config-chart-type-select"
                  >
                    <option value="line">Line Chart</option>
                    <option value="area">Area Chart</option>
                    <option value="bar">Bar Chart</option>
                  </select>
                </div>
              </div>

              {/* Group 3: Data Display */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Data Display</label>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Table View</label>
                    <select
                      value={draftConfig.table_view}
                      onChange={(e) => setDraftConfig((prev) => ({ ...prev, table_view: e.target.value }))}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold text-slate-800 outline-none"
                      data-field-key="config-table-view"
                    >
                      <option value="active_stream">Active Fulfillment Stream</option>
                      <option value="orders_only">Orders Only View</option>
                      <option value="packing_only">Packing Slips View</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Default Tab</label>
                    <select
                      value={draftConfig.default_tab}
                      onChange={(e) => setDraftConfig((prev) => ({ ...prev, default_tab: e.target.value as any }))}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold text-slate-800 outline-none"
                      data-field-key="config-default-tab"
                    >
                      <option value="all">All</option>
                      <option value="so">Sales Orders</option>
                      <option value="ps">Packing</option>
                      <option value="ds">Dispatched</option>
                      <option value="inv">Invoices</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Rows Per Page</label>
                    <select
                      value={draftConfig.rows_per_page}
                      onChange={(e) => setDraftConfig((prev) => ({ ...prev, rows_per_page: parseInt(e.target.value, 10) }))}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold text-slate-800 outline-none"
                      data-field-key="config-rows-per-page"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group 4: Color Theme */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Color Theme</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900">
                    <input
                      type="radio"
                      name="dash_theme"
                      value="system"
                      checked={draftConfig.color_theme_mode === "system"}
                      onChange={() => setDraftConfig((prev) => ({ ...prev, color_theme_mode: "system" }))}
                      className="text-blue-600 focus:ring-blue-500"
                      data-field-key="config-theme-system"
                    />
                    <span>Use System Theme</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="dash_theme"
                      value="custom"
                      checked={draftConfig.color_theme_mode === "custom"}
                      onChange={() => setDraftConfig((prev) => ({ ...prev, color_theme_mode: "custom" }))}
                      className="text-blue-600 focus:ring-blue-500"
                      data-field-key="config-theme-custom"
                    />
                    <span>Custom</span>
                  </label>
                </div>

                {/* Color Palette Dots */}
                <div className="flex items-center gap-2 pt-1">
                  {[
                    { color: "#2563eb", name: "Blue" },
                    { color: "#06b6d4", name: "Cyan" },
                    { color: "#8b5cf6", name: "Purple" },
                    { color: "#f97316", name: "Orange" },
                    { color: "#64748b", name: "Slate" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setDraftConfig((prev) => ({ ...prev, custom_accent_color: c.color, color_theme_mode: "custom" }))}
                      style={{ backgroundColor: c.color }}
                      className={`w-6 h-6 rounded-full transition transform hover:scale-110 flex items-center justify-center text-white ${
                        draftConfig.custom_accent_color === c.color ? "ring-2 ring-offset-2 ring-blue-500" : ""
                      }`}
                      title={c.name}
                    >
                      {draftConfig.custom_accent_color === c.color && <Check size={12} className="stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <button
                type="button"
                onClick={handleResetConfig}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                <RotateCcw size={13} />
                <span>Reset to Default</span>
              </button>
              <button
                type="button"
                onClick={handleApplyConfig}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-xs font-extrabold shadow-sm transition tracking-wide uppercase"
                data-field-key="config-apply-btn"
              >
                Apply
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Detail Preview Modal for Clicked Document                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wider">
                  {selectedDocPreview.doc_type}
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  Document #{selectedDocPreview.doc_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocPreview(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Customer</span>
                <span className="font-bold text-slate-800">{selectedDocPreview.customer_name}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Document Date</span>
                <span className="font-mono font-bold text-slate-800">{selectedDocPreview.doc_date}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Item / SKU Summary</span>
                <span className="font-mono font-bold text-slate-800">{selectedDocPreview.item_summary}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Quantity</span>
                <span className="font-mono font-extrabold text-blue-700">{selectedDocPreview.quantity} Pairs</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Total Value</span>
                <span className="font-mono font-extrabold text-emerald-700">₹ {selectedDocPreview.formatted_value}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Current Status</span>
                <span className="font-bold text-slate-800">{selectedDocPreview.status}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedDocPreview(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onNotification?.("Action Triggered", `Triggered ${selectedDocPreview.next_action}`, "success");
                  setSelectedDocPreview(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                {selectedDocPreview.next_action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
