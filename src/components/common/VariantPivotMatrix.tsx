import React, { useMemo, useState } from "react";

export interface VariantPivotItem {
  id: string;
  label: string;
  color?: string;
  size?: string;
  quantity: number;
  unitValue: number;
}

export interface VariantPivotMatrixProps {
  items: VariantPivotItem[];
  compact?: boolean;
}

export const VariantPivotMatrix: React.FC<VariantPivotMatrixProps> = ({ items, compact = false }) => {
  const [view, setView] = useState<"matrix" | "size" | "color">("matrix");
  const sizes = useMemo(
    () => Array.from(new Set(items.map((item) => item.size).filter(Boolean))) as string[],
    [items],
  );
  const colors = useMemo(
    () => Array.from(new Set(items.map((item) => item.color || "Unspecified"))),
    [items],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, { quantity: number; value: number }>();
    items.forEach((item) => {
      const key = view === "size" ? item.size || "Unspecified" : item.color || "Unspecified";
      const current = map.get(key) || { quantity: 0, value: 0 };
      current.quantity += item.quantity;
      current.value += item.quantity * item.unitValue;
      map.set(key, current);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, view]);

  if (!items.length) return <div className="p-4 text-center text-xs text-theme-muted">No variant lines available.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-theme-divider bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-divider bg-theme-surface-2 p-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Variant view</span>
        <div className="flex gap-1">
          {(["matrix", "size", "color"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${view === mode ? "bg-indigo-600 text-white" : "bg-white text-theme-muted border border-theme-divider"}`}
            >
              {mode === "matrix" ? "Color x Size" : `By ${mode}`}
            </button>
          ))}
        </div>
      </div>
      {view === "matrix" ? (
        <table className={`w-full text-xs ${compact ? "min-w-[420px]" : "min-w-[620px]"}`}>
          <thead><tr className="bg-indigo-900 text-left text-[10px] font-bold uppercase text-white">
            <th className="p-2">Color</th>
            {sizes.map((size) => <th key={size} className="p-2 text-right">{size}</th>)}
            <th className="p-2 text-right">Total</th>
          </tr></thead>
          <tbody className="divide-y divide-theme-divider">
            {colors.map((color) => <tr key={color}>
              <td className="p-2 font-bold text-theme-body">{color}</td>
              {sizes.map((size) => <td key={size} className="p-2 text-right font-mono">{items.filter((item) => (item.color || "Unspecified") === color && item.size === size).reduce((sum, item) => sum + item.quantity, 0)}</td>)}
              <td className="p-2 text-right font-bold">{items.filter((item) => (item.color || "Unspecified") === color).reduce((sum, item) => sum + item.quantity, 0)}</td>
            </tr>)}
          </tbody>
        </table>
      ) : (
        <table className={`w-full text-xs ${compact ? "min-w-[300px]" : "min-w-[420px]"}`}>
          <thead><tr className="bg-theme-surface-2 text-left text-[10px] font-bold uppercase text-theme-muted"><th className="p-2">{view}</th><th className="p-2 text-right">Quantity</th><th className="p-2 text-right">Value</th></tr></thead>
          <tbody className="divide-y divide-theme-divider">{grouped.map(([label, totals]) => <tr key={label}><td className="p-2 font-semibold">{label}</td><td className="p-2 text-right font-mono">{totals.quantity}</td><td className="p-2 text-right font-mono">{totals.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
};
