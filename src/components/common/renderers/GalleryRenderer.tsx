import React from "react";
import { Package } from "lucide-react";
import { LookupRendererProps } from "./ILookupRenderer.js";

export const GalleryRenderer: React.FC<LookupRendererProps> = ({
  items,
  selectedIndex = 0,
  onSelect,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              isSelected
                ? "bg-[var(--c-seef-accent)]/10 border-[var(--c-seef-accent)] shadow-xs"
                : "bg-theme-surface-2 border-theme-divider hover:border-theme-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Package className="w-5 h-5 text-[var(--c-seef-accent)]" />
              {item.badge && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-theme-surface-1 border border-theme-divider text-theme-muted">
                  {typeof item.badge === "string" ? item.badge : item.badge.label}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-theme-heading line-clamp-1">
                {item.title || (item as any).name || item.id}
              </div>
              <div className="text-[10px] font-mono text-theme-muted mt-0.5">
                {(item as any).code || item.id}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
