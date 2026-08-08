/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — EmptyState
 * Standard     : Sprint 3 UX Polish / Fiori Plain Language
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * RULE (from user review): Every empty screen must suggest the next action.
 * "Nothing here yet" + CTA, not just "No Data".
 *
 * Variants:
 *   no-data    — blank list / table (most common)
 *   no-results — search returned 0 hits
 *   offline    — no connectivity
 *   error      — unexpected API failure
 *   restricted — user lacks permission
 */

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────

export type EmptyStateVariant =
  | "no-data"
  | "no-results"
  | "offline"
  | "error"
  | "restricted";

export interface EmptyStateCTA {
  label: string;
  onClick(): void;
  icon?: string;
}

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /** Override default icon */
  icon?: string;
  /** Override default headline */
  headline?: string;
  /** Override default description */
  description?: string;
  /** Primary CTA — always suggests the next action */
  cta?: EmptyStateCTA;
  /** Secondary CTA (e.g. "Import" alongside "Receive Stock") */
  secondaryCta?: EmptyStateCTA;
  compact?: boolean;
  style?: React.CSSProperties;
}

// ── Variant defaults — plain Fiori language ────────────────────────────────

const VARIANT_DEFAULTS: Record<
  EmptyStateVariant,
  { icon: string; headline: string; description: string }
> = {
  "no-data": {
    icon: "📭",
    headline: "Nothing here yet",
    description: "Get started by adding your first record.",
  },
  "no-results": {
    icon: "🔍",
    headline: "No results found",
    description: "Try adjusting your search or filters.",
  },
  "offline": {
    icon: "📡",
    headline: "Working offline",
    description: "Your changes are saved and will sync when connectivity returns.",
  },
  "error": {
    icon: "⚠️",
    headline: "Something went wrong",
    description: "We couldn't load this data. Try again or contact support if the problem continues.",
  },
  "restricted": {
    icon: "🔒",
    headline: "Access restricted",
    description: "You don't have permission to view this. Contact your administrator.",
  },
};

