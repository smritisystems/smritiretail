/**
 * Project      : SMRITI Retail OS
 * Module       : SEEF List Report Pattern Component (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.2.0  (SEEF Phase 6 — Token Upgrade)
 * Modified     : 2026-07-26
 * Note         : FioriListReport is preserved as backward-compatible alias
 *                for SEEFListReport. All new code should use SEEFListReport.
 */

import React, { useState } from "react";
import { Search, Filter, RefreshCw, Plus, Download, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { SEEFSkeleton } from "./SEEFSkeleton.tsx";
import { SEEFEmptyState } from "./SEEFEmptyState.tsx";

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
  const { config } = useSEEF();
  const pageSize = 15;
  const rowPadding = config.density === "compact" ? "8px 12px" : config.density === "spacious" ? "14px 16px" : "10px 14px";

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
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--c-theme-surface-1)",
      color: "var(--c-theme-body)",
      borderRadius: "var(--seef-radius-active-xl)",
      border: "var(--seef-card-border)",
      overflow: "hidden",
      boxShadow: "var(--seef-elevation-2)",
      fontFamily: "var(--font-sans)",
    }}>
      {/* 1. List Report Header & Action Toolbar */}
      <div style={{
        padding: "var(--seef-space-xl)",
        background: "var(--c-theme-surface-2)",
        borderBottom: "1px solid var(--c-theme-divider)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--seef-space-md)",
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: "var(--seef-font-size-xl)",
            fontWeight: 700,
            color: "var(--c-theme-body)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: "2px 0 0", fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Toolbar Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--seef-space-sm)", flexWrap: "wrap" }}>
          {selectable && selectedIds && selectedIds.size > 0 && bulkActions}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="seef-interactive seef-focus-ring"
              title="Refresh Data"
              style={toolbarBtnStyle}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}

          {filterOptions.length > 0 && (
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className="seef-interactive seef-focus-ring"
              style={{
                ...toolbarBtnStyle,
                background: showFilterBar ? "rgba(26,115,232,0.10)" : "none",
                color: showFilterBar ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
                border: showFilterBar ? "1px solid rgba(26,115,232,0.30)" : "1px solid var(--c-theme-divider)",
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </button>
          )}

          {onExport && (
            <button onClick={onExport} className="seef-interactive seef-focus-ring" style={toolbarBtnStyle}>
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}

          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="seef-interactive seef-focus-ring"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 14px",
                borderRadius: "var(--seef-radius-active-md)",
                background: "var(--c-seef-accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--seef-font-size-sm)",
                fontWeight: 600,
                boxShadow: "var(--seef-elevation-1)",
              }}
            >
              <Plus className="w-4 h-4" />
              {primaryActionLabel}
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Bar */}
      {showFilterBar && (
        <div style={{
          padding: "var(--seef-space-md) var(--seef-space-xl)",
          background: "var(--c-theme-surface-2)",
          borderBottom: "1px solid var(--c-theme-divider)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--seef-space-md)",
        }}>
          <div style={{ position: "relative", flex: "1", minWidth: "200px" }}>
            <Search style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--c-theme-muted)",
              width: 14,
              height: 14,
            }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                width: "100%",
                background: "var(--c-theme-surface-1)",
                border: "1px solid var(--c-theme-divider)",
                borderRadius: "var(--seef-radius-active-md)",
                paddingLeft: "32px",
                paddingRight: "12px",
                paddingTop: "7px",
                paddingBottom: "7px",
                fontSize: "var(--seef-font-size-sm)",
                color: "var(--c-theme-body)",
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
          </div>

          {filterOptions.map((f) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", fontWeight: 500 }}>
                {f.label}:
              </span>
              <select
                value={activeFilters[f.key] || "ALL"}
                onChange={(e) => { setActiveFilters({ ...activeFilters, [f.key]: e.target.value }); setCurrentPage(1); }}
                style={{
                  background: "var(--c-theme-surface-1)",
                  border: "1px solid var(--c-theme-divider)",
                  borderRadius: "var(--seef-radius-active-sm)",
                  padding: "5px 10px",
                  fontSize: "var(--seef-font-size-xs)",
                  color: "var(--c-theme-body)",
                  outline: "none",
                }}
              >
                <option value="ALL">All {f.label}s</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 3. Data Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? (
          <div style={{ padding: "var(--seef-space-xl)" }}>
            <SEEFSkeleton variant="table" rows={8} columns={columns.length} />
          </div>
        ) : paginatedData.length === 0 ? (
          <SEEFEmptyState
            title="No Records Found"
            description="No records match the current filter criteria. Try adjusting your search or filters."
          />
        ) : (
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--seef-font-size-sm)",
          }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{
                background: "var(--c-theme-surface-2)",
                borderBottom: "2px solid var(--c-theme-divider)",
              }}>
                {selectable && (
                  <th style={{ padding: rowPadding, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: "pointer", accentColor: "var(--c-seef-accent)" }}
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      padding: rowPadding,
                      fontWeight: 600,
                      fontSize: "var(--seef-font-size-xs)",
                      color: "var(--c-theme-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => {
                const rowId = row.id !== undefined ? row.id : idx;
                const isRowSelected = selectedIds ? selectedIds.has(rowId) : false;
                return (
                  <tr
                    key={rowId ? String(rowId) : idx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={onRowClick ? "seef-interactive" : ""}
                    style={{
                      borderBottom: "1px solid var(--c-theme-divider)",
                      cursor: onRowClick ? "pointer" : "default",
                      background: isRowSelected ? "rgba(26,115,232,0.07)" : "transparent",
                      transition: "background var(--seef-motion-fast) var(--seef-ease-standard)",
                    }}
                  >
                    {selectable && (
                      <td style={{ padding: rowPadding, width: 40 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => handleToggleRowSelect(rowId, e)}
                          style={{ cursor: "pointer", accentColor: "var(--c-seef-accent)" }}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: rowPadding,
                          color: "var(--c-theme-primary)",
                          textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                          fontFamily: col.align === "right" ? "var(--font-mono)" : undefined,
                        }}
                      >
                        {col.render ? col.render(row) : String((row as Record<string, any>)[col.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Pagination Footer */}
      <div style={{
        padding: "var(--seef-space-md) var(--seef-space-xl)",
        background: "var(--c-theme-surface-2)",
        borderTop: "1px solid var(--c-theme-divider)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "var(--seef-font-size-xs)",
        color: "var(--c-theme-muted)",
        flexShrink: 0,
      }}>
        <div>Showing {paginatedData.length} of {filteredData.length} entries</div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--seef-space-sm)" }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="seef-interactive seef-focus-ring"
            style={{ ...pagerBtnStyle, opacity: currentPage === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="seef-interactive seef-focus-ring"
            style={{ ...pagerBtnStyle, opacity: currentPage === totalPages ? 0.4 : 1 }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const toolbarBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  padding: "6px 12px",
  borderRadius: "var(--seef-radius-active-md)",
  background: "none",
  color: "var(--c-theme-muted)",
  border: "1px solid var(--c-theme-divider)",
  cursor: "pointer",
  fontSize: "var(--seef-font-size-sm)",
};

const pagerBtnStyle: React.CSSProperties = {
  padding: "4px",
  borderRadius: "var(--seef-radius-active-sm)",
  background: "var(--c-theme-surface-hover)",
  border: "1px solid var(--c-theme-divider)",
  color: "var(--c-theme-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

// Backward-compatible alias — FioriListReport is now SEEFListReport
export const SEEFListReport = FioriListReport;

