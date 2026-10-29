/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.19
 * Created      : 2026-08-27
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Multi-Dimensional Report Engine with Unified A4 Landscape Body Portal Print Studio
 */

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
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
  PanelRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import { formatCurrency, formatNumber, formatDate } from "../../utils/formatters";
import { GlobalExportService } from "../../services/globalExportService";
import { apiFetchV1, getTenantCompanyContext } from "../../lib/apiFetchV1";

export interface ReportColumnDef {
  key: string;
  label: string;
  datatype: "currency" | "number" | "date" | "badge" | "text" | "link";
  isSummary?: boolean;
  width?: number;
  align?: "left" | "right" | "center";
  entityLink?: "invoice" | "sales_order" | "item" | "customer" | string;
}

export interface SmritiReportEngineProps {
  reportId: string;
  reportTitle: string;
  reportCategory?: string;
  description?: string;
  data?: any[];
  columns?: ReportColumnDef[];
  summaryMetrics?: Record<string, any>;
  chartConfig?: any;
  systemMessage?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  activeRole?: string;
  onNotification?: (type: "success" | "error" | "info", message: string) => void;
  onEntityClick?: (entityType: string, entityId: string) => void;
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
  chartConfig,
  systemMessage,
  onRefresh,
  isLoading = false,
  activeRole = "Store Manager",
  onNotification,
  onEntityClick,
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

