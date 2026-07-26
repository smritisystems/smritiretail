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
 * SEEF Empty State — Standardized "No Data" Component
 *
 * Resolves illustration from useSEEF().config.illustrationPack.
 * Used on every list, table, and search result screen when no records exist.
 *
 * Usage:
 *   <SEEFEmptyState
 *     title="No Orders Found"
 *     description="Create your first purchase order to get started."
 *     action={{ label: "New Order", onClick: () => {} }}
 *   />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { SEEFIllustrationPack } from "../../layout_engine/SEEFTypes.ts";

// ── SVG Illustrations (inline — no network dependency, AOP-001 compliant) ─────

const ILLUSTRATIONS: Record<SEEFIllustrationPack | "none", React.FC<{ size?: number }>> = {
  none: () => null,

  minimal: ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <rect x="20" y="20" width="40" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" opacity={0.4} />
      <circle cx="40" cy="40" r="8" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
    </svg>
  ),

  enterprise: ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <rect x="10" y="30" width="60" height="40" rx="3" stroke="currentColor" strokeWidth="1.5" opacity={0.35} />
      <rect x="25" y="20" width="30" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" opacity={0.35} />
      <line x1="30" y1="42" x2="50" y2="42" stroke="currentColor" strokeWidth="1.5" opacity={0.3} />
      <line x1="30" y1="50" x2="50" y2="50" stroke="currentColor" strokeWidth="1.5" opacity={0.3} />
      <line x1="30" y1="58" x2="44" y2="58" stroke="currentColor" strokeWidth="1.5" opacity={0.3} />
    </svg>
  ),

  historical: ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <path d="M20 60 L20 30 L40 15 L60 30 L60 60" stroke="currentColor" strokeWidth="1.5" opacity={0.35} />
      <rect x="32" y="44" width="16" height="16" stroke="currentColor" strokeWidth="1" opacity={0.3} />
      <line x1="20" y1="60" x2="60" y2="60" stroke="currentColor" strokeWidth="1.5" opacity={0.35} />
      <line x1="30" y1="30" x2="50" y2="30" stroke="currentColor" strokeWidth="1" opacity={0.25} />
      <circle cx="40" cy="22" r="3" stroke="currentColor" strokeWidth="1" opacity={0.3} />
    </svg>
  ),

  cultural: ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="25" stroke="currentColor" strokeWidth="1.5" opacity={0.3} />
      <path d="M40 15 Q55 27.5 40 40 Q25 27.5 40 15Z" stroke="currentColor" strokeWidth="1" opacity={0.3} fill="none" />
      <path d="M65 40 Q52.5 55 40 40 Q52.5 25 65 40Z" stroke="currentColor" strokeWidth="1" opacity={0.3} fill="none" />
      <path d="M40 65 Q25 52.5 40 40 Q55 52.5 40 65Z" stroke="currentColor" strokeWidth="1" opacity={0.3} fill="none" />
      <path d="M15 40 Q27.5 25 40 40 Q27.5 55 15 40Z" stroke="currentColor" strokeWidth="1" opacity={0.3} fill="none" />
      <circle cx="40" cy="40" r="4" stroke="currentColor" strokeWidth="1" opacity={0.4} />
    </svg>
  ),

  abstract: ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <polygon points="40,10 65,55 15,55" stroke="currentColor" strokeWidth="1.5" opacity={0.3} fill="none" />
      <circle cx="40" cy="45" r="12" stroke="currentColor" strokeWidth="1" opacity={0.25} />
      <line x1="10" y1="65" x2="70" y2="65" stroke="currentColor" strokeWidth="1" opacity={0.2} />
      <circle cx="40" cy="65" r="6" stroke="currentColor" strokeWidth="1" opacity={0.3} />
    </svg>
  ),
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SEEFEmptyStateProps {
  /** Primary message — what is empty */
  title: string;
  /** Supplementary explanation */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Override illustration pack for this instance */
  illustrationOverride?: SEEFIllustrationPack;
  /** Custom icon — shown instead of illustration when provided */
  icon?: React.ReactNode;
  /** CSS class */
  className?: string;
  id?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const SEEFEmptyState: React.FC<SEEFEmptyStateProps> = ({
  title,
  description,
  action,
  secondaryAction,
  illustrationOverride,
  icon,
  className = "",
  id,
}) => {
  const { config } = useSEEF();
  const pack = illustrationOverride ?? config.illustrationPack;
  const Illustration = ILLUSTRATIONS[pack] ?? ILLUSTRATIONS.enterprise;

  return (
    <div
      id={id}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--seef-space-2xl)",
        textAlign: "center",
        color: "var(--c-theme-muted)",
        gap: "var(--seef-space-md)",
        minHeight: "200px",
      }}
    >
      {/* Illustration or custom icon */}
      <div style={{
        color: "var(--c-theme-divider)",
        marginBottom: "var(--seef-space-sm)",
      }}>
        {icon ? (
          <div style={{ fontSize: "40px", opacity: 0.5 }}>{icon}</div>
        ) : (
          <Illustration size={72} />
        )}
      </div>

      {/* Title */}
      <div style={{
        fontSize: "var(--seef-font-size-lg)",
        fontWeight: 600,
        color: "var(--c-theme-primary)",
        fontFamily: "var(--font-display)",
      }}>
        {title}
      </div>

      {/* Description */}
      {description && (
        <div style={{
          fontSize: "var(--seef-font-size-sm)",
          color: "var(--c-theme-muted)",
          maxWidth: "340px",
          lineHeight: 1.6,
        }}>
          {description}
        </div>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div style={{
          display: "flex",
          gap: "var(--seef-space-sm)",
          marginTop: "var(--seef-space-sm)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          {action && (
            <button
              onClick={action.onClick}
              className="seef-interactive seef-focus-ring"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "var(--seef-radius-active-md)",
                border: "none",
                background: "var(--c-seef-accent)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "var(--seef-font-size-sm)",
                fontWeight: 500,
              }}
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="seef-interactive seef-focus-ring"
              style={{
                padding: "8px 16px",
                borderRadius: "var(--seef-radius-active-md)",
                border: "1px solid var(--c-theme-divider)",
                background: "none",
                color: "var(--c-theme-muted)",
                cursor: "pointer",
                fontSize: "var(--seef-font-size-sm)",
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
