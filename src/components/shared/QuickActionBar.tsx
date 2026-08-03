/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — QuickActionBar
 * Standard     : Sprint 3 UX Polish / SXP Constitution v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * WNG-003 compliant: top toolbar region only, never a second sidebar.
 * WNG-004 compliant: actions rendered from manifest data, not hardcoded.
 *
 * Universal action bar shared by ALL studios:
 *   Inventory, Sales, Purchase, POS, CRM, Accounting
 *
 * Standard slots (in order):
 *   Primary CTA  — "+ New" / "Receive Stock" / "New Bill"
 *   Scan         — opens scanner_action mode
 *   Search       — opens CommandPalette (Ctrl+K)
 *   Filter       — opens filter drawer
 *   Export       — exports current view
 *   More         — overflow menu for secondary actions
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  /** visual variant */
  variant?: "primary" | "secondary" | "ghost";
  onClick(): void;
  /** show only in these modes */
  visibleIn?: Array<"SIMPLE" | "HYBRID" | "ADVANCED">;
}

export interface QuickActionBarProps {
  /** Domain label shown at left — plain language */
  domainLabel?: string;
  /** Primary action (always visible, leftmost, filled button) */
  primaryAction?: QuickAction;
  /** Scan action — always renders as icon-only button */
  onScan?(): void;
  /** Secondary actions shown inline up to maxInline, rest in overflow */
  actions?: QuickAction[];
  /** Max secondary actions to show inline before overflow. Default 3 */
  maxInline?: number;
  /** Current adaptive mode */
  mode?: "SIMPLE" | "HYBRID" | "ADVANCED";
  workspaceId?: string;
  style?: React.CSSProperties;
}

// ── Styles ────────────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sxp-space-2, 8px)",
  padding: "var(--sxp-space-2, 8px) var(--sxp-space-4, 16px)",
  background: "var(--sxp-surface-2, #1F2430)",
  borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
  minHeight: 52,
  flexShrink: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sxp-space-2, 8px)",
  padding: "var(--sxp-space-2, 8px) var(--sxp-space-4, 16px)",
  borderRadius: "var(--sxp-radius-md, 8px)",
  border: "none",
  background: "var(--sxp-brand, #818cf8)",
  color: "#fff",
  fontSize: "var(--sxp-text-sm, 13px)",
  fontWeight: 600,
  cursor: "pointer",
  transition: "var(--sxp-transition-fast, all 100ms ease-out)",
  whiteSpace: "nowrap",
};

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: "var(--sxp-radius-md, 8px)",
  border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
  background: "transparent",
  color: "var(--sxp-text-secondary, #94a3b8)",
  fontSize: 16,
  cursor: "pointer",
  transition: "var(--sxp-transition-fast, all 100ms ease-out)",
};

const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sxp-space-2, 8px)",
  padding: "var(--sxp-space-2, 8px) var(--sxp-space-3, 12px)",
  borderRadius: "var(--sxp-radius-md, 8px)",
  border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
  background: "transparent",
  color: "var(--sxp-text-secondary, #94a3b8)",
  fontSize: "var(--sxp-text-sm, 13px)",
  fontWeight: 500,
  cursor: "pointer",
  transition: "var(--sxp-transition-fast, all 100ms ease-out)",
  whiteSpace: "nowrap",
};

// ── Overflow menu ─────────────────────────────────────────────────────────

