/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Sprint 4 — Legacy Migration Dashboard
 *
 * Calls: GET /api/v1/legacy-menu-map/stats
 *        GET /api/v1/legacy-menu-map/?status=PENDING (list view)
 *        GET /api/v1/legacy-menu-map/by-workspace/{id} (workspace drill)
 *
 * Auth: MANAGER role required (enforced by backend).
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import type { LucideIcon } from "lucide-react";
import {
  Database,
  GitBranch,
  CheckCircle2,
  Merge,
  Replace,
  Archive,
  Clock,
  Minus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Search,
  Layers,
  Zap,
  AlertTriangle,
  Info,
  Table2,
  Filter,
  X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MigStats {
  total: number;
  mapped: number;
  merged: number;
  replaced: number;
  deprecated: number;
  not_applic: number;
  pending: number;
  coverage_pct: number;
  modules: Record<string, number>;
  multi_instance_count: number;
}

interface MigEntry {
  id: string;
  sh9_mnu_no: number;
  sh9_menu_opt: number;
  sh9_mnu_cap: string | null;
  sh9_exe_name: string | null;
  smriti_menu_id: string | null;
  smriti_workspace: string | null;
  smriti_action: string | null;
  migration_status: string;
}

interface PagedList {
  total: number;
  page: number;
  size: number;
  pages: number;
  items: MigEntry[];
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; Icon: LucideIcon }> = {
  MAPPED:     { label: "Mapped",     color: "#22c55e", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.30)",  Icon: CheckCircle2 },
  MERGED:     { label: "Merged",     color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.30)", Icon: Merge },
  REPLACED:   { label: "Replaced",   color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.30)", Icon: Replace },
  DEPRECATED: { label: "Deprecated", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)", Icon: Archive },
  NOT_APPLIC: { label: "N/A",        color: "#6b7280", bg: "rgba(107,114,128,0.10)",border: "rgba(107,114,128,0.25)",Icon: Minus },
  PENDING:    { label: "Pending",    color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.30)",  Icon: Clock },
};

// ── Arc Progress ───────────────────────────────────────────────────────────────

function ArcGauge({ pct }: { pct: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = circ * (pct / 100);
  const color = pct >= 90 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="130" height="80" viewBox="0 0 130 80" style={{ overflow: "visible" }}>
      {/* Track */}
      <path
        d={`M 15,70 A ${r},${r} 0 0,1 115,70`}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M 15,70 A ${r},${r} 0 0,1 115,70`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${filled * 0.5} ${circ}`}
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }}
      />
      {/* Label */}
      <text x="65" y="62" textAnchor="middle" fill={color}
        style={{ fontSize: 20, fontWeight: 700, fontFamily: "Space Grotesk, sans-serif" }}>
        {pct.toFixed(1)}%
      </text>
      <text x="65" y="78" textAnchor="middle" fill="rgba(255,255,255,0.45)"
        style={{ fontSize: 10, fontFamily: "Inter, sans-serif" }}>
        Coverage
      </text>
    </svg>
  );
}

// ── Stat Chip ──────────────────────────────────────────────────────────────────

