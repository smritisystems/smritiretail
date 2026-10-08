/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.23
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Administrative Observability Workspace (RFC 8594 Legacy Deprecation & Telemetry)
 * Capability    : withCapability("legacy_deprecation_telemetry_observability", "GOVERNANCE")
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  Server,
  Radio,
  ArrowUpRight,
  Database,
  ExternalLink,
  ChevronDown,
  Layers,
  FileText,
  X,
  Code,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TelemetrySummary {
  total_events: number;
  endpoint_access_total: number;
  fallback_invoked_total: number;
  unique_companies_count: number;
  by_path: Record<string, number>;
  by_caller: Record<string, number>;
  by_reason: Record<string, number>;
  generated_at: string;
}

export interface TelemetryEvent {
  event_type: "LEGACY_ENDPOINT_ACCESSED" | "LEGACY_FALLBACK_INVOKED" | string;
  timestamp: number;
  iso_timestamp: string;
  path?: string;
  method?: string;
  client_ip?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  successor_endpoint?: string;
  warning_code?: string;
  caller?: string;
  product_id?: string | null;
  reason?: string;
}

interface EventsApiResponse {
  count: number;
  events: TelemetryEvent[];
}

export interface LegacyDeprecationTelemetryTabProps {
  embedded?: boolean;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
}

// ── Utility Formatting Helpers ─────────────────────────────────────────────────

function formatRelativeTime(tsSeconds: number): string {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - tsSeconds));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function calculateSunsetCountdown(): { days: number; hours: number } {
  // RFC 8594 Sunset: 2028-01-01T00:00:00Z
  const sunsetDate = new Date("2028-01-01T00:00:00Z").getTime();
  const now = Date.now();
  const diffMs = Math.max(0, sunsetDate - now);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours };
}

// ── Main Workspace Component ───────────────────────────────────────────────────