interface OverflowMenuProps {
  actions: QuickAction[];
  onClose(): void;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({ actions, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="More actions"
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
        background: "var(--sxp-surface-3, #2B3242)",
        border: "1px solid var(--sxp-border-strong, rgba(255,255,255,0.15))",
        borderRadius: "var(--sxp-radius-lg, 12px)",
        boxShadow: "var(--sxp-shadow-lg, 0 12px 32px rgba(0,0,0,0.5))",
        minWidth: 180,
        padding: "var(--sxp-space-1, 4px)",
        zIndex: "var(--sxp-z-dropdown, 1000)" as unknown as number,
        animation: "sxp-scale-in var(--sxp-motion-fast, 100ms) var(--sxp-ease-spring, cubic-bezier(0.34,1.56,0.64,1)) both",
      }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          role="menuitem"
          id={`quick-action-overflow-${action.id}`}
          onClick={() => { action.onClick(); onClose(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sxp-space-3, 12px)",
            width: "100%",
            padding: "var(--sxp-space-2, 8px) var(--sxp-space-3, 12px)",
            background: "none",
            border: "none",
            borderRadius: "var(--sxp-radius-md, 8px)",
            color: "var(--sxp-text-secondary, #94a3b8)",
            fontSize: "var(--sxp-text-sm, 13px)",
            cursor: "pointer",
            textAlign: "left",
            transition: "var(--sxp-transition-fast, all 100ms ease-out)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sxp-surface-hover, #252D3D)";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-primary, #e2e8f0)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "none";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-secondary, #94a3b8)";
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>{action.icon}</span>
          <span style={{ flex: 1 }}>{action.label}</span>
          {action.shortcut && (
            <kbd style={{ fontSize: 10, color: "var(--sxp-text-muted, #64748b)", fontFamily: "var(--sxp-font-mono)" }}>
              {action.shortcut}
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
};

// ── QuickActionBar ─────────────────────────────────────────────────────────

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  domainLabel,
  primaryAction,
  onScan,
  actions = [],
  maxInline = 3,
  mode = "SIMPLE",
  workspaceId = "global",
  style,
}) => {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Filter by adaptive mode
  const visibleActions = actions.filter(
    (a) => !a.visibleIn || a.visibleIn.includes(mode)
  );
  const inlineActions  = visibleActions.slice(0, maxInline);
  const overflowActions = visibleActions.slice(maxInline);

  const openCommandPalette = useCallback(() => {
    WorkspaceEventBus.publish("CommandPaletteOpened", {}, workspaceId);
  }, [workspaceId]);

  return (
    <div
      role="toolbar"
      aria-label={domainLabel ? `${domainLabel} actions` : "Quick actions"}
      style={{ ...barStyle, ...style }}
    >
      {/* Domain label */}
      {domainLabel && (
        <span
          style={{
            fontSize: "var(--sxp-text-sm, 13px)",
            fontWeight: 600,
            color: "var(--sxp-text-muted, #64748b)",
            marginRight: "var(--sxp-space-2, 8px)",
            whiteSpace: "nowrap",
          }}
        >
          {domainLabel}
        </span>
      )}

      {/* Primary CTA */}
      {primaryAction && (
        <button
          id={`quick-action-primary-${primaryAction.id}`}
          onClick={primaryAction.onClick}
          aria-label={primaryAction.label}
          style={primaryBtnStyle}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sxp-brand-hover, #6d7ae8)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sxp-brand, #818cf8)"; }}
        >
          <span aria-hidden="true">{primaryAction.icon}</span>
          {primaryAction.label}
          {primaryAction.shortcut && (
            <kbd style={{ fontSize: 10, opacity: 0.7, fontFamily: "var(--sxp-font-mono)" }}>
              {primaryAction.shortcut}
            </kbd>
          )}
        </button>
      )}

      {/* Scan — always icon-only, scanner zone trigger */}
      {onScan && (
        <button
          id="quick-action-scan"
          onClick={onScan}
          aria-label="Scan item"
          title="Scan item (F9)"
          style={iconBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sxp-surface-hover, #252D3D)";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-primary, #e2e8f0)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-secondary, #94a3b8)";
          }}
        >
          <span aria-hidden="true">📷</span>
        </button>
      )}

      {/* Inline secondary actions */}
      {inlineActions.map((action) => (
        <button
          key={action.id}
          id={`quick-action-${action.id}`}
          onClick={action.onClick}
          aria-label={action.label}
          title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
          style={secondaryBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sxp-surface-hover, #252D3D)";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-primary, #e2e8f0)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-secondary, #94a3b8)";
          }}
        >
          <span aria-hidden="true">{action.icon}</span>
          <span className="sxp-hide-xs">{action.label}</span>
        </button>
      ))}

      {/* Search — Ctrl+K trigger */}
      <button
        id="quick-action-search"
        onClick={openCommandPalette}
        aria-label="Search (Ctrl+K)"
        title="Search (Ctrl+K)"
        style={{ ...iconBtnStyle, marginLeft: "auto" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--sxp-surface-hover, #252D3D)";
          (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-primary, #e2e8f0)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-secondary, #94a3b8)";
        }}
      >
        <span aria-hidden="true">🔍</span>
      </button>

      {/* More — overflow menu */}
      {overflowActions.length > 0 && (
        <div ref={moreRef} style={{ position: "relative" }}>
          <button
            id="quick-action-more"
            onClick={() => setOverflowOpen((o) => !o)}
            aria-label="More actions"
            aria-expanded={overflowOpen}
            aria-haspopup="menu"
            style={iconBtnStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--sxp-surface-hover, #252D3D)";
              (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-primary, #e2e8f0)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--sxp-text-secondary, #94a3b8)";
            }}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          {overflowOpen && (
            <OverflowMenu
              actions={overflowActions}
              onClose={() => setOverflowOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
