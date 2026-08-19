/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Search, RefreshCw, Download, Filter, 
  Calendar, Layers, FileSpreadsheet, Loader2, 
  ChevronLeft, ChevronRight, AlertCircle, Database
} from "lucide-react";
import { LedgerConfig } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { formatDateTime } from "../../../utils/formatters.ts";

export interface LedgerScreenProps<T = any> {
  config: LedgerConfig<T>;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
}

export function LedgerScreen<T extends Record<string, any>>({
  config,
  onNotification,
}: LedgerScreenProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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

  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch Ledger data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1(config.apiEndpoint);
      let list: T[] = [];
      if (config.responseTransform) {
        list = config.responseTransform(data);
      } else if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === "object") {
        list = data.items || data.logs || data.records || [];
      }
      setItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error(`Failed to load ${config.title}:`, err);
      if (onNotification) {
        onNotification("Network Error", err.message || `Failed to fetch ${config.entityName}`, "error");
      }
    } finally {
      setLoading(false);
    }
  }, [config, onNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Text Search across fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchFields = config.searchFields || Object.keys(item);
        const matches = searchFields.some((field) => {
          const val = item[field as keyof T];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        });
        if (!matches) return false;
      }

      // 2. Select Filters
      for (const [key, val] of Object.entries(activeFilters)) {
        if (val !== "ALL" && val !== "") {
          const itemVal = item[key];
          if (String(itemVal).toLowerCase() !== String(val).toLowerCase()) {
            return false;
          }
        }
      }

      // 3. Date Range Filter
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
  }, [items, searchQuery, activeFilters, dateRange, config.searchFields]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const headers = config.columns.map((c) => `"${c.label}"`).join(",");
    const rows = filteredItems.map((item) =>
      config.columns
        .map((c) => {
          const val = item[c.key];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${config.exportFileName || config.entityName.toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <div className="flex items-center gap-2 self-start md:self-auto font-mono text-xs">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="px-3 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={config.searchPlaceholder || `Search ${config.entityName.toLowerCase()}...`}
              className="w-full bg-theme-surface-1 border border-theme-divider focus:border-blue-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-primary placeholder:text-theme-muted focus:outline-hidden font-mono"
            />
          </div>

          {/* Dynamic Select Filters */}
          {config.filters?.map((filter) => (
            <div key={filter.key} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-theme-muted font-mono">{filter.label}:</span>
              <select
                value={activeFilters[filter.key] || "ALL"}
                onChange={(e) => {
                  setActiveFilters((p) => ({ ...p, [filter.key]: e.target.value }));
                  setPage(1);
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

          {/* Date Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => {
                setDateRange((p) => ({ ...p, startDate: e.target.value }));
                setPage(1);
              }}
              className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
            />
            <span className="text-theme-muted text-xs">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => {
                setDateRange((p) => ({ ...p, endDate: e.target.value }));
                setPage(1);
              }}
              className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Status Count Bar */}
        <div className="flex items-center justify-between text-[11px] text-theme-muted font-mono pt-2 border-t border-theme-divider/40">
          <div>
            Showing <strong className="text-theme-primary">{filteredItems.length}</strong> matching entries (Total:{" "}
            {items.length})
          </div>
          {filteredItems.length > 0 && (
            <div>
              Page {page} of {totalPages}
            </div>
          )}
        </div>
      </div>

      {/* Dense Ledger Table */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-theme-surface-3/60 text-theme-muted font-mono border-b border-theme-divider uppercase text-[10px] tracking-wider">
              <tr>
                {config.columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-3.5 py-2.5 ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider font-mono">
              {loading ? (
                <tr>
                  <td colSpan={config.columns.length} className="px-4 py-12 text-center text-theme-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-blue-400" />
                      <span>Loading ledger audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length} className="px-4 py-12 text-center text-theme-muted">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((record, index) => (
                  <tr key={record[config.idKey || "id"] || index} className="hover:bg-theme-surface-hover/50 transition-colors">
                    {config.columns.map((col) => {
                      const val = record[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`px-3.5 py-2 ${
                            col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                          }`}
                        >
                          {col.render ? col.render(val, record, index) : String(val ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-theme-divider flex items-center justify-between font-mono text-xs">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded-lg disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={13} />
              <span>Previous</span>
            </button>

            <span className="text-theme-muted">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded-lg disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
