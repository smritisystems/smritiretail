/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 â€” OperationLauncher (SWEF P-007)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 / 3-Interaction Rule
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.2.0  (Sprint 3 â€” WCAG AA accessibility pass)
 * Created      : 2026-08-03
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * FOUR EXECUTION MODES (same engine):
 *   wizard       â€” multi-step (max 4 steps): Receive, GRN, Transfer
 *   quick_action â€” single confirm (max 2 steps): Adjust qty
 *   bulk_action  â€” multi-SKU select then confirm (max 3 steps)
 *   scanner_action â€” 3-INTERACTION RULE ENFORCED: Scan â†’ Confirm â†’ Done
 *
 * SWEF P-007: Mobile warehouse â‰¤ 3 interactions after scan.
 * This component enforces that rule structurally â€” it's impossible to
 * create a scanner_action with more than 3 steps.
 */

import React, { useState, useEffect, useRef, useId } from "react";
import { WorkspaceActionRegistry, WorkspaceActionDef, ActionExecutionContext } from "../../layout_engine/WorkspaceActionRegistry.js";
import { adaptiveWorkspaceStore } from "../../layout_engine/adaptive_workspace_store.js";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type OperationMode = "wizard" | "quick_action" | "bulk_action" | "scanner_action";

const MAX_STEPS: Record<OperationMode, number> = {
  wizard: 4,
  quick_action: 2,
  bulk_action: 3,
  scanner_action: 3, // FROZEN â€” SWEF P-007 / 3-interaction rule
};

export interface OperationStep {
  id: string;
  label: string;
  content: React.ReactNode;
  /** Return true to allow advancing to next step */
  canProceed?(): boolean;
}

export interface OperationDef {
  actionId: string;
  mode: OperationMode;
  /** Steps to render (must not exceed MAX_STEPS for the mode) */
  steps: OperationStep[];
  /** Context for WorkspaceActionRegistry.execute() */
  context: ActionExecutionContext;
}

// â”€â”€ Operation Card (action grid tile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OperationCardProps {
  action: WorkspaceActionDef;
  onSelect(actionId: string): void;
  dense?: boolean;
}

const OperationCard: React.FC<OperationCardProps> = ({ action, onSelect, dense }) => (
  <button
    id={`op-card-${action.id}`}
    aria-label={action.shortcut ? `${action.label}, shortcut ${action.shortcut}` : action.label}
    title={action.shortcut ? `${action.label} Â· ${action.shortcut}` : action.label}
    onClick={() => onSelect(action.id)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(action.id); }
    }}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: dense ? 6 : 10,
      minWidth: "var(--sxp-op-card-min, 160px)",
      maxWidth: "var(--sxp-op-card-max, 220px)",
      padding: dense ? "14px 12px" : "20px 16px",
      borderRadius: 12,
      border: "1px solid var(--c-theme-divider)",
      background: "var(--c-theme-surface-2)",
      color: "var(--c-theme-body)",
      cursor: "pointer",
      transition: "all var(--sxp-motion-action, 150ms)",
      textAlign: "center",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.5)";
      (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-theme-divider)";
      (e.currentTarget as HTMLButtonElement).style.background = "var(--c-theme-surface-2)";
    }}
  >
    <span aria-hidden="true" style={{ fontSize: dense ? 22 : 28 }}>{action.icon}</span>
    <span style={{ fontSize: dense ? 12 : 13, fontWeight: 600, lineHeight: 1.3 }}>{action.label}</span>
    {action.shortcut && (
      <kbd style={{
        fontSize: 10,
        padding: "2px 5px",
        borderRadius: 3,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.15)",
        fontFamily: "monospace",
        color: "var(--c-theme-muted)",
      }}>{action.shortcut}</kbd>
    )}
  </button>
);

// â”€â”€ Wizard / Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OperationWizardProps {
  operation: OperationDef;
  onClose(): void;
}

