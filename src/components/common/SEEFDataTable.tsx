/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0  (SEEF Phase 6)
 * Created      : 2026-07-26
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEEF Data Table — Enterprise Data Grid Primitive
 *
 * The canonical data table component for SMRITI Retail OS.
 * Reads density, animation policy, and theme from useSEEF().
 *
 * Features:
 *  - Column sort, column visibility toggle
 *  - Row selection (single / multi), sticky header
 *  - Virtual scrolling for 100K+ rows (windowed rendering)
 *  - Inline search / filter bar
 *  - CSV export
 *  - Keyboard navigation: ↑↓ row navigation, Enter→select/open
 *  - SEEFSkeleton loading state, SEEFEmptyState no-data state
 *  - Density-aware row height: compact 32px, comfortable 44px, spacious 56px
 *  - WCAG AA: aria-sort, aria-selected, aria-rowcount, role="grid"
 *
 * Usage:
 *   <SEEFDataTable
 *     columns={columns}
 *     rows={rows}
 *     loading={isLoading}
 *     onRowClick={(row) => openDetail(row)}
 *     searchable
 *     selectable
 *     exportable
 *   />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  KeyboardEvent,
} from "react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { SEEFSkeleton } from "./SEEFSkeleton.tsx";
import { SEEFEmptyState } from "./SEEFEmptyState.tsx";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SEEFColumnDef<TRow = Record<string, unknown>> {
  /** Unique key — maps to row field name */
  key: string;
  /** Display header label */
  header: string;
  /** Column width in px (default: 140) */
  width?: number;
  /** Minimum column width (default: 60) */
  minWidth?: number;
  /** Alignment of cell content */
  align?: "left" | "center" | "right";
  /** Whether this column is sortable (default: true) */
  sortable?: boolean;
  /** Whether this column can be hidden (default: true) */
  hideable?: boolean;
  /** Frozen/sticky column (leftmost columns) */
  frozen?: boolean;
  /** Custom cell renderer */
  render?: (value: unknown, row: TRow, rowIndex: number) => React.ReactNode;
  /** Custom sort comparator */
  comparator?: (a: TRow, b: TRow) => number;
}

export type SortDirection = "asc" | "desc" | "none";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface SEEFDataTableProps<TRow = Record<string, unknown>> {
  /** Column definitions */
  columns: SEEFColumnDef<TRow>[];
  /** Row data array */
  rows: TRow[];
  /** Row key extractor — defaults to row index */
  rowKey?: (row: TRow, index: number) => string | number;
  /** Whether data is loading — shows skeleton */
  loading?: boolean;
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number;
  /** Whether to show the inline search bar */
  searchable?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** External search value (controlled) */
  searchValue?: string;
  /** Callback when internal search changes */
  onSearchChange?: (value: string) => void;
  /** Whether rows are selectable */
  selectable?: boolean;
  /** Multi-select mode (default: true when selectable=true) */
  multiSelect?: boolean;
  /** Controlled selected row keys */
  selectedKeys?: Set<string | number>;
  /** Callback when selection changes */
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Row click handler */
  onRowClick?: (row: TRow, index: number) => void;
  /** Whether CSV export button is shown */
  exportable?: boolean;
  /** File name for CSV export (without extension) */
  exportFileName?: string;
  /** Custom toolbar actions rendered alongside search */
  toolbarActions?: React.ReactNode;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Empty state action */
  emptyAction?: { label: string; onClick: () => void };
  /** Fixed height for the scrollable body in px. Default 480. */
  height?: number;
  /** Density override for this table instance (overrides SEEF global) */
  densityOverride?: "compact" | "comfortable" | "spacious";
  /** Additional CSS class */
  className?: string;
  /** Unique ID for accessibility */
  id?: string;
  /** Caption for screen readers */
  caption?: string;
}

// ── Density row heights ────────────────────────────────────────────────────────

const ROW_HEIGHT = { compact: 32, comfortable: 44, spacious: 56 } as const;
const HEADER_HEIGHT = { compact: 36, comfortable: 44, spacious: 52 } as const;
const VIRTUAL_OVERSCAN = 5;

