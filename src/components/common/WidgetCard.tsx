/**
 * SMRITI Retail OS
 * Component  : WidgetCard
 * Purpose    : Reusable widget shell for adaptive dashboard cards and mobile stacks.
 */
import React from "react";
import { DashboardWidget } from "../../kernel/upr/dashboard/DashboardRegistry.js";

interface WidgetCardProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  children,
  toolbar,
  className = "",
  style,
}) => (
  <article
    className={`adaptive-widget-card ${className}`}
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: "var(--sxp-widget-padding, 20px)",
      borderRadius: "var(--sxp-widget-radius, 10px)",
      border: "1px solid var(--c-theme-divider)",
      background: "var(--c-theme-surface-2)",
      color: "var(--c-theme-body)",
      minHeight: 120,
      ...style,
    }}
    aria-labelledby={`${widget.id}-title`}
    data-widget-id={widget.id}
  >
    <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h2
          id={`${widget.id}-title`}
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--c-theme-body)",
          }}
        >
          {widget.title}
        </h2>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--c-theme-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {widget.type.replace("_", " ")}
        </div>
      </div>
      {toolbar && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {toolbar}
        </div>
      )}
    </header>

    <div style={{ flex: 1, minHeight: 56 }}>{children}</div>
  </article>
);
