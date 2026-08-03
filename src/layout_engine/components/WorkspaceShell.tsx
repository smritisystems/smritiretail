/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 â€” WorkspaceShell (Nine-Region Layout Container)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 â€” Certification Gate SXP-CS-001
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (SXP-CS-001 / P-004):
 *   Every studio MUST mount inside WorkspaceShell.
 *   No custom shells are permitted.
 *   Shell has ZERO domain logic.
 *   Zone-specific layout is applied via the `zone` field in WorkspaceMetadata.
 *
 * NINE REGIONS:
 *   1. Header           â€” title, domain badge, mode switcher, user controls
 *   2. Breadcrumb Bar   â€” WNE-provided navigation trail
 *   3. Smart Action Bar â€” manifest actions, adaptive-filtered
 *   4. Filter Strip     â€” collapsible (WNG-003), drawer on phone
 *   5. Workspace Body   â€” studio-supplied zone ReactNode
 *   6. Inspector Panel  â€” slide-in right (Object Page detail)
 *   7. Notification Trayâ€” isolated toasts, never overlay body
 *   8. Status Bar       â€” kernel health, record count, last sync
 *   9. [AI Panel slot]  â€” hidden by default, expands when SPK.ai licensed
 */

import React, { useRef, useEffect, useState } from "react";
import { WorkspaceMetadata } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceNavigationEngine, Crumb } from "../../layout_engine/WorkspaceNavigationEngine.js";
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry.js";
import { WorkspaceHealthMonitor } from "../../layout_engine/WorkspaceHealthMonitor.js";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";
import { useSmritiExperience } from "../../context/SmritiExperienceContext.js";
import { adaptiveWorkspaceStore } from "../../layout_engine/adaptive_workspace_store.js";

// â”€â”€ Zone CSS Mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ZONE_BODY_CLASS: Record<string, string> = {
  dashboard:  "sxp-zone-dashboard",
  operator:   "sxp-zone-operator",
  document:   "sxp-zone-document",
  executive:  "sxp-zone-executive",
  scanner:    "sxp-zone-scanner",
  approval:   "sxp-zone-approval",
};

// â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface WorkspaceShellProps {
  /** Workspace metadata from WorkspaceRegistry / manifest */
  metadata: WorkspaceMetadata;
  /** Collapsible filter strip content (WNG-003 compliant) */
  filterStrip?: React.ReactNode;
  /** Main workspace content â€” must match the declared zone */
  body: React.ReactNode;
  /** Slide-in inspector panel (Object Page detail) */
  inspector?: React.ReactNode;
  /** Custom status bar content (appended after default health text) */
  statusBar?: React.ReactNode;
}

