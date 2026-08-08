/**
 * SMRITI Retail OS
 * Component  : WorkspaceLayoutSelector
 * Purpose    : Expose saved dashboard layout controls for adaptive workspace cards.
 */
import React from "react";
import { WorkspacePersonalizationEngine } from "../../layout_engine/WorkspacePersonalizationEngine.js";

interface WorkspaceLayoutSelectorProps {
  workspaceId: string;
  onReset?: () => void;
  widgets?: Array<{ id: string; title?: string; subtitle?: string }>;
}

export const WorkspaceLayoutSelector: React.FC<WorkspaceLayoutSelectorProps> = ({
  workspaceId,
  onReset,
  widgets = [],
}) => {
  const savedLayout = WorkspacePersonalizationEngine.getDashboardLayout(workspaceId);
  const hasCustomLayout = savedLayout.length > 0;
  const widgetMap = new Map(widgets.map((widget) => [widget.id, widget]));

  const getLayoutSeed = () =>
    widgets.map((widget, index) => ({
      widgetId: widget.id,
      colSpan: 4,
      rowSpan: 1,
      order: index,
      hidden: false,
    }));

  const currentLayout = savedLayout.length > 0 ? savedLayout : getLayoutSeed();

  const toggleVisibility = (widgetId: string) => {
    const nextLayout = currentLayout.map((entry) =>
      entry.widgetId === widgetId ? { ...entry, hidden: !entry.hidden } : entry
    );
    WorkspacePersonalizationEngine.saveDashboardLayout(workspaceId, nextLayout);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 12, color: "var(--smriti-color-text-secondary)" }}>
        {hasCustomLayout
          ? "Custom dashboard layout is active for this workspace."
          : "Using the default adaptive dashboard layout."}
      </div>
      <button
        type="button"
        disabled={!hasCustomLayout}
        onClick={() => {
          if (!hasCustomLayout) return;
          WorkspacePersonalizationEngine.clearDashboardLayout(workspaceId);
          onReset?.();
        }}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--smriti-color-border)",
          background: hasCustomLayout ? "var(--smriti-color-surface-muted)" : "transparent",
          color: hasCustomLayout ? "var(--smriti-color-text-primary)" : "var(--smriti-color-text-secondary)",
          cursor: hasCustomLayout ? "pointer" : "not-allowed",
          fontSize: 12,
        }}
      >
        Reset layout
      </button>
      {widgets.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {currentLayout.map((entry) => {
            const widget = widgetMap.get(entry.widgetId);
            if (!widget) return null;
            return (
              <button
                key={entry.widgetId}
                type="button"
                onClick={() => toggleVisibility(entry.widgetId)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--smriti-color-border)",
                  background: entry.hidden ? "var(--smriti-color-surface-muted)" : "var(--smriti-color-surface)",
                  color: entry.hidden ? "var(--smriti-color-text-secondary)" : "var(--smriti-color-text-primary)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                {entry.hidden ? `Show ${widget.title ?? entry.widgetId}` : `Hide ${widget.title ?? entry.widgetId}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
