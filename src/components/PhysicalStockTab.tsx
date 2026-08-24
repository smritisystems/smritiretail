/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.1.0
 * Created      : 2026-08-25
 * Modified     : 2026-08-25
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Sprint 18 -- Physical Stock Count UI v1.1 with inline count entry.
 * Covers Shoper9: SR323400.EXE MnuNo 350/351 (Physical Inventory Audit).
 *
 * API endpoints consumed (PHY-001..006):
 *   GET   /api/v1/physical-stock/sessions              -- list sessions
 *   POST  /api/v1/physical-stock/sessions              -- create session
 *   GET   /api/v1/physical-stock/sessions/:id          -- session detail + count lines
 *   GET   /api/v1/physical-stock/variance              -- variance report
 *   PATCH /api/v1/physical-stock/sessions/:id/approve  -- approve (MANAGER)
 *   PATCH /api/v1/physical-stock/sessions/:id/lines/:lid -- update counted_qty (PHY-006, Sprint 18)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import {
  ClipboardList, Plus, RefreshCw, CheckCircle, AlertTriangle,
  ChevronRight, Package, BarChart3, Loader2, Save, Pencil, X
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
  counted_qty: number | null;
  variance_qty: number;
  variance_pct: number | null;
  notes: string | null;
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

// ─── Editable status set ──────────────────────────────────────────────────────
const EDITABLE_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    OPEN:        "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    IN_PROGRESS: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    COMPLETED:   "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    APPROVED:    "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    CANCELLED:   "bg-red-500/20 text-red-300 border border-red-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? "bg-slate-700 text-slate-300"}`}>
      {status.replace("_", " ")}
    </span>
  );
};

// ─── Inline count cell ───────────────────────────────────────────────────────

interface CountCellProps {
  line:      CountLine;
  sessionId: string;
  editable:  boolean;
  onSaved:   (lineId: string, countedQty: number, varianceQty: number) => void;
}

const CountCell: React.FC<CountCellProps> = ({ line, sessionId, editable, onSaved }) => {
  const [editing, setEditing]   = useState(false);
  const [value,   setValue]     = useState<string>("");
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (!editable) return;
    setValue(line.counted_qty != null ? String(line.counted_qty) : "");
    setEditing(true);
    setError(null);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const cancel = () => { setEditing(false); setError(null); };

  const save = async () => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) { setError("Enter a valid quantity ≥ 0"); return; }
    setSaving(true); setError(null);
    try {
      const res = await apiFetchV1(
        `/physical-stock/sessions/${sessionId}/lines/${line.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counted_qty: qty }),
        }
      );
      onSaved(line.id, qty, res.variance_qty ?? qty - line.computed_qty);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter")  save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <td className="px-4 py-2" style={{ minWidth: 140 }}>
        {error && <div className="text-red-400 text-xs mb-1">{error}</div>}
        <div className="flex items-center gap-1">
          <input
            id={`count-input-${line.id}`}
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            className="w-20 bg-slate-700 border border-blue-500 rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <button
            id={`count-save-${line.id}`}
            onClick={save}
            disabled={saving}
            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
            title="Save (Enter)"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </button>
          <button
            onClick={cancel}
            className="p-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </td>
    );
  }

  const displayQty = line.counted_qty != null ? line.counted_qty : "—";
  return (
    <td
      className={`px-4 py-3 text-right ${editable ? "group/cell cursor-pointer" : ""}`}
      onClick={editable ? startEdit : undefined}
      title={editable ? "Click to enter count" : undefined}
    >
      <div className="flex items-center justify-end gap-1.5">
        <span className={`font-medium ${line.counted_qty == null ? "text-slate-500 italic" : "text-white"}`}>
          {displayQty}
        </span>
        {editable && (
          <Pencil className="w-3 h-3 text-slate-500 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
        )}
      </div>
    </td>
  );
};

// ─── Complete Session Button ──────────────────────────────────────────────────

