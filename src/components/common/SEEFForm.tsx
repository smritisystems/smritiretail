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
 * SEEF Form — Layout Engine for Form Rendering
 *
 * Switches between form layout modes from useSEEF().config.formMode:
 *   single-page  — All sections visible, scrollable
 *   tabbed       — Sections rendered as horizontal tabs
 *   accordion    — Sections collapse/expand individually
 *   wizard       — Step-by-step sequential navigation
 *
 * Each section is independently collapsible, supports inline validation,
 * and emits onAutoSave signals when field values change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { SEEFFormMode } from "../../layout_engine/SEEFTypes.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SEEFFormSection {
  id: string;
  title: string;
  icon?: React.ReactNode;
  /** Content of the form section */
  content: React.ReactNode;
  /** True if section has validation errors */
  hasError?: boolean;
  /** True if section is complete / valid */
  isComplete?: boolean;
  /** Whether section can be collapsed (single-page / accordion mode) */
  collapsible?: boolean;
  /** Whether section is initially open */
  defaultOpen?: boolean;
}

export interface SEEFFormProps {
  /** Form sections */
  sections: SEEFFormSection[];
  /** Called after each field change (for auto-save) */
  onAutoSave?: () => void;
  /** Override the SEEF global form mode for this form */
  modeOverride?: SEEFFormMode;
  /** Footer: action buttons (Save, Cancel, etc.) */
  footer?: React.ReactNode;
  /** Current step for wizard mode (controlled) */
  wizardStep?: number;
  /** Called when wizard advances to next step */
  onWizardNext?: (nextStep: number) => void;
  /** Called when wizard goes back */
  onWizardPrev?: (prevStep: number) => void;
  /** Called when wizard completes final step */
  onWizardComplete?: () => void;
  className?: string;
  id?: string;
}

// ── Mode: Single Page ─────────────────────────────────────────────────────────