// ── CSV export ─────────────────────────────────────────────────────────────────

function exportToCSV<TRow>(
  columns: SEEFColumnDef<TRow>[],
  rows: TRow[],
  fileName: string,
  visibleCols: Set<string>
) {
  const exportCols = columns.filter((c) => visibleCols.has(c.key) && !c.render);
  const header = exportCols.map((c) => `"${c.header}"`).join(",");
  const body = rows
    .map((row) =>
      exportCols
        .map((c) => {
          const val = (row as Record<string, unknown>)[c.key];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sort ──────────────────────────────────────────────────────────────────────

function applySort<TRow>(rows: TRow[], sort: SortState, cols: SEEFColumnDef<TRow>[]): TRow[] {
  if (sort.direction === "none") return rows;
  const col = cols.find((c) => c.key === sort.key);
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (col.comparator) {
      cmp = col.comparator(a, b);
    } else {
      const av = (a as Record<string, unknown>)[col.key];
      const bv = (b as Record<string, unknown>)[col.key];
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = -1;
      else if (bv == null) cmp = 1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    }
    return sort.direction === "desc" ? -cmp : cmp;
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

function applySearch<TRow>(rows: TRow[], query: string, cols: SEEFColumnDef<TRow>[]): TRow[] {
  if (!query.trim()) return rows;
  const q = query.toLowerCase();
  return rows.filter((row) =>
    cols.some((col) => {
      if (col.render) return false;
      const val = (row as Record<string, unknown>)[col.key];
      return val != null && String(val).toLowerCase().includes(q);
    })
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SEEFDataTable<TRow = Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 8,
  searchable = false,
  searchPlaceholder = "Search…",
  searchValue: controlledSearch,
  onSearchChange,
  selectable = false,
  multiSelect = true,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  onRowClick,
  exportable = false,
  exportFileName = "smriti-export",
  toolbarActions,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  emptyAction,
  height = 480,
  densityOverride,
  className = "",
  id,
  caption,
}: SEEFDataTableProps<TRow>) {
  const { config } = useSEEF();
  const density = densityOverride ?? config.density;
  const rowH = ROW_HEIGHT[density];
  const headerH = HEADER_HEIGHT[density];
  const animate = config.animationPolicy !== "none" && !config.reducedMotion;

  // Column visibility
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const visibleCols = useMemo(
    () => new Set(columns.filter((c) => !hiddenCols.has(c.key)).map((c) => c.key)),
    [columns, hiddenCols]
  );
  const visibleColumns = useMemo(() => columns.filter((c) => visibleCols.has(c.key)), [columns, visibleCols]);

  // Sort
  const [sortState, setSortState] = useState<SortState>({ key: "", direction: "none" });
  const handleSort = useCallback((key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: "", direction: "none" };
    });
  }, []);

  // Search
  const [internalSearch, setInternalSearch] = useState("");
  const searchQuery = controlledSearch ?? internalSearch;
  const handleSearchChange = useCallback((val: string) => {
    setInternalSearch(val);
    onSearchChange?.(val);
  }, [onSearchChange]);

  // Processed rows
  const processedRows = useMemo(() => {
    return applySort(applySearch(rows, searchQuery, columns), sortState, columns);
  }, [rows, searchQuery, sortState, columns]);

  // Selection
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string | number>>(new Set());
  const selectedKeys = controlledSelectedKeys ?? internalSelectedKeys;

  const getRowKey = useCallback(
    (row: TRow, index: number): string | number => (rowKey ? rowKey(row, index) : index),
    [rowKey]
  );

  const handleRowSelect = useCallback(
    (row: TRow, index: number, ctrlKey: boolean) => {
      if (!selectable) return;
      const key = getRowKey(row, index);
      const next = new Set(selectedKeys);
      if (multiSelect && ctrlKey) {
        next.has(key) ? next.delete(key) : next.add(key);
      } else {
        if (next.has(key) && next.size === 1) next.clear();
        else { next.clear(); next.add(key); }
      }
      setInternalSelectedKeys(next);
      onSelectionChange?.(next);
    },
    [selectable, multiSelect, selectedKeys, getRowKey, onSelectionChange]
  );

  // Virtual scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = processedRows.length * rowH;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowH) - VIRTUAL_OVERSCAN);
  const endIndex = Math.min(
    processedRows.length,
    Math.ceil((scrollTop + height) / rowH) + VIRTUAL_OVERSCAN
  );
  const visibleRows = processedRows.slice(startIndex, endIndex);

  // Keyboard navigation
  const [focusedRow, setFocusedRow] = useState(-1);

  const handleTableKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (processedRows.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedRow((p) => Math.min(p + 1, processedRows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedRow((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter" && focusedRow >= 0) { onRowClick?.(processedRows[focusedRow], focusedRow); }
    else if (e.key === " " && focusedRow >= 0 && selectable) { e.preventDefault(); handleRowSelect(processedRows[focusedRow], focusedRow, false); }
  }, [processedRows, focusedRow, onRowClick, selectable, handleRowSelect]);

  // Column visibility panel
  const [showColPanel, setShowColPanel] = useState(false);
  const hideableColumns = columns.filter((c) => c.hideable !== false);

  // ── Styles ───────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    border: "1px solid var(--seef-border)",
    borderRadius: "var(--seef-radius-md)",
    overflow: "hidden",
    backgroundColor: "var(--seef-surface-1)",
    display: "flex",
    flexDirection: "column",
  };

  const toolbarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--seef-space-2)",
    padding: `var(--seef-space-2) var(--seef-space-3)`,
    borderBottom: "1px solid var(--seef-border)",
    backgroundColor: "var(--seef-surface-2)",
    flexWrap: "wrap",
  };

  const searchInputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 160,
    maxWidth: 320,
    height: density === "compact" ? 28 : 34,
    padding: "0 var(--seef-space-2)",
    border: "1px solid var(--seef-border)",
    borderRadius: "var(--seef-radius-sm)",
    background: "var(--seef-surface-1)",
    color: "var(--seef-text-primary)",
    fontSize: "var(--seef-font-sm)",
    outline: "none",
  };

  const iconBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    border: "1px solid var(--seef-border)",
    borderRadius: "var(--seef-radius-sm)",
    background: "var(--seef-surface-1)",
    color: "var(--seef-text-secondary)",
    fontSize: "var(--seef-font-xs)",
    cursor: "pointer",
  };

  const headerCellStyle = (col: SEEFColumnDef<TRow>): React.CSSProperties => ({
    width: col.width ?? 140,
    minWidth: col.minWidth ?? 60,
    height: headerH,
    padding: "0 var(--seef-space-2)",
    textAlign: col.align ?? "left",
    fontSize: "var(--seef-font-sm)",
    fontWeight: 600,
    color: "var(--seef-text-secondary)",
    backgroundColor: "var(--seef-surface-2)",
    borderBottom: "2px solid var(--seef-border)",
    borderRight: "1px solid var(--seef-border)",
    position: col.frozen ? "sticky" : "relative",
    left: col.frozen ? 0 : undefined,
    zIndex: col.frozen ? 2 : 1,
    userSelect: "none",
    cursor: col.sortable !== false ? "pointer" : "default",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    alignItems: "center",
    gap: "var(--seef-space-1)",
    flexShrink: 0,
    boxSizing: "border-box",
  });

  const bodyCellStyle = (col: SEEFColumnDef<TRow>): React.CSSProperties => ({
    width: col.width ?? 140,
    minWidth: col.minWidth ?? 60,
    height: rowH,
    padding: "0 var(--seef-space-2)",
    textAlign: col.align ?? "left",
    fontSize: "var(--seef-font-sm)",
    color: "var(--seef-text-primary)",
    borderBottom: "1px solid var(--seef-border)",
    borderRight: "1px solid var(--seef-border)",
    position: col.frozen ? "sticky" : undefined,
    left: col.frozen ? 0 : undefined,
    zIndex: col.frozen ? 1 : undefined,
    backgroundColor: col.frozen ? "inherit" : undefined,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  });

  const sortIcon = (key: string) => {
    if (sortState.key !== key) return <span style={{ opacity: 0.3, fontSize: 11 }}>⇅</span>;
    return <span style={{ fontSize: 11, color: "var(--seef-brand)" }}>{sortState.direction === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={containerStyle} className={className} id={id}>
        {(searchable || toolbarActions || exportable) && <div style={toolbarStyle} />}
        <div style={{ padding: "var(--seef-space-4)" }}>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <SEEFSkeleton key={i} variant="text" width="100%" height={rowH - 8} style={{ marginBottom: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty (no initial data) ────────────────────────────────────────────────

  if (!loading && rows.length === 0) {
    return (
      <div style={containerStyle} className={className} id={id}>
        {(searchable || toolbarActions || exportable) && (
          <div style={toolbarStyle}>
            {searchable && (
              <input
                style={searchInputStyle}
                type="search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label="Search table"
              />
            )}
            {toolbarActions}
          </div>
        )}
        <SEEFEmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  const noSearchResults = processedRows.length === 0 && !!searchQuery;

  // ── Full table ────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle} className={className} id={id}>
      {/* Toolbar */}
      {(searchable || toolbarActions || exportable || hideableColumns.length > 0) && (
        <div style={toolbarStyle} role="toolbar" aria-label="Table controls">
          {searchable && (
            <input
              style={searchInputStyle}
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search table"
            />
          )}
          {searchable && (
            <span style={{ fontSize: "var(--seef-font-xs)", color: "var(--seef-text-secondary)", whiteSpace: "nowrap" }}>
              {processedRows.length.toLocaleString()} row{processedRows.length !== 1 ? "s" : ""}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {toolbarActions}
          {/* Column visibility */}
          {hideableColumns.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowColPanel((v) => !v)} title="Columns" aria-label="Toggle columns" style={iconBtnStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>view_column</span>
                Columns
              </button>
              {showColPanel && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
                  background: "var(--seef-surface-2)", border: "1px solid var(--seef-border)",
                  borderRadius: "var(--seef-radius-md)", padding: "var(--seef-space-2)", minWidth: 180,
                  boxShadow: "var(--seef-elevation-3)",
                }}>
                  {hideableColumns.map((col) => (
                    <label key={col.key} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "4px 8px",
                      cursor: "pointer", fontSize: "var(--seef-font-sm)", color: "var(--seef-text-primary)",
                    }}>
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        onChange={() => {
                          const next = new Set(hiddenCols);
                          next.has(col.key) ? next.delete(col.key) : next.add(col.key);
                          setHiddenCols(next);
                        }}
                      />
                      {col.header}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* CSV Export */}
          {exportable && (
            <button
              onClick={() => exportToCSV(columns, processedRows, exportFileName, visibleCols)}
              title="Export CSV" aria-label="Export as CSV" style={iconBtnStyle}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
              Export
            </button>
          )}
        </div>
      )}

      {noSearchResults ? (
        <SEEFEmptyState
          title="No matching records"
          description={`No results for "${searchQuery}". Try a different search term.`}
        />
      ) : (
        <div
          role="grid"
          aria-label={caption ?? "Data table"}
          aria-rowcount={processedRows.length}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          style={{ outline: "none", display: "flex", flexDirection: "column", flex: 1 }}
        >
          {/* Sticky header */}
          <div role="row" aria-rowindex={0} style={{ display: "flex", flexShrink: 0, overflowX: "hidden" }}>
            {selectable && (
              <div style={{ ...headerCellStyle({ key: "__sel", header: "", width: 40, sortable: false }), cursor: "default" }} role="columnheader">
                {multiSelect && (
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={selectedKeys.size === processedRows.length && processedRows.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const all = new Set(processedRows.map((r, i) => getRowKey(r, i)));
                        setInternalSelectedKeys(all);
                        onSelectionChange?.(all);
                      } else {
                        setInternalSelectedKeys(new Set());
                        onSelectionChange?.(new Set());
                      }
                    }}
                  />
                )}
              </div>
            )}
            {visibleColumns.map((col) => (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={sortState.key !== col.key ? "none" : sortState.direction === "asc" ? "ascending" : "descending"}
                style={headerCellStyle(col)}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                title={col.header}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{col.header}</span>
                {col.sortable !== false && sortIcon(col.key)}
              </div>
            ))}
          </div>

          {/* Virtual body */}
          <div
            ref={scrollRef}
            onScroll={() => scrollRef.current && setScrollTop(scrollRef.current.scrollTop)}
            style={{ height, overflowY: "auto", overflowX: "auto", position: "relative" }}
          >
            <div style={{ height: totalHeight, position: "relative" }}>
              <div style={{ position: "absolute", top: startIndex * rowH, left: 0, right: 0 }}>
                {visibleRows.map((row, relIdx) => {
                  const absIdx = startIndex + relIdx;
                  const key = getRowKey(row, absIdx);
                  const isSelected = selectedKeys.has(key);
                  const isFocused = focusedRow === absIdx;
                  return (
                    <div
                      key={String(key)}
                      role="row"
                      aria-rowindex={absIdx + 1}
                      aria-selected={selectable ? isSelected : undefined}
                      style={{
                        display: "flex",
                        cursor: onRowClick ? "pointer" : "default",
                        backgroundColor: isSelected
                          ? "var(--seef-brand-subtle)"
                          : isFocused
                          ? "var(--seef-surface-3)"
                          : absIdx % 2 === 0
                          ? "var(--seef-surface-1)"
                          : "var(--seef-surface-2)",
                        outline: isFocused ? "2px solid var(--seef-brand)" : "none",
                        outlineOffset: -2,
                        transition: animate ? "background-color var(--seef-motion-fast)" : "none",
                      }}
                      onClick={(e) => {
                        setFocusedRow(absIdx);
                        handleRowSelect(row, absIdx, e.ctrlKey || e.metaKey);
                        onRowClick?.(row, absIdx);
                      }}
                      onMouseEnter={() => setFocusedRow(absIdx)}
                    >
                      {selectable && (
                        <div style={bodyCellStyle({ key: "__sel", header: "", width: 40 })}>
                          <input
                            type="checkbox"
                            aria-label={`Select row ${absIdx + 1}`}
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); handleRowSelect(row, absIdx, false); }}
                          />
                        </div>
                      )}
                      {visibleColumns.map((col) => {
                        const cellVal = (row as Record<string, unknown>)[col.key];
                        return (
                          <div
                            key={col.key}
                            role="gridcell"
                            style={bodyCellStyle(col)}
                            title={col.render ? undefined : String(cellVal ?? "")}
                          >
                            {col.render
                              ? col.render(cellVal, row, absIdx)
                              : cellVal == null
                              ? <span style={{ color: "var(--seef-text-muted)" }}>—</span>
                              : String(cellVal)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selection footer */}
          {selectable && selectedKeys.size > 0 && (
            <div style={{
              padding: "var(--seef-space-1) var(--seef-space-3)",
              borderTop: "1px solid var(--seef-border)",
              fontSize: "var(--seef-font-xs)",
              color: "var(--seef-text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "var(--seef-space-2)",
              backgroundColor: "var(--seef-surface-2)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--seef-brand)" }}>check_circle</span>
              {selectedKeys.size} row{selectedKeys.size !== 1 ? "s" : ""} selected
              <button
                onClick={() => { setInternalSelectedKeys(new Set()); onSelectionChange?.(new Set()); }}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--seef-text-secondary)", cursor: "pointer", fontSize: "var(--seef-font-xs)" }}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

SEEFDataTable.displayName = "SEEFDataTable";
export default SEEFDataTable;
