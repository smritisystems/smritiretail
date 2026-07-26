/**
 * Project      : SMRITI Retail OS
 * Module       : SAP Fiori List Report Pattern Component (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.0.0
 */

import React, { useState } from "react";
import { Search, Filter, RefreshCw, Plus, Download, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

export interface ListReportColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
}

export interface ListReportFilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

interface FioriListReportProps<T> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: ListReportColumn<T>[];
  filterOptions?: ListReportFilterOption[];
  onRowClick?: (item: T) => void;
  onCreateNew?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  searchPlaceholder?: string;
  primaryActionLabel?: string;
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
  bulkActions?: React.ReactNode;
}

export function FioriListReport<T extends { id?: string | number }>({
  title,
  subtitle,
  data,
  columns,
  filterOptions = [],
  onRowClick,
  onCreateNew,
  onRefresh,
  onExport,
  isLoading = false,
  searchPlaceholder = "Search records...",
  primaryActionLabel = "Create Record",
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
}: FioriListReportProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilterBar, setShowFilterBar] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter Data
  const filteredData = data.filter((item) => {
    // 1. Search term
    const matchesSearch = Object.values(item as Record<string, any>).some(
      (val) => val && String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Filter Bar selects
    const matchesFilters = Object.entries(activeFilters).every(([key, value]) => {
      if (!value || value === "ALL") return true;
      return String((item as Record<string, any>)[key]) === value;
    });

    return matchesSearch && matchesFilters;
  });

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const allSelected = selectable && filteredData.length > 0 && selectedIds?.size === filteredData.length;

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const allIds = new Set<string | number>();
      filteredData.forEach((item) => {
        if (item.id !== undefined) allIds.add(item.id);
      });
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleToggleRowSelect = (id: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange || !selectedIds) return;
    const nextSet = new Set(selectedIds);
    if (e.target.checked) {
      nextSet.add(id);
    } else {
      nextSet.delete(id);
    }
    onSelectionChange(nextSet);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* 1. List Report Header & Action Toolbar */}
      <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2">
          {selectable && selectedIds && selectedIds.size > 0 && bulkActions}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}

          {filterOptions.length > 0 && (
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
                showFilterBar
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                  : "bg-slate-800 text-slate-300 border-slate-700/50 hover:bg-slate-700"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </button>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 flex items-center gap-2 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          )}

          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              {primaryActionLabel}
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Filter Bar (Fiori Filter Bar Pattern) */}
      {showFilterBar && (
        <div className="p-4 bg-slate-900/50 border-b border-slate-800/80 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {filterOptions.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">{f.label}:</span>
              <select
                value={activeFilters[f.key] || "ALL"}
                onChange={(e) => {
                  setActiveFilters({ ...activeFilters, [f.key]: e.target.value });
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <option value="ALL">All {f.label}s</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 3. Actionable Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900/80 sticky top-0 z-10 border-b border-slate-800">
            <tr>
              {selectable && (
                <th className="p-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 accent-cyan-500 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3.5 font-semibold text-slate-400 tracking-wider uppercase text-[11px] ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading dataset...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-12 text-center text-slate-500">
                  No records match the current filter criteria.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const rowId = row.id !== undefined ? row.id : idx;
                const isRowSelected = selectedIds ? selectedIds.has(rowId) : false;
                return (
                  <tr
                    key={rowId ? String(rowId) : idx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-slate-900/60 transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${isRowSelected ? "bg-slate-900/80" : ""}`}
                  >
                    {selectable && (
                      <td className="p-3.5 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => handleToggleRowSelect(rowId, e)}
                          className="rounded border-slate-700 bg-slate-900 accent-cyan-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`p-3.5 text-slate-200 ${
                          col.align === "right"
                            ? "text-right font-mono"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, any>)[col.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Table Pagination Footer */}
      <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing {paginatedData.length} of {filteredData.length} entries
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
