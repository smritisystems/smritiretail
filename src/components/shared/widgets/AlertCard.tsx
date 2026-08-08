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
  info:     { icon: "ℹ️", bg: "var(--smriti-widget-status-info-bg)",  border: "var(--smriti-widget-status-info-fg)",  color: "var(--smriti-widget-status-info-fg)" },
  warning:  { icon: "⚠️", bg: "var(--smriti-widget-status-warning-bg)",  border: "var(--smriti-widget-status-warning-fg)",  color: "var(--smriti-widget-status-warning-fg)" },
  critical: { icon: "🚨", bg: "var(--smriti-widget-status-danger-bg)",   border: "var(--smriti-widget-status-danger-fg)",   color: "var(--smriti-widget-status-danger-fg)" },
};

const _AlertCardComponent: React.FC<AlertCardProps> = ({ alerts, maxVisible = 5, onDismiss }) => {
  const visible = alerts.slice(0, maxVisible);

  if (visible.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: "var(--c-theme-muted)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>✅</span> No active alerts
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
                <button onClick={() => onDismiss(alert.id)} style={{ background: "none", border: "none", color: "var(--c-theme-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
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
