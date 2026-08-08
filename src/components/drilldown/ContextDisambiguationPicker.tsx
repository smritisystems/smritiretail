/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Context Disambiguation Picker
 * Standard     : UCIF-004 (Renderer Rule — FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useEffect, useRef, useState } from "react";
import type { ResolvedContext } from "../../kernel/upr/context/InspectorSchema.js";
import { UCIFKernel } from "../../kernel/upr/context/UCIFKernel.js";
import { useDrillDown } from "./drilldown_store.js";

const ENTITY_ICONS: Record<string, string> = {
  customer: "👤",
  product: "📦",
  supplier: "🏭",
  invoice: "🧾",
  warehouse: "🏢",
  batch: "🗂️",
  serial: "🔢",
  salesperson: "🧑‍💼",
  payment: "💳",
  purchase_order: "📋",
  ledger: "📒",
};

interface ContextDisambiguationPickerProps {
  candidates: ResolvedContext[];
  onClose: () => void;
}

export const ContextDisambiguationPicker: React.FC<ContextDisambiguationPickerProps> = ({
  candidates,
  onClose,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { openPanel } = useDrillDown();
  const listRef = useRef<HTMLUListElement>(null);

  const handleSelect = (ctx: ResolvedContext) => {
    openPanel({ entityType: ctx.entityType, entityId: ctx.entityId, title: ctx.title, metadata: { variant: ctx.variant } });
    UCIFKernel.pin(ctx);
    onClose();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, candidates.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(candidates[selectedIdx]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedIdx, candidates]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl w-[340px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-theme-divider flex items-center gap-2">
          <span className="text-base">🔎</span>
          <div>
            <p className="text-xs font-semibold text-theme-primary">Multiple contexts detected</p>
            <p className="text-xs text-theme-muted">Which entity would you like to inspect?</p>
          </div>
        </div>

        {/* Candidates list */}
        <ul ref={listRef} className="py-1 max-h-64 overflow-y-auto" role="listbox">
          {candidates.map((ctx, idx) => (
            <li
              key={`${ctx.entityType}_${idx}`}
              role="option"
              aria-selected={idx === selectedIdx}
              className={`
                flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                ${idx === selectedIdx
                  ? "bg-theme-accent/10 border-l-2 border-theme-accent"
                  : "border-l-2 border-transparent hover:bg-theme-surface-2"
                }
              `}
              onClick={() => handleSelect(ctx)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <span className="text-lg w-6 flex-shrink-0">
                {ENTITY_ICONS[ctx.entityType] ?? "🔷"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-text truncate">
                  {ctx.entityType.charAt(0).toUpperCase() + ctx.entityType.slice(1)}
                  {ctx.title && ctx.title !== ctx.entityType ? `: ${ctx.title}` : ""}
                </p>
                {ctx.entityId && (
                  <p className="text-xs text-theme-muted truncate">{ctx.entityId}</p>
                )}
              </div>
              <span className="text-xs text-theme-muted flex-shrink-0">
                {ctx.confidence}%
              </span>
            </li>
          ))}
        </ul>

        {/* Footer keyboard hint */}
        <div className="px-4 py-2 border-t border-theme-divider bg-theme-surface-2 flex gap-4 text-xs text-theme-muted">
          <span><kbd className="px-1 bg-theme-surface-1 border border-theme-divider rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 bg-theme-surface-1 border border-theme-divider rounded">Enter</kbd> Select</span>
          <span><kbd className="px-1 bg-theme-surface-1 border border-theme-divider rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