export const OperationWizard: React.FC<OperationWizardProps> = ({ operation, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);

  // Stable IDs for ARIA
  const headerId = useId();
  const stepId   = useId();

  // Focus trap
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // Auto-focus first focusable element
    const first = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, result]);

  const steps = operation.steps.slice(0, MAX_STEPS[operation.mode]);
  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isScannerMode = operation.mode === "scanner_action";

  const handleNext = async () => {
    if (currentStep.canProceed && !currentStep.canProceed()) return;
    if (isLast) {
      setExecuting(true);
      const res = await WorkspaceActionRegistry.execute(operation.actionId, operation.context);
      setResult({ success: res.success, message: res.message });
      setExecuting(false);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  if (result) {
    return (
      <div style={overlayStyle} role="alertdialog" aria-modal="true" aria-label={result.success ? "Operation completed" : "Operation failed"}>
        <div style={panelStyle} role="alert" ref={panelRef}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div aria-hidden="true" style={{ fontSize: 48, marginBottom: 12 }}>{result.success ? "âœ…" : "âŒ"}</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {result.success ? "Done" : "Something went wrong"}
            </div>
            {result.message && (
              <div style={{ fontSize: 13, color: "var(--c-theme-muted)", marginBottom: 16 }}>
                {result.message}
              </div>
            )}
            <button onClick={onClose} autoFocus style={primaryBtnStyle}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby={headerId} aria-describedby={stepId}>
      <div style={panelStyle} ref={panelRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--c-theme-divider)" }}>
          <div>
            <div id={headerId} style={{ fontSize: 14, fontWeight: 600 }}>{currentStep.label}</div>
            {!isScannerMode && (
              <div id={stepId} style={{ fontSize: 11, color: "var(--c-theme-muted)", marginTop: 2 }}>
                Step {stepIndex + 1} of {steps.length}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-theme-muted)", fontSize: 18 }}
          >
            <span aria-hidden="true">Ã—</span>
          </button>
        </div>

        {/* Step progress (non-scanner) */}
        {!isScannerMode && steps.length > 1 && (
          <div style={{ display: "flex", padding: "12px 20px 0", gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= stepIndex ? "var(--c-seef-accent)" : "var(--c-theme-divider)" }} />
            ))}
          </div>
        )}

        {/* Step content */}
        <div style={{ padding: "20px", flex: 1, overflow: "auto" }}>
          {currentStep.content}
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--c-theme-divider)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {stepIndex > 0 && !isScannerMode && (
            <button onClick={() => setStepIndex((i) => i - 1)} style={secondaryBtnStyle}>Back</button>
          )}
          <button onClick={handleNext} disabled={executing} style={primaryBtnStyle}>
            {executing ? "Processingâ€¦" : isLast ? (isScannerMode ? "Done" : "Confirm") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9000,
  backdropFilter: "blur(4px)",
};

const panelStyle: React.CSSProperties = {
  background: "var(--c-theme-surface-2)",
  border: "1px solid rgba(99,102,241,0.25)",
  borderRadius: 14,
  minWidth: 360,
  maxWidth: 520,
  width: "90vw",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 8,
  border: "none",
  background: "var(--c-seef-accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--c-theme-divider)",
  background: "transparent",
  color: "var(--c-theme-muted)",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};

// â”€â”€ OperationLauncher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OperationLauncherProps {
  /** Action IDs visible in this launcher (from workspace manifest) */
  actionIds: string[];
  /** Build an OperationDef when user selects an action (returns null for direct execution) */
  getOperationDef?(actionId: string): OperationDef | null;
  /** Execution context */
  executionContext: ActionExecutionContext;
  compact?: boolean;
}

export const OperationLauncher: React.FC<OperationLauncherProps> = ({
  actionIds,
  getOperationDef,
  executionContext,
  compact = false,
}) => {
  const [activeOperation, setActiveOperation] = useState<OperationDef | null>(null);
  const mode = adaptiveWorkspaceStore.getMode();
  const visibleActions = WorkspaceActionRegistry.getVisible(mode, actionIds);

  const handleSelect = (actionId: string) => {
    if (getOperationDef) {
      const opDef = getOperationDef(actionId);
      if (opDef) {
        setActiveOperation(opDef);
        return;
      }
    }
    // No multi-step wizard â€” direct execute
    WorkspaceActionRegistry.execute(actionId, executionContext);
  };

  return (
    <>
      <div
        role="grid"
        aria-label="Operations"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sxp-op-card-gap, 16px)",
          padding: compact ? "8px" : "16px",
        }}
      >
        {visibleActions.map((action) => (
          <OperationCard
            key={action.id}
            action={action}
            onSelect={handleSelect}
            dense={compact}
          />
        ))}
        {visibleActions.length === 0 && (
          <div style={{ color: "var(--c-theme-muted)", fontSize: 13, padding: 16 }}>
            No operations available in {mode} mode.
          </div>
        )}
      </div>

      {activeOperation && (
        <OperationWizard
          operation={activeOperation}
          onClose={() => setActiveOperation(null)}
        />
      )}
    </>
  );
};
