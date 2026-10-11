/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

interface ColDef {
  widthClass?: string; // e.g. "w-24", "w-40"
  align?: "left" | "center" | "right";
}

export interface SmritiTableSkeletonProps {
  rows?: number;
  columns?: ColDef[];
  /** Show a compact header skeleton row */
  showHeader?: boolean;
  className?: string;
}

const Shimmer: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    className={`relative overflow-hidden rounded bg-theme-surface-2 ${className}`}
    aria-hidden="true"
  >
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
  </div>
);

const DEFAULT_COLS: ColDef[] = [
  { widthClass: "w-6" },
  { widthClass: "w-28" },
  { widthClass: "w-36" },
  { widthClass: "w-24" },
  { widthClass: "w-16", align: "right" },
  { widthClass: "w-20", align: "right" },
  { widthClass: "w-16", align: "center" },
  { widthClass: "w-16", align: "center" },
];

export const SmritiTableSkeleton: React.FC<SmritiTableSkeletonProps> = ({
  rows = 8,
  columns = DEFAULT_COLS,
  showHeader = true,
  className = "",
}) => {
  return (
    <div className={`overflow-x-auto ${className}`} aria-busy="true" aria-label="Loading…">
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      <table className="w-full border-collapse">
        {showHeader && (
          <thead>
            <tr className="bg-theme-surface-2 border-b border-theme-divider">
              {columns.map((col, i) => (
                <th key={i} className={`px-5 py-2.5 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}>
                  <Shimmer className="h-2.5 rounded-full" style={{ width: col.widthClass ? undefined : "80px" } as React.CSSProperties} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-theme-divider/30"
              style={{ opacity: 1 - rowIdx * 0.07 }}
            >
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-5 py-3">
                  <Shimmer
                    className={`h-3 rounded-full ${col.widthClass ?? "w-full"}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
