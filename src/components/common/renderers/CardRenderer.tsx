import React from "react";
import { User } from "lucide-react";
import { LookupRendererProps } from "./ILookupRenderer.js";

export const CardRenderer: React.FC<LookupRendererProps> = ({
  items,
  selectedIndex = 0,
  onSelect,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1.5 ${
              isSelected
                ? "bg-[var(--c-seef-accent)]/10 border-[var(--c-seef-accent)] shadow-xs"
                : "bg-theme-surface-2 border-theme-divider hover:border-theme-muted"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--c-seef-accent)]" />
                <h4 className="text-xs font-extrabold text-theme-heading">{item.title || (item as any).name}</h4>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-theme-surface-1 border border-theme-divider text-theme-muted">
                  {typeof item.badge === "string" ? item.badge : item.badge.label}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-theme-muted">
              Code: {(item as any).code || item.id} • City: {String(item.metadata?.city || "General")}
            </div>
          </div>
        );
      })}
    </div>
  );
};
