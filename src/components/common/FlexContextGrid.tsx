/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * FlexContextGrid
 * ====================
 * A single, reusable, keyboard-navigable data grid that renders dynamically
 * based on the active entity context descriptor from FieldContextRegistry.
 *
 * This component replaces the three duplicated product/item/customer search
 * table implementations in:
 *   - billing/ProductSearchBrows.tsx
 *   - billing/ItemBrowseOverlayD.tsx
 *   - purchase/PurchBrowseDlg.tsx
 *
 * Props:
 *   - columns          : FlexibleGridColumn[] from the registry
 *   - results          : SearchResult[] from GlobalSearchService
 *   - isLoading        : boolean — shows skeleton rows
 *   - selectedIndex    : externally controlled selection (for keyboard nav)
 *   - onSelectIndex    : callback when hover or arrow key changes selection
 *   - onSelectRow      : callback when user confirms a selection (click / Enter)
 *   - emptyMessage     : optional custom message when results is empty
 *   - maxRows          : max visible rows before scroll (default: 15)
 */

import React, { useRef, useEffect, useCallback } from "react";
import { FlexibleGridColumn } from "../../services/globalContext/fieldContext.ts";
import { SearchResult } from "../../services/globalContext/GlobalSearchService.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FlexibleContextGridProps {
  columns: FlexibleGridColumn[];
  results: SearchResult[];
  isLoading?: boolean;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onSelectRow: (row: any) => void;
  emptyMessage?: string;
  maxRows?: number;
  /** Whether the containing element captures keyboard events (default: true) */
  handleKeys?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell Value Renderer
// ─────────────────────────────────────────────────────────────────────────────