// â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  metadata,
  filterStrip,
  body,
  inspector,
  statusBar,
}) => {
  const { mode, canRender, compactMode, touchMode, keyboardMode } = useSmritiExperience();
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>(WorkspaceNavigationEngine.getBreadcrumbs());
  const [filterOpen, setFilterOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [healthViolation, setHealthViolation] = useState(false);
  const mountTime = useRef(Date.now());

  // Sync breadcrumbs from WNE
  useEffect(() => {
    WorkspaceNavigationEngine.navigate(metadata.id);
    return WorkspaceNavigationEngine.subscribe(() =>
      setBreadcrumbs(WorkspaceNavigationEngine.getBreadcrumbs())
    );
  }, [metadata.id]);

  // Report workspace load time to health monitor
  useEffect(() => {
    WorkspaceHealthMonitor.setActiveWorkspace(metadata.id);
    WorkspaceHealthMonitor.start();
    const loadMs = Date.now() - mountTime.current;
    WorkspaceHealthMonitor.recordWorkspaceLoad(metadata.id, loadMs);

    return () => {
      const closeTime = Date.now() - mountTime.current;
      if (closeTime < 100) WorkspaceHealthMonitor.stop();
    };
  }, [metadata.id]);

  // Subscribe to health reports (show violation indicator in status bar)
  useEffect(() => {
    return WorkspaceEventBus.subscribe("HealthReport", (event) => {
      const report = event.payload as { slowWidgets: string[] };
      setHealthViolation(report.slowWidgets.length > 0);
    });
  }, []);

  // Toast notification from WorkspaceEventBus (demo)
  useEffect(() => {
    return WorkspaceEventBus.subscribe("ActionExecuted", (event) => {
      const payload = event.payload as { actionId: string; result: { success: boolean; message?: string } };
      if (payload.result.success) {
        const msg = payload.result.message ?? `${payload.actionId} completed`;
        setNotifications((n) => [...n, msg]);
        setTimeout(() => setNotifications((n) => n.slice(1)), 3000);
      }
    });
  }, []);

  // Visible actions for this workspace (adaptive-filtered)
  const visibleActions = WorkspaceActionRegistry.getVisible(mode, metadata.actions);
  const showDiagnostics = adaptiveWorkspaceStore.canRender("diagnostics");

  const density = compactMode ? "sxp-density-compact" : "sxp-density-comfortable";
  const touchClass = touchMode ? "sxp-touch" : "";
  const kbClass = keyboardMode ? "sxp-keyboard-mode" : "";
  const zoneClass = ZONE_BODY_CLASS[metadata.zone] ?? "sxp-zone-operator";

  return (
    <div
      className={`sxp-shell ${density} ${touchClass} ${kbClass}`}
      data-workspace-id={metadata.id}
      data-zone={metadata.zone}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--c-theme-surface-2)",
        color: "var(--c-theme-body)",
      }}
    >
      {/* â”€â”€ Region 1: Header â”€â”€ */}
      <header
        className="sxp-header"
        style={{
          height: "var(--sxp-header-height, 48px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--c-theme-divider)",
          flexShrink: 0,
          background: "var(--c-theme-surface-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {metadata.title}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(99,102,241,0.15)",
              color: "var(--c-seef-accent)",
              border: "1px solid rgba(99,102,241,0.25)",
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {mode}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {filterStrip && (
            <button
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--c-theme-divider)",
                background: filterOpen ? "rgba(99,102,241,0.15)" : "transparent",
                color: "var(--c-theme-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {filterOpen ? "Hide Filters" : "Filters"}
            </button>
          )}
          {inspector && (
            <button
              onClick={() => setInspectorOpen((o) => !o)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--c-theme-divider)",
                background: inspectorOpen ? "rgba(99,102,241,0.15)" : "transparent",
                color: "var(--c-theme-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Details
            </button>
          )}
        </div>
      </header>

      {/* â”€â”€ Region 2: Breadcrumb Bar â”€â”€ */}
      <nav
        className="sxp-breadcrumb"
        aria-label="Breadcrumb navigation"
        style={{
          height: "var(--sxp-breadcrumb-height, 32px)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 6,
          fontSize: 12,
          color: "var(--c-theme-muted)",
          borderBottom: "1px solid var(--c-theme-divider)",
          flexShrink: 0,
        }}
      >
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.label}>
            {i > 0 && <span style={{ opacity: 0.4 }}>â€º</span>}
            {crumb.isCurrent ? (
              <span style={{ color: "var(--c-theme-body)", fontWeight: 500 }}>
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => crumb.workspaceId && WorkspaceNavigationEngine.navigate(crumb.workspaceId)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: "inherit",
                }}
              >
                {crumb.label}
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* â”€â”€ Region 3: Smart Action Bar â”€â”€ */}
      {visibleActions.length > 0 && (
        <div
          className="sxp-action-bar"
          role="toolbar"
          aria-label="Workspace actions"
          style={{
            height: "var(--sxp-action-bar-height, 52px)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 6,
            borderBottom: "1px solid var(--c-theme-divider)",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          {visibleActions.map((action) => (
            <button
              key={action.id}
              title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
              aria-label={action.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--c-theme-divider)",
                background: "var(--c-theme-surface-2)",
                color: "var(--c-theme-body)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background var(--sxp-motion-action, 150ms)",
              }}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
              {keyboardMode && action.shortcut && (
                <kbd
                  style={{
                    fontSize: 10,
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontFamily: "monospace",
                  }}
                >
                  {action.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}

      {/* â”€â”€ Region 4: Filter Strip â”€â”€ */}
      {filterStrip && filterOpen && (
        <div
          className="sxp-filter-strip"
          style={{
            minHeight: "var(--sxp-filter-strip-height, 44px)",
            padding: "8px 16px",
            borderBottom: "1px solid var(--c-theme-divider)",
            flexShrink: 0,
            background: "var(--c-theme-surface-2)",
          }}
        >
          {filterStrip}
        </div>
      )}

      {/* â”€â”€ Main Content Row (Body + Inspector) â”€â”€ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* â”€â”€ Region 5: Workspace Body â”€â”€ */}
        <main
          className={`sxp-body ${zoneClass}`}
          style={{
            flex: 1,
            overflow: "auto",
            padding: metadata.zone === "scanner" ? 0 : 16,
          }}
        >
          {body}
        </main>

        {/* â”€â”€ Region 6: Inspector Panel â”€â”€ */}
        {inspector && inspectorOpen && (
          <aside
            className="sxp-inspector"
            style={{
              width: "var(--sxp-inspector-width, 360px)",
              borderLeft: "1px solid var(--c-theme-divider)",
              overflow: "auto",
              flexShrink: 0,
              background: "var(--c-theme-surface-2)",
            }}
          >
            {inspector}
          </aside>
        )}

        {/* â”€â”€ Region 9: AI Panel Slot (hidden by default) â”€â”€ */}
        {/* Reserved â€” expands when SPK.ai is licensed */}
      </div>

      {/* â”€â”€ Region 7: Notification Tray (isolated from body) â”€â”€ */}
      {notifications.length > 0 && (
        <div
          className="sxp-notification-tray"
          style={{
            position: "fixed",
            bottom: 40,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 9999,
          }}
        >
          {notifications.map((msg, i) => (
            <div
              key={i}
              role="status"
              aria-live="polite"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                background: "rgba(30,30,60,0.95)",
                border: "1px solid rgba(99,102,241,0.35)",
                color: "#e2e8f0",
                fontSize: 13,
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                backdropFilter: "blur(12px)",
                maxWidth: 320,
                animation: `fadeIn var(--sxp-motion-panel, 250ms) ease`,
              }}
            >
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* â”€â”€ Region 8: Status Bar â”€â”€ */}
      <footer
        className="sxp-status-bar"
        style={{
          height: "var(--sxp-status-bar-height, 28px)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          fontSize: 11,
          color: "var(--c-theme-muted)",
          borderTop: "1px solid var(--c-theme-divider)",
          flexShrink: 0,
          background: "var(--c-theme-surface-2)",
        }}
      >
        <span>{metadata.title}</span>
        {showDiagnostics && healthViolation && (
          <span style={{ color: "#f59e0b", fontWeight: 500 }}>âš  Slow widgets detected</span>
        )}
        <span style={{ marginLeft: "auto" }}>{canRender("diagnostics") ? "ADVANCED" : mode}</span>
        {statusBar}
      </footer>
    </div>
  );
};