  // Asynchronous Prepared Report State (Frappe / ERPNext Pattern)
  const [preparedTaskId, setPreparedTaskId] = useState<string | null>(null);
  const [preparedStatus, setPreparedStatus] = useState<string | null>(null);
  const [preparedProgress, setPreparedProgress] = useState<number>(0);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);

  // Print Preview Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const tenantContext = useMemo(() => {
    if (typeof window !== "undefined") {
      return getTenantCompanyContext();
    }
    return { companyName: "", companyAddress: "", companyGstin: "" };
  }, []);

  useEffect(() => {
    if (!isPrintModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsPrintModalOpen(false);
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPrintModalOpen]);


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
      setIsPrintModalOpen(true);
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
      columns: activeColumns.map(({ key, label, datatype, isSummary, width, align }) => ({
        key,
        label,
        datatype,
        isSummary,
        width,
        align,
      })),
      data: exportRows,
      metadata: {
        moduleTitle: reportTitle,
        companyName: (typeof window !== "undefined" ? getTenantCompanyContext().companyName : "") || "SMRITI Retail OS",
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

  const handlePreparedExport = async (format: "XLSX" | "CSV" = "XLSX") => {
    setIsPreparing(true);
    onNotification?.("info", `Enqueuing prepared report #${reportId} for background execution...`);
    try {
      const res: any = await apiFetchV1("/reports/prepared/enqueue", {
        method: "POST",
        body: JSON.stringify({
          report_code: reportId,
          parameters: {
            from_date: startDate,
            to_date: endDate,
            store: selectedStore,
            status: selectedStatus,
            search: searchTerm || undefined,
          },
          export_format: format,
        }),
      });

      if (res?.is_cached_hit && res?.download_url) {
        onNotification?.("success", `Snapshot Cache Hit! Downloading sealed report artifact...`);
        window.location.href = res.download_url;
        setIsPreparing(false);
        return;
      }

      setPreparedTaskId(res.task_id);
      setPreparedStatus(res.status);
      setPreparedProgress(res.progress_percent || 10);
      onNotification?.("success", `Prepared report enqueued as Task ${res.task_id}. Background worker running.`);

      // Poll status every 2 seconds
      const interval = setInterval(async () => {
        try {
          const pollRes: any = await apiFetchV1(`/reports/prepared/${res.task_id}/status`);
          setPreparedStatus(pollRes.status);
          setPreparedProgress(pollRes.progress_percent);
          if (pollRes.status === "COMPLETED") {
            clearInterval(interval);
            setIsPreparing(false);
            onNotification?.("success", `Prepared Report completed! Sealed hash: ${pollRes.forensic_hash?.substring(0, 16)}...`);
            if (pollRes.download_url) {
              window.location.href = pollRes.download_url;
            }
          } else if (pollRes.status === "FAILED") {
            clearInterval(interval);
            setIsPreparing(false);
            onNotification?.("error", `Prepared Report failed: ${pollRes.error_message || "Unknown error"}`);
          }
        } catch (pollErr) {
          clearInterval(interval);
          setIsPreparing(false);
        }
      }, 2000);
    } catch (err: any) {
      setIsPreparing(false);
      onNotification?.("error", err?.message || "Failed to enqueue prepared report.");
    }
  };

  const renderCellContent = (col: ReportColumnDef, val: any, _row: any) => {
    if (val === null || val === undefined) return <span className="text-slate-500">—</span>;

    const isLink = col.datatype === "link" || col.entityLink || ["invoice_no", "order_no", "item_code", "doc_no", "bill_no"].includes(col.key);
    if (isLink) {
      const entityType = col.entityLink || (col.key.includes("invoice") || col.key.includes("bill") ? "invoice" : col.key.includes("order") ? "sales_order" : "item");
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onEntityClick) {
              onEntityClick(entityType, String(val));
            } else {
              onNotification?.("info", `Document ${val} clicked (${entityType})`);
            }
          }}
          className="inline-flex items-center gap-1 font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer group"
          title={`Click to preview ${entityType}: ${val}`}
        >
          <span>{String(val)}</span>
          <ExternalLink size={10} className="opacity-60 group-hover:opacity-100" />
        </button>
      );
    }

    if (col.datatype === "currency") {
      return <span className="font-semibold text-emerald-400">{formatCurrency(val)}</span>;
    }
    if (col.datatype === "number") {
      return <span className="font-semibold text-slate-200">{formatNumber(val)}</span>;
    }
    if (col.datatype === "date") {
      return <span className="text-slate-400 font-mono">{formatDate(val)}</span>;
    }
    if (col.datatype === "badge") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
          {String(val || "ACTIVE")}
        </span>
      );
    }
    return <span className="text-slate-300">{String(val)}</span>;
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

            {/* Frappe-Inspired Asynchronous Prepared Report Exporter */}
            <button
              type="button"
              onClick={() => handlePreparedExport("XLSX")}
              disabled={isPreparing}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Asynchronous background report generation with deterministic caching and statutory sealing"
            >
              <Clock size={13} className={isPreparing ? "animate-spin" : ""} />
              <span>{isPreparing ? `Preparing (${preparedProgress}%)` : "Prepared Export"}</span>
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

      {/* System Message / Audit Guidance Banner */}
      {systemMessage && (
        <div className="px-4 py-2 bg-theme-surface-1 border border-theme-border rounded-xl text-xs font-mono text-theme-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-indigo-400" />
            <span>{systemMessage}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
            Governed Contract
          </span>
        </div>
      )}

      {/* Asynchronous Prepared Report Notification & Download Banner */}
      {preparedTaskId && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            {preparedStatus === "COMPLETED" ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : preparedStatus === "FAILED" ? (
              <AlertCircle size={16} className="text-rose-400" />
            ) : (
              <Clock size={16} className="animate-spin text-indigo-400" />
            )}
            <div>
              <span className="text-indigo-200">
                Prepared Task <strong>{preparedTaskId}</strong>: Status is{" "}
                <span className={preparedStatus === "COMPLETED" ? "text-emerald-400 font-bold" : "text-amber-300"}>
                  {preparedStatus}
                </span>{" "}
                ({preparedProgress}%)
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Background execution generated in Statutory Vault with deterministic caching and SHA-256 seal.
              </p>
            </div>
          </div>
          {preparedStatus === "COMPLETED" && (
            <a
              href={`/api/v1/reports/prepared/${preparedTaskId}/download`}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Download size={13} /> Download Sealed Artifact (.xlsx)
            </a>
          )}
        </div>
      )}

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
                                      {renderCellContent(col, val, row)}
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
                            {renderCellContent(col, val, row)}
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

      {/* ── Official Report Ledger Print Preview (Body Portal) ── */}
      {isPrintModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="smriti-report-modal-root print-preview-visible fixed inset-0 z-50 flex flex-col bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:static print:inset-auto print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:overflow-visible"
          role="dialog"
          aria-modal="true"
          aria-label="Report Ledger Print Preview"
        >
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 8mm 10mm 10mm 10mm;
              }
              #root {
                display: none !important;
              }
              html, body {
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .smriti-report-modal-root {
                position: static !important;
                display: block !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: white !important;
              }
              .smriti-report-toolbar,
              .no-print {
                display: none !important;
              }
              .smriti-report-canvas-wrapper {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: white !important;
              }
              .smriti-report-printable-sheet {
                box-shadow: none !important;
                border: none !important;
                margin: 0 auto !important;
                padding: 0 !important;
                max-width: 100% !important;
                visibility: visible !important;
                background: white !important;
              }
            }
          `}</style>

          {/* Floating Toolbar */}
          <div className="smriti-report-toolbar h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm shrink-0 print:hidden">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                <Printer size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Report Ledger Print Studio</span>
                  <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    A4 LANDSCAPE
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {reportTitle} ({reportId}) • {filteredData.length} records in active scope
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => window.print()}
                data-testid="smriti-report-print-btn"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition cursor-pointer"
              >
                <Printer size={15} />
                <span>Print Ledger (F9 / Ctrl+P)</span>
              </button>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                title="Close Preview (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Viewport Canvas */}
          <div className="smriti-report-canvas-wrapper flex-1 overflow-y-auto p-8 bg-slate-100/90 dark:bg-slate-950 flex justify-center print:p-0 print:m-0 print:block print:bg-white print:overflow-visible">
            <div className="smriti-report-printable-sheet bg-white text-slate-900 p-8 max-w-[1100px] w-full min-h-[750px] text-[10px] font-sans leading-relaxed shadow-xl rounded border border-slate-200 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-lg font-black uppercase tracking-tight text-slate-950">
                      {tenantContext.companyName || "SMRITI ENTERPRISES LTD"}
                    </h1>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {tenantContext.companyAddress || "101, Corporate Hub, Nariman Point, Mumbai - 400021"}
                    </p>
                    <div className="flex items-center space-x-3 mt-1 text-[9.5px] text-slate-700 font-mono">
                      <span>GSTIN: <strong>{tenantContext.companyGstin || "27AABCS1429B1Z8"}</strong></span>
                      <span>•</span>
                      <span>Branch: <strong>Main Corporate Central</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-block bg-slate-900 text-white font-bold px-3 py-1 rounded text-xs tracking-wider uppercase">
                      {reportTitle}
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 font-mono">
                      Report ID: {reportId} • {reportCategory}
                    </p>
                  </div>
                </div>
              </div>

              {/* Filter Parameters Ribbon */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded p-2.5 mb-4 text-[9.5px]">
                <div>
                  <span className="text-slate-400 block font-medium">Reporting Period</span>
                  <strong className="text-slate-800 font-mono">{startDate} to {endDate}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Location Scope</span>
                  <strong className="text-slate-800">{selectedStore}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Status Scope</span>
                  <strong className="text-slate-800">{selectedStatus}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Generated Timestamp</span>
                  <strong className="text-slate-800 font-mono">
                    {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                </div>
              </div>

              {/* KPI Summary Strip */}
              {kpis && (
                <div className="flex gap-4 mb-4 text-[10px]">
                  {Object.entries(kpis)
                    .filter(([_, v]) => v !== null && v !== undefined)
                    .map(([label, value]) => (
                      <div key={label} className="flex-1 bg-slate-50 border border-slate-200 rounded p-2">
                        <span className="text-slate-500 text-[9px] block">{label}</span>
                        <span className="font-bold font-mono text-slate-900 text-xs">{String(value)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Table Grid */}
              <table className="w-full border-collapse border border-slate-300 mb-4 text-[9.5px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="border border-slate-300 p-1.5 text-center w-8">#</th>
                    {activeColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`border border-slate-300 p-1.5 ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={activeColumns.length + 1} className="border border-slate-300 p-6 text-center text-slate-400 italic">
                        No records found matching the active reporting criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                        <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        {activeColumns.map((col) => {
                          const val = row[col.key];
                          let formattedVal: any = val;
                          if (val === null || val === undefined) formattedVal = "-";
                          else if (col.datatype === "currency" && typeof val === "number") formattedVal = formatCurrency(val);
                          else if (col.datatype === "number" && typeof val === "number") formattedVal = formatNumber(val);
                          else if (col.datatype === "date" && typeof val === "string") formattedVal = formatDate(val);
                          else if (typeof val === "boolean") formattedVal = val ? "YES" : "NO";
                          else if (typeof val === "object") formattedVal = JSON.stringify(val);

                          return (
                            <td
                              key={col.key}
                              className={`border border-slate-300 p-1.5 ${
                                col.align === "right" ? "text-right font-mono font-medium" : col.align === "center" ? "text-center font-mono" : "text-left"
                              }`}
                            >
                              {String(formattedVal)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {showGrandTotal && filteredData.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
                      <td className="border border-slate-300 p-2 text-center font-mono font-black">TOTAL</td>
                      {activeColumns.map((col, cIdx) => (
                        <td
                          key={col.key}
                          className={`border border-slate-300 p-2 font-mono ${
                            col.align === "right" ? "text-right font-black" : "text-left"
                          }`}
                        >
                          {calculateSummaryCell(filteredData, col, cIdx === 0, "GRAND TOTAL")}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* Signatory & Audit Block */}
              <div className="border border-slate-300 rounded p-3 text-[9px] flex justify-between items-end mt-4">
                <div className="text-center w-48 border-t border-slate-400 pt-1">
                  <div className="font-bold text-slate-800">Generated & Prepared By</div>
                  <div className="h-8"></div>
                  <div className="text-slate-500">{activeRole}</div>
                </div>
                <div className="text-center w-48 border-t border-slate-400 pt-1">
                  <div className="font-bold text-slate-800">Branch Accountant / Auditor</div>
                  <div className="h-8"></div>
                  <div className="text-slate-500">Internal Audit Verification</div>
                </div>
                <div className="text-center w-48 border-t border-slate-400 pt-1">
                  <div className="font-bold text-slate-800">For {tenantContext.companyName || "SMRITI ENTERPRISES LTD"}</div>
                  <div className="h-8"></div>
                  <div className="text-slate-500">Authorized Financial Signatory</div>
                </div>
              </div>

              <div className="text-center text-[8px] text-slate-400 mt-4">
                Official Business Intelligence & Ledger Record • Generated by SMRITI Report Engine • Confidential • Page 1 of Official Register
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  );
};
