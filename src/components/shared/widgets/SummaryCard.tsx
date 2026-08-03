/**
 * SXP v1.0 â€” SummaryCard Widget
 * SWEF: WidgetType "summary_card" | SXP-CS-002 (Zero ERP terminology)
 */
import React from "react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: string;
  accent?: boolean;
}

const _SummaryCardComponent: React.FC<SummaryCardProps> = ({
  title, value, unit, subtitle, icon, accent,
}) => (
  <div style={{
    padding: "var(--sxp-widget-padding, 20px)",
    borderRadius: "var(--sxp-widget-radius, 10px)",
    border: "1px solid var(--c-theme-divider)",
    background: accent ? "rgba(99,102,241,0.08)" : "var(--c-theme-surface-2)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 110,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, color: "var(--c-theme-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{title}</span>
      {icon && <span style={{ fontSize: 18, opacity: 0.7 }}>{icon}</span>}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: accent ? "var(--c-seef-accent)" : "var(--c-theme-body)", fontFamily: "var(--font-mono, monospace)" }}>
        {value}
      </span>
      {unit && <span style={{ fontSize: 13, color: "var(--c-theme-muted)" }}>{unit}</span>}
    </div>
    {subtitle && <div style={{ fontSize: 12, color: "var(--c-theme-muted)" }}>{subtitle}</div>}
  </div>
);

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const SummaryCard = React.memo(_SummaryCardComponent);
