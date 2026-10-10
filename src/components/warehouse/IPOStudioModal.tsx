/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.117.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.117.1 (2026-10-04):
 *   - Replaced ipoEngine mock with GET/POST /wms/audits live API.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface StockAudit {
  audit_id: string;
  audit_no?: string;
  warehouse_id?: string;
  status: string;
  audit_date?: string;
  variance_value?: number;
  counted_items?: number;
  notes?: string;
}

interface IPOStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:      "text-slate-400 bg-slate-800/30 border-slate-700/30",
  IN_PROGRESS:"text-amber-300 bg-amber-500/15 border-amber-500/25",
  COMPLETED:  "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  CANCELLED:  "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

export const IPOStudioModal: React.FC<IPOStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [audits, setAudits]         = useState<StockAudit[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ warehouse_id: "", notes: "" });

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<StockAudit[]>("/wms/audits");
      setAudits(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load stock audits."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.warehouse_id) { onNotification?.("Validation", "Warehouse ID is required.", "info"); return; }
    setSubmitting(true);
    try {
      const a = await apiFetchV1<StockAudit>("/wms/audits", {
        method: "POST",
        body: JSON.stringify({ warehouse_id: form.warehouse_id, notes: form.notes }),
      });
      if (a) {
        setAudits((prev) => [a, ...prev]);
        onNotification?.("Audit Created", `${a.audit_no ?? a.audit_id}`, "success");
        setShowForm(false);
        setForm({ warehouse_id: "", notes: "" });
      }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Audit creation failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const summary = {
    total: audits.length,
    completed: audits.filter((a) => a.status === "COMPLETED").length,
    inProgress: audits.filter((a) => a.status === "IN_PROGRESS").length,
    variance: audits.reduce((s, a) => s + (a.variance_value ?? 0), 0),
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-400 text-2xl">fact_check</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">IPO / Stock Audit Studio</h2>
              <p className="text-xs text-slate-400">Physical inventory verification - variance tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 transition-all">
              + New Audit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/30 text-xs text-center">
          {[
            { label: "Total Audits",  value: summary.total,       color: "text-slate-300" },
            { label: "In Progress",   value: summary.inProgress,  color: "text-amber-400" },
            { label: "Completed",     value: summary.completed,   color: "text-emerald-400" },
            { label: "Total Variance",value: `\u20b9${Math.abs(summary.variance).toLocaleString("en-IN")}`, color: summary.variance < 0 ? "text-rose-400" : "text-emerald-400" },
          ].map((m) => (
            <div key={m.label}>
              <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">New Stock Audit</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Warehouse ID *</label>
                <input value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                  placeholder="WH-MUM-01" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Q3 2026 cycle count..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500/60" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40 transition-all">
                {submitting ? "Creating..." : "Start Audit"}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {audits.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">fact_check</span>
              <p className="text-sm">No audits found. Start one to track inventory accuracy.</p>
            </div>
          ) : audits.map((a) => (
            <div key={a.audit_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
              <div>
                <p className="font-bold text-slate-100 font-mono">{a.audit_no ?? a.audit_id}</p>
                <p className="text-slate-500 mt-0.5">{a.warehouse_id ?? "—"} · {a.audit_date ?? "—"} · {a.counted_items ?? 0} items counted</p>
                {a.notes && <p className="text-slate-600 text-[10px]">{a.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                {a.variance_value != null && (
                  <span className={`font-mono font-bold text-sm ${a.variance_value < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {a.variance_value > 0 ? "+" : ""}\u20b9{Math.abs(a.variance_value).toLocaleString("en-IN")}
                  </span>
                )}
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[a.status] ?? ""}`}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default IPOStudioModal;
