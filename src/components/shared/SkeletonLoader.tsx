/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — SkeletonLoader
 * Standard     : Sprint 3 UX Polish / sxp-tokens.css + motion-tokens.css
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Theme-aware shimmer skeletons — never grey, always surface tokens.
 * Respects prefers-reduced-motion (duration collapses to 0 via CSS).
 *
 * Components:
 *   SkeletonCard       — replaces loading KPI / summary cards
 *   SkeletonRow        — replaces loading table / list rows
 *   SkeletonTimeline   — replaces loading timeline events
 *   SkeletonDashboard  — full dashboard loading layout (2×2 cards + list)
 */

import React from "react";

// ── Base shimmer element ───────────────────────────────────────────────────

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  style?: React.CSSProperties;
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 14,
  radius = "var(--sxp-radius-sm, 4px)",
  style,
  className,
}) => (
  <div
    className={`sxp-skeleton${className ? ` ${className}` : ""}`}
    aria-hidden="true"
    style={{
      width,
      height,
      borderRadius: radius,
      ...style,
    }}
  />
);

// ── SkeletonCard — KPI / SummaryCard replacement ──────────────────────────

export interface SkeletonCardProps {
  /** Show an icon placeholder at top-left */
  withIcon?: boolean;
  /** Show a trend line at bottom */
  withTrend?: boolean;
  style?: React.CSSProperties;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  withIcon = true,
  withTrend = false,
  style,
}) => (
  <div
    role="status"
    aria-label="Loading card"
    style={{
      background: "var(--sxp-surface-2, #1F2430)",
      border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
      borderRadius: "var(--sxp-radius-lg, 12px)",
      padding: "var(--sxp-space-5, 20px)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sxp-space-3, 12px)",
      ...style,
    }}
  >
    {withIcon && (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SkeletonBlock width={32} height={32} radius="var(--sxp-radius-md, 8px)" />
        <SkeletonBlock width="45%" height={12} />
      </div>
    )}
    <SkeletonBlock width="65%" height={28} />
    <SkeletonBlock width="40%" height={11} />
    {withTrend && (
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {[40, 55, 45, 70, 60, 80, 65].map((h, i) => (
          <SkeletonBlock key={i} width={8} height={h * 0.3} style={{ alignSelf: "flex-end" }} />
        ))}
      </div>
    )}
    <span className="sxp-sr-only">Loading…</span>
  </div>
);

// ── SkeletonRow — table / list row replacement ─────────────────────────────

export interface SkeletonRowProps {
  /** Number of column blocks to render */
  cols?: number;
  /** Show leading avatar/icon */
  withAvatar?: boolean;
  style?: React.CSSProperties;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({
  cols = 4,
  withAvatar = false,
  style,
}) => (
  <div
    role="status"
    aria-label="Loading row"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--sxp-space-4, 16px)",
      padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
      borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
      ...style,
    }}
  >
    {withAvatar && (
      <SkeletonBlock width={36} height={36} radius="var(--sxp-radius-full, 9999px)" style={{ flexShrink: 0 }} />
    )}
    {Array.from({ length: cols }).map((_, i) => (
      <SkeletonBlock key={i} height={12} style={{ flex: i === 0 ? 2 : 1 }} />
    ))}
    <span className="sxp-sr-only">Loading…</span>
  </div>
);

// ── SkeletonTimeline — timeline event list replacement ─────────────────────

export interface SkeletonTimelineProps {
  /** Number of events to render */
  events?: number;
  style?: React.CSSProperties;
}

export const SkeletonTimeline: React.FC<SkeletonTimelineProps> = ({
  events = 4,
  style,
}) => (
  <div
    role="status"
    aria-label="Loading timeline"
    style={{ display: "flex", flexDirection: "column", gap: 0, ...style }}
  >
    {Array.from({ length: events }).map((_, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          gap: "var(--sxp-space-4, 16px)",
          padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
          position: "relative",
        }}
      >
        {/* Timeline dot + connector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <SkeletonBlock width={10} height={10} radius="var(--sxp-radius-full)" style={{ flexShrink: 0 }} />
          {i < events - 1 && (
            <div style={{ width: 1, flex: 1, minHeight: 24, background: "var(--sxp-border, rgba(255,255,255,0.08))", marginTop: 4 }} />
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, paddingBottom: i < events - 1 ? 12 : 0 }}>
          <SkeletonBlock width="55%" height={12} />
          <SkeletonBlock width="35%" height={10} />
        </div>
      </div>
    ))}
    <span className="sxp-sr-only">Loading…</span>
  </div>
);

// ── SkeletonDashboard — full dashboard layout placeholder ──────────────────

export interface SkeletonDashboardProps {
  /** Number of KPI cards in top row */
  kpiCount?: number;
  /** Number of list rows */
  listRows?: number;
}

export const SkeletonDashboard: React.FC<SkeletonDashboardProps> = ({
  kpiCount = 4,
  listRows = 5,
}) => (
  <div
    role="status"
    aria-label="Loading dashboard"
    style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-6, 24px)", padding: "var(--sxp-space-6, 24px)" }}
  >
    {/* KPI row */}
    <div className="sxp-grid">
      {Array.from({ length: kpiCount }).map((_, i) => (
        <SkeletonCard key={i} withIcon withTrend={i === 0} />
      ))}
    </div>

    {/* List section */}
    <div
      style={{
        background: "var(--sxp-surface-2, #1F2430)",
        border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
        borderRadius: "var(--sxp-radius-lg, 12px)",
        overflow: "hidden",
      }}
    >
      {/* Table header */}
      <div style={{ padding: "var(--sxp-space-4, 16px)", borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))" }}>
        <SkeletonBlock width="30%" height={14} />
      </div>
      {Array.from({ length: listRows }).map((_, i) => (
        <SkeletonRow key={i} cols={4} withAvatar={i === 0} />
      ))}
    </div>
    <span className="sxp-sr-only">Loading…</span>
  </div>
);
