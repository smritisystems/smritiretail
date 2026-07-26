/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0  (SEEF Phase 3)
 * Created      : 2026-07-26
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SMRITI Enterprise Experience Framework (SEEF) — Admin Configurator
 *
 * A slide-in admin drawer accessible from every screen's Shell Bar.
 * Role-gated: SYSADMIN + MANAGER only.
 * Changes apply live — no page reload required.
 * Config persists to localStorage via SEEFContext.
 *
 * Sections:
 *  1. Theme & Branding
 *  2. Density & Typography
 *  3. Layout & Navigation
 *  4. Cards & Surfaces
 *  5. Animation & Motion
 *  6. Illustrations & Background
 *  7. Workspace & Industry
 *  8. Accessibility
 *  9. Reset, Export & Import
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef } from "react";
import {
  X, Palette, Type, Layout, Square, Zap, Image, Briefcase,
  Accessibility, RotateCcw, Download, Upload, ChevronDown,
  ChevronRight, Monitor, Moon, Sun, Contrast, Minimize2,
  Building2, Check
} from "lucide-react";
import { useSEEF } from "./SEEFContext.tsx";
import {
  SEEFTheme,
  SEEFDensity,
  SEEFCardStyle,
  SEEFAnimationPolicy,
  SEEFNavigationMode,
  SEEFFormMode,
  SEEFDialogMode,
  SEEFFontScale,
  SEEFIllustrationPack,
} from "./SEEFTypes.ts";
import { adaptiveWorkspaceStore } from "./adaptive_workspace_store.ts";
import { saefExperienceStore, IndustryPackType, INDUSTRY_PACKS } from "./saef_experience_store.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SEEFAdminConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  /** User role — determines which sections are visible */
  userRole?: string;
}

// ── Section toggle helper ─────────────────────────────────────────────────────

const ConfigSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ icon, title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderBottom: "1px solid var(--c-theme-divider)",
      marginBottom: "2px",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--c-theme-primary)",
          fontSize: "var(--seef-font-size-sm)",
          fontWeight: 600,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--c-seef-accent)", display: "flex" }}>{icon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div style={{ padding: "4px 16px 14px" }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Option Grid helper ────────────────────────────────────────────────────────

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: "6px",
      marginTop: "8px",
    }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            style={{
              padding: "8px 6px",
              borderRadius: "var(--seef-radius-active-md)",
              border: active
                ? "2px solid var(--c-seef-accent)"
                : "1px solid var(--c-theme-divider)",
              background: active
                ? "rgba(var(--c-seef-accent), 0.12)"
                : "var(--c-theme-surface-2)",
              color: active ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: active ? 600 : 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              transition: "all var(--seef-motion-fast) var(--seef-ease-standard)",
              position: "relative",
            }}
          >
            {active && (
              <span style={{
                position: "absolute",
                top: "3px",
                right: "3px",
                color: "var(--c-seef-accent)",
                lineHeight: 1,
              }}>
                <Check size={9} />
              </span>
            )}
            {opt.icon && <span>{opt.icon}</span>}
            <span style={{ lineHeight: 1.2, textAlign: "center" }}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Label helper ──────────────────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--c-theme-muted)",
    marginBottom: "4px",
    marginTop: "10px",
  }}>
    {children}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export const SEEFAdminConfigurator: React.FC<SEEFAdminConfiguratorProps> = ({
  isOpen,
  onClose,
  userRole = "SYSADMIN",
}) => {
  const { config, updateSEEF, resetSEEF, exportConfig, importConfig } = useSEEF();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const isSysAdmin = userRole === "SYSADMIN";

  if (!isOpen) return null;

  // ── Theme definitions ──────────────────────────────────────────────────────
  const themes: { value: SEEFTheme; label: string; icon: React.ReactNode }[] = [
    { value: "enterprise",    label: "Enterprise",   icon: <Building2 size={14} /> },
    { value: "dark",          label: "SMRITI Dark",  icon: <Moon size={14} /> },
    { value: "light",         label: "Light",        icon: <Sun size={14} /> },
    { value: "corporate",     label: "Corporate",    icon: <Monitor size={14} /> },
    { value: "minimal",       label: "Minimal",      icon: <Minimize2 size={14} /> },
    { value: "high-contrast", label: "High Contrast",icon: <Contrast size={14} /> },
  ];

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smriti-seef-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import handler ─────────────────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const ok = importConfig(json);
      setImportError(ok ? null : "Invalid SEEF config file.");
    };
    reader.readAsText(file);
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const drawerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    width: "320px",
    height: "100vh",
    background: "var(--c-theme-surface-1)",
    borderLeft: "1px solid var(--c-theme-divider)",
    boxShadow: "var(--seef-elevation-5)",
    zIndex: 10000,
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-sans)",
    overflow: "hidden",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--c-seef-overlay)",
          zIndex: 9999,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div style={drawerStyle}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid var(--c-theme-divider)",
          background: "var(--c-theme-surface-2)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--c-theme-primary)",
              letterSpacing: "-0.01em",
            }}>
              SEEF Configurator
            </div>
            <div style={{
              fontSize: "10px",
              color: "var(--c-theme-muted)",
              marginTop: "1px",
            }}>
              Enterprise Experience Framework
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--c-theme-muted)",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "var(--seef-radius-active-sm)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", fontSize: "13px" }}>

          {/* ── 1. Theme & Branding ──────────────────────────────────────── */}
          <ConfigSection icon={<Palette size={13} />} title="Theme & Branding">
            <FieldLabel>Application Theme</FieldLabel>
            <OptionGrid
              options={themes}
              value={config.theme}
              onChange={(v) => updateSEEF({ theme: v })}
              columns={3}
            />
            {isSysAdmin && (
              <>
                <FieldLabel>Company Logo URL</FieldLabel>
                <input
                  type="text"
                  value={config.companyLogoUrl ?? ""}
                  placeholder="https://example.com/logo.png"
                  onChange={(e) => updateSEEF({ companyLogoUrl: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "var(--seef-radius-active-sm)",
                    border: "1px solid var(--c-theme-divider)",
                    background: "var(--c-theme-surface-2)",
                    color: "var(--c-theme-primary)",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </>
            )}
          </ConfigSection>

          {/* ── 2. Density & Typography ─────────────────────────────────── */}
          <ConfigSection icon={<Type size={13} />} title="Density & Typography">
            <FieldLabel>Display Density</FieldLabel>
            <OptionGrid
              options={[
                { value: "compact" as SEEFDensity,     label: "Compact" },
                { value: "comfortable" as SEEFDensity, label: "Comfortable" },
                { value: "spacious" as SEEFDensity,    label: "Spacious" },
              ]}
              value={config.density}
              onChange={(v) => updateSEEF({ density: v })}
              columns={3}
            />
            <FieldLabel>Font Scale</FieldLabel>
            <OptionGrid
              options={[
                { value: "small" as SEEFFontScale,   label: "Small" },
                { value: "default" as SEEFFontScale,  label: "Default" },
                { value: "large" as SEEFFontScale,    label: "Large" },
                { value: "xl" as SEEFFontScale,       label: "XL" },
              ]}
              value={config.fontScale}
              onChange={(v) => updateSEEF({ fontScale: v })}
              columns={4}
            />
          </ConfigSection>

          {/* ── 3. Layout & Navigation ──────────────────────────────────── */}
          <ConfigSection icon={<Layout size={13} />} title="Layout & Navigation">
            <FieldLabel>Navigation Mode</FieldLabel>
            <OptionGrid
              options={[
                { value: "sidebar" as SEEFNavigationMode,  label: "Sidebar" },
                { value: "rail" as SEEFNavigationMode,     label: "Rail" },
                { value: "top-nav" as SEEFNavigationMode,  label: "Top Nav" },
              ]}
              value={config.navigationMode}
              onChange={(v) => updateSEEF({ navigationMode: v })}
              columns={3}
            />
            <FieldLabel>Form Layout</FieldLabel>
            <OptionGrid
              options={[
                { value: "single-page" as SEEFFormMode, label: "Single Page" },
                { value: "tabbed" as SEEFFormMode,      label: "Tabbed" },
                { value: "accordion" as SEEFFormMode,   label: "Accordion" },
                { value: "wizard" as SEEFFormMode,      label: "Wizard" },
              ]}
              value={config.formMode}
              onChange={(v) => updateSEEF({ formMode: v })}
              columns={2}
            />
            <FieldLabel>Default Dialog Mode</FieldLabel>
            <OptionGrid
              options={[
                { value: "centered" as SEEFDialogMode,    label: "Centered" },
                { value: "right-panel" as SEEFDialogMode, label: "Side Panel" },
                { value: "bottom-sheet" as SEEFDialogMode,label: "Bottom Sheet" },
                { value: "fullscreen" as SEEFDialogMode,  label: "Fullscreen" },
              ]}
              value={config.defaultDialogMode}
              onChange={(v) => updateSEEF({ defaultDialogMode: v })}
              columns={2}
            />
          </ConfigSection>

          {/* ── 4. Cards & Surfaces ─────────────────────────────────────── */}
          <ConfigSection icon={<Square size={13} />} title="Cards & Surfaces">
            <FieldLabel>Card Style</FieldLabel>
            <OptionGrid
              options={[
                { value: "flat" as SEEFCardStyle,     label: "Flat" },
                { value: "elevated" as SEEFCardStyle,  label: "Elevated" },
                { value: "glass" as SEEFCardStyle,    label: "Glass" },
                { value: "minimal" as SEEFCardStyle,  label: "Minimal" },
                { value: "outlined" as SEEFCardStyle, label: "Outlined" },
                { value: "floating" as SEEFCardStyle, label: "Floating" },
              ]}
              value={config.cardStyle}
              onChange={(v) => updateSEEF({ cardStyle: v })}
              columns={3}
            />
          </ConfigSection>

          {/* ── 5. Animation & Motion ───────────────────────────────────── */}
          <ConfigSection icon={<Zap size={13} />} title="Animation & Motion">
            <FieldLabel>Animation Policy</FieldLabel>
            <OptionGrid
              options={[
                { value: "full" as SEEFAnimationPolicy,   label: "Full" },
                { value: "subtle" as SEEFAnimationPolicy, label: "Subtle" },
                { value: "none" as SEEFAnimationPolicy,   label: "Off" },
              ]}
              value={config.animationPolicy}
              onChange={(v) => updateSEEF({ animationPolicy: v })}
              columns={3}
            />
            {config.reducedMotion && (
              <div style={{
                marginTop: "8px",
                padding: "6px 8px",
                background: "rgba(248,156,0,0.12)",
                borderRadius: "4px",
                fontSize: "11px",
                color: "var(--c-seef-warning)",
              }}>
                System reduced-motion is active — animations are automatically disabled.
              </div>
            )}
          </ConfigSection>

          {/* ── 6. Illustrations ────────────────────────────────────────── */}
          <ConfigSection icon={<Image size={13} />} title="Illustrations & Background" defaultOpen={false}>
            <FieldLabel>Illustration Pack</FieldLabel>
            <OptionGrid
              options={[
                { value: "none" as SEEFIllustrationPack,       label: "None" },
                { value: "minimal" as SEEFIllustrationPack,    label: "Minimal" },
                { value: "enterprise" as SEEFIllustrationPack, label: "Enterprise" },
                { value: "historical" as SEEFIllustrationPack, label: "Historical" },
                { value: "cultural" as SEEFIllustrationPack,   label: "Cultural" },
                { value: "abstract" as SEEFIllustrationPack,   label: "Abstract" },
              ]}
              value={config.illustrationPack}
              onChange={(v) => updateSEEF({ illustrationPack: v })}
              columns={3}
            />
          </ConfigSection>

          {/* ── 7. Workspace & Industry ─────────────────────────────────── */}
          {isSysAdmin && (
            <ConfigSection icon={<Briefcase size={13} />} title="Workspace & Industry" defaultOpen={false}>
              <FieldLabel>Workspace Mode</FieldLabel>
              <OptionGrid
                options={[
                  { value: "SIMPLE",   label: "Simple" },
                  { value: "HYBRID",   label: "Hybrid" },
                  { value: "ADVANCED", label: "Advanced" },
                ]}
                value={adaptiveWorkspaceStore.getMode()}
                onChange={(v) =>
                  adaptiveWorkspaceStore.setMode(v as "SIMPLE" | "HYBRID" | "ADVANCED")
                }
                columns={3}
              />
              <FieldLabel>Industry Pack</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                {(Object.keys(INDUSTRY_PACKS) as IndustryPackType[]).map((packId) => {
                  const pack = INDUSTRY_PACKS[packId];
                  const active = saefExperienceStore.getActivePack().id === packId;
                  return (
                    <button
                      key={packId}
                      onClick={() => saefExperienceStore.setActivePack(packId)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--seef-radius-active-sm)",
                        border: active
                          ? "1px solid var(--c-seef-accent)"
                          : "1px solid var(--c-theme-divider)",
                        background: active
                          ? "rgba(26,115,232,0.10)"
                          : "var(--c-theme-surface-2)",
                        color: active ? "var(--c-seef-accent)" : "var(--c-theme-primary)",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: active ? 600 : 400,
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{pack.name}</span>
                      {active && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </ConfigSection>
          )}

          {/* ── 8. Accessibility ────────────────────────────────────────── */}
          <ConfigSection icon={<Accessibility size={13} />} title="Accessibility" defaultOpen={false}>
            {[
              {
                label: "High Contrast Mode",
                key: "highContrast" as const,
                desc: "Forces high-contrast theme for maximum legibility",
              },
              {
                label: "Reduced Motion Override",
                key: "reducedMotion" as const,
                desc: "Disable all animations regardless of policy",
              },
              {
                label: "Keyboard-First Mode",
                key: "keyboardFirst" as const,
                desc: "Enhanced keyboard focus indicators throughout",
              },
            ].map(({ label, key, desc }) => (
              <div key={key} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginTop: "10px",
                gap: "12px",
              }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--c-theme-primary)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--c-theme-muted)", marginTop: "2px" }}>
                    {desc}
                  </div>
                </div>
                <button
                  onClick={() => updateSEEF({ [key]: !config[key] })}
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "10px",
                    border: "none",
                    background: config[key] ? "var(--c-seef-accent)" : "var(--c-theme-divider)",
                    cursor: "pointer",
                    position: "relative",
                    flexShrink: 0,
                    transition: "background var(--seef-motion-fast) var(--seef-ease-standard)",
                  }}
                >
                  <span style={{
                    position: "absolute",
                    top: "2px",
                    left: config[key] ? "18px" : "2px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left var(--seef-motion-fast) var(--seef-ease-standard)",
                  }} />
                </button>
              </div>
            ))}
          </ConfigSection>

          {/* ── 9. Reset / Export / Import ──────────────────────────────── */}
          <ConfigSection icon={<RotateCcw size={13} />} title="Config Management" defaultOpen={false}>
            {importError && (
              <div style={{
                padding: "6px 8px",
                background: "rgba(187,0,0,0.10)",
                borderRadius: "4px",
                color: "var(--c-seef-error)",
                fontSize: "11px",
                marginBottom: "8px",
              }}>
                {importError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
              <button
                onClick={handleExport}
                style={actionBtnStyle("var(--c-seef-info)")}
              >
                <Download size={13} /> Export Config JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={actionBtnStyle("var(--c-seef-accent)")}
              >
                <Upload size={13} /> Import Config JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleImport}
              />
              <button
                onClick={() => { resetSEEF(); setImportError(null); }}
                style={actionBtnStyle("var(--c-seef-error)")}
              >
                <RotateCcw size={13} /> Reset to Defaults
              </button>
            </div>
          </ConfigSection>
        </div>

        {/* Footer badge */}
        <div style={{
          padding: "8px 16px",
          background: "var(--c-theme-surface-2)",
          borderTop: "1px solid var(--c-theme-divider)",
          fontSize: "10px",
          color: "var(--c-theme-muted)",
          textAlign: "center",
          flexShrink: 0,
        }}>
          SEEF v1.0 · Changes apply instantly · © SMRITIBooks.com
        </div>
      </div>
    </>
  );
};

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    padding: "8px 12px",
    borderRadius: "var(--seef-radius-active-sm)",
    border: `1px solid ${color}`,
    background: "none",
    color: color,
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    transition: "background var(--seef-motion-fast) var(--seef-ease-standard)",
  };
}
