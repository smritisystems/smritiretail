/**
 * SXP v1.0 â€” AlertCard Widget
 * SWEF: WidgetType "alert_card" | SXP-CS-007 (No stock-out surprises)
 */
import React from "react";

export type AlertSeverity = "info" | "warning" | "critical";

interface Alert {
  id: string;
  severity: AlertSeverity;
  /** Plain language â€” "Stock Below Reorder Point" not "ITEX_REORDER_THRESHOLD_BREACH" */
  title: string;
  description?: string;
  /** ISO timestamp */
  raisedAt?: string;
  actionLabel?: string;
  onAction?(): void;
}

interface AlertCardProps {
  alerts: Alert[];
  maxVisible?: number;
  onDismiss?(alertId: string): void;
}

const SEVERITY_STYLES: Record<AlertSeverity, { icon: string; bg: string; border: string; color: string }> = {
  info:     { icon: "â„¹ï¸", bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.25)",  color: "#818cf8" },
  warning:  { icon: "âš ï¸", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  color: "#f59e0b" },
  critical: { icon: "ðŸš¨", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.30)",   color: "#ef4444" },
};

const _AlertCardComponent: React.FC<AlertCardProps> = ({ alerts, maxVisible = 5, onDismiss }) => {
  const visible = alerts.slice(0, maxVisible);

  if (visible.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: "var(--c-theme-muted)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>âœ…</span> No active alerts
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {visible.map((alert) => {
        const s = SEVERITY_STYLES[alert.severity];
        return (
          <div key={alert.id} style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: `1px solid ${s.border}`,
            background: s.bg,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{alert.title}</div>
              {alert.description && (
                <div style={{ fontSize: 12, color: "var(--c-theme-muted)", marginTop: 2 }}>{alert.description}</div>
              )}
              {alert.raisedAt && (
                <div style={{ fontSize: 11, color: "var(--c-theme-muted)", marginTop: 4 }}>
                  {new Date(alert.raisedAt).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              {alert.actionLabel && alert.onAction && (
                <button onClick={alert.onAction} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: `1px solid ${s.border}`, background: "transparent", color: s.color, cursor: "pointer" }}>
                  {alert.actionLabel}
                </button>
              )}
              {onDismiss && (
                <button onClick={() => onDismiss(alert.id)} style={{ background: "none", border: "none", color: "var(--c-theme-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>Ã—</button>
              )}
            </div>
          </div>
        );
      })}
      {alerts.length > maxVisible && (
        <div style={{ fontSize: 12, color: "var(--c-theme-muted)", textAlign: "center", paddingTop: 4 }}>
          +{alerts.length - maxVisible} more alerts
        </div>
      )}
    </div>
  );
};

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const AlertCard = React.memo(_AlertCardComponent);
