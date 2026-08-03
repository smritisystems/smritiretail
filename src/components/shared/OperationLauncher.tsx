/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — OperationLauncher (SWEF P-007)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 / 3-Interaction Rule
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * FOUR EXECUTION MODES (same engine):
 *   wizard       — multi-step (max 4 steps): Receive, GRN, Transfer
 *   quick_action — single confirm (max 2 steps): Adjust qty
 *   bulk_action  — multi-SKU select then confirm (max 3 steps)
 *   scanner_action — 3-INTERACTION RULE ENFORCED: Scan → Confirm → Done
 *
 * SWEF P-007: Mobile warehouse ≤ 3 interactions after scan.
 * This component enforces that rule structurally — it's impossible to
 * create a scanner_action with more than 3 steps.
 */

import React, { useState } from "react";
import { WorkspaceActionRegistry, WorkspaceActionDef, ActionExecutionContext } from "../../layout_engine/WorkspaceActionRegistry.js";
import { adaptiveWorkspaceStore } from "../../layout_engine/adaptive_workspace_store.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OperationMode = "wizard" | "quick_action" | "bulk_action" | "scanner_action";

const MAX_STEPS: Record<OperationMode, number> = {
  wizard: 4,
  quick_action: 2,
  bulk_action: 3,
  scanner_action: 3, // FROZEN — SWEF P-007 / 3-interaction rule
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

// ── Operation Card (action grid tile) ────────────────────────────────────────

interface OperationCardProps {
  action: WorkspaceActionDef;
  onSelect(actionId: string): void;
  dense?: boolean;
}

const OperationCard: React.FC<OperationCardProps> = ({ action, onSelect, dense }) => (
  <button
    id={`op-card-${action.id}`}
    aria-label={action.label}
    title={action.shortcut ? `${action.label} · ${action.shortcut}` : action.label}
    onClick={() => onSelect(action.id)}
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
      border: "1px solid var(--c-border, rgba(255,255,255,0.1))",
      background: "var(--c-surface-elevated, rgba(255,255,255,0.04))",
      color: "var(--c-text-primary, #e2e8f0)",
      cursor: "pointer",
      transition: "all var(--sxp-motion-action, 150ms)",
      textAlign: "center",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.5)";
      (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-border, rgba(255,255,255,0.1))";
      (e.currentTarget as HTMLButtonElement).style.background = "var(--c-surface-elevated, rgba(255,255,255,0.04))";
    }}
  >
    <span style={{ fontSize: dense ? 22 : 28 }}>{action.icon}</span>
    <span style={{ fontSize: dense ? 12 : 13, fontWeight: 600, lineHeight: 1.3 }}>{action.label}</span>
    {action.shortcut && (
      <kbd style={{
        fontSize: 10,
        padding: "2px 5px",
        borderRadius: 3,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.15)",
        fontFamily: "monospace",
        color: "var(--c-text-muted, #64748b)",
      }}>{action.shortcut}</kbd>
    )}
  </button>
);

// ── Wizard / Modal ────────────────────────────────────────────────────────────

interface OperationWizardProps {
  operation: OperationDef;
  onClose(): void;
}

export const OperationWizard: React.FC<OperationWizardProps> = ({ operation, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);

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
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{result.success ? "✅" : "❌"}</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {result.success ? "Done" : "Failed"}
            </div>
            {result.message && (
              <div style={{ fontSize: 13, color: "var(--c-text-secondary, #94a3b8)" }}>
                {result.message}
              </div>
            )}
            <button onClick={onClose} style={primaryBtnStyle}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={operation.actionId}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--c-border, rgba(255,255,255,0.08))" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{currentStep.label}</div>
            {!isScannerMode && (
              <div style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)", marginTop: 2 }}>
                Step {stepIndex + 1} of {steps.length}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted, #64748b)", fontSize: 18 }}>×</button>
        </div>

        {/* Step progress (non-scanner) */}
        {!isScannerMode && steps.length > 1 && (
          <div style={{ display: "flex", padding: "12px 20px 0", gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= stepIndex ? "var(--c-brand, #818cf8)" : "var(--c-border, rgba(255,255,255,0.1))" }} />
            ))}
          </div>
        )}

        {/* Step content */}
        <div style={{ padding: "20px", flex: 1, overflow: "auto" }}>
          {currentStep.content}
        </div>

        {/* Actions */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--c-border, rgba(255,255,255,0.08))", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {stepIndex > 0 && !isScannerMode && (
            <button onClick={() => setStepIndex((i) => i - 1)} style={secondaryBtnStyle}>Back</button>
          )}
          <button onClick={handleNext} disabled={executing} style={primaryBtnStyle}>
            {executing ? "Processing…" : isLast ? (isScannerMode ? "Done" : "Confirm") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

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
  background: "var(--c-surface-elevated, #1e1e3a)",
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
  background: "var(--c-brand, #818cf8)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--c-border, rgba(255,255,255,0.1))",
  background: "transparent",
  color: "var(--c-text-secondary, #94a3b8)",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};

// ── OperationLauncher ─────────────────────────────────────────────────────────

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
    // No multi-step wizard — direct execute
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
          <div style={{ color: "var(--c-text-muted, #64748b)", fontSize: 13, padding: 16 }}>
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