const SinglePageForm: React.FC<{ sections: SEEFFormSection[] }> = ({ sections }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((s) => [s.id, s.collapsible ? !(s.defaultOpen ?? true) : false])
    )
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--seef-space-md)" }}>
      {sections.map((section) => {
        const isCollapsed = section.collapsible && collapsed[section.id];
        return (
          <div
            key={section.id}
            className="seef-card"
            style={{
              borderRadius: "var(--seef-radius-active-lg)",
              overflow: "hidden",
              border: section.hasError
                ? "1px solid var(--c-seef-error)"
                : "var(--seef-card-border)",
            }}
          >
            {/* Section header */}
            <div
              onClick={section.collapsible ? () => setCollapsed((p) => ({ ...p, [section.id]: !p[section.id] })) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--seef-space-sm)",
                padding: "var(--seef-space-md) var(--seef-space-lg)",
                background: "var(--c-theme-surface-2)",
                borderBottom: isCollapsed ? "none" : "1px solid var(--c-theme-divider)",
                cursor: section.collapsible ? "pointer" : "default",
              }}
            >
              {section.icon && (
                <span style={{ color: "var(--c-seef-accent)", display: "flex" }}>{section.icon}</span>
              )}
              <span style={{
                flex: 1,
                fontSize: "var(--seef-font-size-sm)",
                fontWeight: 600,
                color: "var(--c-theme-body)",
              }}>
                {section.title}
              </span>
              {section.hasError && <AlertCircle size={14} style={{ color: "var(--c-seef-error)" }} />}
              {section.isComplete && !section.hasError && <CheckCircle2 size={14} style={{ color: "var(--c-seef-success)" }} />}
              {section.collapsible && (
                isCollapsed ? <ChevronRight size={14} style={{ color: "var(--c-theme-muted)" }} />
                           : <ChevronDown size={14} style={{ color: "var(--c-theme-muted)" }} />
              )}
            </div>
            {/* Section content */}
            {!isCollapsed && (
              <div style={{ padding: "var(--seef-space-lg)" }}>
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Mode: Tabbed ──────────────────────────────────────────────────────────────

const TabbedForm: React.FC<{ sections: SEEFFormSection[] }> = ({ sections }) => {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const activeSection = sections.find((s) => s.id === activeId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--c-theme-divider)",
        overflowX: "auto",
        background: "var(--c-theme-surface-2)",
        gap: "0",
        flexShrink: 0,
      }}>
        {sections.map((section) => {
          const active = activeId === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveId(section.id)}
              className="seef-interactive seef-focus-ring"
              style={{
                padding: "var(--seef-space-md) var(--seef-space-lg)",
                border: "none",
                borderBottom: active ? "2px solid var(--c-seef-accent)" : "2px solid transparent",
                background: "none",
                cursor: "pointer",
                color: active ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
                fontSize: "var(--seef-font-size-sm)",
                fontWeight: active ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                transition: "all var(--seef-motion-fast) var(--seef-ease-standard)",
              }}
            >
              {section.icon}
              {section.title}
              {section.hasError && (
                <span style={{
                  width: 6, height: 6,
                  borderRadius: "50%",
                  background: "var(--c-seef-error)",
                  display: "inline-block",
                }} />
              )}
              {section.isComplete && !section.hasError && (
                <CheckCircle2 size={12} style={{ color: "var(--c-seef-success)" }} />
              )}
            </button>
          );
        })}
      </div>
      {/* Active section content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--seef-space-xl)" }}>
        {activeSection?.content}
      </div>
    </div>
  );
};

// ── Mode: Accordion ───────────────────────────────────────────────────────────

const AccordionForm: React.FC<{ sections: SEEFFormSection[] }> = ({ sections }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.defaultOpen !== false).map((s) => s.id))
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {sections.map((section) => {
        const open = openIds.has(section.id);
        return (
          <div
            key={section.id}
            style={{
              border: section.hasError
                ? "1px solid var(--c-seef-error)"
                : "1px solid var(--c-theme-divider)",
              borderRadius: "var(--seef-radius-active-md)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => toggle(section.id)}
              className="seef-interactive seef-focus-ring"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "var(--seef-space-sm)",
                padding: "var(--seef-space-md) var(--seef-space-lg)",
                background: open ? "var(--c-theme-surface-2)" : "var(--c-theme-surface-1)",
                border: "none",
                cursor: "pointer",
                color: "var(--c-theme-body)",
                fontSize: "var(--seef-font-size-sm)",
                fontWeight: open ? 600 : 400,
              }}
            >
              {section.icon && (
                <span style={{ color: "var(--c-seef-accent)", display: "flex" }}>{section.icon}</span>
              )}
              <span style={{ flex: 1, textAlign: "left" }}>{section.title}</span>
              {section.hasError && <AlertCircle size={14} style={{ color: "var(--c-seef-error)" }} />}
              {section.isComplete && !section.hasError && <CheckCircle2 size={14} style={{ color: "var(--c-seef-success)" }} />}
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {open && (
              <div style={{
                padding: "var(--seef-space-lg)",
                borderTop: "1px solid var(--c-theme-divider)",
              }}>
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Mode: Wizard ──────────────────────────────────────────────────────────────

const WizardForm: React.FC<{
  sections: SEEFFormSection[];
  step: number;
  onNext: (n: number) => void;
  onPrev: (n: number) => void;
  onComplete: () => void;
}> = ({ sections, step, onNext, onPrev, onComplete }) => {
  const current = sections[step];
  const isLast = step === sections.length - 1;
  const isFirst = step === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Step indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        padding: "var(--seef-space-md) var(--seef-space-xl)",
        background: "var(--c-theme-surface-2)",
        borderBottom: "1px solid var(--c-theme-divider)",
        overflowX: "auto",
        flexShrink: 0,
      }}>
        {sections.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={s.id}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: 60 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? "var(--c-seef-success)" : active ? "var(--c-seef-accent)" : "var(--c-theme-surface-hover)",
                  color: done || active ? "#fff" : "var(--c-theme-muted)",
                  fontSize: "11px",
                  fontWeight: 700,
                  transition: "background var(--seef-motion-normal) var(--seef-ease-standard)",
                }}>
                  {done ? <CheckCircle2 size={14} /> : active ? <Circle size={12} style={{ fill: "#fff" }} /> : i + 1}
                </div>
                <span style={{
                  fontSize: "10px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--c-seef-accent)" : done ? "var(--c-seef-success)" : "var(--c-theme-muted)",
                  whiteSpace: "nowrap",
                }}>
                  {s.title}
                </span>
              </div>
              {i < sections.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  background: done ? "var(--c-seef-success)" : "var(--c-theme-divider)",
                  marginBottom: "18px",
                  minWidth: 16,
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--seef-space-xl)" }}>
        {current?.content}
      </div>

      {/* Navigation */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "var(--seef-space-md) var(--seef-space-xl)",
        borderTop: "1px solid var(--c-theme-divider)",
        background: "var(--c-theme-surface-2)",
        flexShrink: 0,
      }}>
        <button
          onClick={() => onPrev(step - 1)}
          disabled={isFirst}
          className="seef-interactive seef-focus-ring"
          style={{
            padding: "var(--seef-space-sm) var(--seef-space-lg)",
            borderRadius: "var(--seef-radius-active-md)",
            border: "1px solid var(--c-theme-divider)",
            background: "none",
            color: "var(--c-theme-muted)",
            cursor: isFirst ? "not-allowed" : "pointer",
            opacity: isFirst ? 0.4 : 1,
            fontSize: "var(--seef-font-size-sm)",
          }}
        >
          ← Back
        </button>
        <button
          onClick={isLast ? onComplete : () => onNext(step + 1)}
          className="seef-interactive seef-focus-ring"
          style={{
            padding: "var(--seef-space-sm) var(--seef-space-lg)",
            borderRadius: "var(--seef-radius-active-md)",
            border: "none",
            background: isLast ? "var(--c-seef-success)" : "var(--c-seef-accent)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "var(--seef-font-size-sm)",
            fontWeight: 500,
          }}
        >
          {isLast ? "Complete ✓" : "Next →"}
        </button>
      </div>
    </div>
  );
};

