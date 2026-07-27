/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
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
 * SEEF Skeleton — Standardized Loading Placeholder
 *
 * Density-aware sizing from useSEEF().config.density.
 * Switches to a spinner when animationPolicy = "none" (accessibility).
 *
 * Usage:
 *   <SEEFSkeleton variant="text" lines={3} />
 *   <SEEFSkeleton variant="card" height={120} />
 *   <SEEFSkeleton variant="table" rows={8} columns={5} />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { useSEEF, useSEEFAnimation } from "../../layout_engine/SEEFContext.tsx";

// ── Skeleton base styles ───────────────────────────────────────────────────────

const shimmerKeyframe = `
@keyframes seef-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

if (typeof document !== "undefined" && !document.getElementById("seef-shimmer-style")) {
  const style = document.createElement("style");
  style.id = "seef-shimmer-style";
  style.textContent = shimmerKeyframe;
  document.head.appendChild(style);
}

// ── Shimmer block ──────────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  animated?: boolean;
}> = ({ width = "100%", height = 16, rounded = false, animated = true }) => (
  <div
    style={{
      width,
      height,
      borderRadius: rounded ? "9999px" : "var(--seef-radius-active-sm)",
      background: animated
        ? "linear-gradient(90deg, var(--c-theme-surface-hover) 25%, var(--c-theme-surface-2) 50%, var(--c-theme-surface-hover) 75%)"
        : "var(--c-theme-surface-hover)",
      backgroundSize: "200% 100%",
      animation: animated ? "seef-shimmer 1.4s ease-in-out infinite" : "none",
    }}
  />
);

// ── Spinner (reduced-motion alternative) ──────────────────────────────────────

const SEEFSpinner: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <div style={{
    width: size,
    height: size,
    border: `2px solid var(--c-theme-divider)`,
    borderTopColor: "var(--c-seef-accent)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SEEFSkeletonProps {
  /** Skeleton layout type */
  variant?: "text" | "card" | "table" | "kpi" | "list" | "spinner";
  /** For "text" — number of text lines */
  lines?: number;
  /** Height in px or CSS string */
  height?: number | string;
  /** Width in px or CSS string */
  width?: number | string;
  /** For "table" — number of rows */
  rows?: number;
  /** For "table" — number of columns */
  columns?: number;
  /** Additional CSS class */
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const SEEFSkeleton: React.FC<SEEFSkeletonProps> = ({
  variant = "text",
  lines = 3,
  height = 120,
  rows = 6,
  columns = 4,
  className = "",
  id,
}) => {
  const { config } = useSEEF();
  const animPolicy = useSEEFAnimation();
  const animated = animPolicy !== "none";

  const gap = config.density === "compact" ? 6 : config.density === "spacious" ? 12 : 8;
  const rowH = config.density === "compact" ? 28 : config.density === "spacious" ? 42 : 34;

  if (variant === "spinner" || !animated) {
    return (
      <div
        id={id}
        className={className}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}
      >
        <SEEFSpinner size={28} />
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div id={id} className={className} style={{ display: "flex", flexDirection: "column", gap }}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock
            key={i}
            height={14}
            width={i === lines - 1 ? "60%" : "100%"}
            animated={animated}
          />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        id={id}
        className={className}
        style={{
          borderRadius: "var(--seef-card-radius)",
          overflow: "hidden",
        }}
      >
        <SkeletonBlock height={height} animated={animated} />
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap }}>
          <SkeletonBlock height={14} width="60%" animated={animated} />
          <SkeletonBlock height={11} animated={animated} />
          <SkeletonBlock height={11} width="80%" animated={animated} />
        </div>
      </div>
    );
  }

  if (variant === "kpi") {
    return (
      <div id={id} className={className} style={{ display: "flex", flexDirection: "column", gap }}>
        <SkeletonBlock height={11} width="50%" animated={animated} />
        <SkeletonBlock height={28} width="70%" animated={animated} />
        <SkeletonBlock height={10} width="40%" animated={animated} />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div id={id} className={className} style={{ display: "flex", flexDirection: "column", gap }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SkeletonBlock width={32} height={32} rounded animated={animated} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              <SkeletonBlock height={13} width="70%" animated={animated} />
              <SkeletonBlock height={10} width="45%" animated={animated} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // variant === "table"
  return (
    <div id={id} className={className} style={{ overflow: "hidden" }}>
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: "8px",
        padding: "8px 0",
        borderBottom: "1px solid var(--c-theme-divider)",
        marginBottom: "4px",
      }}>
        {Array.from({ length: columns }).map((_, c) => (
          <SkeletonBlock key={c} height={12} width="60%" animated={animated} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "8px",
            padding: `${gap / 2}px 0`,
            borderBottom: "1px solid var(--c-theme-divider)",
            height: rowH,
            alignItems: "center",
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBlock key={c} height={13} width={c === 0 ? "80%" : "60%"} animated={animated} />
          ))}
        </div>
      ))}
    </div>
  );
};
