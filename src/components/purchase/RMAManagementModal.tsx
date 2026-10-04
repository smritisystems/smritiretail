/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.118.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.118.1 (2026-10-04):
 *   - Replaced rmaEngine mock with GET /sales/returns, POST /sales/returns.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface SalesReturn {
  return_id: string;
  return_no?: string;
  customer_name?: string;
  invoice_no?: string;
  status: string;
  return_reason?: string;
  total_refund?: number;
  return_date?: string;
}

interface RMAManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  INITIATED:  "text-amber-300 bg-amber-500/15 border-amber-500/25",
  APPROVED:   "text-sky-300 bg-sky-500/15 border-sky-500/25",
  RECEIVED:   "text-violet-300 bg-violet-500/15 border-violet-500/25",
  REFUNDED:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  REJECTED:   "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

const REASONS = ["DEFECTIVE_PRODUCT", "WRONG_ITEM_DELIVERED", "DAMAGED_IN_TRANSIT", "CUSTOMER_CHANGED_MIND", "QUALITY_ISSUE", "SIZE_MISMATCH", "OTHER"];
const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const RMAManagementModal: React.FC<RMAManagementModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [returns, setReturns]       = useState<SalesReturn[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [form, setForm]             = useState({ customer_name: "", invoice_no: "", return_reason: "DEFECTIVE_PRODUCT", notes: "" });

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<SalesReturn[]>("/sales/returns");
      setReturns(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load returns."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const displayed = filterStatus === "ALL" ? returns : returns.filter((r) => r.status === filterStatus);

  const handleCreate = async () => {
    if (!form.customer_name || !form.invoice_no) {
      onNotification?.("Validation", "Customer name and invoice no are required.", "info"); return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetchV1<SalesReturn>("/sales/returns", {
        method: "POST",
        body: JSON.stringify({ customer_name: form.customer_name, invoice_no: form.invoice_no, return_reason: form.return_reason, notes: form.notes }),
      });
      if (r) {
        setReturns((prev) => [r, ...prev]);
        onNotification?.("Return Created", `${r.return_no ?? r.return_id}`, "success");
        setShowForm(false);
        setForm({ customer_name: "", invoice_no: "", return_reason: "DEFECTIVE_PRODUCT", notes: "" });
      }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Return creation failed.", "error"); }
    finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">assignment_return</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">RMA Management</h2>
              <p className="text-xs text-slate-400">Return merchandise authorization - refund tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">+ New Return</button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><span className="material-symbols-outlined text-lg">close</span></button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        {showForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">New Return Request</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Customer Name *</label>
                <input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Invoice No *</label>
                <input value={form.invoice_no} onChange={(e) => setForm((f) => ({ ...f, invoice_no: e.target.value }))} placeholder="INV-2026-001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Return Reason</label>
                <select value={form.return_reason} onChange={(e) => setForm((f) => ({ ...f, return_reason: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/60">
                  {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional details"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/60" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition-all">
                {submitting ? "Creating..." : "Create Return"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          {["ALL", "INITIATED", "APPROVED", "RECEIVED", "REFUNDED", "REJECTED"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${filterStatus === s ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              {s}
            </button>
          ))}
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">assignment_return</span>
              <p className="text-sm">No returns found.</p>
            </div>
          ) : displayed.map((r) => (
            <div key={r.return_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
              <div>
                <p className="font-bold text-slate-100 font-mono">{r.return_no ?? r.return_id}</p>
                <p className="text-slate-500 mt-0.5">{r.customer_name ?? "—"} · Invoice: {r.invoice_no ?? "—"} · {r.return_date ?? "—"}</p>
                {r.return_reason && <p className="text-slate-600 text-[10px]">{r.return_reason.replace(/_/g, " ")}</p>}
              </div>
              <div className="flex items-center gap-3">
                {r.total_refund != null && <span className="font-black font-mono text-emerald-400">{fmt(r.total_refund)}</span>}
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
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

export default RMAManagementModal;
