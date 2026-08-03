/**
 * SXP v1.0 — KPIProgressCard Widget
 * SWEF: WidgetType "progress_card" | Shows goal vs actual with fill bar
 */
import React from "react";

interface KPIProgressCardProps {
  title: string;
  current: number;
  target: number;
  unit?: string;
  /** "high_is_good" (stock fill) or "low_is_good" (shrinkage, reorder days) */
  direction?: "high_is_good" | "low_is_good";
  icon?: string;
}

const _KPIProgressCardComponent: React.FC<KPIProgressCardProps> = ({
  title, current, target, unit, direction = "high_is_good", icon,
}) => {
  const pct = Math.min(Math.round((current / Math.max(target, 1)) * 100), 100);
  const goodPct = direction === "high_is_good" ? pct : 100 - pct;
  const barColor = goodPct >= 70 ? "#22c55e" : goodPct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{
      padding: "var(--sxp-widget-padding, 20px)",
      borderRadius: "var(--sxp-widget-radius, 10px)",
      border: "1px solid var(--c-border, rgba(255,255,255,0.08))",
      background: "var(--c-surface-elevated, rgba(255,255,255,0.04))",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{title}</span>
        {icon && <span style={{ fontSize: 18, opacity: 0.7 }}>{icon}</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: barColor, fontFamily: "var(--font-mono, monospace)" }}>
          {current}{unit}
        </span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted, #64748b)" }}>
          of {target}{unit}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 3,
          background: barColor,
          transition: "width var(--sxp-motion-action, 150ms)",
        }} />
      </div>

      <div style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)", display: "flex", justifyContent: "space-between" }}>
        <span>{pct}% achieved</span>
        <span style={{ color: barColor }}>{goodPct >= 70 ? "On Track" : goodPct >= 40 ? "Needs Attention" : "At Risk"}</span>
      </div>
    </div>
  );
};

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const KPIProgressCard = React.memo(_KPIProgressCardComponent);
