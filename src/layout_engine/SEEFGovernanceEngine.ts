/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SEEF Governance Engine v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 * Created      : 2026-07-26
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * AOP-001: Governance Engine is a dev/CI advisory tool.
 * It MUST NOT block any business workflow or component render.
 * All violations are warnings/suggestions only.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type GovernanceSeverity = "error" | "warning" | "info";

export interface GovernanceViolation {
  id: string;
  validator: string;
  severity: GovernanceSeverity;
  component: string;
  file?: string;
  message: string;
  detail?: string;
  autoFixable: boolean;
  suggestion?: string;
  timestamp: number;
}

export interface ModuleComplianceScore {
  module: string;
  score: number;           // 0–100
  violations: GovernanceViolation[];
  lastScanned: number;
}

export interface GovernanceReport {
  generatedAt: number;
  overallScore: number;    // 0–100
  totalViolations: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  modules: ModuleComplianceScore[];
  trend: "improving" | "stable" | "degrading";
}

// ── Validator Patterns ────────────────────────────────────────────────────────

// Hardcoded hex color patterns (covers 3-char, 6-char, 8-char hex)
const HARDCODED_HEX_RE = /#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/g;

// Hardcoded rgb/rgba/hsl/hsla patterns
const HARDCODED_COLOR_FUNC_RE = /\b(?:rgb|rgba|hsl|hsla)\s*\(/g;

// Hardcoded pixel values that are NOT on the 8-pt grid (not multiples of 4)
const HARDCODED_PX_RE = /(?:margin|padding|gap|width|height|top|left|right|bottom)\s*:\s*(\d+)px/g;

// Hardcoded font-size values
const HARDCODED_FONTSIZE_RE = /font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/g;

// Known non-SEEF slate/cyan/purple Tailwind legacy classes
const LEGACY_TAILWIND_CLASSES = [
  /\bbg-slate-\d{3}\b/g,
  /\btext-slate-\d{3}\b/g,
  /\bborder-slate-\d{3}\b/g,
  /\bbg-cyan-\d{3}\b/g,
  /\btext-cyan-\d{3}\b/g,
  /\bbg-zinc-\d{3}\b/g,
  /\btext-zinc-\d{3}\b/g,
];

// Valid SEEF CSS var patterns (these are allowed)
const SEEF_TOKEN_RE = /var\(--(?:c-|seef-|font-|c-theme-)/;
const THEME_CLASS_RE = /(?:bg|text|border)-theme-/;

// ── Individual Validators ─────────────────────────────────────────────────────

/**
 * ColorTokenValidator
 * Detects hardcoded hex/rgb colors in inline style strings.
 * AOP-001: Advisory only — does not throw.
 */
export function validateColorTokens(
  source: string,
  component: string,
  file?: string
): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];

  // Ignore lines with SEEF tokens (allowed pattern)
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    // Skip lines that are using SEEF or theme tokens
    if (SEEF_TOKEN_RE.test(line) || THEME_CLASS_RE.test(line)) return;
    // Skip comments
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;

    const hexMatches = [...line.matchAll(HARDCODED_HEX_RE)];
    hexMatches.forEach(match => {
      violations.push({
        id: `CT-${component}-L${i + 1}-${match[0]}`,
        validator: "ColorTokenValidator",
        severity: "warning",
        component,
        file,
        message: `Hardcoded hex color "${match[0]}" detected`,
        detail: `Line ${i + 1}: ${line.trim()}`,
        autoFixable: false,
        suggestion: `Replace "${match[0]}" with the nearest SEEF token (e.g., var(--c-seef-accent) or var(--c-theme-body)).`,
        timestamp: Date.now(),
      });
    });

    const funcMatches = [...line.matchAll(HARDCODED_COLOR_FUNC_RE)];
    funcMatches.forEach(match => {
      violations.push({
        id: `CT-FUNC-${component}-L${i + 1}`,
        validator: "ColorTokenValidator",
        severity: "warning",
        component,
        file,
        message: `Hardcoded color function "${match[0]}..." detected`,
        detail: `Line ${i + 1}: ${line.trim()}`,
        autoFixable: false,
        suggestion: `Use CSS custom property tokens instead of inline color functions.`,
        timestamp: Date.now(),
      });
    });
  });

  return violations;
}

/**
 * SpacingValidator
 * Detects pixel values not on the 8-point grid (multiples of 4).
 */
