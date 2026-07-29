/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0  (SEEF Phase 5)
 * Created      : 2026-07-26
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEEF Card — Surface Primitive
 *
 * The canonical card component for SMRITI Retail OS.
 * Resolves its visual style from SEEFContext (useSEEF().config.cardStyle).
 * Supports per-instance override via the `styleOverride` prop.
 *
 * Usage:
 *   <SEEFCard>…content…</SEEFCard>
 *   <SEEFCard styleOverride="glass" elevation={3}>…</SEEFCard>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { SEEFCardStyle } from "../../layout_engine/SEEFTypes.ts";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SEEFCardProps {
  children: React.ReactNode;
  /** Override the SEEF global card style for this instance only. */
  styleOverride?: SEEFCardStyle;
  /** Elevation level 0-5. Defaults to style-appropriate level. */
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Additional CSS class names */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
  /** Whether the card should appear interactive (hover effects) */
  interactive?: boolean;
  /** HTML element to render — defaults to div */
  as?: "div" | "section" | "article" | "aside";
  /** Accessible label */
  "aria-label"?: string;
  id?: string;
}

// ── Style resolver ─────────────────────────────────────────────────────────────

function resolveCardStyles(
  cardStyle: SEEFCardStyle,
  elevation?: number,
  interactive?: boolean
): React.CSSProperties {
  const elevationLevel = elevation ?? defaultElevationFor(cardStyle);
  const elevationVar = `var(--seef-elevation-${elevationLevel})`;

  const base: React.CSSProperties = {
    borderRadius: "var(--seef-card-radius)",
    transition:
      "box-shadow var(--seef-motion-normal) var(--seef-ease-standard), " +
      "background var(--seef-motion-normal) var(--seef-ease-standard), " +
      "transform var(--seef-motion-fast) var(--seef-ease-standard)",
  };

  if (interactive) {
    base.cursor = "pointer";
  }

  switch (cardStyle) {
    case "flat":
      return {
        ...base,
        background: "var(--c-theme-surface-1)",
        border: "1px solid var(--c-theme-divider)",
        boxShadow: "none",
      };
    case "elevated":
      return {
        ...base,
        background: "var(--seef-card-bg)",
        border: "var(--seef-card-border)",
        boxShadow: elevationVar,
      };
    case "glass":
      return {
        ...base,
        background: "rgba(255, 255, 255, 0.07)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow: elevationVar,
      };
    case "minimal":
      return {
        ...base,
        background: "transparent",
        border: "none",
        boxShadow: "none",
      };
    case "outlined":
      return {
        ...base,
        background: "transparent",
        border: "1px solid var(--c-theme-divider)",
        boxShadow: "none",
      };
    case "floating":
      return {
        ...base,
        background: "var(--seef-card-bg)",
        border: "var(--seef-card-border)",
        boxShadow: "var(--seef-elevation-4)",
      };
    default:
      return {
        ...base,
        background: "var(--seef-card-bg)",
        border: "var(--seef-card-border)",
        boxShadow: elevationVar,
      };
  }
}

function defaultElevationFor(style: SEEFCardStyle): number {
  const map: Record<SEEFCardStyle, number> = {
    flat: 0, elevated: 1, glass: 2, minimal: 0, outlined: 0, floating: 4,
  };
  return map[style] ?? 1;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const SEEFCard: React.FC<SEEFCardProps> = ({
  children,
  styleOverride,
  elevation,
  className = "",
  style = {},
  onClick,
  interactive,
  as: Tag = "div",
  "aria-label": ariaLabel,
  id,
}) => {
  const { config } = useSEEF();
  const activeStyle = styleOverride ?? config.cardStyle;
  const resolvedStyles = resolveCardStyles(activeStyle, elevation, interactive || !!onClick);

  return (
    <Tag
      id={id}
      className={`seef-card ${interactive || onClick ? "seef-interactive seef-focus-ring" : ""} ${className}`}
      style={{ ...resolvedStyles, ...style }}
      onClick={onClick}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      role={onClick ? "button" : undefined}
    >
      {children}
    </Tag>
  );
};

// ── KPI / Stat Card Variant ────────────────────────────────────────────────────

export interface SEEFKPICardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  styleOverride?: SEEFCardStyle;
  onClick?: () => void;
  id?: string;
}

export const SEEFKPICard: React.FC<SEEFKPICardProps> = ({
  label,
  value,
  trend,
  trendValue,
  icon,
  styleOverride,
  onClick,
  id,
}) => {
  const trendColor =
    trend === "up" ? "var(--c-seef-success)"
    : trend === "down" ? "var(--c-seef-error)"
    : "var(--c-theme-muted)";

  return (
    <SEEFCard
      id={id}
      styleOverride={styleOverride}
      interactive={!!onClick}
      onClick={onClick}
      style={{ padding: "var(--seef-space-lg)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            fontSize: "var(--seef-font-size-xs)",
            color: "var(--c-theme-muted)",
            marginBottom: "var(--seef-space-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 500,
          }}>
            {label}
          </div>
          <div style={{
            fontSize: "var(--seef-font-size-xl)",
            fontWeight: 700,
            color: "var(--c-theme-body)",
            fontFamily: "var(--font-display)",
            lineHeight: 1.1,
          }}>
            {value}
          </div>
          {trendValue && (
            <div style={{
              fontSize: "var(--seef-font-size-xs)",
              color: trendColor,
              marginTop: "var(--seef-space-xs)",
              fontWeight: 500,
            }}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            color: "var(--c-seef-accent)",
            opacity: 0.8,
            display: "flex",
            alignItems: "center",
          }}>
            {icon}
          </div>
        )}
      </div>
    </SEEFCard>
  );
};
