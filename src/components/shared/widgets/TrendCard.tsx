/**
 * SXP v1.0 â€” TrendCard Widget
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
      border: "1px solid var(--smriti-color-border)",
      background: "var(--smriti-color-surface)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--smriti-color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{title}</span>
        {changeLabel && (
          <span style={{ fontSize: 11, fontWeight: 600, color: positive ? "var(--smriti-color-success)" : "var(--smriti-color-danger)", padding: "2px 6px", borderRadius: 4, background: positive ? "var(--smriti-color-success-muted)" : "var(--smriti-color-danger-muted)" }}>
            {positive ? "â–²" : "â–¼"} {changeLabel}
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
            background: i === data.length - 1 ? "var(--smriti-color-accent)" : "var(--smriti-color-neutral-muted)",
            transition: "height var(--sxp-motion-action, 150ms)",
          }} />
        ))}
      </div>

      {/* Last value */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--smriti-color-text-secondary)" }}>
        <span>{data[0]?.label}</span>
        <span style={{ fontWeight: 600, color: "var(--smriti-color-text-primary)" }}>
          {data[data.length - 1]?.value}{unit}
        </span>
      </div>
    </div>
  );
};

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const TrendCard = React.memo(_TrendCardComponent);
