import React from "react";
import { ChevronRight } from "lucide-react";
import { LookupRendererProps } from "./ILookupRenderer.js";

export const TableRenderer: React.FC<LookupRendererProps> = ({
  items,
  columns,
  selectedIndex = 0,
  onSelect,
}) => {
  if (items.length === 0) return null;

  const displayCols = columns && columns.length > 0
    ? columns
    : [
        { key: "code", label: "Code", type: "text" },
        { key: "name", label: "Name", type: "text" },
      ];

  return (
    <div className="w-full overflow-x-auto border border-theme-divider rounded-xl">
      <table className="w-full text-left border-collapse text-xs font-sans">
        <thead className="bg-theme-surface-2 font-mono text-[10px] text-theme-muted uppercase tracking-wider border-b border-theme-divider">
          <tr>
            <th className="p-2.5">Title / Code</th>
            {displayCols.slice(0, 4).map((col) => (
              <th key={col.key} className="p-2.5">{col.label}</th>
            ))}
            <th className="p-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-theme-divider font-medium">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[var(--c-seef-accent)]/15 text-[var(--c-seef-accent)] font-bold"
                    : "hover:bg-theme-surface-hover text-theme-heading"
                }`}
              >
                <td className="p-2.5">
                  <div className="font-bold">{item.title || (item as any).name || item.id}</div>
                  <div className="text-[10px] font-mono text-theme-muted">{(item as any).code || item.id}</div>
                </td>
                {displayCols.slice(0, 4).map((col) => (
                  <td key={col.key} className="p-2.5 font-mono text-theme-body">
                    {String(item.columns?.[col.key] ?? item.metadata?.[col.key] ?? "—")}
                  </td>
                ))}
                <td className="p-2.5 text-right">
                  <ChevronRight className="w-4 h-4 inline-block text-theme-muted" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