// ── Component ─────────────────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = "no-data",
  icon,
  headline,
  description,
  cta,
  secondaryCta,
  compact = false,
  style,
}) => {
  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedIcon        = icon        ?? defaults.icon;
  const resolvedHeadline    = headline    ?? defaults.headline;
  const resolvedDescription = description ?? defaults.description;

  const padding    = compact ? "var(--sxp-space-6, 24px)" : "var(--sxp-space-12, 48px) var(--sxp-space-6, 24px)";
  const iconSize   = compact ? 32 : 48;
  const headingSize = compact ? "var(--sxp-text-base, 14px)" : "var(--sxp-text-lg, 16px)";

  return (
    <div
      role="status"
      aria-label={resolvedHeadline}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding,
        gap: "var(--sxp-space-3, 12px)",
        ...style,
      }}
    >
      {/* Icon */}
      <div
        aria-hidden="true"
        style={{
          fontSize: iconSize,
          lineHeight: 1,
          marginBottom: compact ? 0 : "var(--sxp-space-2, 8px)",
          filter: variant === "offline" ? "grayscale(0.4)" : "none",
        }}
      >
        {resolvedIcon}
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: headingSize,
          fontWeight: "var(--sxp-weight-semibold, 600)" as React.CSSProperties["fontWeight"],
          color: "var(--sxp-text-primary, #e2e8f0)",
          lineHeight: "var(--sxp-leading-tight, 1.25)",
        }}
      >
        {resolvedHeadline}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: "var(--sxp-text-sm, 13px)",
          color: "var(--sxp-text-secondary, #94a3b8)",
          lineHeight: "var(--sxp-leading-normal, 1.5)",
          maxWidth: 360,
        }}
      >
        {resolvedDescription}
      </div>

      {/* CTAs — always suggest next action */}
      {(cta || secondaryCta) && (
        <div
          style={{
            display: "flex",
            gap: "var(--sxp-space-3, 12px)",
            marginTop: "var(--sxp-space-2, 8px)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {cta && (
            <button
              id={`empty-state-cta-${variant}`}
              onClick={cta.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sxp-space-2, 8px)",
                padding: "var(--sxp-space-2, 8px) var(--sxp-space-5, 20px)",
                borderRadius: "var(--sxp-radius-md, 8px)",
                border: "none",
                background: "var(--sxp-brand, #818cf8)",
                color: "#fff",
                fontSize: "var(--sxp-text-sm, 13px)",
                fontWeight: "var(--sxp-weight-semibold, 600)" as React.CSSProperties["fontWeight"],
                cursor: "pointer",
                transition: "var(--sxp-transition-fast)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sxp-brand-hover, #6d7ae8)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sxp-brand, #818cf8)"; }}
            >
              {cta.icon && <span aria-hidden="true">{cta.icon}</span>}
              {cta.label}
            </button>
          )}
          {secondaryCta && (
            <button
              id={`empty-state-secondary-${variant}`}
              onClick={secondaryCta.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sxp-space-2, 8px)",
                padding: "var(--sxp-space-2, 8px) var(--sxp-space-5, 20px)",
                borderRadius: "var(--sxp-radius-md, 8px)",
                border: "1px solid var(--sxp-border-strong, rgba(255,255,255,0.15))",
                background: "transparent",
                color: "var(--sxp-text-secondary, #94a3b8)",
                fontSize: "var(--sxp-text-sm, 13px)",
                fontWeight: "var(--sxp-weight-medium, 500)" as React.CSSProperties["fontWeight"],
                cursor: "pointer",
                transition: "var(--sxp-transition-fast)",
              }}
            >
              {secondaryCta.icon && <span aria-hidden="true">{secondaryCta.icon}</span>}
              {secondaryCta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Domain-specific presets (plain language, next-action CTAs) ────────────

/** "Nothing here yet — Receive Stock" */
export const EmptyInventory: React.FC<{ onReceive(): void; onImport?(): void }> = ({ onReceive, onImport }) => (
  <EmptyState
    variant="no-data"
    icon="📦"
    headline="Nothing here yet"
    description="Your stock list is empty. Start by receiving goods from a supplier."
    cta={{ label: "Receive Stock", icon: "📥", onClick: onReceive }}
    secondaryCta={onImport ? { label: "Import Products", icon: "📋", onClick: onImport } : undefined}
  />
);

/** "No bills yet — Start a New Bill" */
export const EmptyPOS: React.FC<{ onNewBill(): void }> = ({ onNewBill }) => (
  <EmptyState
    variant="no-data"
    icon="🧾"
    headline="No bills yet"
    description="Scan a product or search to start a new bill."
    cta={{ label: "New Bill", icon: "➕", onClick: onNewBill }}
  />
);

/** "No orders yet — Raise an Order" */
export const EmptyOrders: React.FC<{ onNewOrder(): void; domain: "sales" | "purchase" }> = ({ onNewOrder, domain }) => (
  <EmptyState
    variant="no-data"
    icon={domain === "sales" ? "🛒" : "📋"}
    headline="No orders yet"
    description={domain === "sales"
      ? "Create your first sales order to get started."
      : "Raise a purchase order to begin procurement."}
    cta={{
      label: domain === "sales" ? "New Order" : "Raise Order",
      icon: "➕",
      onClick: onNewOrder,
    }}
  />
);

/** "No results — adjust your search" */
export const EmptySearchResults: React.FC<{ query: string; onClear(): void }> = ({ query, onClear }) => (
  <EmptyState
    variant="no-results"
    headline={`No results for "${query}"`}
    description="Try different keywords, or clear your filters to see everything."
    cta={{ label: "Clear Search", icon: "✕", onClick: onClear }}
    compact
  />
);

/** "Working offline" */
export const OfflineBanner: React.FC<{ pendingCount?: number }> = ({ pendingCount = 0 }) => (
  <EmptyState
    variant="offline"
    headline="Working offline"
    description={pendingCount > 0
      ? `${pendingCount} action${pendingCount !== 1 ? "s" : ""} queued — will sync when connection returns.`
      : "Your work is saved locally and will sync when connection returns."}
    compact
  />
);