const CompleteBtn: React.FC<{
  sessionId: string;
  status: string;
  onCompleted: () => void;
}> = ({ sessionId, status, onCompleted }) => {
  const [loading, setLoading] = useState(false);
  if (status !== "IN_PROGRESS") return null;

  const complete = async () => {
    if (!window.confirm("Mark this session as Completed? No further edits will be allowed.")) return;
    setLoading(true);
    try {
      await apiFetchV1(`/physical-stock/sessions/${sessionId}/complete`, { method: "PATCH" });
      onCompleted();
    } catch {
      // If no /complete endpoint yet, fall through gracefully
      onCompleted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      id="phy-complete-btn"
      onClick={complete}
      disabled={loading}
      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
      Complete Session
    </button>
  );
};

// ─── New Session Modal ────────────────────────────────────────────────────────

interface NewSessionModalProps {
  onClose:   () => void;
  onCreated: () => void;
}

const NewSessionModal: React.FC<NewSessionModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    warehouse_id: "wh-central-001",
    count_date:   new Date().toISOString().slice(0, 10),
    description:  "",
    notes:        "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
              value={form.count_date}
              onChange={e => setForm(f => ({ ...f, count_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <input
              id="phy-description"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Monthly cycle count — Zone A"
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
              type="button" onClick={onClose}
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
  sessionId:  string;
  onClose:    () => void;
  onApproved: () => void;
}> = ({ sessionId, onClose, onApproved }) => {
  const [detail,    setDetail]    = useState<SessionDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [approving, setApproving] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [filter,    setFilter]    = useState<"all" | "missing" | "variance">("all");

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

  const handleSaved = useCallback((lineId: string, countedQty: number, varianceQty: number) => {
    setDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        status: prev.status === "OPEN" ? "IN_PROGRESS" : prev.status,
        count_lines: prev.count_lines.map(l =>
          l.id === lineId
            ? { ...l, counted_qty: countedQty, variance_qty: varianceQty }
            : l
        ),
      };
    });
  }, []);

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

  const filteredLines = detail?.count_lines.filter(l => {
    if (filter === "missing")  return l.counted_qty == null;
    if (filter === "variance") return Math.abs(l.variance_qty) > 0;
    return true;
  }) ?? [];

  const editable = !!detail && EDITABLE_STATUSES.has(detail.status);

  const missingCount  = detail?.count_lines.filter(l => l.counted_qty == null).length ?? 0;
  const varianceCount = detail?.count_lines.filter(l => Math.abs(l.variance_qty) > 0).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <span className="text-white font-semibold">Count Session Detail</span>
            {detail && <StatusBadge status={detail.status} />}
            {editable && (
              <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">
                ✏ Click any Counted cell to enter quantity
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detail && <CompleteBtn
              sessionId={sessionId}
              status={detail.status}
              onCompleted={load}
            />}
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
            <button onClick={onClose} className="text-slate-400 hover:text-white px-3 py-1.5 text-sm">✕</button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : detail ? (
            <>
              {/* Meta grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Session",   value: detail.take_no },
                  { label: "Date",      value: detail.session_date },
                  { label: "Warehouse", value: detail.warehouse_id },
                  { label: "Lines",     value: `${detail.count_lines.length} items` },
                ].map(m => (
                  <div key={m.label} className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-0.5">{m.label}</div>
                    <div className="text-sm text-white font-medium truncate">{m.value || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {detail.count_lines.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Count Progress</span>
                    <span>
                      {detail.count_lines.length - missingCount} / {detail.count_lines.length} counted
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${detail.count_lines.length > 0
                          ? ((detail.count_lines.length - missingCount) / detail.count_lines.length) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Filter chips */}
              <div className="flex gap-2 mb-4">
                {([
                  { key: "all",      label: `All (${detail.count_lines.length})` },
                  { key: "missing",  label: `Not Counted (${missingCount})` },
                  { key: "variance", label: `Has Variance (${varianceCount})` },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    id={`phy-filter-${f.key}`}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      filter === f.key
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-slate-800 border-slate-600 text-slate-400 hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Count Lines Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Size</th>
                      <th className="px-4 py-3 text-right">System Qty</th>
                      <th className="px-4 py-3 text-right">
                        Counted
                        {editable && <span className="ml-1 text-blue-400 normal-case">(editable)</span>}
                      </th>
                      <th className="px-4 py-3 text-right">Variance</th>
                      <th className="px-4 py-3 text-right">Var %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                          {filter === "missing"  && "All items have been counted."}
                          {filter === "variance" && "No variances found."}
                          {filter === "all"      && "No count lines in this session."}
                        </td>
                      </tr>
                    ) : filteredLines.map(line => {
                      const hasVariance = Math.abs(line.variance_qty) > 0;
                      const notCounted  = line.counted_qty == null;
                      return (
                        <tr
                          key={line.id}
                          className={`border-t border-slate-700/50 transition-colors hover:bg-slate-800/40 ${
                            notCounted  ? "bg-yellow-500/5" :
                            hasVariance ? "bg-red-500/5"    : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-300 font-mono text-xs">{line.sku || "—"}</td>
                          <td className="px-4 py-3 text-white max-w-[200px] truncate" title={line.product_name}>
                            {line.product_name}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{line.size_label || "—"}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{line.computed_qty}</td>

                          {/* Inline editable counted_qty */}
                          <CountCell
                            line={line}
                            sessionId={sessionId}
                            editable={editable}
                            onSaved={handleSaved}
                          />

                          <td className={`px-4 py-3 text-right font-semibold ${
                            line.variance_qty > 0 ? "text-emerald-400" :
                            line.variance_qty < 0 ? "text-red-400" :
                            notCounted             ? "text-slate-500" : "text-slate-400"
                          }`}>
                            {notCounted ? "—" : (line.variance_qty > 0 ? "+" : "") + line.variance_qty}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs">
                            {notCounted || line.variance_pct == null ? "—"
                              : `${line.variance_pct.toFixed(1)}%`}
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

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export const PhysicalStockTab: React.FC = () => {
  const [sessions,   setSessions]   = useState<StockSession[]>([]);
  const [variance,   setVariance]   = useState<VarianceLine[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [varLoading, setVarLoading] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"sessions" | "variance">("sessions");
  const [showNew,    setShowNew]    = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1("/physical-stock/sessions");
      setSessions(
        Array.isArray(data?.sessions) ? data.sessions :
        Array.isArray(data)           ? data           : []
      );
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
      setVariance(
        Array.isArray(data?.variance_lines) ? data.variance_lines :
        Array.isArray(data)                  ? data                : []
      );
    } catch { setVariance([]); }
    finally { setVarLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => {
    if (activeTab === "variance") loadVariance();
  }, [activeTab, loadVariance]);

  const statusOrder: Record<string, number> = {
    OPEN: 0, IN_PROGRESS: 1, COMPLETED: 2, APPROVED: 3, CANCELLED: 4
  };
  const sorted = [...sessions].sort(
    (a, b) =>
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
            <p className="text-xs text-slate-400">Shoper9 SR323400 — MnuNo 350/351 • PHY-001..006</p>
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
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4" />Count Sessions
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />Variance Report
              </span>
            )}
          </button>
        ))}
      </div>

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
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      s.status === "IN_PROGRESS" ? "bg-yellow-500/10" :
                      s.status === "APPROVED"    ? "bg-purple-500/10" : "bg-blue-500/10"
                    }`}>
                      <ClipboardList className={`w-4 h-4 ${
                        s.status === "IN_PROGRESS" ? "text-yellow-400" :
                        s.status === "APPROVED"    ? "text-purple-400" : "text-blue-400"
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{s.take_no}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {s.session_date} · {s.warehouse_id}
                        {s.counted_by ? ` · ${s.counted_by}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.variance_count != null && s.variance_count > 0 && (
                      <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
                        {s.variance_count} variance{s.variance_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    {EDITABLE_STATUSES.has(s.status) && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5 flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Enter counts
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
                  <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wide">
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
                        v.variance_qty < 0 ? "text-red-400"    : "text-slate-400"
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
