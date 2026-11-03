import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Columns3, GripVertical, RotateCcw, Save } from "lucide-react";
import {
  BILLING_GRID_COLUMNS,
  BillingGridLayout,
  BillingGridView,
  normalizeBillingGridLayout,
} from "./billingGridPreferences.ts";

interface Props {
  view: BillingGridView;
  layout: BillingGridLayout;
  dirty?: boolean;
  saving?: boolean;
  onChange: (layout: BillingGridLayout) => void;
  onSave: () => void;
  onReset: () => void;
}

export function BillingGridColumnSettings({
  view,
  layout,
  dirty = false,
  saving = false,
  onChange,
  onSave,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const normalized = normalizeBillingGridLayout(layout);
  const viewLayout = normalized[view];
  const columns = BILLING_GRID_COLUMNS[view];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const updateLayout = (nextView: typeof viewLayout) => {
    onChange({ ...normalized, [view]: nextView });
  };

  const moveColumn = (key: string, offset: number) => {
    const index = viewLayout.order.indexOf(key);
    const nextIndex = index + offset;
    if (index < 0 || nextIndex < 0 || nextIndex >= viewLayout.order.length) return;
    const order = [...viewLayout.order];
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    updateLayout({ ...viewLayout, order });
  };

  const reorderColumn = (targetKey: string) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const order = viewLayout.order.filter(key => key !== draggedKey);
    const targetIndex = order.indexOf(targetKey);
    order.splice(targetIndex < 0 ? order.length : targetIndex, 0, draggedKey);
    updateLayout({ ...viewLayout, order });
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <span role="status" aria-live="polite" className={`hidden text-[10px] font-semibold sm:inline ${dirty ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
        {saving ? "Saving…" : dirty ? "Unsaved changes" : "Layout saved"}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Configure billing grid columns"
        onClick={() => setOpen(value => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <Columns3 size={14} /> Columns <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Grid layout</p>
              <p className="text-[10px] text-slate-500">Drag to reorder or use the arrow controls.</p>
            </div>
            <button type="button" onClick={onReset} disabled={saving} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {viewLayout.order.map((key, index) => {
              const column = columns.find(item => item.key === key);
              if (!column) return null;
              const checked = viewLayout.visible.includes(key);
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => setDraggedKey(key)}
                  onDragEnd={() => setDraggedKey(null)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault();
                    reorderColumn(key);
                    setDraggedKey(null);
                  }}
                  className={`flex h-8 items-center gap-1 rounded px-1 text-[11px] ${draggedKey === key ? "opacity-40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                >
                  <GripVertical size={13} className="shrink-0 cursor-grab text-slate-400" aria-hidden="true" />
                  <input
                    type="checkbox"
                    aria-label={`Show ${column.label} column`}
                    checked={checked}
                    disabled={column.required}
                    onChange={() => {
                      const visible = checked
                        ? viewLayout.visible.filter(item => item !== key)
                        : [...viewLayout.visible, key];
                      updateLayout({ ...viewLayout, visible });
                    }}
                    className="accent-blue-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{column.label}</span>
                  <button type="button" aria-label={`Move ${column.label} up`} disabled={index === 0} onClick={() => moveColumn(key, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700">
                    <ChevronUp size={13} />
                  </button>
                  <button type="button" aria-label={`Move ${column.label} down`} disabled={index === viewLayout.order.length - 1} onClick={() => moveColumn(key, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700">
                    <ChevronDown size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={13} /> {saving ? "Saving…" : "Save Layout"}
          </button>
        </div>
      )}
    </div>
  );
}