export function validateSpacing(
  source: string,
  component: string,
  file?: string
): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
    // Only flag inline style objects (not CSS files)
    if (!line.includes("style=") && !line.includes("Style:") && !line.includes("Style =")) return;

    const matches = [...line.matchAll(HARDCODED_PX_RE)];
    matches.forEach(match => {
      const px = parseInt(match[1], 10);
      if (px % 4 !== 0) {
        violations.push({
          id: `SP-${component}-L${i + 1}-${px}`,
          validator: "SpacingValidator",
          severity: "info",
          component,
          file,
          message: `Off-grid spacing: ${px}px is not a multiple of 4`,
          detail: `Line ${i + 1}: ${line.trim()}`,
          autoFixable: false,
          suggestion: `Use the nearest 8-point grid value: ${Math.round(px / 4) * 4}px, or use a SEEF spacing token (var(--seef-space-*)).`,
          timestamp: Date.now(),
        });
      }
    });
  });

  return violations;
}

/**
 * LegacyTailwindValidator
 * Detects hardcoded slate/cyan Tailwind classes that should be SEEF tokens.
 */
export function validateLegacyTailwind(
  source: string,
  component: string,
  file?: string
): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;

    LEGACY_TAILWIND_CLASSES.forEach(pattern => {
      const matches = [...line.matchAll(new RegExp(pattern.source, "g"))];
      matches.forEach(match => {
        violations.push({
          id: `LT-${component}-L${i + 1}-${match[0]}`,
          validator: "LegacyTailwindValidator",
          severity: "warning",
          component,
          file,
          message: `Legacy Tailwind class "${match[0]}" should be replaced with SEEF theme token`,
          detail: `Line ${i + 1}: ${line.trim()}`,
          autoFixable: true,
          suggestion: `Replace with bg-theme-surface-* or text-theme-* equivalent CSS custom property class.`,
          timestamp: Date.now(),
        });
      });
    });
  });

  return violations;
}

/**
 * TypographyValidator
 * Detects hardcoded font-size values outside SEEF typography scale.
 */
export function validateTypography(
  source: string,
  component: string,
  file?: string
): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
    if (SEEF_TOKEN_RE.test(line)) return; // already using tokens

    const matches = [...line.matchAll(HARDCODED_FONTSIZE_RE)];
    matches.forEach(match => {
      violations.push({
        id: `TY-${component}-L${i + 1}`,
        validator: "TypographyValidator",
        severity: "info",
        component,
        file,
        message: `Hardcoded font-size "${match[1]}" outside SEEF typography scale`,
        detail: `Line ${i + 1}: ${line.trim()}`,
        autoFixable: false,
        suggestion: `Use var(--seef-font-size-xs/sm/base/lg/xl/2xl/3xl) or the Tailwind text-* class with SEEF font scale.`,
        timestamp: Date.now(),
      });
    });
  });

  return violations;
}

// ── Registry: Known Modules ───────────────────────────────────────────────────

export const SEEF_MODULE_REGISTRY: Array<{ id: string; label: string; file: string }> = [
  { id: "dashboard",       label: "Dashboard",            file: "src/components/DashboardTab.tsx" },
  { id: "pos",             label: "POS Terminal",         file: "src/components/AdvancedBillingEngine.tsx" },
  { id: "sales",           label: "Sales Studio",         file: "src/components/SalesStudioTab.tsx" },
  { id: "item-master",     label: "Item Master",          file: "src/components/ItemMasterTab.tsx" },
  { id: "purchase",        label: "Purchase Studio",      file: "src/components/PurchaseStudioTab.tsx" },
  { id: "customers",       label: "Customer Master",      file: "src/components/CustomerMasterTab.tsx" },
  { id: "crm",             label: "CRM Studio",           file: "src/components/CrmStudioTab.tsx" },
  { id: "scdm",            label: "SCDM Channel Distribution", file: "src/components/SCDMStudioTab.tsx" },
  { id: "reports",         label: "Reports",              file: "src/components/QuickReportTab.tsx" },

  { id: "inventory",       label: "Inventory",            file: "src/components/InventoryTab.tsx" },
  { id: "staff",           label: "Staff Management",     file: "src/components/StaffManagementTab.tsx" },
  { id: "fiori-list",      label: "FioriListReport",      file: "src/components/common/FioriListReport.tsx" },
  { id: "fiori-object",    label: "FioriObjectPage",      file: "src/components/common/FioriObjectPage.tsx" },
  { id: "nav-renderer",    label: "Navigation Renderer",  file: "src/layout_engine/navigation_renderer.tsx" },
  { id: "seef-context",    label: "SEEFContext",           file: "src/layout_engine/SEEFContext.tsx" },
];

