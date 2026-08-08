import React from "react";
import { Folder } from "lucide-react";
import { LookupRendererProps } from "./ILookupRenderer.js";

export const TreeRenderer: React.FC<LookupRendererProps> = ({
  items,
  selectedIndex = 0,
  onSelect,
}) => {
  return (
    <div className="space-y-1 font-mono text-xs border border-theme-divider rounded-xl p-2 bg-theme-surface-2">
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
              isSelected
                ? "bg-[var(--c-seef-accent)]/20 text-[var(--c-seef-accent)] font-bold"
                : "hover:bg-theme-surface-hover text-theme-heading"
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400" />
              <span>{item.title || (item as any).name}</span>
            </div>
            <span className="text-[10px] text-theme-muted">{(item as any).code || item.id}</span>
          </div>
        );
      })}
    </div>
  );
};
