/**
 * Project      : SMRITI Retail OS
 * Module       : SEEF Governance Dashboard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 * Created      : 2026-07-26
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * AOP-001: This screen is admin-only and advisory.
 * It does not block any business workflow.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, AlertTriangle, Info, CheckCircle2, TrendingUp,
  TrendingDown, Minus, RefreshCw, Download, ChevronDown, ChevronRight,
  Zap, Eye, X, Copy, Search,
} from "lucide-react";
import {
  seefGovernance,
  SEEFGovernanceEngine,
  GovernanceReport,
  GovernanceViolation,
  GovernanceSeverity,
  SEEF_MODULE_REGISTRY,
  validateColorTokens,
  validateSpacing,
  validateLegacyTailwind,
  validateTypography,
} from "./SEEFGovernanceEngine.ts";

// ── Demo Scan: scans known source strings for local violations ─────────────────
// In a real CI integration this would receive file contents from the build pipeline.
// In dev mode, we run static pattern analysis on known module exports.

async function runDemoScan(): Promise<GovernanceReport> {
  // Simulate scanning a few known source snippets
  // These are representative patterns — in CI the actual file contents are passed in
  const demoSources: Record<string, string> = {
    "DashboardTab": `
      <div className="bg-slate-950 text-slate-100">
        <span style={{ color: "#2563EB", fontSize: "14px", margin: "3px" }}>KPI</span>
      </div>
    `,
    "SalesStudioTab": `
      <div className="bg-theme-surface-1 text-theme-body">
        <span style={{ color: "var(--c-seef-accent)" }}>Invoice</span>
      </div>
    `,
    "FioriListReport": `
      <div style={{ background: "var(--c-theme-surface-1)", color: "var(--c-theme-body)" }}>
        <table style={{ fontSize: "var(--seef-font-size-sm)" }} />
      </div>
    `,
    "FioriObjectPage": `
      <div style={{ background: "var(--c-theme-surface-1)" }}>
        <h2 style={{ color: "var(--c-theme-body)" }}>Object Page</h2>
      </div>
    `,
    "navigation_renderer": `
      <div className="bg-theme-surface-1 border-theme-divider">
        <button style={{ borderLeft: "3px solid var(--c-seef-accent)" }}>Nav</button>
      </div>
    `,
    "SEEFCommandPalette": `
      <div style={{ background: "var(--c-theme-surface-1)", color: "var(--c-theme-body)" }}>
        <input style={{ border: "1px solid var(--c-theme-divider)" }} />
      </div>
    `,
    "AdvancedBillingEngine": `
      <div className="bg-slate-900 text-white">
        <span style={{ color: "#10b981", fontSize: "18px" }}>POS</span>
      </div>
    `,
  };

  for (const [id, source] of Object.entries(demoSources)) {
    seefGovernance.scanSource(source, id);
  }

  return seefGovernance.generateReport();
}

// ── Score Ring SVG ─────────────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 85 ? "var(--c-seef-success, #22c55e)" :
    score >= 60 ? "var(--c-seef-warning, #f59e0b)" :
    "var(--c-seef-danger, #ef4444)";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--c-theme-divider, #1e3a5f)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${circ}`} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s var(--seef-ease-standard, ease)" }}
      />
    </svg>
  );
};

// ── Severity Badge ─────────────────────────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: GovernanceSeverity }> = ({ severity }) => {
  const map = {
    error:   { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", label: "Error"   },
    warning: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", label: "Warning" },
    info:    { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", label: "Info"    },
  };
  const s = map[severity];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: "var(--seef-radius-active-full, 9999px)",
      background: s.bg, color: s.color,
      fontSize: "var(--seef-font-size-xs, 11px)", fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
};

// ── Violation Row ──────────────────────────────────────────────────────────────

const ViolationRow: React.FC<{ v: GovernanceViolation; onCopy: (msg: string) => void }> = ({ v, onCopy }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = v.severity === "error" ? AlertTriangle : v.severity === "warning" ? AlertTriangle : Info;
  const iconColor = v.severity === "error" ? "#ef4444" : v.severity === "warning" ? "#f59e0b" : "#60a5fa";

  return (
    <div style={{
      borderBottom: "1px solid var(--c-theme-divider)",
      background: expanded ? "rgba(255,255,255,0.02)" : "transparent",
      transition: "background var(--seef-motion-fast) var(--seef-ease-standard)",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="seef-interactive seef-focus-ring"
        style={{
          width: "100%", textAlign: "left",
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          background: "none", border: "none", cursor: "pointer",
        }}
      >
        {expanded
          ? <ChevronDown size={13} style={{ color: "var(--c-theme-muted)", flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: "var(--c-theme-muted)", flexShrink: 0 }} />
        }
        <Icon size={13} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-primary)", flex: 1, textAlign: "left" }}>
          {v.message}
        </span>
        <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
          {v.validator}
        </span>
        <SeverityBadge severity={v.severity} />
        {v.autoFixable && (
          <span style={{
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(34,197,94,0.10)", color: "#22c55e",
            fontSize: 10, fontWeight: 700, flexShrink: 0,
          }}>
            AUTO-FIX
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 12px 42px", display: "flex", flexDirection: "column", gap: 6 }}>
          {v.detail && (
            <div style={{
              background: "var(--c-theme-surface-2)", borderRadius: "var(--seef-radius-active-sm)",
              padding: "8px 12px",
              fontFamily: "var(--font-mono)", fontSize: "var(--seef-font-size-xs)",
              color: "var(--c-theme-muted)", whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {v.detail}
            </div>
          )}
          {v.suggestion && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <Zap size={12} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", lineHeight: 1.5 }}>
                {v.suggestion}
              </span>
              <button
                onClick={() => onCopy(v.suggestion!)}
                className="seef-interactive seef-focus-ring"
                title="Copy suggestion"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--c-theme-muted)", padding: 2, flexShrink: 0,
                }}
              >
                <Copy size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export const SEEFGovernanceDashboard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [report, setReport] = useState<GovernanceReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<GovernanceSeverity | "all">("all");
  const [search, setSearch] = useState("");
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "violations" | "modules">("overview");

  const runScan = useCallback(async () => {
    setScanning(true);
    seefGovernance.clearViolations();
    try {
      const r = await runDemoScan();
      setReport(r);
    } finally {
      setScanning(false);
    }
  }, []);

  // Auto-scan on mount
  useEffect(() => { runScan(); }, [runScan]);

  const handleCopy = (msg: string) => {
    navigator.clipboard.writeText(msg).catch(() => {});
    setCopiedMsg(msg);
    setTimeout(() => setCopiedMsg(null), 2000);
  };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seef-governance-report-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allViolations = report?.modules.flatMap(m => m.violations) ?? [];
  const filtered = allViolations.filter(v => {
    const matchSev = filterSeverity === "all" || v.severity === filterSeverity;
    const matchSearch = search === "" || v.message.toLowerCase().includes(search.toLowerCase())
      || v.component.toLowerCase().includes(search.toLowerCase());
    return matchSev && matchSearch;
  });

  const TrendIcon = report?.trend === "improving" ? TrendingUp
    : report?.trend === "degrading" ? TrendingDown : Minus;
  const trendColor = report?.trend === "improving" ? "#22c55e"
    : report?.trend === "degrading" ? "#ef4444" : "#94a3b8";

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: "var(--seef-radius-active-md)",
    fontSize: "var(--seef-font-size-sm)",
    fontWeight: activeTab === tab ? 600 : 400,
    background: activeTab === tab ? "rgba(26,115,232,0.12)" : "none",
    color: activeTab === tab ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
    border: "none", cursor: "pointer",
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--c-theme-surface-1)", color: "var(--c-theme-body)",
      fontFamily: "var(--font-sans)", overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "16px 20px",
        background: "var(--c-theme-surface-2)",
        borderBottom: "1px solid var(--c-theme-divider)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <ShieldCheck size={20} style={{ color: "var(--c-seef-accent)" }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "var(--seef-font-size-lg)", fontWeight: 700, fontFamily: "var(--font-display)" }}>
            SEEF Governance Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)" }}>
            UX Compliance Engine · Advisory Only · AOP-001
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={runScan}
            disabled={scanning}
            className="seef-interactive seef-focus-ring"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: "var(--seef-radius-active-md)",
              background: "none", border: "1px solid var(--c-theme-divider)",
              color: "var(--c-theme-muted)", cursor: "pointer",
              fontSize: "var(--seef-font-size-sm)",
            }}
          >
            <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scanning…" : "Re-Scan"}
          </button>

          <button
            onClick={exportReport}
            disabled={!report}
            className="seef-interactive seef-focus-ring"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: "var(--seef-radius-active-md)",
              background: "none", border: "1px solid var(--c-theme-divider)",
              color: "var(--c-theme-muted)", cursor: "pointer",
              fontSize: "var(--seef-font-size-sm)",
            }}
          >
            <Download size={13} /> Export JSON
          </button>

          {onClose && (
            <button onClick={onClose} className="seef-interactive seef-focus-ring" style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--c-theme-muted)", padding: 4,
            }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        padding: "8px 16px",
        background: "var(--c-theme-surface-2)",
        borderBottom: "1px solid var(--c-theme-divider)",
        display: "flex", gap: 4,
      }}>
        {(["overview", "violations", "modules"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="seef-interactive seef-focus-ring"
            style={tabStyle(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "violations" && allViolations.length > 0 && (
              <span style={{
                marginLeft: 6, padding: "1px 6px",
                borderRadius: 9999, background: "rgba(239,68,68,0.15)",
                color: "#ef4444", fontSize: 10, fontWeight: 700,
              }}>
                {allViolations.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ padding: "var(--seef-space-xl)" }}>
            {/* Score cards row */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--seef-space-md)", marginBottom: "var(--seef-space-xl)",
            }}>
              {/* Overall Score */}
              <div style={{
                background: "var(--c-theme-surface-2)", borderRadius: "var(--seef-radius-active-xl)",
                border: "var(--seef-card-border)", padding: "var(--seef-space-lg)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                position: "relative",
              }}>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <ScoreRing score={report?.overallScore ?? 0} size={80} />
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "var(--seef-font-size-xl)", fontWeight: 700, fontFamily: "var(--font-display)",
                    color: report?.overallScore && report.overallScore >= 85 ? "#22c55e"
                      : report?.overallScore && report.overallScore >= 60 ? "#f59e0b" : "#ef4444",
                  }}>
                    {report?.overallScore ?? "—"}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--seef-font-size-sm)" }}>Overall Score</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginTop: 2 }}>
                    <TrendIcon size={12} style={{ color: trendColor }} />
                    <span style={{ fontSize: 10, color: trendColor, textTransform: "capitalize" }}>
                      {report?.trend ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat tiles */}
              {[
                { label: "Errors",   value: report?.errorCount,   color: "#ef4444", Icon: AlertTriangle },
                { label: "Warnings", value: report?.warningCount, color: "#f59e0b", Icon: AlertTriangle },
                { label: "Info",     value: report?.infoCount,    color: "#60a5fa", Icon: Info },
                { label: "Modules Scanned", value: report?.modules.length, color: "var(--c-seef-accent)", Icon: Eye },
              ].map(({ label, value, color, Icon: IconComp }) => (
                <div key={label} style={{
                  background: "var(--c-theme-surface-2)", borderRadius: "var(--seef-radius-active-xl)",
                  border: "var(--seef-card-border)", padding: "var(--seef-space-lg)",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}>
                  <IconComp size={16} style={{ color }} />
                  <div>
                    <div style={{ fontSize: "var(--seef-font-size-2xl)", fontWeight: 700, fontFamily: "var(--font-display)", color }}>
                      {value ?? "—"}
                    </div>
                    <div style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", marginTop: 2 }}>
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Worst modules list */}
            {report && report.modules.length > 0 && (
              <div style={{ background: "var(--c-theme-surface-2)", borderRadius: "var(--seef-radius-active-xl)", border: "var(--seef-card-border)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-theme-divider)", fontSize: "var(--seef-font-size-sm)", fontWeight: 600 }}>
                  Module Compliance Scores
                </div>
                {report.modules.map(mod => (
                  <div key={mod.module} style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--c-theme-divider)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{ flex: 1, fontSize: "var(--seef-font-size-sm)", color: "var(--c-theme-primary)" }}>
                      {mod.module}
                    </div>
                    {/* Score bar */}
                    <div style={{ width: 120, height: 6, background: "var(--c-theme-divider)", borderRadius: 3 }}>
                      <div style={{
                        height: 6, borderRadius: 3,
                        width: `${mod.score}%`,
                        background: mod.score >= 85 ? "#22c55e" : mod.score >= 60 ? "#f59e0b" : "#ef4444",
                        transition: "width 0.5s var(--seef-ease-standard)",
                      }} />
                    </div>
                    <span style={{
                      fontSize: "var(--seef-font-size-xs)", fontWeight: 700,
                      fontFamily: "var(--font-mono)", width: 32, textAlign: "right",
                      color: mod.score >= 85 ? "#22c55e" : mod.score >= 60 ? "#f59e0b" : "#ef4444",
                    }}>
                      {mod.score}
                    </span>
                    <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", width: 60, textAlign: "right" }}>
                      {mod.violations.length} issue{mod.violations.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {report && report.overallScore === 100 && (
              <div style={{
                marginTop: "var(--seef-space-lg)",
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.20)",
                borderRadius: "var(--seef-radius-active-xl)",
                padding: "var(--seef-space-lg)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <CheckCircle2 size={20} style={{ color: "#22c55e" }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "var(--seef-font-size-sm)", color: "#22c55e" }}>
                    Full Compliance — Score: 100
                  </div>
                  <div style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", marginTop: 2 }}>
                    All scanned modules meet SEEF token and styling standards.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIOLATIONS TAB */}
        {activeTab === "violations" && (
          <div>
            {/* Filter bar */}
            <div style={{
              padding: "12px 16px",
              background: "var(--c-theme-surface-2)",
              borderBottom: "1px solid var(--c-theme-divider)",
              display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
            }}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--c-theme-muted)" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search violations…"
                  style={{
                    width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                    background: "var(--c-theme-surface-1)", border: "1px solid var(--c-theme-divider)",
                    borderRadius: "var(--seef-radius-active-md)", fontSize: "var(--seef-font-size-xs)",
                    color: "var(--c-theme-body)", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              {(["all", "error", "warning", "info"] as const).map(sev => (
                <button key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className="seef-interactive seef-focus-ring"
                  style={{
                    padding: "4px 12px", borderRadius: "var(--seef-radius-active-md)",
                    fontSize: "var(--seef-font-size-xs)", fontWeight: 500,
                    border: "1px solid var(--c-theme-divider)", cursor: "pointer",
                    background: filterSeverity === sev ? "rgba(26,115,232,0.12)" : "none",
                    color: filterSeverity === sev ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
                  }}>
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              ))}
              <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)", marginLeft: "auto" }}>
                {filtered.length} of {allViolations.length} violations
              </span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--c-theme-muted)", fontSize: "var(--seef-font-size-sm)" }}>
                {allViolations.length === 0 ? "Run a scan to see violations." : "No violations match the current filter."}
              </div>
            ) : (
              <div>
                {filtered.map(v => (
                  <ViolationRow key={v.id} v={v} onCopy={handleCopy} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODULES TAB */}
        {activeTab === "modules" && (
          <div style={{ padding: "var(--seef-space-xl)", display: "flex", flexDirection: "column", gap: "var(--seef-space-md)" }}>
            {SEEF_MODULE_REGISTRY.map(reg => {
              const modData = report?.modules.find(m => m.module === reg.id || m.module.toLowerCase().replace(/-/g, "_") === reg.id.replace(/-/g, "_"));
              const score = modData?.score;
              const viols = modData?.violations ?? [];
              const isExpanded = expandedModules.has(reg.id);

              return (
                <div key={reg.id} style={{
                  background: "var(--c-theme-surface-2)",
                  borderRadius: "var(--seef-radius-active-xl)",
                  border: "var(--seef-card-border)", overflow: "hidden",
                }}>
                  <button
                    onClick={() => {
                      const next = new Set(expandedModules);
                      isExpanded ? next.delete(reg.id) : next.add(reg.id);
                      setExpandedModules(next);
                    }}
                    className="seef-interactive seef-focus-ring"
                    style={{
                      width: "100%", background: "none", border: "none", cursor: "pointer",
                      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    {isExpanded
                      ? <ChevronDown size={13} style={{ color: "var(--c-theme-muted)" }} />
                      : <ChevronRight size={13} style={{ color: "var(--c-theme-muted)" }} />
                    }
                    <span style={{ flex: 1, textAlign: "left", fontSize: "var(--seef-font-size-sm)", fontWeight: 600, color: "var(--c-theme-primary)" }}>
                      {reg.label}
                    </span>
                    <span style={{ fontSize: "var(--seef-font-size-xs)", fontFamily: "var(--font-mono)", color: "var(--c-theme-muted)" }}>
                      {reg.file}
                    </span>
                    {score !== undefined ? (
                      <span style={{
                        fontSize: "var(--seef-font-size-xs)", fontWeight: 700,
                        color: score >= 85 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444",
                        fontFamily: "var(--font-mono)",
                      }}>
                        {score}/100
                      </span>
                    ) : (
                      <span style={{ fontSize: "var(--seef-font-size-xs)", color: "var(--c-theme-muted)" }}>Not scanned</span>
                    )}
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--c-theme-divider)" }}>
                      {viols.length === 0 ? (
                        <div style={{ padding: "12px 16px", fontSize: "var(--seef-font-size-xs)", color: "#22c55e", display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={13} /> {score !== undefined ? "No violations detected." : "Module not yet scanned."}
                        </div>
                      ) : (
                        viols.map(v => <ViolationRow key={v.id} v={v} onCopy={handleCopy} />)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Copied Toast ── */}
      {copiedMsg && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 9999,
          background: "var(--c-theme-surface-2)",
          border: "1px solid var(--c-theme-divider)",
          borderRadius: "var(--seef-radius-active-md)",
          padding: "8px 14px",
          fontSize: "var(--seef-font-size-xs)",
          color: "var(--c-theme-body)",
          boxShadow: "var(--seef-elevation-3)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <CheckCircle2 size={12} style={{ color: "#22c55e" }} />
          Suggestion copied to clipboard
        </div>
      )}
    </div>
  );
};

export default SEEFGovernanceDashboard;
