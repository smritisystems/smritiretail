/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Hover Preview Card (Preview Variant)
 * Standard     : UCIF-004 (Renderer Rule — FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Lightweight popover shown on hover (500ms).
 * Uses same InspectorRegistry + InspectorDataProvider as the full panel.
 * Only renders "preview" variant — 3-5 fields max.
 */

import React, { useEffect, useRef, useState } from "react";
import type { ResolvedContext, InspectorConfig } from "../../kernel/upr/context/InspectorSchema.js";
import { InspectorRegistry } from "../../kernel/upr/context/InspectorRegistry.js";
import { InspectorDataService } from "../../kernel/upr/context/InspectorDataProvider.js";
import { useDrillDown } from "./drilldown_store.js";

interface HoverPreviewCardProps {
  context: ResolvedContext;
  anchor: DOMRect;
  onClose: () => void;
}

const FORMAT_MAP: Record<string, (v: any) => string> = {
  currency: (v) => v != null ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v)) : "—",
  date: (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
  phone: (v) => v ? String(v) : "—",
  badge: (v) => v ? String(v) : "—",
  text: (v) => v != null ? String(v) : "—",
};

const formatValue = (value: any, format?: string) => {
  const fn = FORMAT_MAP[format ?? "text"] ?? FORMAT_MAP.text;
  return fn(value);
};

export const HoverPreviewCard: React.FC<HoverPreviewCardProps> = ({ context, anchor, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const { openPanel } = useDrillDown();

  const config: InspectorConfig | undefined = InspectorRegistry.resolveConfig(context.entityType, "preview");

  // Compute position — appear below the anchor, or above if clipped
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(anchor.left, window.innerWidth - 280),
    top: anchor.bottom + 8,
    zIndex: 9999,
    width: 260,
  };

  useEffect(() => {
    if (!context.entityId || !config) { setLoading(false); return; }
    InspectorDataService.fetch(
      context.entityType,
      context.entityId,
      (sectionKey, sectionData) => {
        setData((prev) => ({ ...prev, ...sectionData }));
        setLoading(false);
      }
    );
  }, [context.entityType, context.entityId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleOpenInspector = () => {
    openPanel({ entityType: context.entityType, entityId: context.entityId, title: context.title, metadata: { variant: "compact" } });
    onClose();
  };

  if (!config) return null;

  const allFields = config.sections.flatMap((s) => s.fields).slice(0, 5);
  const titleValue = data[config.titleField] ?? context.title ?? context.entityId;
  const subtitleValue = config.subtitleField ? data[config.subtitleField] : undefined;
  const badgeValue = config.badgeField ? data[config.badgeField] : undefined;

  return (
    <div
      ref={cardRef}
      style={style}
      className="bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-theme-divider bg-theme-surface-2 flex items-start gap-2">
        {config.showImage && data[config.imageField ?? "image_url"] && (
          <img
            src={data[config.imageField ?? "image_url"]}
            alt={titleValue}
            className="w-8 h-8 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-theme-text truncate">{titleValue}</p>
          {subtitleValue && (
            <p className="text-xs text-theme-muted truncate">{subtitleValue}</p>
          )}
        </div>
        {badgeValue && (
          <span className="px-1.5 py-0.5 text-xs bg-theme-accent/15 text-theme-accent rounded-full flex-shrink-0">
            {badgeValue}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="px-3 py-2 space-y-1.5">
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-theme-surface-2 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          allFields.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-theme-muted truncate">{field.label}</span>
              <span className={`text-xs font-medium truncate ${field.highlight ? "text-theme-primary" : "text-theme-text"}`}>
                {formatValue(data[field.key], field.format)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Action */}
      <div className="px-3 py-2 border-t border-theme-divider">
        <button
          onClick={handleOpenInspector}
          className="w-full text-xs text-theme-accent hover:text-theme-accent/80 flex items-center justify-center gap-1 py-1 transition-colors"
        >
          <span>Full Inspector</span>
          <span className="text-theme-muted">F2</span>
        </button>
      </div>
    </div>
  );
};
