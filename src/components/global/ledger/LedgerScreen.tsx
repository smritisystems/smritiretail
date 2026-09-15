/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.55.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Search, RefreshCw, Download, Filter, 
  Calendar, Layers, FileSpreadsheet, Loader2, 
  ChevronLeft, ChevronRight, AlertCircle, Database, ExternalLink,
  ArrowUpDown, ArrowUp, ArrowDown, Check, SlidersHorizontal, Sparkles, X, Tag,
  RotateCcw, TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, Scale, DollarSign
} from "lucide-react";
import { LedgerConfig, LedgerColumn } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { formatCurrency } from "../../../utils/formatters.ts";
import { useWorkspace } from "../../../contexts/WorkspaceContext.tsx";
import { ExportButton } from "../../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../../export/types.ts";

export interface LedgerScreenProps<T = any> {
  config: LedgerConfig<T>;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
}

export function LedgerScreen<T extends Record<string, any>>({
  config,
  onNotification,
}: LedgerScreenProps<T>) {
  const { popOutExternalWindow } = useWorkspace();
  const [items, setItems] = useState<T[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState<number | null>(null);
  const [serverTotals, setServerTotals] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (config.entityName === "Stock Movement" && typeof sessionStorage !== "undefined") {
      const pendingSearch = sessionStorage.getItem("smriti_stock_ledger_search") || "";
      sessionStorage.removeItem("smriti_stock_ledger_search");
      return pendingSearch;
    }
    return "";
  });

  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    config.filters?.forEach((f) => {
      initial[f.key] = f.defaultValue || "ALL";
    });
    return initial;
  });

  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Sorting State
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  // Column / Attribute Visibility State
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() =>
    config.columns.map((c) => c.key)
  );
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // In-Header Column Filter Popover State
  const [openFilterColumnKey, setOpenFilterColumnKey] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState<string>("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const headerFilterPopoverRef = useRef<HTMLDivElement>(null);

  // Header Filters Summary Popover State
  const [isGlobalFilterSummaryOpen, setIsGlobalFilterSummaryOpen] = useState(false);
  const globalFilterSummaryRef = useRef<HTMLDivElement>(null);

  // Autocomplete Suggestions State
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Handle outside clicks for dropdowns & popovers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setColumnPickerOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (headerFilterPopoverRef.current && !headerFilterPopoverRef.current.contains(event.target as Node)) {
        setOpenFilterColumnKey(null);
      }
      if (globalFilterSummaryRef.current && !globalFilterSummaryRef.current.contains(event.target as Node)) {
        setIsGlobalFilterSummaryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Ledger data with server-side query execution
  const fetchData = useCallback(
    async (overrideParams?: { startDate?: string; endDate?: string; search?: string; movementType?: string; page?: number; preservePage?: boolean }) => {
      setLoading(true);
      try {
        const start = overrideParams?.startDate !== undefined ? overrideParams.startDate : dateRange.startDate;
        const end = overrideParams?.endDate !== undefined ? overrideParams.endDate : dateRange.endDate;
        const term = overrideParams?.search !== undefined ? overrideParams.search : searchQuery;
        const mvType = overrideParams?.movementType !== undefined ? overrideParams.movementType : activeFilters["movement_type"];
        const requestedPage = overrideParams?.page ?? (overrideParams?.preservePage ? page : 1);

        const params = new URLSearchParams();
        if (start) {
          params.append("from_date", start);
          params.append("start_date", start);
        }
        if (end) {
          params.append("to_date", end);
          params.append("end_date", end);
        }
        if (term && term.trim()) {
          params.append("search", term.trim());
        }
        if (mvType && mvType !== "ALL") {
          params.append("movement_type", mvType);
        }
        params.append("skip", String((requestedPage - 1) * pageSize));
        params.append("limit", String(pageSize));

        const queryString = params.toString();
        const endpoint = queryString
          ? `${config.apiEndpoint}${config.apiEndpoint.includes("?") ? "&" : "?"}${queryString}`
          : config.apiEndpoint;

        const data = await apiFetchV1(endpoint);
        let list: T[] = [];
        if (config.responseTransform) {
          list = config.responseTransform(data);
        } else if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === "object") {
          list = data.items || data.logs || data.records || [];
        }
        setItems(Array.isArray(list) ? list : []);
        setServerTotalCount(data && typeof data === "object" && !Array.isArray(data) ? Number(data.total ?? 0) : null);
        setServerTotals(data && typeof data === "object" && !Array.isArray(data) && data.totals
          ? Object.fromEntries(Object.entries(data.totals).map(([key, value]) => [key, Number(value) || 0]))
          : null);
        setPage(requestedPage);
      } catch (err: any) {
        console.error(`Failed to load ${config.title}:`, err);
        if (onNotification) {
          onNotification("Network Error", err.message || `Failed to fetch ${config.entityName}`, "error");
        }
      } finally {
        setLoading(false);
      }
    },
    [config, onNotification, dateRange.startDate, dateRange.endDate, searchQuery, activeFilters, page]
  );

  useEffect(() => {
    fetchData();
  }, [config.apiEndpoint]);

  // Derived unique attribute lists for dynamic filtering
  const dynamicAttributeOptions = useMemo(() => {
    const brands = new Set<string>();
    const colors = new Set<string>();
    const sizes = new Set<string>();

    items.forEach((item) => {
      if (item.brand && item.brand !== "—" && item.brand !== "-") brands.add(item.brand);
      if (item.color && item.color !== "—" && item.color !== "-") colors.add(item.color);
      if (item.size && item.size !== "—" && item.size !== "-") sizes.add(item.size);
    });

    return {
      brands: Array.from(brands).sort(),
      colors: Array.from(colors).sort(),
      sizes: Array.from(sizes).sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      }),
    };
  }, [items]);

  // Helper to compute unique values with counts for any column
  const getUniqueValuesForColumn = useCallback(
    (colKey: string) => {
      const counts: Record<string, number> = {};
      items.forEach((item) => {
        const raw = item[colKey];
        const valStr = raw !== undefined && raw !== null && String(raw).trim() !== "" ? String(raw) : "—";
        counts[valStr] = (counts[valStr] || 0) + 1;
      });

      const uniqueList = Object.keys(counts).map((val) => ({
        value: val,
        count: counts[val],
      }));

      return uniqueList.sort((a, b) => {
        const numA = parseFloat(a.value);
        const numB = parseFloat(b.value);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.value.localeCompare(b.value);
      });
    },
    [items]
  );

  // Smart suggestions derived from current query and items
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const suggestions: { label: string; field: string; type: string }[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      if (suggestions.length >= 10) break;

      const candidates = [
        { val: item.barcode, type: "Barcode", field: "barcode" },
        { val: item.sku, type: "SKU", field: "sku" },
        { val: item.style_code, type: "Style", field: "style_code" },
        { val: item.product_name, type: "Product", field: "product_name" },
        { val: item.brand, type: "Brand", field: "brand" },
        { val: item.color, type: "Color", field: "color" },
        { val: item.size, type: "Size", field: "size" },
        { val: item.movement_type, type: "Transaction", field: "movement_type" },
        { val: item.reference_doc_no, type: "Ref Doc", field: "reference_doc_no" },
        { val: item.reference_doc_id, type: "Ref Doc ID", field: "reference_doc_id" },
        { val: item.date || (item.created_at ? String(item.created_at).split("T")[0] : undefined), type: "Date", field: "date" },
      ];

      for (const c of candidates) {
        if (c.val && typeof c.val === "string" && c.val !== "—" && c.val.toLowerCase().includes(q)) {
          const key = `${c.type}:${c.val}`;
          if (!seen.has(key)) {
            seen.add(key);
            suggestions.push({ label: c.val, type: c.type, field: c.field });
            if (suggestions.length >= 10) break;
          }
        }
      }
    }
    return suggestions;
  }, [items, searchQuery]);

  // Date Range Quick Preset Helper with auto-fetch
  const setDatePreset = (preset: "today" | "yesterday" | "this_month" | "last_30" | "clear") => {
    const now = new Date();
    if (preset === "clear") {
      setDateRange({ startDate: "", endDate: "" });
      fetchData({ startDate: "", endDate: "" });
      return;
    }
    if (preset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setDateRange({ startDate: todayStr, endDate: todayStr });
      fetchData({ startDate: todayStr, endDate: todayStr });
      return;
    }
    if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setDateRange({ startDate: yStr, endDate: yStr });
      fetchData({ startDate: yStr, endDate: yStr });
      return;
    }
    if (preset === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = startOfMonth.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      setDateRange({ startDate: startStr, endDate: todayStr });
      fetchData({ startDate: startStr, endDate: todayStr });
      return;
    }
    if (preset === "last_30") {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      const pastStr = past.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      setDateRange({ startDate: pastStr, endDate: todayStr });
      fetchData({ startDate: pastStr, endDate: todayStr });
      return;
    }
  };

  // Sorting Handler
  const handleSort = (columnKey: string) => {
    if (sortField === columnKey) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(columnKey);
      setSortDirection("asc");
    }
  };

  // Toggle Column Visibility
  const toggleColumnVisibility = (key: string) => {
    setVisibleColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllColumns = () => {
    setVisibleColumnKeys(config.columns.map((c) => c.key));
  };

  const deselectAllColumns = () => {
    // Keep at least SKU and Product Name
    setVisibleColumnKeys(["sku", "product_name"]);
  };

  // Column Filter Actions
  const toggleColumnFilterValue = (colKey: string, val: string) => {
    setColumnFilters((prev) => {
      const current = prev[colKey] || [];
      const updated = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];

      if (updated.length === 0) {
        const next = { ...prev };
        delete next[colKey];
        return next;
      }
      return { ...prev, [colKey]: updated };
    });
    setPage(1);
  };

  const clearColumnFilter = (colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setActiveFilters(() => {
      const initial: Record<string, string> = {};
      config.filters?.forEach((f) => {
        initial[f.key] = f.defaultValue || "ALL";
      });
      return initial;
    });
    setDateRange({ startDate: "", endDate: "" });
    setSearchQuery("");
    setSortField(null);
    setSortDirection(null);
    fetchData({ startDate: "", endDate: "", search: "", movementType: "ALL" });
  };

  const activeHeaderFilterCount = Object.keys(columnFilters).length;
  const hasAnyFilterActive =
    activeHeaderFilterCount > 0 ||
    Boolean(searchQuery) ||
    Boolean(dateRange.startDate || dateRange.endDate) ||
    Object.values(activeFilters).some((v) => v !== "ALL" && v !== "");

  // Client-side filtering & sorting
  const filteredAndSortedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      // A. Text Search across fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchFields = config.searchFields || Object.keys(item);
        const matches = searchFields.some((field) => {
          const val = item[field as keyof T];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        });
        if (!matches) return false;
      }

      // B. Select Filters from Toolbar
      for (const [key, val] of Object.entries(activeFilters)) {
        if (val !== "ALL" && val !== "") {
          const itemVal = item[key];
          if (String(itemVal || "").toLowerCase() !== String(val).toLowerCase()) {
            return false;
          }
        }
      }

      // C. In-Header Column Filters
      for (const [colKey, allowedVals] of Object.entries(columnFilters)) {
        if (allowedVals && allowedVals.length > 0) {
          const raw = item[colKey];
          const valStr = raw !== undefined && raw !== null && String(raw).trim() !== "" ? String(raw) : "—";
          if (!allowedVals.includes(valStr)) {
            return false;
          }
        }
      }

      // D. Date Range Filter
      if (dateRange.startDate) {
        const itemDate = item.created_at || item.timestamp || item.date;
        if (itemDate && new Date(itemDate) < new Date(dateRange.startDate)) {
          return false;
        }
      }
      if (dateRange.endDate) {
        const itemDate = item.created_at || item.timestamp || item.date;
        if (itemDate && new Date(itemDate) > new Date(dateRange.endDate + "T23:59:59")) {
          return false;
        }
      }

      return true;
    });

    // 2. Sort
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined || valA === "—") return 1;
        if (valB === null || valB === undefined || valB === "—") return -1;

        const numA = typeof valA === "number" ? valA : parseFloat(String(valA));
        const numB = typeof valB === "number" ? valB : parseFloat(String(valB));

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === "asc" ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDirection === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return filtered;
  }, [items, searchQuery, activeFilters, columnFilters, dateRange, config.searchFields, sortField, sortDirection]);

  const visibleColumns = useMemo(() => {
    return config.columns.filter((col) => visibleColumnKeys.includes(col.key));
  }, [config.columns, visibleColumnKeys]);

  const totalPages = Math.ceil((serverTotalCount ?? filteredAndSortedItems.length) / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedItems.slice(start, start + pageSize);
  }, [filteredAndSortedItems, page, pageSize]);

  // Totals & Sub-Totals Calculation Engine
  const calculateTotals = useCallback((rows: T[]) => {
    const sums: Record<string, number> = {};
    rows.forEach((row) => {
      Object.keys(row).forEach((k) => {
        const raw = row[k];
        const num = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (!isNaN(num)) {
          sums[k] = (sums[k] || 0) + num;
        }
      });
    });
    return sums;
  }, []);

  const pageSubTotals = useMemo(() => calculateTotals(paginatedItems), [paginatedItems, calculateTotals]);
  const grandTotals = useMemo(
    () => serverTotals && Object.keys(columnFilters).length === 0
      ? {
          ...serverTotals,
          in_qty: serverTotals.total_in_qty || 0,
          out_qty: serverTotals.total_out_qty || 0,
          total_value: serverTotals.total_movement_value || 0,
          in_value: serverTotals.total_in_value || 0,
          out_value: serverTotals.total_out_value || 0,
        }
      : calculateTotals(filteredAndSortedItems),
    [serverTotals, columnFilters, filteredAndSortedItems, calculateTotals]
  );

  // Executive KPI Summary Metrics
  const kpiMetrics = useMemo(() => {
    let totalInQty = 0;
    let totalOutQty = 0;
    let totalInVal = 0;
    let totalOutVal = 0;
    let totalMovementVal = 0;

    if (serverTotals && Object.keys(columnFilters).length === 0) {
      return {
        totalInQty: serverTotals.total_in_qty || 0,
        totalOutQty: serverTotals.total_out_qty || 0,
        totalInVal: serverTotals.total_in_value || 0,
        totalOutVal: serverTotals.total_out_value || 0,
        totalMovementVal: serverTotals.total_movement_value || 0,
        totalMovedQty: serverTotals.total_moved_qty || 0,
        netQty: serverTotals.net_qty || 0,
      };
    }

    filteredAndSortedItems.forEach((item: any) => {
      const inQ = parseFloat(item.in_qty) || 0;
      const outQ = parseFloat(item.out_qty) || 0;
      const inV = parseFloat(item.in_value) || 0;
      const outV = parseFloat(item.out_value) || 0;
      const totV = parseFloat(item.total_value) || 0;

      totalInQty += inQ;
      totalOutQty += outQ;
      totalInVal += inV;
      totalOutVal += outV;
      totalMovementVal += totV;
    });

    return {
      totalInQty,
      totalOutQty,
      totalInVal,
      totalOutVal,
      totalMovementVal,
      totalMovedQty: totalInQty + totalOutQty,
      netQty: totalInQty - totalOutQty,
    };
  }, [filteredAndSortedItems, serverTotals, columnFilters]);

  const ledgerExportColumns = useMemo<ExportColumnDefinition[]>(() => {
    return visibleColumns.map((c) => {
      const lower = c.key.toLowerCase();
      let dt: any = "text";
      if (lower.includes("amount") || lower.includes("balance") || lower.includes("rate") || lower.includes("price") || lower.includes("total") || lower.includes("val")) {
        dt = "currency";
      } else if (lower.includes("date") || lower.includes("time") || lower.includes("timestamp")) {
        dt = "datetime";
      } else if (lower.includes("qty") || lower.includes("quantity") || lower.includes("count") || lower.includes("stock")) {
        dt = "number";
      } else if (lower.includes("percentage") || lower.includes("tax_rate") || lower.includes("taxrate")) {
        dt = "percentage";
      }
      return {
        key: c.key,
        label: c.label,
        align: c.align,
        datatype: dt,
        isSummary: dt === "currency" || dt === "number",
        isVisible: true,
      };
    });
  }, [visibleColumns]);

  return (
    <div className="flex-1 bg-theme-surface-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
      {/* Header Banner */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            {config.icon}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-theme-primary font-display">{config.title}</h1>
            <p className="text-xs text-theme-muted mt-0.5">{config.subtitle}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto font-mono text-xs">
          {/* Header Filters Summary / Clear Button */}
          <div className="relative" ref={globalFilterSummaryRef}>
            <button
              type="button"
              onClick={() => setIsGlobalFilterSummaryOpen(!isGlobalFilterSummaryOpen)}
              className={`px-3 py-2 border rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                hasAnyFilterActive
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold"
                  : "bg-theme-surface-3 hover:bg-theme-surface-hover border-theme-divider text-theme-primary"
              }`}
            >
              <Filter size={13} className={hasAnyFilterActive ? "text-amber-400 fill-amber-400/20" : "text-blue-400"} />
              <span>Filters</span>
              {activeHeaderFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                  {activeHeaderFilterCount}
                </span>
              )}
            </button>

            {isGlobalFilterSummaryOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-theme-surface-2 border border-theme-divider rounded-xl shadow-2xl p-3 z-50 space-y-3 font-sans">
                <div className="flex items-center justify-between pb-2 border-b border-theme-divider">
                  <span className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                    <Filter size={13} className="text-amber-400" />
                    <span>Active Header Filters</span>
                  </span>
                  {hasAnyFilterActive && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[11px] text-rose-400 hover:underline font-mono cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={10} />
                      <span>Reset All</span>
                    </button>
                  )}
                </div>

                {activeHeaderFilterCount === 0 && !searchQuery && !dateRange.startDate ? (
                  <div className="text-xs text-theme-muted py-2 text-center">No active column filters. Click any column header to filter.</div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto text-xs font-mono">
                    {searchQuery && (
                      <div className="p-2 rounded bg-theme-surface-3 border border-theme-divider flex items-center justify-between">
                        <div>
                          <span className="text-theme-muted text-[10px] block">Keyword Search</span>
                          <span className="text-blue-400 font-semibold">"{searchQuery}"</span>
                        </div>
                        <button type="button" onClick={() => setSearchQuery("")} className="text-theme-muted hover:text-rose-400">
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {(dateRange.startDate || dateRange.endDate) && (
                      <div className="p-2 rounded bg-theme-surface-3 border border-theme-divider flex items-center justify-between">
                        <div>
                          <span className="text-theme-muted text-[10px] block">Date Range</span>
                          <span className="text-emerald-400 font-semibold">{dateRange.startDate || "Start"} to {dateRange.endDate || "End"}</span>
                        </div>
                        <button type="button" onClick={() => setDatePreset("clear")} className="text-theme-muted hover:text-rose-400">
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {Object.entries(columnFilters).map(([colKey, vals]) => {
                      const colDef = config.columns.find((c) => c.key === colKey);
                      return (
                        <div key={colKey} className="p-2 rounded bg-theme-surface-3 border border-theme-divider flex items-center justify-between">
                          <div>
                            <span className="text-theme-muted text-[10px] block">{colDef?.label || colKey}</span>
                            <span className="text-amber-400 font-semibold">{vals.join(", ")}</span>
                          </div>
                          <button type="button" onClick={() => clearColumnFilter(colKey)} className="text-theme-muted hover:text-rose-400">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attributes / Columns Customizer */}
          <div className="relative" ref={columnPickerRef}>
            <button
              type="button"
              onClick={() => setColumnPickerOpen(!columnPickerOpen)}
              className="px-3 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal size={13} className="text-indigo-400" />
              <span>Attributes ({visibleColumnKeys.length}/{config.columns.length})</span>
            </button>

            {columnPickerOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-theme-surface-2 border border-theme-divider rounded-xl shadow-2xl p-3 z-50 space-y-2.5 font-sans">
                <div className="flex items-center justify-between pb-2 border-b border-theme-divider">
                  <span className="text-xs font-bold text-theme-primary">Visible Attributes</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={selectAllColumns}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <span className="text-theme-muted">|</span>
                    <button
                      type="button"
                      onClick={deselectAllColumns}
                      className="text-rose-400 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                  {config.columns.map((col) => {
                    const isChecked = visibleColumnKeys.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-theme-surface-3 cursor-pointer select-none transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumnVisibility(col.key)}
                          className="rounded border-theme-divider text-blue-500 focus:ring-0"
                        />
                        <span className={`text-xs ${isChecked ? "text-theme-primary font-medium" : "text-theme-muted"}`}>
                          {col.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="px-3 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <ExportButton
            moduleTitle={config.title}
            columns={ledgerExportColumns}
            data={filteredAndSortedItems}
            totalRecordsCount={items.length}
            filteredRecordsCount={filteredAndSortedItems.length}
            apiEndpoint={config.apiEndpoint}
            searchTerm={searchQuery}
            appliedFilters={activeFilters}
            dateRange={dateRange.startDate ? { start: dateRange.startDate, end: dateRange.endDate } : undefined}
            onNotification={(title, msg, type) => onNotification?.(title, msg, (type === "error" ? "error" : "success"))}
          />

          {/* Popout External Window Button */}
          <button
            type="button"
            onClick={() => popOutExternalWindow(config.entityName.toLowerCase().replace(/\s+/g, "-"), config.title)}
            title="Pop Out into Standalone Window"
            className="p-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-primary rounded-xl transition-colors cursor-pointer"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px]">
            <span className="flex items-center gap-1">
              <ArrowDownLeft size={13} className="text-emerald-400" />
              <span>Total Inward</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
              +{kpiMetrics.totalInQty} Units
            </span>
          </div>
          <div className="text-base md:text-lg font-bold text-emerald-400 mt-1">
            {formatCurrency(kpiMetrics.totalInVal)}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px]">
            <span className="flex items-center gap-1">
              <ArrowUpRight size={13} className="text-rose-400" />
              <span>Total Outward</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold text-[10px]">
              -{kpiMetrics.totalOutQty} Units
            </span>
          </div>
          <div className="text-base md:text-lg font-bold text-rose-400 mt-1">
            {formatCurrency(kpiMetrics.totalOutVal)}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px]">
            <span className="flex items-center gap-1">
              <Scale size={13} className="text-cyan-400" />
              <span>Net Movement</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold text-[10px]">
              {kpiMetrics.netQty >= 0 ? `+${kpiMetrics.netQty}` : kpiMetrics.netQty} Units
            </span>
          </div>
          <div className={`text-base md:text-lg font-bold mt-1 ${kpiMetrics.netQty >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
            {formatCurrency(kpiMetrics.totalInVal - kpiMetrics.totalOutVal)}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px]">
            <span className="flex items-center gap-1">
              <Layers size={13} className="text-blue-400" />
              <span>Total Moved Stock</span>
            </span>
            <span className="text-[10px] text-blue-300 font-bold">
              In {kpiMetrics.totalInQty} / Out {kpiMetrics.totalOutQty}
            </span>
          </div>
          <div className="text-base md:text-lg font-bold text-blue-400 mt-1">
            {kpiMetrics.totalMovedQty} Units
          </div>
          <div className="text-[10px] text-theme-muted mt-1">
            Inward + outward movements
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px]">
            <span className="flex items-center gap-1">
              <DollarSign size={13} className="text-amber-400" />
              <span>Movement Valuation</span>
            </span>
            <span className="text-[10px] text-theme-muted">
              {filteredAndSortedItems.length} Entries
            </span>
          </div>
          <div className="text-base md:text-lg font-bold text-amber-400 mt-1">
            {formatCurrency(kpiMetrics.totalMovementVal)}
          </div>
        </div>
      </div>

      {filteredAndSortedItems.length > 0 && kpiMetrics.totalInQty === 0 && kpiMetrics.totalOutQty > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-3 text-xs text-amber-200">
          <strong>Outward-only view:</strong> this result contains outgoing movements but no inward or opening-stock movement.
          Closing balances can appear negative until opening stock is recorded or the date range includes the inward movement.
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input with Autocomplete Suggestions */}
          <div className="relative flex-1" ref={searchContainerRef}>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchData();
              }}
              placeholder={config.searchPlaceholder || `Search ${config.entityName.toLowerCase()}...`}
              className="w-full bg-theme-surface-1 border border-theme-divider focus:border-blue-500 rounded-lg pl-9 pr-8 py-1.5 text-xs text-theme-primary placeholder:text-theme-muted focus:outline-hidden font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchData({ search: "" });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}

            {/* Live Autocomplete Suggestions Overlay */}
            {isSearchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-theme-surface-2 border border-theme-divider rounded-xl shadow-2xl overflow-hidden z-50 font-mono text-xs">
                <div className="px-3 py-1.5 bg-theme-surface-3/80 text-[10px] text-theme-muted flex items-center gap-1.5 border-b border-theme-divider">
                  <Sparkles size={11} className="text-amber-400" />
                  <span>Smart Attribute Suggestions</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-theme-divider/40">
                  {searchSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchQuery(sug.label);
                        setIsSearchFocused(false);
                        fetchData({ search: sug.label });
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-theme-surface-hover flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="text-theme-primary font-medium">{sug.label}</span>
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800 uppercase font-bold">
                        {sug.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Configured Filters (Movement Type) */}
          {config.filters?.map((filter) => (
            <div key={filter.key} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-theme-muted font-mono">{filter.label}:</span>
              <select
                value={activeFilters[filter.key] || "ALL"}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveFilters((p) => ({ ...p, [filter.key]: val }));
                  if (filter.key === "movement_type") {
                    fetchData({ movementType: val });
                  }
                }}
                className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Dynamic Brand Filter */}
          {dynamicAttributeOptions.brands.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-theme-muted font-mono">Brand:</span>
              <select
                value={activeFilters["brand"] || "ALL"}
                onChange={(e) => {
                  setActiveFilters((p) => ({ ...p, brand: e.target.value }));
                  setPage(1);
                }}
                className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
              >
                <option value="ALL">All Brands ({dynamicAttributeOptions.brands.length})</option>
                {dynamicAttributeOptions.brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Color Filter */}
          {dynamicAttributeOptions.colors.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-theme-muted font-mono">Color:</span>
              <select
                value={activeFilters["color"] || "ALL"}
                onChange={(e) => {
                  setActiveFilters((p) => ({ ...p, color: e.target.value }));
                  setPage(1);
                }}
                className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
              >
                <option value="ALL">All Colors ({dynamicAttributeOptions.colors.length})</option>
                {dynamicAttributeOptions.colors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Size Filter */}
          {dynamicAttributeOptions.sizes.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-theme-muted font-mono">Size:</span>
              <select
                value={activeFilters["size"] || "ALL"}
                onChange={(e) => {
                  setActiveFilters((p) => ({ ...p, size: e.target.value }));
                  setPage(1);
                }}
                className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
              >
                <option value="ALL">All Sizes ({dynamicAttributeOptions.sizes.length})</option>
                {dynamicAttributeOptions.sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Filter with Presets & Fetch Button */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-theme-surface-1 border border-theme-divider rounded-lg p-0.5 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setDatePreset("today")}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  dateRange.startDate === new Date().toISOString().split("T")[0] &&
                  dateRange.endDate === new Date().toISOString().split("T")[0]
                    ? "bg-blue-600 text-white font-bold"
                    : "text-theme-muted hover:text-theme-primary"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("yesterday")}
                className="px-2 py-1 rounded text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
              >
                Yday
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("this_month")}
                className="px-2 py-1 rounded text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("last_30")}
                className="px-2 py-1 rounded text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
              >
                30D
              </button>
              {(dateRange.startDate || dateRange.endDate) && (
                <button
                  type="button"
                  onClick={() => setDatePreset("clear")}
                  className="px-1.5 py-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Clear Date Filter"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => {
                  setDateRange((p) => ({ ...p, startDate: e.target.value }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchData();
                }}
                className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
              />
              <span className="text-theme-muted text-xs">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => {
                  setDateRange((p) => ({ ...p, endDate: e.target.value }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchData();
                }}
                className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={loading}
                title="Fetch / Submit Date Query"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                <span>Fetch</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Count Bar */}
        <div className="flex items-center justify-between text-[11px] text-theme-muted font-mono pt-2 border-t border-theme-divider/40">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-theme-primary">{serverTotalCount ?? filteredAndSortedItems.length}</strong> matching entries (Loaded: {items.length})
            </span>
            {sortField && (
              <span className="text-indigo-400">
                ? Sorted by <strong>{sortField}</strong> ({sortDirection?.toUpperCase()})
              </span>
            )}
            {hasAnyFilterActive && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-rose-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
              >
                <RotateCcw size={10} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
          {filteredAndSortedItems.length > 0 && (
            <div>
              Page {page} of {totalPages}
            </div>
          )}
        </div>
      </div>

      {/* Dense Ledger Table with Sub-Totals & Grand Totals */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-theme-surface-3/60 text-theme-muted font-mono border-b border-theme-divider uppercase text-[10px] tracking-wider select-none">
              <tr>
                {visibleColumns.map((col) => {
                  const isSorted = sortField === col.key;
                  const activeFilterVals = columnFilters[col.key] || [];
                  const isFilterActive = activeFilterVals.length > 0;
                  const isDropdownOpen = openFilterColumnKey === col.key;

                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className={`relative px-3 py-2.5 group transition-colors ${
                        isSorted || isFilterActive ? "text-blue-400 bg-theme-surface-hover/80" : ""
                      }`}
                    >
                      <div className={`flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-between"}`}>
                        {/* Sort Title Click Area */}
                        <div
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 cursor-pointer hover:text-theme-primary truncate"
                          title={`Sort by ${col.label}`}
                        >
                          <span className="truncate">{col.label}</span>
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ArrowUp size={11} className="text-blue-400 shrink-0" />
                            ) : (
                              <ArrowDown size={11} className="text-blue-400 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown size={10} className="text-theme-muted/40 group-hover:text-theme-muted shrink-0" />
                          )}
                        </div>

                        {/* Column Filter Popover Trigger */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFilterColumnKey(isDropdownOpen ? null : col.key);
                            setColumnFilterSearch("");
                          }}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isFilterActive
                              ? "bg-amber-500/20 text-amber-400"
                              : "text-theme-muted/40 hover:text-theme-primary group-hover:text-theme-muted"
                          }`}
                          title={`Filter by ${col.label}`}
                        >
                          <Filter size={10} className={isFilterActive ? "fill-amber-400/30" : ""} />
                        </button>
                      </div>

                      {/* Anchored Header Column Filter Popover */}
                      {isDropdownOpen && (
                        <div
                          ref={headerFilterPopoverRef}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-1 w-64 bg-theme-surface-2 border border-theme-divider rounded-xl shadow-2xl p-3 z-50 normal-case tracking-normal font-sans text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150 text-theme-primary"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-theme-divider">
                            <span className="font-bold flex items-center gap-1 text-[11px]">
                              <Filter size={11} className="text-amber-400" />
                              <span>Filter: {col.label}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenFilterColumnKey(null)}
                              className="text-theme-muted hover:text-theme-primary p-0.5 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          {/* Quick Sorting in Popover */}
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                            <button
                              type="button"
                              onClick={() => {
                                setSortField(col.key);
                                setSortDirection("asc");
                              }}
                              className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                                isSorted && sortDirection === "asc"
                                  ? "bg-blue-600 text-white border-blue-600 font-bold"
                                  : "bg-theme-surface-3 border-theme-divider text-theme-body hover:bg-theme-surface-hover"
                              }`}
                            >
                              <ArrowUp size={11} />
                              <span>Sort A → Z</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSortField(col.key);
                                setSortDirection("desc");
                              }}
                              className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                                isSorted && sortDirection === "desc"
                                  ? "bg-blue-600 text-white border-blue-600 font-bold"
                                  : "bg-theme-surface-3 border-theme-divider text-theme-body hover:bg-theme-surface-hover"
                              }`}
                            >
                              <ArrowDown size={11} />
                              <span>Sort Z → A</span>
                            </button>
                          </div>

                          {/* Search values in this column */}
                          <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
                            <input
                              type="text"
                              value={columnFilterSearch}
                              onChange={(e) => setColumnFilterSearch(e.target.value)}
                              placeholder={`Search values...`}
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-theme-primary placeholder:text-theme-muted font-mono focus:outline-hidden focus:border-blue-500"
                            />
                          </div>

                          {/* Distinct Column Values List */}
                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                            {(() => {
                              const allVals = getUniqueValuesForColumn(col.key);
                              const filteredVals = columnFilterSearch
                                ? allVals.filter((v) => v.value.toLowerCase().includes(columnFilterSearch.toLowerCase()))
                                : allVals;

                              if (filteredVals.length === 0) {
                                return <div className="text-theme-muted text-[10px] py-2 text-center">No values found.</div>;
                              }

                              return filteredVals.map(({ value, count }) => {
                                const isChecked = activeFilterVals.includes(value);
                                return (
                                  <label
                                    key={value}
                                    className="flex items-center justify-between px-2 py-1 rounded hover:bg-theme-surface-3 cursor-pointer select-none transition-colors"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleColumnFilterValue(col.key, value)}
                                        className="rounded border-theme-divider text-blue-500 focus:ring-0"
                                      />
                                      <span className={`truncate ${isChecked ? "text-theme-primary font-bold text-amber-400" : "text-theme-body"}`}>
                                        {value}
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-theme-muted font-mono ml-2 shrink-0">({count})</span>
                                  </label>
                                );
                              });
                            })()}
                          </div>

                          {/* Filter Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-theme-divider text-[10px] font-mono">
                            <button
                              type="button"
                              onClick={() => clearColumnFilter(col.key)}
                              disabled={!isFilterActive}
                              className="text-rose-400 hover:underline disabled:opacity-40 cursor-pointer"
                            >
                              Clear Filter
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenFilterColumnKey(null)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors cursor-pointer"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider font-mono">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-theme-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-blue-400" />
                      <span>Loading ledger audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-theme-muted">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((record, index) => (
                  <tr key={record[config.idKey || "id"] || index} className="hover:bg-theme-surface-hover/50 transition-colors">
                    {visibleColumns.map((col) => {
                      const val = record[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`px-3.5 py-2.5 ${
                            col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                          }`}
                        >
                          {col.render ? col.render(val, record, index) : val !== undefined && val !== null ? String(val) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>

            {/* Sub-Totals & Grand Totals Table Footer */}
            {filteredAndSortedItems.length > 0 && (
              <tfoot className="bg-theme-surface-3/80 font-mono border-t-2 border-theme-divider text-xs divide-y divide-theme-divider/50">
                {/* 1. Page Sub-Total Row */}
                <tr className="bg-theme-surface-3/40 font-semibold text-[11px]">
                  {visibleColumns.map((col, idx) => {
                    if (idx === 0) {
                      return (
                        <td key={col.key} className="px-3.5 py-2 text-theme-primary">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold border border-blue-500/20">
                              Sub-Total
                            </span>
                            <span className="text-[10px] text-theme-muted">({paginatedItems.length})</span>
                          </div>
                        </td>
                      );
                    }

                    // Render Sub-total value
                    const key = col.key;
                    if (key === "in_qty") {
                      return (
                        <td key={key} className="px-3.5 py-2 text-right text-emerald-400 font-bold">
                          {pageSubTotals.in_qty > 0 ? `+${pageSubTotals.in_qty}` : "—"}
                        </td>
                      );
                    }
                    if (key === "out_qty") {
                      return (
                        <td key={key} className="px-3.5 py-2 text-right text-rose-400 font-bold">
                          {pageSubTotals.out_qty > 0 ? `-${pageSubTotals.out_qty}` : "—"}
                        </td>
                      );
                    }
                    if (key === "total_value" || key === "in_value" || key === "out_value" || key === "closing_value") {
                      const sumVal = pageSubTotals[key] || 0;
                      return (
                        <td key={key} className="px-3.5 py-2 text-right text-emerald-400 font-bold">
                          {formatCurrency(sumVal)}
                        </td>
                      );
                    }
                    if (key === "quantity") {
                      const netQ = (pageSubTotals.in_qty || 0) - (pageSubTotals.out_qty || 0);
                      return (
                        <td key={key} className="px-3.5 py-2 text-right text-theme-primary font-bold">
                          {netQ}
                        </td>
                      );
                    }
                    return (
                      <td key={key} className="px-3.5 py-2 text-theme-muted/40 text-center">
                        —
                      </td>
                    );
                  })}
                </tr>

                {/* 2. Grand Total Row */}
                <tr className="bg-theme-surface-3 font-bold text-xs text-theme-primary">
                  {visibleColumns.map((col, idx) => {
                    if (idx === 0) {
                      return (
                        <td key={col.key} className="px-3.5 py-2.5 text-theme-primary">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] uppercase font-extrabold border border-amber-500/40">
                              Grand Total
                            </span>
                            <span className="text-[10px] text-theme-muted font-normal">
                              ({filteredAndSortedItems.length} records)
                            </span>
                          </div>
                        </td>
                      );
                    }

                    const key = col.key;
                    if (key === "in_qty") {
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-emerald-400 font-bold text-xs">
                          {grandTotals.in_qty > 0 ? `+${grandTotals.in_qty}` : "—"}
                        </td>
                      );
                    }
                    if (key === "out_qty") {
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-rose-400 font-bold text-xs">
                          {grandTotals.out_qty > 0 ? `-${grandTotals.out_qty}` : "—"}
                        </td>
                      );
                    }
                    if (key === "total_value") {
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-amber-400 font-extrabold text-xs">
                          {formatCurrency(grandTotals.total_value || 0)}
                        </td>
                      );
                    }
                    if (key === "in_value") {
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-emerald-400 font-bold text-xs">
                          {formatCurrency(grandTotals.in_value || 0)}
                        </td>
                      );
                    }
                    if (key === "out_value") {
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-rose-400 font-bold text-xs">
                          {formatCurrency(grandTotals.out_value || 0)}
                        </td>
                      );
                    }
                    if (key === "closing_value") {
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-cyan-300 font-bold text-xs">
                          {formatCurrency(grandTotals.closing_value || 0)}
                        </td>
                      );
                    }
                    if (key === "quantity") {
                      const netQ = (grandTotals.in_qty || 0) - (grandTotals.out_qty || 0);
                      return (
                        <td key={key} className="px-3.5 py-2.5 text-right text-cyan-400 font-bold text-xs">
                          {netQ >= 0 ? `+${netQ}` : netQ}
                        </td>
                      );
                    }
                    return (
                      <td key={key} className="px-3.5 py-2.5 text-theme-muted/40 text-center">
                        —
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-theme-surface-3/30 border-t border-theme-divider p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-theme-muted">
          <div>
            Showing <strong className="text-theme-primary">{paginatedItems.length}</strong> of{" "}
            <strong className="text-theme-primary">{serverTotalCount ?? filteredAndSortedItems.length}</strong> records
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                fetchData({ page: nextPage, preservePage: true });
              }}
              className="p-1.5 rounded-lg border border-theme-divider hover:bg-theme-surface-hover text-theme-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 font-medium">
              Page <strong className="text-theme-primary">{page}</strong> of <strong className="text-theme-primary">{totalPages}</strong>
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1);
                fetchData({ page: nextPage, preservePage: true });
              }}
              className="p-1.5 rounded-lg border border-theme-divider hover:bg-theme-surface-hover text-theme-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

