/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-27
 * Modified     : 2026-08-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Download,
  Filter,
  Search,
  Grid,
  Layers,
  BarChart3,
  FileSpreadsheet,
  Printer,
  Share2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  TableProperties,
  ArrowUpDown,
  ExternalLink,
  Sparkles,
  Info,
  Check,
  Calculator,
  Sigma,
  Save,
  PanelRight
} from "lucide-react";
import { formatCurrency, formatNumber, formatDate } from "../../utils/formatters";
import { GlobalExportService } from "../../services/globalExportService";

export interface ReportColumnDef {
  key: string;
  label: string;
  datatype: "currency" | "number" | "date" | "badge" | "text";
  isSummary?: boolean;
  width?: number;
  align?: "left" | "right" | "center";
}

export interface SmritiReportEngineProps {
  reportId: string;
  reportTitle: string;
  reportCategory?: string;
  description?: string;
  data: any[];
  columns?: ReportColumnDef[];
  summaryMetrics?: Record<string, any>;
  onRefresh?: () => void;
  isLoading?: boolean;
  activeRole?: string;
  onNotification?: (type: "success" | "error" | "info", message: string) => void;
}

type DatePreset = "today" | "yesterday" | "this_week" | "mtd" | "qtd" | "fytd" | "custom";
type GroupByOption = "none" | "store_code" | "store_name" | "customer_name" | "style_name" | "category";