function renderCellValue(
  column: FlexibleGridColumn,
  value: string | number | null | undefined
): React.ReactNode {
  const val = value == null ? "—" : value;

  if (column.style === "price") {
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    if (isNaN(num)) return <span className="text-[#737685]">—</span>;
    return <span className="font-mono font-bold">₹{num.toFixed(2)}</span>;
  }

  if (column.style === "mono") {
    return <span className="font-mono">{val}</span>;
  }

  if (column.style === "bold") {
    return <span className="font-semibold">{val}</span>;
  }

  if (column.style === "muted") {
    return <span className="text-[#737685]">{val}</span>;
  }

  if (column.style === "badge-green") {
    return (
      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
        {val}
      </span>
    );
  }

  if (column.style === "badge-amber") {
    return (
      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
        {val}
      </span>
    );
  }

  if (column.style === "badge-red") {
    return (
      <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
        {val}
      </span>
    );
  }

  return <span>{val}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Row
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRow({ columns }: { columns: FlexibleGridColumn[] }) {
  return (
    <tr className="border-b border-[#e2e2e8]/60">
      {columns.map((col) => (
        <td key={col.id} className="px-2 py-1.5 border-r border-[#c4c6d4]/40 last:border-r-0">
          <div className="h-3 bg-[#e8e7ed] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const FlexibleContextGrid: React.FC<FlexibleContextGridProps> = ({
  columns,
  results,
  isLoading = false,
  selectedIndex,
  onSelectIndex,
  onSelectRow,
  emptyMessage = "No records match your search. Try a different query.",
  maxRows = 15,
  handleKeys = true,
}) => {
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected row into view
  useEffect(() => {
    if (!tableBodyRef.current) return;
    const rows = tableBodyRef.current.querySelectorAll("tr[data-row]");
    const target = rows[selectedIndex] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (!handleKeys) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onSelectIndex(Math.min(selectedIndex + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onSelectIndex(Math.max(selectedIndex - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelectRow(results[selectedIndex].data);
        }
      }
    },
    [handleKeys, selectedIndex, results, onSelectIndex, onSelectRow]
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-white"
      tabIndex={-1}
      onKeyDown={handleKeys ? (handleKeyDown as any) : undefined}
    >
      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
        {/* ── Table Header ─────────────────────────────────────────────────── */}
        <thead className="sticky top-0 z-10 bg-[#e8e7ed] border-b border-[#c4c6d4] text-[10px] font-bold text-[#434652] uppercase tracking-wider select-none">
          <tr>
            <th className="w-8 px-2 py-2 text-center border-r border-[#c4c6d4] shrink-0">#</th>
            {columns.map((col) => (
              <th
                key={col.id}
                className={`px-2 py-2 border-r border-[#c4c6d4] last:border-r-0 ${col.width || ""} ${
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

        {/* ── Table Body ───────────────────────────────────────────────────── */}
        <tbody
          ref={tableBodyRef}
          className="divide-y divide-[#e2e2e8] font-medium text-[#1a1b20]"
        >
          {/* Loading skeletons */}
          {isLoading && results.length === 0 && (
            <>
              {Array.from({ length: Math.min(maxRows, 8) }).map((_, i) => (
                <SkeletonRow key={`skel-${i}`} columns={columns} />
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoading && results.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-4 py-10 text-center text-[#737685]"
              >
                <span className="material-symbols-outlined text-3xl text-[#c4c6d4] block mb-2">
                  search_off
                </span>
                <p className="text-xs font-medium">{emptyMessage}</p>
              </td>
            </tr>
          )}

          {/* Data rows */}
          {results.slice(0, maxRows * 3).map((result, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <tr
                key={result.data?.id || result.data?.code || idx}
                data-row={idx}
                onClick={() => onSelectRow(result.data)}
                onMouseEnter={() => onSelectIndex(idx)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#cdddff] text-[#00296d] border-l-4 border-l-[#00296d]"
                    : "hover:bg-[#f4f3f9]"
                }`}
              >
                {/* Row number */}
                <td className="px-2 py-1.5 text-center border-r border-[#c4c6d4]/60 text-[#737685] font-mono shrink-0">
                  {idx + 1}
                </td>

                {/* Data columns */}
                {columns.map((col) => {
                  const rawValue = col.accessor(result.data);
                  return (
                    <td
                      key={col.id}
                      className={`px-2 py-1.5 border-r border-[#c4c6d4]/60 last:border-r-0 truncate max-w-xs ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      } ${col.width || ""}`}
                    >
                      {renderCellValue(col, rawValue)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Footer / Info Bar (companion component)
// ─────────────────────────────────────────────────────────────────────────────

interface FlexibleGridFooterProps {
  totalResults: number;
  isLoading: boolean;
  selectedIndex: number;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}

export const FlexibleGridFooter: React.FC<FlexibleGridFooterProps> = ({
  totalResults,
  isLoading,
  selectedIndex,
  onConfirm,
  onCancel,
  confirmLabel = "Select",
}) => {
  return (
    <div className="bg-[#e8e7ed] border-t border-[#c4c6d4] px-4 py-2 flex justify-between items-center shrink-0 text-xs">
      <div className="flex items-center gap-3 text-[#434652] font-semibold">
        <span>
          {isLoading ? (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              Loading...
            </span>
          ) : (
            <span>{totalResults} record{totalResults !== 1 ? "s" : ""} found</span>
          )}
        </span>
        <span className="text-[#737685] text-[11px]">
          <kbd className="bg-white border border-[#c4c6d4] px-1 rounded font-mono text-[10px]">↑</kbd>{" "}
          <kbd className="bg-white border border-[#c4c6d4] px-1 rounded font-mono text-[10px]">↓</kbd>{" "}
          Navigate &nbsp;
          <kbd className="bg-white border border-[#c4c6d4] px-1 rounded font-mono text-[10px]">Enter</kbd>{" "}
          Select &nbsp;
          <kbd className="bg-white border border-[#c4c6d4] px-1 rounded font-mono text-[10px]">Esc</kbd>{" "}
          Close
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={selectedIndex < 0}
          className="bg-[#00296d] hover:bg-[#003d9b] disabled:opacity-40 text-white text-xs font-bold uppercase px-5 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm"
        >
          <span className="material-symbols-outlined text-[15px]">check</span>
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-[#faf9ff] hover:bg-[#e8e7ed] text-[#434652] text-xs font-bold uppercase px-4 py-1.5 rounded border border-[#c4c6d4] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
export { FlexibleContextGrid as FlexContextGrid };
