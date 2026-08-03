/**
 * SXP v1.0 — ActionCard Widget
 * SWEF: WidgetType "action_card" | Quick single-click operation tile
 */
import React from "react";

interface ActionCardProps {
  icon: string;
  title: string;
  description?: string;
  badge?: string | number;
  badgeVariant?: "info" | "warning" | "success" | "error";
  onClick(): void;
  disabled?: boolean;
}

const BADGE_COLORS = {
  info:    { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  warning: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
  success: { bg: "rgba(34,197,94,0.15)",  color: "#22c55e" },
  error:   { bg: "rgba(239,68,68,0.15)",  color: "#ef4444" },
};

const _ActionCardComponent: React.FC<ActionCardProps> = ({
  icon, title, description, badge, badgeVariant = "info", onClick, disabled,
}) => {
  const badgeStyle = BADGE_COLORS[badgeVariant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "var(--sxp-widget-padding, 20px)",
        borderRadius: "var(--sxp-widget-radius, 10px)",
        border: "1px solid var(--c-border, rgba(255,255,255,0.08))",
        background: disabled ? "transparent" : "var(--c-surface-elevated, rgba(255,255,255,0.04))",
        width: "100%",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all var(--sxp-motion-action, 150ms)",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-primary, #e2e8f0)" }}>{title}</span>
          {badge !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: badgeStyle.bg, color: badgeStyle.color, flexShrink: 0 }}>
              {badge}
            </span>
          )}
        </div>
        {description && (
          <span style={{ fontSize: 12, color: "var(--c-text-secondary, #94a3b8)", marginTop: 3, display: "block" }}>{description}</span>
        )}
      </div>
    </button>
  );
};

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const ActionCard = React.memo(_ActionCardComponent);
