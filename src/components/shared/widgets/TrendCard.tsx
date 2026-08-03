/**
 * SXP v1.0 — TrendCard Widget
 * SWEF: WidgetType "trend_card" | SXP-CS-002 (Zero ERP terminology)
 */
import React from "react";

interface TrendPoint { label: string; value: number; }

interface TrendCardProps {
  title: string;
  data: TrendPoint[];
  unit?: string;
  positive?: boolean;
  changeLabel?: string;
}

const _TrendCardComponent: React.FC<TrendCardProps> = ({
  title, data, unit, positive, changeLabel,
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{
      padding: "var(--sxp-widget-padding, 20px)",
      borderRadius: "var(--sxp-widget-radius, 10px)",
      border: "1px solid var(--c-border, rgba(255,255,255,0.08))",
      background: "var(--c-surface-elevated, rgba(255,255,255,0.04))",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{title}</span>
        {changeLabel && (
          <span style={{ fontSize: 11, fontWeight: 600, color: positive ? "#22c55e" : "#ef4444", padding: "2px 6px", borderRadius: 4, background: positive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
            {positive ? "▲" : "▼"} {changeLabel}
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48 }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.label}: ${d.value}${unit ?? ""}`} style={{
            flex: 1,
            height: `${Math.max((d.value / max) * 100, 4)}%`,
            borderRadius: "2px 2px 0 0",
            background: i === data.length - 1 ? "var(--c-brand, #818cf8)" : "rgba(129,140,248,0.35)",
            transition: "height var(--sxp-motion-action, 150ms)",
          }} />
        ))}
      </div>

      {/* Last value */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-text-muted, #64748b)" }}>
        <span>{data[0]?.label}</span>
        <span style={{ fontWeight: 600, color: "var(--c-text-primary, #e2e8f0)" }}>
          {data[data.length - 1]?.value}{unit}
        </span>
      </div>
    </div>
  );
};

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const TrendCard = React.memo(_TrendCardComponent);
