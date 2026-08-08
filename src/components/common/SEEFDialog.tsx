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
 * SEEF Dialog — Multi-Mode Modal/Panel/Sheet Primitive
 *
 * Default mode resolved from useSEEF().config.defaultDialogMode.
 * Per-instance override available via `mode` prop.
 * Keyboard-first: Escape closes, Tab traps focus within dialog.
 * AOP-001: Never blocks a business workflow — always closeable.
 *
 * Modes:
 *   centered     — Traditional modal, centered on viewport
 *   right-panel  — Slide-in from right (Object Page detail)
 *   bottom-sheet — Slides up from bottom (mobile-first)
 *   fullscreen   — Full viewport (Print Preview, Report Designer)
 *   split-view   — Master-detail side-by-side
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useSEEF, useSEEFAnimation } from "../../layout_engine/SEEFContext.tsx";
import { SEEFDialogMode } from "../../layout_engine/SEEFTypes.ts";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SEEFDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Dialog title shown in header */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Dialog content */
  children: React.ReactNode;
  /** Footer content (action buttons etc.) */
  footer?: React.ReactNode;
  /** Override global dialog mode for this instance */
  mode?: SEEFDialogMode;
  /** Width for centered and right-panel modes (default: 560px) */
  width?: number | string;
  /** Whether clicking backdrop closes the dialog */
  closeOnBackdrop?: boolean;
  /** Whether Escape key closes the dialog */
  closeOnEscape?: boolean;
  /** Whether to show a close button in the header */
  showCloseButton?: boolean;
  /** Accessible dialog label (for screen readers) */
  "aria-label"?: string;
  /** Unique ID for the dialog */
  id?: string;
  /** Whether dialog is in a loading/processing state */
  loading?: boolean;
  /** Optional icon component shown next to header title */
  icon?: React.ElementType;
  /** Optional extra header element (e.g., badges, status) */
  headerExtra?: React.ReactNode;
  /** Optional Tailwind max-width class override */
  maxWidthClass?: string;
}

// ── Container style per mode ───────────────────────────────────────────────────