function StatChip({ statusKey, count, total, onClick, active }: {
  statusKey: string; count: number; total: number;
  onClick: () => void; active: boolean;
}) {
  const m = STATUS_META[statusKey] ?? STATUS_META.PENDING;
  const { Icon } = m;
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? m.bg : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? m.border : "rgba(255,255,255,0.09)"}`,
        borderRadius: 12, padding: "12px 16px", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 6,
        transition: "all 0.2s", textAlign: "left",
        transform: active ? "translateY(-2px)" : "none",
        boxShadow: active ? `0 0 12px ${m.bg}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={14} style={{ color: m.color, flexShrink: 0 }} />
        <span style={{ color: m.color, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {m.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ color: "#fff", fontSize: 24, fontWeight: 700, fontFamily: "Space Grotesk, sans-serif" }}>
          {count}
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{pct}%</span>
      </div>
      {/* Mini bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: m.color, borderRadius: 2,
          transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </button>
  );
}

// ── Entry Row ──────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: MigEntry }) {
  const m = STATUS_META[entry.migration_status] ?? STATUS_META.PENDING;
  const { Icon } = m;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 70px 1fr 160px 120px 110px",
      gap: 12, alignItems: "center", padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      fontSize: 12, color: "rgba(255,255,255,0.75)",
      transition: "background 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
        {entry.sh9_mnu_no}
      </span>
      <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
        {entry.sh9_menu_opt}
      </span>
      <span style={{ fontWeight: 500, color: "#e5e7eb" }}>{entry.sh9_mnu_cap ?? "—"}</span>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
        {entry.sh9_exe_name ?? "—"}
      </span>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        {entry.smriti_workspace ?? <em style={{ color: "rgba(255,255,255,0.25)" }}>unassigned</em>}
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: m.bg, border: `1px solid ${m.border}`,
        borderRadius: 6, padding: "2px 8px", width: "fit-content",
      }}>
        <Icon size={10} style={{ color: m.color }} />
        <span style={{ color: m.color, fontSize: 10, fontWeight: 600 }}>{m.label}</span>
      </span>
    </div>
  );
}

// ── Module bar ─────────────────────────────────────────────────────────────────

function ModuleBar({ modules }: { modules: Record<string, number> }) {
  const sorted = Object.entries(modules).sort(([, a], [, b]) => b - a);
  const maxVal = sorted[0]?.[1] ?? 1;
  const MODULE_COLORS: Record<string, string> = {
    SALES: "#3b82f6", INVENTORY: "#10b981", PURCHASE: "#8b5cf6",
    FINANCE: "#f59e0b", REPORTS: "#06b6d4", CONFIG: "#6366f1",
    ADMIN: "#ec4899", CRM: "#14b8a6", SYSTEM: "#94a3b8",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map(([mod, cnt]) => (
        <div key={mod} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 80, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
            color: MODULE_COLORS[mod] ?? "#94a3b8", textAlign: "right", flexShrink: 0,
          }}>{mod}</span>
          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${(cnt / maxVal) * 100}%`,
              background: MODULE_COLORS[mod] ?? "#94a3b8",
              transition: "width 0.7s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
          <span style={{ width: 26, fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "right", flexShrink: 0 }}>
            {cnt}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const LegacyMigDashTab: React.FC = () => {
  const [stats, setStats]     = useState<MigStats | null>(null);
  const [list, setList]       = useState<PagedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoad, setListLoad] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [view, setView]       = useState<"overview" | "list">("overview");

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiFetchV1("/legacy-menu-map/stats");
      if (!r.ok) throw new Error(await r.text());
      setStats(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load migration statistics.");
    } finally { setLoading(false); }
  }, []);

  const fetchList = useCallback(async (pg: number, status: string | null, q: string) => {
    setListLoad(true);
    try {
      const params = new URLSearchParams({ page: String(pg), size: "50" });
      if (status) params.set("status", status);
      if (q.trim()) params.set("search", q.trim());
      const r = await apiFetchV1(`/legacy-menu-map/?${params}`);
      if (!r.ok) throw new Error(await r.text());
      setList(await r.json());
    } catch (_) { /* silently keep previous list */ }
    finally { setListLoad(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (view === "list") fetchList(page, filterStatus, search);
  }, [view, page, filterStatus, search, fetchList]);

  const handleStatusClick = (key: string) => {
    if (filterStatus === key) { setFilterStatus(null); }
    else { setFilterStatus(key); setPage(1); }
    setView("list");
  };

  // ── Render: loading ──
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, gap: 12, color: "rgba(255,255,255,0.4)" }}>
      <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: 13 }}>Loading migration statistics…</span>
    </div>
  );

  // ── Render: error ──
  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 12, padding: 20, display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <AlertTriangle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ color: "#ef4444", fontWeight: 600, margin: 0, fontSize: 13 }}>Could not load statistics</p>
          <p style={{ color: "rgba(255,255,255,0.5)", margin: "4px 0 12px", fontSize: 12 }}>{error}</p>
          <button onClick={fetchStats} style={{
            background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 7, padding: "6px 14px", color: "#ef4444", fontSize: 12, cursor: "pointer",
          }}>Retry</button>
        </div>
      </div>
    </div>
  );

  if (!stats) return null;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, fontFamily: "Inter, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GitBranch size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f1f5f9", fontFamily: "Space Grotesk, sans-serif" }}>
              Shoper9 → SMRITI Migration
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              Legacy vaMenu lineage registry · {stats.total} entries · Sprint 1–3
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 2 }}>
            {(["overview", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: view === v ? "rgba(99,102,241,0.5)" : "transparent",
                color: view === v ? "#fff" : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}>
                {v === "overview" ? "Overview" : "Browse"}
              </button>
            ))}
          </div>
          <button onClick={fetchStats} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            color: "rgba(255,255,255,0.6)", fontSize: 11,
          }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {view === "overview" && (
        <>
          {/* Top row: Arc gauge + Multi-instance badge + Key numbers */}
          <div style={{
            display: "grid", gridTemplateColumns: "160px 1fr auto",
            gap: 16, marginBottom: 20, alignItems: "start",
          }}>
            {/* Gauge */}
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 14, padding: "18px 16px", display: "flex",
              flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <ArcGauge pct={stats.coverage_pct} />
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
                {stats.total - stats.pending}/{stats.total} classified
              </p>
            </div>

            {/* Status chips grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {Object.keys(STATUS_META).map(key => (
                <StatChip
                  key={key}
                  statusKey={key}
                  count={(stats as unknown as Record<string, number>)[key.toLowerCase()] ?? 0}
                  total={stats.total}
                  onClick={() => handleStatusClick(key)}
                  active={filterStatus === key}
                />
              ))}
            </div>

            {/* Right: info cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
              {/* Multi-instance */}
              <div style={{
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <Zap size={13} style={{ color: "#f59e0b" }} />
                  <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Multi-Instance
                  </span>
                </div>
                <span style={{ color: "#fff", fontSize: 26, fontWeight: 700, fontFamily: "Space Grotesk, sans-serif" }}>
                  {stats.multi_instance_count}
                </span>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                  entries require multi-tab session support
                </p>
              </div>

              {/* Source info */}
              <div style={{
                background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <Database size={13} style={{ color: "#6366f1" }} />
                  <span style={{ color: "#6366f1", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Source
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  Shoper9 EE<br />
                  SH9_013_EE_0_12<br />
                  183 S9Q files<br />
                  283 raw → 265 active
                </p>
              </div>
            </div>
          </div>

          {/* Module breakdown */}
          {Object.keys(stats.modules).length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "18px 20px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Layers size={14} style={{ color: "#6366f1" }} />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }}>
                  SMRITI Module Coverage (MAPPED entries)
                </span>
              </div>
              <ModuleBar modules={stats.modules} />
            </div>
          )}

          {/* Governance note */}
          <div style={{
            background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <Info size={14} style={{ color: "#06b6d4", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 11, lineHeight: 1.6 }}>
                <strong style={{ color: "#06b6d4" }}>8 pending entries</strong> require multi-company/replication assessment
                (AST Replication, Secondary DB imports, Stock across Chain, HO Chain config).
                These are non-transactional and do not block Sprint 4 functional parity.
                The 9 SMRITI-new capabilities (Wiki, Loyalty, PSV, UFE, Formulas, Terms Engine,
                Approval Matrix, Dev Tracker, About) have no Shoper predecessor and require no migration.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── LIST / BROWSE ── */}
      {view === "list" && (
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, overflow: "hidden",
        }}>
          {/* Toolbar */}
          <div style={{
            padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          }}>
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "6px 12px", flex: 1, minWidth: 200,
            }}>
              <Search size={12} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search caption or group…"
                style={{
                  background: "none", border: "none", outline: "none",
                  color: "#e5e7eb", fontSize: 12, width: "100%",
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <X size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                </button>
              )}
            </div>

            {/* Status filter pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => { setFilterStatus(null); setPage(1); }}
                style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                  cursor: "pointer", border: `1px solid ${!filterStatus ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`,
                  background: !filterStatus ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                  color: !filterStatus ? "#818cf8" : "rgba(255,255,255,0.4)",
                }}>ALL</button>
              {Object.entries(STATUS_META).map(([key, m]) => (
                <button key={key}
                  onClick={() => { setFilterStatus(filterStatus === key ? null : key); setPage(1); }}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                    cursor: "pointer",
                    border: `1px solid ${filterStatus === key ? m.border : "rgba(255,255,255,0.08)"}`,
                    background: filterStatus === key ? m.bg : "rgba(255,255,255,0.03)",
                    color: filterStatus === key ? m.color : "rgba(255,255,255,0.4)",
                  }}>{m.label}</button>
              ))}
            </div>

            {list && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto", flexShrink: 0 }}>
                {list.total} entries
              </span>
            )}
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "60px 70px 1fr 160px 120px 110px",
            gap: 12, padding: "8px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em",
          }}>
            <span>MnuNo</span><span>MenuOpt</span>
            <span>Caption</span><span>ExeName</span>
            <span>SMRITI Workspace</span><span>Status</span>
          </div>

          {/* Rows */}
          {listLoad ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              <RefreshCw size={14} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} /><br />
              Loading…
            </div>
          ) : list?.items?.length ? (
            list.items.map(e => <EntryRow key={e.id} entry={e} />)
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              No entries match the current filter.
            </div>
          )}

          {/* Pagination */}
          {list && list.pages > 1 && (
            <div style={{
              padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7, padding: "5px 14px", color: page <= 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                  fontSize: 11, cursor: page <= 1 ? "default" : "pointer",
                }}>← Prev</button>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                Page {page} of {list.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(list.pages, p + 1))}
                disabled={page >= list.pages}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7, padding: "5px 14px",
                  color: page >= list.pages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                  fontSize: 11, cursor: page >= list.pages ? "default" : "pointer",
                }}>Next →</button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
