/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-08-25
 * Modified     : 2026-08-25
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Sprint 17 -- Physical Stock Count UI.
 * Covers Shoper9: SR323400.EXE MnuNo 350/351 (Physical Inventory Audit).
 *
 * API endpoints consumed (all via PHY-001..005):
 *   GET  /api/v1/physical-stock/sessions         -- list sessions
 *   POST /api/v1/physical-stock/sessions         -- create new count session
 *   GET  /api/v1/physical-stock/sessions/:id     -- session detail + count lines
 *   GET  /api/v1/physical-stock/variance         -- variance report
 *   PATCH /api/v1/physical-stock/sessions/:id/approve  -- approve (MANAGER)
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import {
  ClipboardList, Plus, RefreshCw, CheckCircle, AlertTriangle,
  ChevronRight, ChevronDown, Package, BarChart3, Loader2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockSession {
  id: string;
  take_no: string;
  warehouse_id: string;
  session_date: string;
  counted_by: string;
  status: string;
  notes: string | null;
  line_count?: number;
  variance_count?: number;
}

interface CountLine {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  size_label: string | null;
  color: string | null;
  computed_qty: number;
  counted_qty: number;
  variance_qty: number;
  variance_pct: number | null;
}

interface SessionDetail extends StockSession {
  count_lines: CountLine[];
}

interface VarianceLine {
  product_id: string;
  sku: string;
  product_name: string;
  computed_qty: number;
  counted_qty: number;
  variance_qty: number;
  variance_pct: number | null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    OPEN:      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    IN_PROGRESS: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    COMPLETED: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    APPROVED:  "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    CANCELLED: "bg-red-500/20 text-red-300 border border-red-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? "bg-slate-700 text-slate-300"}`}>
      {status}
    </span>
  );
};

// ─── New Session Modal ────────────────────────────────────────────────────────

interface NewSessionModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const NewSessionModal: React.FC<NewSessionModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    warehouse_id: "wh-central-001",
    session_date: new Date().toISOString().slice(0, 10),
    counted_by:   "",
    notes:        "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.counted_by.trim()) { setError("Counted By is required"); return; }
    setSaving(true); setError(null);
    try {
      await apiFetchV1("/physical-stock/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-400" />
          New Stock Count Session
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Warehouse</label>
            <input
              id="phy-warehouse"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={form.warehouse_id}
              onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
              placeholder="wh-central-001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Count Date</label>
            <input
              id="phy-session-date"
              type="date"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={form.session_date}
              onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Counted By <span className="text-red-400">*</span></label>
            <input
              id="phy-counted-by"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={form.counted_by}
              onChange={e => setForm(f => ({ ...f, counted_by: e.target.value }))}
              placeholder="Staff name or ID"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              id="phy-notes"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional remarks"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded p-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="phy-session-submit"
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Creating…" : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Session Detail Panel ─────────────────────────────────────────────────────

const SessionDetailPanel: React.FC<{
  sessionId: string;
  onClose: () => void;
  onApproved: () => void;
}> = ({ sessionId, onClose, onApproved }) => {
  const [detail,    setDetail]    = useState<SessionDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [approving, setApproving] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetchV1(`/physical-stock/sessions/${sessionId}`);
      setDetail(d);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!window.confirm("Approve this stock count session? This action cannot be undone.")) return;
    setApproving(true);
    try {
      await apiFetchV1(`/physical-stock/sessions/${sessionId}/approve`, { method: "PATCH" });
      onApproved();
    } catch (err: any) {
      setError(err?.message ?? "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <span className="text-white font-semibold">Session Detail</span>
            {detail && <StatusBadge status={detail.status} />}
          </div>
          <div className="flex gap-2">
            {detail?.status === "COMPLETED" && (
              <button
                id="phy-approve-btn"
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-3 py-1.5">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : detail ? (
            <>
              {/* Meta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Take No",    value: detail.take_no },
                  { label: "Date",       value: detail.session_date },
                  { label: "Counted By", value: detail.counted_by },
                  { label: "Warehouse",  value: detail.warehouse_id },
                ].map(m => (
                  <div key={m.label} className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">{m.label}</div>
                    <div className="text-sm text-white font-medium truncate">{m.value || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Count Lines Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-slate-400 text-xs uppercase">
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Size</th>
                      <th className="px-4 py-3 text-right">System Qty</th>
                      <th className="px-4 py-3 text-right">Counted</th>
                      <th className="px-4 py-3 text-right">Variance</th>
                      <th className="px-4 py-3 text-right">Var %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.count_lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                          No count lines recorded yet.
                        </td>
                      </tr>
                    ) : detail.count_lines.map((line, i) => {
                      const hasVariance = Math.abs(line.variance_qty) > 0;
                      return (
                        <tr
                          key={line.id}
                          className={`border-t border-slate-700/50 transition-colors hover:bg-slate-800/50 ${
                            hasVariance ? "bg-red-500/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-300 font-mono text-xs">{line.sku}</td>
                          <td className="px-4 py-3 text-white">{line.product_name}</td>
                          <td className="px-4 py-3 text-slate-400">{line.size_label || "—"}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{line.computed_qty}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">{line.counted_qty}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            line.variance_qty > 0 ? "text-emerald-400" :
                            line.variance_qty < 0 ? "text-red-400" : "text-slate-400"
                          }`}>
                            {line.variance_qty > 0 ? "+" : ""}{line.variance_qty}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs">
                            {line.variance_pct != null ? `${line.variance_pct.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PhysicalStockTab: React.FC = () => {
  const [sessions,      setSessions]      = useState<StockSession[]>([]);
  const [variance,      setVariance]      = useState<VarianceLine[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [varLoading,    setVarLoading]    = useState(false);
  const [activeTab,     setActiveTab]     = useState<"sessions" | "variance">("sessions");
  const [showNew,       setShowNew]       = useState(false);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1("/physical-stock/sessions");
      setSessions(Array.isArray(data?.sessions) ? data.sessions :
                  Array.isArray(data)            ? data : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVariance = useCallback(async () => {
    setVarLoading(true);
    try {
      const data = await apiFetchV1("/physical-stock/variance");
      setVariance(Array.isArray(data?.variance_lines) ? data.variance_lines :
                  Array.isArray(data)                  ? data : []);
    } catch { setVariance([]); }
    finally { setVarLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => {
    if (activeTab === "variance") loadVariance();
  }, [activeTab, loadVariance]);

  const statusOrder: Record<string, number> = { OPEN: 0, IN_PROGRESS: 1, COMPLETED: 2, APPROVED: 3, CANCELLED: 4 };
  const sorted = [...sessions].sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
    b.session_date.localeCompare(a.session_date)
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Physical Stock Count</h1>
            <p className="text-xs text-slate-400">Shoper9 SR323400 — MnuNo 350/351</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="phy-refresh"
            onClick={activeTab === "sessions" ? loadSessions : loadVariance}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="phy-new-session"
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Count Session
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-slate-800">
        {(["sessions", "variance"] as const).map(t => (
          <button
            key={t}
            id={`phy-tab-${t}`}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t
                ? "bg-slate-800 text-white border-t border-x border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "sessions" ? (
              <span className="flex items-center gap-1.5"><Package className="w-4 h-4" />Count Sessions</span>
            ) : (
              <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" />Variance Report</span>
            )}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Sessions tab */}
      {activeTab === "sessions" && (
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
              <ClipboardList className="w-12 h-12 opacity-30" />
              <p className="text-sm">No stock count sessions yet.</p>
              <button
                onClick={() => setShowNew(true)}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Create the first session
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map(s => (
                <div
                  key={s.id}
                  className="group bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer transition-all"
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{s.take_no}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {s.session_date} · {s.warehouse_id} · Counted by: {s.counted_by}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {s.variance_count != null && s.variance_count > 0 && (
                      <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
                        {s.variance_count} variance{s.variance_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Variance tab */}
      {activeTab === "variance" && (
        <div className="flex-1 overflow-y-auto p-6">
          {varLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-right">System Qty</th>
                    <th className="px-4 py-3 text-right">Counted</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-4 py-3 text-right">Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                        No variance data — run a count session first.
                      </td>
                    </tr>
                  ) : variance.map((v, i) => (
                    <tr
                      key={v.product_id + i}
                      className={`border-t border-slate-700/40 hover:bg-slate-800/40 transition-colors ${
                        Math.abs(v.variance_qty) > 0 ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{v.sku}</td>
                      <td className="px-4 py-3 text-white">{v.product_name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{v.computed_qty}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{v.counted_qty}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        v.variance_qty > 0 ? "text-emerald-400" :
                        v.variance_qty < 0 ? "text-red-400" : "text-slate-400"
                      }`}>
                        {v.variance_qty > 0 ? "+" : ""}{v.variance_qty}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs">
                        {v.variance_pct != null ? `${v.variance_pct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNew && (
        <NewSessionModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); loadSessions(); }}
        />
      )}
      {selectedId && (
        <SessionDetailPanel
          sessionId={selectedId}
          onClose={() => setSelectedId(null)}
          onApproved={() => { setSelectedId(null); loadSessions(); }}
        />
      )}
    </div>
  );
};

export default PhysicalStockTab;
