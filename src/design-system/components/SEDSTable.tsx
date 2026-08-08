/**
 * Project      : SMRITI Business OS
 * Component    : SEDSTable (SMRITI Enterprise Design System Data Table)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React, { useState, useMemo } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  CheckSquare, 
  Square, 
  SlidersHorizontal,
  Download,
  Search,
  Filter,
  Columns
} from "lucide-react";

export interface SEDSColumn<T> {
  key: string;
  header?: string;
  title?: string;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  visible?: boolean;
}

export interface SEDSTableProps<T> {
  data: T[];
  columns: SEDSColumn<T>[];
  rowKey?: keyof T | ((row: T) => string);
  title?: string;
  subtitle?: string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onRowClick?: (row: T) => void;
  bulkActions?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
  emptyText?: string;
  dense?: boolean;
  stickyHeader?: boolean;
}

export function SEDSTable<T>({
  data,
  columns: initialColumns,
  rowKey,
  title,
  subtitle,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  onRowClick,
  bulkActions,
  searchable = true,
  searchPlaceholder = "Search records...",
  loading = false,
  emptyText = "No records found.",
  dense = false,
  stickyHeader = true,
}: SEDSTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(initialColumns.filter(c => c.visible !== false).map(c => c.key))
  );
  const [showColumnChooser, setShowColumnChooser] = useState(false);

  // Filter columns
  const activeColumns = useMemo(() => {
    return initialColumns.filter(c => visibleColumns.has(c.key));
  }, [initialColumns, visibleColumns]);

  // Search filtering
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row => {
      return initialColumns.some(col => {
        const val = col.accessor ? col.accessor(row) : (row as any)[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, initialColumns]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = initialColumns.find(c => c.key === sortKey);
    return [...filteredData].sort((a, b) => {
      const valA = col?.accessor ? col.accessor(a) : (a as any)[sortKey];
      const valB = col?.accessor ? col.accessor(b) : (b as any)[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const comp = valA < valB ? -1 : 1;
      return sortOrder === "asc" ? comp : -comp;
    });
  }, [filteredData, sortKey, sortOrder, initialColumns]);

  const getRowKey = (r: T, idx = 0): string =>
    typeof rowKey === "function"
      ? rowKey(r)
      : typeof rowKey === "string" && (r as any)[rowKey] !== undefined
      ? String((r as any)[rowKey])
      : (r as any).id || (r as any).key || String(idx);

  // Selection handlers
  const allSelected = sortedData.length > 0 && sortedData.every((r, idx) => selectedKeys.has(getRowKey(r, idx)));
  
  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      const newSet = new Set(sortedData.map((r, idx) => getRowKey(r, idx)));
      onSelectionChange(newSet);
    }
  };

  const toggleSelectRow = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const toggleColumnVisibility = (key: string) => {
    const next = new Set(visibleColumns);
    if (next.has(key)) {
      if (next.size > 1) next.delete(key);
    } else {
      next.add(key);
    }
    setVisibleColumns(next);
  };

  return (
    <div className="w-full flex flex-col bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-lg overflow-hidden font-sans">
      {/* Table Header & Controls Bar */}
      <div className="px-5 py-4 bg-theme-surface-1 border-b border-theme-divider flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {title && <h3 className="text-base font-bold text-theme-body tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-theme-muted mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {selectedKeys.size > 0 && bulkActions && (
            <div className="flex items-center gap-2 bg-blue-950/40 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs text-blue-400 animate-in fade-in">
              <span className="font-mono font-bold">{selectedKeys.size} selected</span>
              <div className="h-3 w-px bg-blue-500/30 mx-1" />
              {bulkActions}
            </div>
          )}

          {searchable && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-xl text-xs text-theme-body focus:border-blue-500 outline-none w-48 sm:w-64 transition-all"
              />
            </div>
          )}

          {/* Column Chooser Button */}
          <div className="relative">
            <button
              onClick={() => setShowColumnChooser(!showColumnChooser)}
              className="p-2 bg-theme-surface-2 border border-theme-divider rounded-xl text-theme-muted hover:text-theme-body hover:border-theme-muted transition flex items-center gap-1.5 text-xs font-semibold"
              title="Configure Columns"
            >
              <Columns size={14} />
              <span className="hidden sm:inline">Columns</span>
            </button>

            {showColumnChooser && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-theme-surface-1 border border-indigo-500/30 rounded-2xl shadow-2xl z-50 p-3 space-y-2 text-xs">
                <div className="font-bold text-theme-body pb-1 border-b border-theme-divider flex items-center justify-between">
                  <span>Toggle Columns</span>
                  <span className="text-[10px] font-mono text-theme-muted">{activeColumns.length}/{initialColumns.length}</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {initialColumns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-theme-surface-hover p-1 rounded-lg text-theme-body">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="rounded border-theme-divider text-blue-500 focus:ring-0"
                      />
                      <span>{col.header}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Body Container */}
      <div className="overflow-x-auto w-full max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`bg-theme-surface-1 border-b border-theme-divider text-[11px] font-bold text-theme-muted uppercase tracking-wider ${stickyHeader ? "sticky top-0 z-10 bg-theme-surface-1" : ""}`}>
              {selectable && (
                <th className="w-10 px-4 py-3 text-center">
                  <button onClick={toggleSelectAll} className="text-theme-muted hover:text-theme-body transition">
                    {allSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} />}
                  </button>
                </th>
              )}

              {activeColumns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3 font-semibold ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {col.sortable !== false ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-theme-body transition focus:outline-none"
                    >
                      <span>{col.header || col.title || col.key}</span>
                      {sortKey === col.key ? (
                        sortOrder === "asc" ? <ChevronUp size={14} className="text-blue-400" /> : <ChevronDown size={14} className="text-blue-400" />
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    <span>{col.header || col.title || col.key}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-theme-divider/60 text-xs">
            {loading ? (
              <tr>
                <td colSpan={activeColumns.length + (selectable ? 1 : 0)} className="py-12 text-center text-theme-muted">
                  <div className="inline-flex items-center gap-2 font-mono">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading record stream...</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + (selectable ? 1 : 0)} className="py-12 text-center text-theme-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const key = getRowKey(row, idx);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors hover:bg-theme-surface-hover ${onRowClick ? "cursor-pointer" : ""} ${
                      isSelected ? "bg-blue-950/20" : ""
                    } ${dense ? "py-2" : "py-3"}`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={e => toggleSelectRow(key, e)} className="text-theme-muted hover:text-theme-body transition">
                          {isSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} />}
                        </button>
                      </td>
                    )}

                    {activeColumns.map(col => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${
                          col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                        } text-theme-body`}
                      >
                        {col.accessor ? col.accessor(row) : (row as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Meta */}
      <div className="px-5 py-3 bg-theme-surface-1 border-t border-theme-divider text-[11px] font-mono text-theme-muted flex items-center justify-between">
        <span>Showing {sortedData.length} of {data.length} records</span>
        <span>SMRITI Virtualized Table v3.16</span>
      </div>
    </div>
  );
}