export const LegacyDeprecationTelemetryTab: React.FC<LegacyDeprecationTelemetryTabProps> = ({
  embedded = false,
  onNotification,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // seconds (0 = off)
  const [fromDisk, setFromDisk] = useState<boolean>(false);
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeModalEvent, setActiveModalEvent] = useState<TelemetryEvent | null>(null);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Fetch telemetry summary and recent events
  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        const [sumRes, evRes] = await Promise.all([
          apiFetchV1<TelemetrySummary>("/api/v1/governance/legacy-telemetry/summary"),
          apiFetchV1<EventsApiResponse>(
            `/api/v1/governance/legacy-telemetry/events?limit=250&from_disk=${fromDisk}`
          ),
        ]);

        if (sumRes) setSummary(sumRes);
        if (evRes && Array.isArray(evRes.events)) {
          // Sort latest first
          setEvents(evRes.events.slice().reverse());
        }
        setLastFetchedAt(new Date());
      } catch (err: any) {
        console.error("Failed to fetch legacy deprecation telemetry:", err);
        if (onNotification) {
          onNotification("Telemetry Sync Failed", err?.message || "Failed to query telemetry API", "error");
        }
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [fromDisk, onNotification]
  );

  // Initial fetch and fetch on fromDisk toggle
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval polling
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchData(false);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchData]);

  // Sunset calculations
  const countdown = useMemo(() => calculateSunsetCountdown(), []);

  // Filtered event list
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedEventType !== "ALL" && ev.event_type !== selectedEventType) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (ev.path && ev.path.toLowerCase().includes(q)) ||
        (ev.caller && ev.caller.toLowerCase().includes(q)) ||
        (ev.product_id && ev.product_id.toLowerCase().includes(q)) ||
        (ev.company_id && ev.company_id.toLowerCase().includes(q)) ||
        (ev.client_ip && ev.client_ip.toLowerCase().includes(q)) ||
        (ev.warning_code && ev.warning_code.toLowerCase().includes(q)) ||
        (ev.reason && ev.reason.toLowerCase().includes(q))
      );
    });
  }, [events, selectedEventType, searchQuery]);

  // Export handlers
  const handleExportJSONL = () => {
    if (!events.length) return;
    const content = events.map((e) => JSON.stringify(e)).join("\n");
    const blob = new Blob([content], { type: "application/x-ndjson;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smriti_legacy_telemetry_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    if (onNotification) onNotification("Export Generated", "Downloaded telemetry events as JSONL", "success");
  };

  const handleExportCSV = () => {
    if (!events.length) return;
    const headers = [
      "Timestamp",
      "ISO_UTC",
      "Event_Type",
      "Company_ID",
      "Path_Or_Caller",
      "Method",
      "Product_ID",
      "Warning_Code",
      "Reason",
      "Client_IP",
    ];
    const rows = events.map((e) => [
      e.timestamp,
      `"${e.iso_timestamp || ""}"`,
      `"${e.event_type || ""}"`,
      `"${e.company_id || ""}"`,
      `"${e.path || e.caller || ""}"`,
      `"${e.method || ""}"`,
      `"${e.product_id || ""}"`,
      `"${e.warning_code || ""}"`,
      `"${e.reason || ""}"`,
      `"${e.client_ip || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smriti_legacy_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (onNotification) onNotification("Export Generated", "Downloaded telemetry events as CSV", "success");
  };

  const handleCopySummary = () => {
    if (!summary) return;
    const text = `SMRITI Legacy Deprecation Telemetry Summary (${summary.generated_at})\nTotal Events: ${summary.total_events}\nEndpoint Invocations: ${summary.endpoint_access_total}\nRuntime Fallbacks: ${summary.fallback_invoked_total}\nUnique Tenants: ${summary.unique_companies_count}\nRoutes: ${JSON.stringify(summary.by_path, null, 2)}\nCallers: ${JSON.stringify(summary.by_caller, null, 2)}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
    if (onNotification) onNotification("Summary Copied", "Telemetry summary copied to clipboard", "info");
  };

  return (
    <div
      role="region"
      aria-label="Legacy Deprecation Telemetry & Governance Console"
      className={`w-full min-h-full flex flex-col ${
        embedded ? "p-0" : "p-4 md:p-6"
      } bg-[#0b0f17] text-[#e2e8f0] font-sans space-y-6`}
      style={{ minHeight: "100%" }}
    >
      {/* ── Header Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-display">
                  RFC 8594 Legacy Deprecation & Telemetry Monitor
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Gateway Active
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Option B Dual-Key Observability Console • Tracking legacy route migration toward the 2028 Sunset
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sunset Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
            <Clock size={14} className="text-amber-400" />
            <span>Sunset in:</span>
            <span className="font-mono font-bold text-amber-300">
              {countdown.days}d {countdown.hours}h
            </span>
          </div>

          {/* Auto Refresh Select */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
            <RefreshCw size={13} className={refreshing ? "animate-spin text-cyan-400" : "text-slate-400"} />
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-slate-900 text-slate-200">
                Poll: Off
              </option>
              <option value={10} className="bg-slate-900 text-slate-200">
                Poll: 10s
              </option>
              <option value={30} className="bg-slate-900 text-slate-200">
                Poll: 30s
              </option>
              <option value={60} className="bg-slate-900 text-slate-200">
                Poll: 60s
              </option>
            </select>
          </div>

          {/* Source toggle */}
          <button
            type="button"
            onClick={() => setFromDisk(!fromDisk)}
            title={fromDisk ? "Reading from durable disk JSONL file" : "Reading from fast in-memory rate-limited buffer"}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              fromDisk
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database size={13} />
            <span>{fromDisk ? "Disk JSONL" : "In-Memory Buffer"}</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-medium text-white transition-all flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-cyan-400" : ""} />
            <span>Refresh</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-xs font-semibold text-cyan-300 transition-all flex items-center gap-1.5"
            >
              <Download size={13} />
              <span>Export</span>
              <ChevronDown size={12} />
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 py-1 bg-slate-900 border border-white/15 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-20">
              <button
                type="button"
                onClick={handleExportJSONL}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2"
              >
                <FileText size={12} className="text-cyan-400" />
                <span>JSONL Format</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2"
              >
                <FileText size={12} className="text-emerald-400" />
                <span>CSV Spreadsheet</span>
              </button>
            </div>
          </div>

          {/* Copy summary */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy summary text"
          >
            {copiedSummary ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* ── Executive KPI Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Events */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Telemetry Events</span>
            <Activity size={16} className="text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-white font-mono">
              {summary ? summary.total_events.toLocaleString() : "—"}
            </span>
            <span className="text-xs text-slate-400">recorded</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {fromDisk ? "Persistent JSONL storage" : "60s deduplication window"}
          </div>
        </div>

        {/* External Endpoint Hits */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Legacy Route Access</span>
            <ExternalLink size={16} className="text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-amber-300 font-mono">
              {summary ? summary.endpoint_access_total.toLocaleString() : "—"}
            </span>
            {summary && summary.total_events > 0 && (
              <span className="text-xs text-amber-400/80">
                ({Math.round((summary.endpoint_access_total / summary.total_events) * 100)}%)
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            HTTP callers on <code className="text-amber-300/80">/api/v1/products</code>
          </div>
        </div>

        {/* Runtime Fallbacks */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Runtime Fallbacks</span>
            <Layers size={16} className="text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-rose-300 font-mono">
              {summary ? summary.fallback_invoked_total.toLocaleString() : "—"}
            </span>
            {summary && summary.total_events > 0 && (
              <span className="text-xs text-rose-400/80">
                ({Math.round((summary.fallback_invoked_total / summary.total_events) * 100)}%)
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Reports & Export fallback reads
          </div>
        </div>

        {/* Companies Monitored */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Monitored Tenants</span>
            <Server size={16} className="text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-emerald-300 font-mono">
              {summary ? summary.unique_companies_count : "—"}
            </span>
            <span className="text-xs text-slate-400">companies</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Multi-tenant isolated scopes
          </div>
        </div>

        {/* Gateway RFC 8594 Compliance */}
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Gateway Status</span>
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold text-white font-mono">
              RFC 8594
            </span>
            <span className="text-xs font-semibold text-emerald-400">Compliant</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-300/80 flex items-center gap-1">
            <span>Deprecation + Sunset headers attached</span>
          </div>
        </div>
      </div>

      {/* ── Distribution Analytics Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Legacy Endpoint Frequency */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ExternalLink size={15} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Legacy Route Calls by Path</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {summary ? Object.keys(summary.by_path).length : 0} routes
            </span>
          </div>
          <div className="mt-4 space-y-3 flex-1">
            {summary && Object.keys(summary.by_path).length > 0 ? (
              Object.entries(summary.by_path).map(([path, count]) => {
                const max = Math.max(...Object.values(summary.by_path), 1);
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={path} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <code className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]" title={path}>
                        {path}
                      </code>
                      <span className="font-mono font-semibold text-amber-300">{count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-28 flex flex-col items-center justify-center text-xs text-slate-500 italic">
                Zero legacy route requests recorded
              </div>
            )}
          </div>
        </div>

        {/* Runtime Fallbacks by Caller */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-rose-400" />
              <h3 className="text-sm font-semibold text-white">Runtime Fallbacks by Caller</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {summary ? Object.keys(summary.by_caller).length : 0} callers
            </span>
          </div>
          <div className="mt-4 space-y-3 flex-1">
            {summary && Object.keys(summary.by_caller).length > 0 ? (
              Object.entries(summary.by_caller).map(([caller, count]) => {
                const max = Math.max(...Object.values(summary.by_caller), 1);
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={caller} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <code className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]" title={caller}>
                        {caller}
                      </code>
                      <span className="font-mono font-semibold text-rose-300">{count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-28 flex flex-col items-center justify-center text-xs text-slate-500 italic">
                Zero runtime fallback reads invoked
              </div>
            )}
          </div>
        </div>

        {/* Fallback Reasons & Code */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Fallback Invariants & Codes</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Status</span>
          </div>
          <div className="mt-4 space-y-3 flex-1 text-xs">
            {summary && Object.keys(summary.by_reason).length > 0 ? (
              Object.entries(summary.by_reason).map(([reason, count]) => (
                <div key={reason} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-slate-200">{reason}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Historical unlinked record</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">
                    {count}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                All read operations currently resolving authoritative canonical variant identities (0 unlinked fallbacks).
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-white/10 space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Warning Code:</span>
                <code className="text-amber-300">SMRITI-DEPR-002</code>
              </div>
              <div className="flex items-center justify-between">
                <span>Fallback Code:</span>
                <code className="text-rose-300">SMRITI-DEPR-003</code>
              </div>
              <div className="flex items-center justify-between">
                <span>Successor API:</span>
                <code className="text-cyan-300">/api/v1/universal/items</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Telemetry Event Stream ── */}
      <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden flex flex-col">
        {/* Table Header Filter Bar */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Live Telemetry Event Stream</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/10 text-slate-300">
              {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex items-center p-1 rounded-lg bg-black/30 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setSelectedEventType("ALL")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedEventType === "ALL" ? "bg-white/15 text-white font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedEventType("LEGACY_ENDPOINT_ACCESSED")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedEventType === "LEGACY_ENDPOINT_ACCESSED"
                    ? "bg-amber-500/20 text-amber-300 font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Endpoint
              </button>
              <button
                type="button"
                onClick={() => setSelectedEventType("LEGACY_FALLBACK_INVOKED")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedEventType === "LEGACY_FALLBACK_INVOKED"
                    ? "bg-rose-500/20 text-rose-300 font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Fallback
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search route, caller, IP..."
                className="pl-8 pr-3 py-1 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-44 md:w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-medium">
                <th className="py-2.5 px-4 font-mono">Time</th>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4">Path / Caller</th>
                <th className="py-2.5 px-4">Company</th>
                <th className="py-2.5 px-4">Origin / IP</th>
                <th className="py-2.5 px-4">Warning / Reason</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-cyan-400" />
                    <span>Loading telemetry event stream...</span>
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Info size={18} className="mx-auto mb-2 text-slate-600" />
                    <span>No telemetry events matching current filter criteria</span>
                  </td>
                </tr>
              ) : (
                filteredEvents.slice(0, 100).map((ev, idx) => {
                  const isEndpoint = ev.event_type === "LEGACY_ENDPOINT_ACCESSED";
                  return (
                    <tr
                      key={`${ev.timestamp}-${idx}`}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        <span title={ev.iso_timestamp}>{formatRelativeTime(ev.timestamp)}</span>
                      </td>

                      {/* Event Type Badge */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isEndpoint ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            ENDPOINT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                            FALLBACK
                          </span>
                        )}
                      </td>

                      {/* Path or Caller */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {isEndpoint && ev.method && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-200">
                              {ev.method}
                            </span>
                          )}
                          <code className="text-slate-200 font-mono text-[11px] truncate max-w-[240px]">
                            {ev.path || ev.caller || "—"}
                          </code>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-300">
                        {ev.company_id || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Origin or Client IP */}
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                        {ev.client_ip || (ev.product_id ? `PID: ${ev.product_id}` : "—")}
                      </td>

                      {/* Warning Code or Reason */}
                      <td className="py-2.5 px-4">
                        <span className="text-[11px] font-mono text-slate-300">
                          {ev.warning_code || ev.reason || "—"}
                        </span>
                      </td>

                      {/* Inspect Action */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveModalEvent(ev)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Code size={11} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-white/10 bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400">
          <span>
            Showing up to 100 recent events • Refreshed at{" "}
            {lastFetchedAt ? lastFetchedAt.toLocaleTimeString() : "—"}
          </span>
          <span className="text-slate-500 font-mono">
            Rate Limiter: 60s window per key
          </span>
        </div>
      </div>

      {/* ── Event Inspection Modal ── */}
      {activeModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-[#0f172a] border border-white/20 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Code size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Telemetry Event Payload</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalEvent(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Event Type & Time */}
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <span className="text-slate-400 block text-[11px]">Event Type</span>
                  <span className="font-mono font-bold text-white text-xs">{activeModalEvent.event_type}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[11px]">ISO UTC Time</span>
                  <span className="font-mono text-cyan-300 text-xs">{activeModalEvent.iso_timestamp}</span>
                </div>
              </div>

              {/* RFC 8594 Headers Context */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-xs">
                <span className="font-semibold text-amber-300 block">RFC 8594 Signaling Conformance:</span>
                <div className="font-mono text-[11px] text-amber-200/90 space-y-0.5">
                  <p>Deprecation: @1798761600</p>
                  <p>Sunset: Sat, 01 Jan 2028 00:00:00 GMT</p>
                  <p>Link: &lt;/api/v1/universal/items&gt;; rel=&quot;successor-version&quot;</p>
                  <p>X-Smriti-Warning: {activeModalEvent.warning_code || "SMRITI-DEPR-002"}</p>
                </div>
              </div>

              {/* JSON Pre */}
              <div>
                <span className="text-xs font-semibold text-slate-300 mb-1.5 block">Raw JSON Record:</span>
                <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-slate-200 overflow-x-auto select-all">
                  {JSON.stringify(activeModalEvent, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(activeModalEvent, null, 2));
                  if (onNotification) onNotification("Copied", "Raw event JSON copied to clipboard", "info");
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white transition-colors flex items-center gap-1.5"
              >
                <Copy size={13} />
                <span>Copy JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