export const SmritiReportEngine: React.FC<SmritiReportEngineProps> = ({
  reportId,
  reportTitle,
  reportCategory = "Operational Intelligence",
  description,
  data = [],
  columns: propColumns,
  summaryMetrics,
  onRefresh,
  isLoading = false,
  activeRole = "Store Manager",
  onNotification,
}) => {
  // Date Preset & Range State
  const [activePreset, setActivePreset] = useState<DatePreset>("mtd");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Dimensional Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // View Layout States
  const [viewMode, setViewMode] = useState<"grid" | "grouped" | "chart">("grid");
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Summary & Totals Configuration
  const [showGrandTotal, setShowGrandTotal] = useState<boolean>(true);
  const [showSubTotals, setShowSubTotals] = useState<boolean>(true);

  // Column Sorting
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Column Visibility Chooser
  const [showColumnChooser, setShowColumnChooser] = useState<boolean>(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<Record<string, boolean>>({});
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [isViewSaved, setIsViewSaved] = useState<boolean>(false);

  // Auto-detect columns if not provided
  const columns: ReportColumnDef[] = useMemo(() => {
    if (propColumns && propColumns.length > 0) return propColumns;
    if (!data || data.length === 0) {
      return [
        { key: "code", label: "CODE", datatype: "text" },
        { key: "title", label: "TITLE", datatype: "text" },
        { key: "category", label: "CATEGORY", datatype: "text" }
      ];
    }
    const sample = data[0];
    return Object.keys(sample)
      .filter((k) => !["id", "_id", "__v"].includes(k))
      .map((k) => {
        const lk = k.toLowerCase();
        let datatype: ReportColumnDef["datatype"] = "text";
        let isSummary = false;
        if (lk.includes("amount") || lk.includes("price") || lk.includes("total") || lk.includes("value") || lk.includes("tax") || lk.includes("mrp") || lk.includes("basic") || lk.includes("rate") || lk.includes("balance")) {
          datatype = "currency";
          isSummary = true;
        } else if (lk.includes("qty") || lk.includes("quantity") || lk.includes("count") || lk.includes("units") || lk.includes("pieces") || lk.includes("pairs")) {
          datatype = "number";
          isSummary = true;
        } else if (lk.includes("date") || lk.includes("created_at") || lk.includes("updated_at")) {
          datatype = "date";
        } else if (lk.includes("status")) {
          datatype = "badge";
        }
        return {
          key: k,
          label: k.replace(/_/g, " ").toUpperCase(),
          datatype,
          isSummary,
          align: datatype === "currency" || datatype === "number" ? ("right" as const) : ("left" as const),
        };
      });
  }, [propColumns, data]);

  // Extract list of unique Stores & Statuses
  const uniqueStores = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      const storeVal = r.site_code || r.store_code || r.siteCode || r.storeCode || r.site_name || r.siteName || r.store;
      if (storeVal) set.add(String(storeVal));
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      const st = r.status || r.fulfillment_status || r.workflow_status;
      if (st) set.add(String(st));
    });
    return Array.from(set).sort();
  }, [data]);

  // Date Preset Change Handler
  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "this_week") {
      const start = new Date();
      start.setDate(now.getDate() - now.getDay());
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "mtd") {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      setStartDate(start);
      setEndDate(todayStr);
    } else if (preset === "qtd") {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
      const start = `${now.getFullYear()}-${String(quarterMonth).padStart(2, "0")}-01`;
      setStartDate(start);
      setEndDate(todayStr);
    } else if (preset === "fytd") {
      const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      setStartDate(`${fyYear}-04-01`);
      setEndDate(`${fyYear + 1}-03-31`);
    }
  };

  // Filtered and Sorted Data
  const filteredData = useMemo(() => {
    let list = [...data];

    // 1. Text Search Filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      list = list.filter((row) =>
        Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === "object") return JSON.stringify(val).toLowerCase().includes(query);
          return String(val).toLowerCase().includes(query);
        })
      );
    }

    // 2. Store Filter
    if (selectedStore !== "ALL") {
      list = list.filter((r) => {
        const storeVal = String(r.site_code || r.store_code || r.siteCode || r.storeCode || r.site_name || r.siteName || r.store || "");
        return storeVal === selectedStore;
      });
    }

    // 3. Status Filter
    if (selectedStatus !== "ALL") {
      list = list.filter((r) => {
        const st = String(r.status || r.fulfillment_status || r.workflow_status || "");
        return st === selectedStatus;
      });
    }

    // 4. Column Sorting
    if (sortColumn) {
      list.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return list;
  }, [data, searchTerm, selectedStore, selectedStatus, sortColumn, sortDirection]);

  // Grouped Data Map
  const groupedData = useMemo(() => {
    if (viewMode !== "grouped" || groupBy === "none") return null;

    const map = new Map<string, any[]>();
    filteredData.forEach((row) => {
      let key = "Other / Unassigned";
      if (groupBy === "store_code" || groupBy === "store_name") {
        key = row.site_code ? `${row.site_code} - ${row.site_name || "Store"}` : (row.site_name || row.store || "Direct / Head Office");
      } else if (groupBy === "customer_name") {
        key = row.customer_name || row.customerName || row.party_name || "General Walk-In";
      } else if (groupBy === "style_name") {
        key = row.style_name || row.style || row.article_no || row.vendor_style || "Standard Article";
      } else if (groupBy === "category") {
        key = row.category || row.item_group || row.division || "General Merchandise";
      }

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });

    return Array.from(map.entries());
  }, [filteredData, viewMode, groupBy]);

  // Active Visible Columns
  const activeColumns = useMemo(() => {
    return columns.filter((c) => visibleColumnKeys[c.key] !== false);
  }, [columns, visibleColumnKeys]);

  // Helper for computing summary totals per column
  const calculateSummaryCell = (rows: any[], col: ReportColumnDef, isFirstCol: boolean, label = "TOTAL") => {
    if (isFirstCol) {
      return `${label} (${rows.length})`;
    }
    const lk = col.key.toLowerCase();
    if (col.datatype === "currency" || lk.includes("amount") || lk.includes("total") || lk.includes("value") || lk.includes("tax") || lk.includes("mrp") || lk.includes("basic") || lk.includes("balance")) {
      const sum = rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
      return formatCurrency(sum);
    }
    if (col.datatype === "number" || lk.includes("qty") || lk.includes("quantity") || lk.includes("count") || lk.includes("units") || lk.includes("pieces") || lk.includes("pairs")) {
      const sum = rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
      return formatNumber(sum, 0);
    }
    if (lk.includes("rate") || lk.includes("price") || lk.includes("discount")) {
      const avg = rows.length > 0 ? rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0) / rows.length : 0;
      return `avg: ${formatCurrency(avg)}`;
    }
    return "—";
  };

  // Computed Dynamic KPIs
  const kpis = useMemo(() => {
    if (summaryMetrics && Object.keys(summaryMetrics).length > 0) {
      return summaryMetrics;
    }

    let totalVal = 0;
    let totalUnits = 0;
    let totalTax = 0;
    let totalCount = filteredData.length;

    filteredData.forEach((r) => {
      totalVal += Number(r.grand_total || r.grandTotal || r.total_value || r.amount || r.billed_value || 0);
      totalUnits += Number(r.quantity || r.total_qty || r.billed_quantity || r.ordered_qty || r.units || 0);
      totalTax += Number(r.tax_total || r.taxTotal || r.tax_amount || r.gst_amount || 0);
    });

    return {
      "Total Records": totalCount,
      "Total Quantity": totalUnits > 0 ? `${formatNumber(totalUnits, 0)} Units` : null,
      "Consolidated Tax (GST)": totalTax > 0 ? formatCurrency(totalTax) : null,
      "Grand Financial Value": formatCurrency(totalVal),
    };
  }, [filteredData, summaryMetrics]);

  // Export Action Handlers
  const handleExport = async (format: "xlsx" | "csv" | "json" | "pdf" | "gsheet") => {
    if (activeRole === "Cashier") {
      onNotification?.("error", "Rule 10 Restricted: Cashier role is denied export privileges.");
      return;
    }

    if (format === "pdf") {
      window.print();
      return;
    }

    // Direct Native Backend Workbooks for Master Registers
    if (format === "xlsx" && reportId === "RPT-TAX-001") {
      window.location.href = "/api/v1/reports/export/tax-invoices-excel";
      onNotification?.("success", "Initiating download of Statutory Tax Invoices Master Workbook (.xlsx)");
      return;
    }
    if (format === "xlsx" && reportId === "RPT-SO-008") {
      window.location.href = "/api/v1/reports/sales-orders/export-excel";
      onNotification?.("success", "Initiating download of Sales Orders Master 6-Sheet Workbook (.xlsx)");
      return;
    }
    if (format === "csv" && reportId === "RPT-SO-008") {
      window.location.href = "/api/v1/reports/sales-orders/export-csv";
      onNotification?.("success", "Initiating download of Flat Sales Orders CSV (.csv)");
      return;
    }

    let exportRows = [...filteredData];

    // If Grand Total is enabled, append summary row
    if (showGrandTotal && exportRows.length > 0) {
      const summaryRow: Record<string, any> = {};
      activeColumns.forEach((col, idx) => {
        if (idx === 0) {
          summaryRow[col.key] = `GRAND TOTAL (${exportRows.length} Records)`;
        } else {
          const lk = col.key.toLowerCase();
          if (col.datatype === "currency" || lk.includes("amount") || lk.includes("total") || lk.includes("value") || lk.includes("tax") || lk.includes("mrp") || lk.includes("basic") || lk.includes("balance")) {
            summaryRow[col.key] = exportRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
          } else if (col.datatype === "number" || lk.includes("qty") || lk.includes("quantity") || lk.includes("count") || lk.includes("units")) {
            summaryRow[col.key] = exportRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
          } else {
            summaryRow[col.key] = "";
          }
        }
      });
      exportRows.push(summaryRow);
    }

    const result = await GlobalExportService.exportDataset({
      moduleName: reportTitle.replace(/[^a-zA-Z0-9_-]/g, "_"),
      format,
      scope: "all",
      columns: activeColumns,
      data: exportRows,
      metadata: {
        moduleTitle: reportTitle,
        companyName: "Tattly Threads / SMRITI Retail OS",
        exportTimestamp: new Date().toLocaleString(),
        searchTerm: searchTerm || undefined,
      },
    });

    if (result.success) {
      onNotification?.("success", `Export completed successfully: ${result.filename}`);
    } else {
      onNotification?.("error", result.errorMessage || "Failed to generate report file.");
    }
  };

  const toggleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveView = () => {
    setIsViewSaved(true);
    onNotification?.("success", `View saved for ${reportTitle}.`);
  };

  const chartColumn = activeColumns.find((column) => column.datatype === "currency" || column.datatype === "number");
  const chartRows = chartColumn ? filteredData.slice(0, 8) : [];
  const chartMaximum = chartColumn
    ? Math.max(...chartRows.map((row) => Math.abs(Number(row[chartColumn.key]) || 0)), 1)
    : 1;

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-theme-surface-1 border border-theme-border p-5 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-theme-divider">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-theme-selection text-theme-primary border border-theme-primary/30">
                {reportCategory}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                isLoading
                  ? "text-amber-300 border-amber-500/30 bg-amber-950/30"
                  : data.length > 0
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-950/30"
                    : "text-slate-300 border-slate-600 bg-slate-800"
              }`}>
                {isLoading ? "LOADING" : data.length > 0 ? "LIVE DATA" : "NO LIVE DATA"}
              </span>
              <span className="text-xs font-mono text-theme-muted">#{reportId}</span>
            </div>
            <h3 className="text-lg font-bold text-theme-body mt-1 flex items-center gap-2">
              {reportTitle}
            </h3>
            {description && (
              <p className="text-xs text-theme-muted mt-0.5 leading-relaxed max-w-3xl">
                {description}
              </p>
            )}
          </div>

          {/* Quick Action Export Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted rounded-lg border border-theme-border transition-colors cursor-pointer disabled:opacity-50"
                title="Reload Latest Data"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin text-indigo-400" : ""} />
              </button>
            )}

            {/* Native Excel Exporter */}
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
                className="px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <TableProperties size={13} /> Excel (.xlsx)
            </button>

            {/* PDF / Print */}
            <button
              type="button"
              onClick={() => handleExport("pdf")}
                className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer size={13} /> Print / PDF
            </button>

            {/* CSV Flat File */}
            <button
              type="button"
              onClick={() => handleExport("csv")}
                className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={13} /> CSV
            </button>

            {/* Direct Google Sheets 1-Click */}
            <button
              type="button"
              onClick={() => handleExport("gsheet")}
                className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Copies table to clipboard and opens Google Sheets"
            >
              <ExternalLink size={13} /> Google Sheets
            </button>

            <button
              type="button"
              onClick={saveView}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isViewSaved
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border-theme-border"
              }`}
            >
              <Save size={13} /> {isViewSaved ? "View Saved" : "Save View"}
            </button>

            <button
              type="button"
              onClick={() => setShowInspector((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                showInspector
                  ? "bg-theme-selection text-theme-primary border-theme-primary/40"
                  : "bg-theme-surface-2 text-theme-muted border-theme-border"
              }`}
              title="Toggle report inspector"
            >
              <PanelRight size={15} />
            </button>
          </div>
        </div>

        {/* Live Executive KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {Object.entries(kpis).map(([label, val], idx) => {
            if (val === null || val === undefined) return null;
            return (
              <div key={idx} className="p-3 bg-theme-surface-2 border border-theme-border rounded-lg">
                <span className="text-[10px] font-mono uppercase font-bold text-theme-muted tracking-wider block">
                  {label}
                </span>
                <p className="text-base font-black font-mono text-theme-body mt-1">
                  {val}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. UNIVERSAL FILTER & SUMMARY CONFIGURATION BAR */}
      <div className="bg-theme-surface-1 border border-theme-border p-4 rounded-xl shadow-xs space-y-3">
        {/* Preset Date Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-theme-divider">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-theme-muted font-mono mr-1 flex items-center gap-1">
              <Calendar size={13} className="text-indigo-400" /> Range:
            </span>
            {(["today", "yesterday", "this_week", "mtd", "qtd", "fytd", "custom"] as DatePreset[]).map((p) => {
              const labels: Record<DatePreset, string> = {
                today: "Today",
                yesterday: "Yesterday",
                this_week: "This Week",
                mtd: "Month to Date",
                qtd: "Quarter",
                fytd: "FY 2026-27",
                custom: "Custom Range"
              };
              const isSelected = activePreset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer ${
                    isSelected
                      ? "bg-theme-primary text-white shadow-xs"
                      : "bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body border border-theme-border"
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          {activePreset === "custom" && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-theme-surface-2 border border-theme-border rounded-lg text-theme-body focus:outline-none focus:border-theme-primary"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-theme-surface-2 border border-theme-border rounded-lg text-theme-body focus:outline-none focus:border-theme-primary"
              />
            </div>
          )}
        </div>

        {/* Search, Store, Status & Summary Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Universal Search */}
          <div className="relative md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search across all fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-theme-surface-2 border border-theme-border rounded-lg text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-theme-primary"
            />
          </div>

          {/* Store / Site Code Filter */}
          <div>
            <select
              value={selectedStore}
            >
              <option value="ALL">🏢 All Stores / Sites</option>
              {uniqueStores.map((st) => (
                <option key={st} value={st}>
                  Store: {st}
                </option>
              ))}
            </select>
          </div>
            <div className={`grid grid-cols-1 ${showInspector ? "xl:grid-cols-[minmax(0,1fr)_248px]" : ""} gap-4 items-start`}>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-theme-surface-2 border border-theme-border rounded-lg text-xs text-theme-body focus:outline-none focus:border-theme-primary"
            >
              <option value="ALL">🏷️ All Statuses</option>
              {uniqueStatuses.map((st) => (
                <option key={st} value={st}>
                  Status: {st}
                </option>
              ))}
            </select>
          </div>

          {/* Grouping Selection */}
          <div>
            <select
              value={groupBy}
              onChange={(e) => {
                const val = e.target.value as GroupByOption;
                setGroupBy(val);
                if (val !== "none") setViewMode("grouped");
                else setViewMode("grid");
              }}
              className="w-full px-2.5 py-1.5 bg-theme-surface-2 border border-theme-border rounded-lg text-xs text-theme-body focus:outline-none focus:border-theme-primary"
            >
              <option value="none">Ungrouped Flat Grid</option>
              <option value="store_code">Group by Store Code</option>
              <option value="customer_name">Group by Customer</option>
              <option value="style_name">Group by Style</option>
              <option value="category">Group by Category</option>
            </select>
          </div>

          {/* Totals & Summary Toggles */}
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            {/* Grand Total Toggle */}
            <button
              type="button"
              onClick={() => setShowGrandTotal(!showGrandTotal)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                showGrandTotal
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs"
                  : "bg-theme-surface-2 border-theme-border text-theme-muted opacity-60"
              }`}
              title="Toggle Grand Total Row"
            >
              <Sigma size={13} />
              <span>Total</span>
            </button>

            {/* Sub-Totals Toggle */}
            {viewMode === "grouped" && (
              <button
                type="button"
                onClick={() => setShowSubTotals(!showSubTotals)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                  showSubTotals
                    ? "bg-theme-selection border-theme-primary/40 text-theme-primary shadow-xs"
                    : "bg-theme-surface-2 border-theme-border text-theme-muted opacity-60"
                }`}
                title="Toggle Group Sub-Totals"
              >
                <Calculator size={13} />
                <span>Sub-Total</span>
              </button>
            )}

            {/* Column Chooser Button */}
            <button
              type="button"
              onClick={() => setShowColumnChooser(!showColumnChooser)}
              className="p-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted border border-theme-border rounded-lg cursor-pointer transition-colors"
              title="Show / Hide Columns"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* Expandable Column Chooser Drawer */}
        {showColumnChooser && (
          <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-border space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-theme-body pb-1 border-b border-theme-divider">
              <span>Configure Columns to Display</span>
              <button
                type="button"
                onClick={() => setVisibleColumnKeys({})}
                className="text-[10px] text-theme-primary hover:underline cursor-pointer"
              >
                Reset All Columns
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {columns.map((c) => {
                const isVisible = visibleColumnKeys[c.key] !== false;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setVisibleColumnKeys((prev) => ({
                        ...prev,
                        [c.key]: !isVisible,
                      }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                      isVisible
                        ? "bg-theme-selection border-theme-primary/40 text-theme-primary"
                        : "bg-theme-surface-1 border-theme-border text-theme-muted line-through"
                    }`}
                  >
                    {isVisible && <Check size={11} />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. REPORT DATA GRID & ACCORDION GROUP VIEW */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {viewMode === "chart" ? (
            <div className="p-5 min-h-[260px]">
              {chartColumn && chartRows.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-theme-body">{chartColumn.label}</span>
                    <span className="text-theme-muted">Showing first {chartRows.length} records</span>
                  </div>
                  {chartRows.map((row, index) => {
                    const value = Number(row[chartColumn.key]) || 0;
                    const labelColumn = activeColumns.find((column) => column.datatype === "text") || activeColumns[0];
                    return (
                      <div key={index} className="grid grid-cols-[minmax(90px,150px)_1fr_auto] items-center gap-3 text-xs">
                        <span className="truncate text-theme-muted">{String(row[labelColumn.key] ?? `Record ${index + 1}`)}</span>
                        <div className="h-2.5 bg-theme-surface-2 rounded-full overflow-hidden">
                          <div className="h-full bg-theme-primary rounded-full transition-all" style={{ width: `${Math.max((Math.abs(value) / chartMaximum) * 100, 3)}%` }} />
                        </div>
                        <span className="font-mono font-semibold text-theme-body">{chartColumn.datatype === "currency" ? formatCurrency(value) : formatNumber(value)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="min-h-[220px] flex items-center justify-center text-sm text-theme-muted">No numeric data is available for chart view.</div>
              )}
            </div>
          ) : viewMode === "grouped" && groupedData ? (
            /* GROUPED ACCORDION VIEW WITH SUB-TOTALS */
            <div className="divide-y divide-slate-800">
              {groupedData.map(([groupName, rows], gIdx) => {
                const isExpanded = expandedGroups[groupName] !== false; // Default expanded
                const groupSubtotal = rows.reduce(
                  (acc, r) => acc + Number(r.grand_total || r.grandTotal || r.amount || r.total_value || 0),
                  0
                );
                const groupUnits = rows.reduce(
                  (acc, r) => acc + Number(r.quantity || r.total_qty || r.units || 0),
                  0
                );

                return (
                  <div key={gIdx} className="bg-slate-900/40">
                    {/* Group Header Banner */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-slate-950/70 hover:bg-slate-950 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={16} className="text-indigo-400" /> : <ChevronRight size={16} className="text-slate-500" />}
                        <span className="font-bold text-sm text-white font-mono">{groupName}</span>
                        <span className="text-xs text-slate-400 font-mono">({rows.length} records)</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        {groupUnits > 0 && <span className="text-slate-400">{formatNumber(groupUnits, 0)} Units</span>}
                        {groupSubtotal > 0 && <span className="font-bold text-emerald-400">{formatCurrency(groupSubtotal)}</span>}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="overflow-x-auto p-2 bg-slate-950/30">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-800/60 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-700">
                              {activeColumns.map((col) => (
                                <th key={col.key} className={`p-2.5 ${col.align === "right" ? "text-right" : "text-left"}`}>
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                                {activeColumns.map((col) => {
                                  const val = row[col.key];
                                  return (
                                    <td key={col.key} className={`p-2.5 ${col.align === "right" ? "text-right font-mono" : ""}`}>
                                      {col.datatype === "currency" ? (
                                        <span className="font-semibold text-emerald-400">{formatCurrency(val)}</span>
                                      ) : col.datatype === "number" ? (
                                        <span className="font-semibold text-slate-200">{formatNumber(val)}</span>
                                      ) : col.datatype === "date" ? (
                                        <span className="text-slate-400 font-mono">{formatDate(val)}</span>
                                      ) : col.datatype === "badge" ? (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                                          {String(val || "ACTIVE")}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">{val !== null && val !== undefined ? String(val) : "—"}</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>

                          {/* GROUP SUB-TOTAL FOOTER ROW */}
                          {showSubTotals && (
                            <tfoot>
                              <tr className="bg-indigo-950/40 border-t-2 border-indigo-500/40 font-mono font-bold text-xs text-indigo-200">
                                {activeColumns.map((col, cIdx) => (
                                  <td key={col.key} className={`p-2.5 ${col.align === "right" ? "text-right text-emerald-300" : ""}`}>
                                    {calculateSummaryCell(rows, col, cIdx === 0, `SUB TOTAL (${groupName})`)}
                                  </td>
                                ))}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* OVERALL STICKY GRAND TOTAL FOR GROUPED VIEW */}
              {showGrandTotal && (
                <div className="p-4 bg-slate-950 border-t-2 border-emerald-500/60 flex flex-col md:flex-row justify-between items-center gap-2 text-xs font-mono font-bold">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Sigma size={16} />
                    <span>OVERALL GRAND TOTAL ({filteredData.length} Records across {groupedData.length} Groups)</span>
                  </div>
                  <div className="flex items-center gap-4 text-emerald-300">
                    <span>
                      Total Units: {formatNumber(filteredData.reduce((acc, r) => acc + (Number(r.quantity || r.total_qty || r.units || 0)), 0), 0)}
                    </span>
                    <span className="text-sm font-black text-emerald-400">
                      Total Value: {formatCurrency(filteredData.reduce((acc, r) => acc + (Number(r.grand_total || r.grandTotal || r.total_value || r.amount || 0)), 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* FLAT TABULAR DATA GRID WITH STICKY GRAND TOTAL */
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800 sticky top-0 z-10">
                  {activeColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`p-3 select-none cursor-pointer hover:text-white transition-colors ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <div className={`inline-flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                        <span>{col.label}</span>
                        <ArrowUpDown size={11} className={sortColumn === col.key ? "text-indigo-400" : "text-slate-600"} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length} className="p-8 text-center font-sans">
                      <div className="text-sm font-semibold text-theme-body">No live data returned</div>
                      <div className="mt-1 text-xs text-theme-muted">This report has no records for the selected period.</div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length} className="p-8 text-center text-slate-500 font-mono text-xs">
                      No matching records found for the selected range and filters.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                      {activeColumns.map((col) => {
                        const val = row[col.key];
                        return (
                          <td key={col.key} className={`p-3 ${col.align === "right" ? "text-right font-mono" : ""}`}>
                            {col.datatype === "currency" ? (
                              <span className="font-semibold text-emerald-400">{formatCurrency(val)}</span>
                            ) : col.datatype === "number" ? (
                              <span className="font-semibold text-slate-200">{formatNumber(val)}</span>
                            ) : col.datatype === "date" ? (
                              <span className="text-slate-400 font-mono">{formatDate(val)}</span>
                            ) : col.datatype === "badge" ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                                {String(val || "ACTIVE")}
                              </span>
                            ) : (
                              <span className="text-slate-300">{val !== null && val !== undefined ? String(val) : "—"}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>

              {/* STICKY GRAND TOTAL FOOTER ROW */}
              {showGrandTotal && filteredData.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-slate-950 border-t-2 border-emerald-500/60 shadow-2xl">
                  <tr className="font-mono font-bold text-xs text-white">
                    {activeColumns.map((col, cIdx) => (
                      <td key={col.key} className={`p-3.5 ${col.align === "right" ? "text-right text-emerald-400 text-sm font-black" : "text-emerald-300"}`}>
                        {calculateSummaryCell(filteredData, col, cIdx === 0, "GRAND TOTAL")}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Table Footer Bar with Entry Count */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 font-mono">
          <div>
            Showing <span className="font-bold text-white">{filteredData.length}</span> of{" "}
            <span className="font-bold text-white">{data.length}</span> total entries
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">SMRITI Universal Engine v3.30.0 • Totals Configured</span>
          </div>
        </div>
      </div>

      {showInspector && (
        <aside className="bg-theme-surface-1 border border-theme-border rounded-xl shadow-xs overflow-hidden xl:sticky xl:top-4">
          <div className="px-4 py-3 border-b border-theme-divider bg-theme-surface-2 flex items-center gap-2">
            <PanelRight size={14} className="text-theme-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-theme-body">Report Inspector</span>
          </div>
          <div className="p-4 space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Canvas</span>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {([
                  ["grid", "Table", Grid],
                  ["grouped", "Grouped", Layers],
                  ["chart", "Chart", BarChart3]
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-1.5 py-2 rounded-md border flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                      viewMode === mode
                        ? "bg-theme-selection text-theme-primary border-theme-primary/40"
                        : "bg-theme-surface-2 text-theme-muted border-theme-border hover:text-theme-body"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Group rows by</label>
              <select
                value={groupBy}
                onChange={(e) => {
                  const nextGroup = e.target.value as GroupByOption;
                  setGroupBy(nextGroup);
                  setViewMode(nextGroup === "none" ? "grid" : "grouped");
                }}
                className="w-full mt-2 px-2.5 py-2 bg-theme-surface-2 border border-theme-border rounded-lg text-theme-body focus:outline-none focus:border-theme-primary"
              >
                <option value="none">No grouping</option>
                <option value="store_code">Store</option>
                <option value="customer_name">Customer</option>
                <option value="style_name">Style</option>
                <option value="category">Category</option>
              </select>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Summary</span>
              <label className="flex items-center justify-between text-theme-body cursor-pointer">
                <span>Grand total</span>
                <input type="checkbox" checked={showGrandTotal} onChange={(e) => setShowGrandTotal(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-theme-body cursor-pointer">
                <span>Group subtotals</span>
                <input type="checkbox" checked={showSubTotals} onChange={(e) => setShowSubTotals(e.target.checked)} />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setShowColumnChooser((prev) => !prev)}
              className="w-full px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-border rounded-lg text-theme-body font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal size={13} /> Configure columns
            </button>
          </div>
        </aside>
      )}
      </div>
    </div>
  );
};