function resolveContainerStyle(
  mode: SEEFDialogMode,
  width: number | string
): React.CSSProperties {
  const w = typeof width === "number" ? `${width}px` : width;

  switch (mode) {
    case "centered":
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: w,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--seef-radius-active-xl)",
        overflow: "hidden",
        zIndex: 10001,
      };
    case "right-panel":
      return {
        position: "fixed",
        top: 0,
        right: 0,
        width: w,
        maxWidth: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--seef-radius-active-xl) 0 0 var(--seef-radius-active-xl)",
        overflow: "hidden",
        zIndex: 10001,
      };
    case "bottom-sheet":
      return {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--seef-radius-active-xl) var(--seef-radius-active-xl) 0 0",
        overflow: "hidden",
        zIndex: 10001,
      };
    case "fullscreen":
      return {
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
        overflow: "hidden",
        zIndex: 10001,
      };
    case "split-view":
      return {
        position: "fixed",
        top: "5vh",
        left: "5vw",
        width: "90vw",
        height: "90vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--seef-radius-active-xl)",
        overflow: "hidden",
        zIndex: 10001,
      };
    default:
      return resolveContainerStyle("centered", width);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export const SEEFDialog: React.FC<SEEFDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  mode: modeOverride,
  width = 560,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  "aria-label": ariaLabel,
  id,
  loading = false,
  icon: Icon,
  headerExtra,
  maxWidthClass,
}) => {
  const { config } = useSEEF();
  const animPolicy = useSEEFAnimation();
  const mode = modeOverride ?? config.defaultDialogMode;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // ── Escape handler ────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape && !loading) {
        e.preventDefault();
        onClose();
      }
      // Tab trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      }
    },
    [closeOnEscape, loading, onClose]
  );

  // ── Open / close effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      // Focus first focusable element inside dialog
      requestAnimationFrame(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      });
    } else {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      (previousFocusRef.current as HTMLElement | null)?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const containerStyle = resolveContainerStyle(mode, width);
  const transitionDur = animPolicy === "none" ? "0ms" : "200ms";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeOnBackdrop && !loading ? onClose : undefined}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--c-seef-overlay)",
          backdropFilter: animPolicy !== "none" ? "blur(4px)" : undefined,
          zIndex: 10000,
          animation: animPolicy !== "none" ? `seef-fade-in ${transitionDur} ease-out` : undefined,
        }}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div
        ref={dialogRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        className={maxWidthClass}
        style={{
          ...containerStyle,
          background: "var(--c-theme-surface-1)",
          boxShadow: "var(--seef-elevation-5)",
          animation: animPolicy !== "none"
            ? `seef-dialog-in ${transitionDur} var(--seef-ease-decelerate)`
            : undefined,
        }}
      >
        {/* Header */}
        {(title || showCloseButton || headerExtra) && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--seef-space-lg) var(--seef-space-xl)",
            borderBottom: "1px solid var(--c-theme-divider)",
            background: "var(--c-theme-surface-2)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {Icon && (
                <div style={{
                  padding: "8px",
                  borderRadius: "8px",
                  background: "var(--c-theme-surface-1)",
                  border: "1px solid var(--c-theme-divider)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Icon style={{ width: "20px", height: "20px", color: "var(--c-seef-accent)" }} />
                </div>
              )}
              <div>
                {title && (
                  <h2 style={{
                    margin: 0,
                    fontSize: "var(--seef-font-size-lg)",
                    fontWeight: 600,
                    color: "var(--c-theme-body)",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.01em",
                  }}>
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p style={{
                    margin: "2px 0 0",
                    fontSize: "var(--seef-font-size-xs)",
                    color: "var(--c-theme-muted)",
                  }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {headerExtra}
              {showCloseButton && (
                <button
                  onClick={!loading ? onClose : undefined}
                  disabled={loading}
                  className="seef-interactive seef-focus-ring"
                  aria-label="Close dialog"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--c-theme-muted)",
                    cursor: loading ? "not-allowed" : "pointer",
                    padding: "6px",
                    borderRadius: "var(--seef-radius-active-sm)",
                    display: "flex",
                    alignItems: "center",
                    opacity: loading ? 0.4 : 1,
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: mode === "fullscreen" ? 0 : "var(--seef-space-xl)",
          position: "relative",
        }}>
          {loading && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--c-seef-overlay)",
              zIndex: 1,
            }}>
              <div style={{
                width: 28,
                height: 28,
                border: "2px solid var(--c-theme-divider)",
                borderTopColor: "var(--c-seef-accent)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
            </div>
          )}
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "var(--seef-space-sm)",
            padding: "var(--seef-space-md) var(--seef-space-xl)",
            borderTop: "1px solid var(--c-theme-divider)",
            background: "var(--c-theme-surface-2)",
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes seef-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes seef-dialog-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

// ── Convenience action button components for dialog footers ───────────────────

export const SEEFDialogAction: React.FC<{
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, onClick, variant = "secondary", disabled, loading }) => {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--c-seef-accent)",
      color: "#fff",
      border: "none",
    },
    secondary: {
      background: "none",
      color: "var(--c-theme-muted)",
      border: "1px solid var(--c-theme-divider)",
    },
    danger: {
      background: "rgba(187,0,0,0.1)",
      color: "var(--c-seef-error)",
      border: "1px solid rgba(187,0,0,0.3)",
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="seef-interactive seef-focus-ring"
      style={{
        ...styles[variant],
        padding: "var(--seef-space-sm) var(--seef-space-lg)",
        borderRadius: "var(--seef-radius-active-md)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        fontSize: "var(--seef-font-size-sm)",
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {loading && (
        <span style={{
          width: 12,
          height: 12,
          border: "1.5px solid currentColor",
          borderTopColor: "transparent",
          borderRadius: "50%",
          display: "inline-block",
          animation: "spin 0.8s linear infinite",
        }} />
      )}
      {label}
    </button>
  );
};