// ── SEEFGovernanceEngine ──────────────────────────────────────────────────────

export class SEEFGovernanceEngine {
  private static instance: SEEFGovernanceEngine;
  private violations: Map<string, GovernanceViolation[]> = new Map();
  private lastReport: GovernanceReport | null = null;
  private listeners: Array<(report: GovernanceReport) => void> = [];

  static getInstance(): SEEFGovernanceEngine {
    if (!SEEFGovernanceEngine.instance) {
      SEEFGovernanceEngine.instance = new SEEFGovernanceEngine();
    }
    return SEEFGovernanceEngine.instance;
  }

  /**
   * Scan a source string for SEEF compliance violations.
   * AOP-001: Never throws — always returns, even on scanner failure.
   */
  scanSource(source: string, componentId: string, file?: string): GovernanceViolation[] {
    try {
      const allViolations: GovernanceViolation[] = [
        ...validateColorTokens(source, componentId, file),
        ...validateSpacing(source, componentId, file),
        ...validateLegacyTailwind(source, componentId, file),
        ...validateTypography(source, componentId, file),
      ];

      // Deduplicate by id
      const seen = new Set<string>();
      const unique = allViolations.filter(v => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });

      this.violations.set(componentId, unique);
      return unique;
    } catch {
      // AOP-001: Governance failures must never surface to end users
      return [];
    }
  }

  /**
   * Generate a full compliance report across all registered modules.
   * Score = 100 - (errors × 10) - (warnings × 3) - (info × 1), clamped 0–100.
   */
  generateReport(): GovernanceReport {
    const modules: ModuleComplianceScore[] = [];
    let totalViolations = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const [module, viols] of this.violations.entries()) {
      const errors   = viols.filter(v => v.severity === "error").length;
      const warnings = viols.filter(v => v.severity === "warning").length;
      const infos    = viols.filter(v => v.severity === "info").length;

      const score = Math.max(0, 100 - errors * 10 - warnings * 3 - infos * 1);

      modules.push({
        module,
        score,
        violations: viols,
        lastScanned: viols[0]?.timestamp ?? Date.now(),
      });

      totalViolations += viols.length;
      errorCount   += errors;
      warningCount += warnings;
      infoCount    += infos;
    }

    const overallScore = modules.length > 0
      ? Math.round(modules.reduce((sum, m) => sum + m.score, 0) / modules.length)
      : 100;

    const prevScore = this.lastReport?.overallScore ?? overallScore;
    const trend: GovernanceReport["trend"] =
      overallScore > prevScore + 2 ? "improving" :
      overallScore < prevScore - 2 ? "degrading" : "stable";

    this.lastReport = {
      generatedAt: Date.now(),
      overallScore,
      totalViolations,
      errorCount,
      warningCount,
      infoCount,
      modules: modules.sort((a, b) => a.score - b.score), // worst first
      trend,
    };

    this.listeners.forEach(fn => {
      try { fn(this.lastReport!); } catch { /* AOP-001 */ }
    });

    return this.lastReport;
  }

  /** Subscribe to report updates */
  subscribe(fn: (report: GovernanceReport) => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  getLastReport(): GovernanceReport | null {
    return this.lastReport;
  }

  clearViolations(componentId?: string): void {
    if (componentId) {
      this.violations.delete(componentId);
    } else {
      this.violations.clear();
    }
  }

  /** Dev-mode console reporter — only runs in development */
  logViolations(componentId: string): void {
    if ((import.meta as any).env?.PROD) return;
    const viols = this.violations.get(componentId) ?? [];
    if (viols.length === 0) return;
    console.group(`[SEEF Governance] ${componentId} — ${viols.length} violation(s)`);
    viols.forEach(v => {
      const method = v.severity === "error" ? "error" : v.severity === "warning" ? "warn" : "info";
      console[method](`[${v.validator}] ${v.message}`, v.detail ?? "");
      if (v.suggestion) console.info("  💡 Suggestion:", v.suggestion);
    });
    console.groupEnd();
  }
}

/** Singleton export */
export const seefGovernance = SEEFGovernanceEngine.getInstance();