// ── Root SEEF Form Component ───────────────────────────────────────────────────

export const SEEFForm: React.FC<SEEFFormProps> = ({
  sections,
  modeOverride,
  footer,
  wizardStep = 0,
  onWizardNext,
  onWizardPrev,
  onWizardComplete,
  className = "",
  id,
}) => {
  const { config } = useSEEF();
  const mode = modeOverride ?? config.formMode;

  const [internalWizardStep, setInternalWizardStep] = useState(wizardStep);
  const effectiveStep = onWizardNext ? wizardStep : internalWizardStep;

  const handleNext = useCallback((n: number) => {
    onWizardNext ? onWizardNext(n) : setInternalWizardStep(n);
  }, [onWizardNext]);

  const handlePrev = useCallback((n: number) => {
    onWizardPrev ? onWizardPrev(n) : setInternalWizardStep(n);
  }, [onWizardPrev]);

  const handleComplete = useCallback(() => {
    onWizardComplete?.();
  }, [onWizardComplete]);

  const renderContent = () => {
    switch (mode) {
      case "tabbed":    return <TabbedForm sections={sections} />;
      case "accordion": return <AccordionForm sections={sections} />;
      case "wizard":    return (
        <WizardForm
          sections={sections}
          step={effectiveStep}
          onNext={handleNext}
          onPrev={handlePrev}
          onComplete={handleComplete}
        />
      );
      default:          return <SinglePageForm sections={sections} />;
    }
  };

  return (
    <div
      id={id}
      className={className}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div style={{ flex: 1, overflow: mode === "wizard" || mode === "tabbed" ? "hidden" : "auto" }}>
        {renderContent()}
      </div>
      {footer && mode !== "wizard" && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--seef-space-sm)",
          padding: "var(--seef-space-md) 0",
          borderTop: "1px solid var(--c-theme-divider)",
          marginTop: "var(--seef-space-md)",
        }}>
          {footer}
        </div>
      )}
    </div>
  );
};
