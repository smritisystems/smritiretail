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
}

export const WorkspaceLayoutSelector: React.FC<WorkspaceLayoutSelectorProps> = ({
  workspaceId,
  onReset,
}) => {
  const savedLayout = WorkspacePersonalizationEngine.getDashboardLayout(workspaceId);
  const hasCustomLayout = savedLayout.length > 0;

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
    </div>
  );
};
