/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.120.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.120.1 (2026-10-04):
 *   - Replaced SupplierPaymentEngine mock with live apiFetchV1 calls:
 *     GET /supplier-payments/, POST /supplier-payments.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface SupplierPayment {
  payment_id: string;
  payment_no?: string;
  supplier_id?: string;
  supplier_name?: string;
  amount: number;
  currency?: string;
  payment_mode?: string;
  status: string;
  payment_date?: string;
  reference?: string;
  notes?: string;
}

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "text-amber-300 bg-amber-500/15 border-amber-500/25",
  APPROVED:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  PAID:      "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  REJECTED:  "text-rose-300 bg-rose-500/15 border-rose-500/25",
  CANCELLED: "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "CHEQUE", "CASH", "UPI"];

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [payments, setPayments]     = useState<SupplierPayment[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({
    supplier_id: "", amount: "", payment_mode: "NEFT", reference: "", notes: "",
  });

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<SupplierPayment[]>("/supplier-payments/");
      setPayments(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load supplier payments.");
    } finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const displayed = filterStatus === "ALL" ? payments : payments.filter((p) => p.status === filterStatus);

  const handleSubmit = async () => {
    if (!form.supplier_id || !form.amount) {
      onNotification?.("Validation", "Supplier ID and Amount are required.", "info"); return;
    }
    setSubmitting(true);
    try {
      const p = await apiFetchV1<SupplierPayment>("/supplier-payments", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      if (p) {
        setPayments((prev) => [p, ...prev]);
        onNotification?.("Payment Created", `${p.payment_no ?? "Payment"} recorded successfully.`, "success");
        setShowForm(false);
        setForm({ supplier_id: "", amount: "", payment_mode: "NEFT", reference: "", notes: "" });
      }
    } catch (e: any) {
      onNotification?.("Error", e?.message ?? "Payment creation failed.", "error");
    } finally { setSubmitting(false); }
  };

  const totals = payments.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + p.amount; return acc;
  }, {} as Record<string, number>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-teal-400 text-2xl">payments</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Supplier Payment Studio</h2>
              <p className="text-xs text-slate-400">AP reconciliation - payment tracking - status workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 transition-all">
              + New Payment
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        {showForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">New Supplier Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Supplier ID</label>
                <input value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  placeholder="SUP-001" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Amount</label>
                <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Payment Mode</label>
                <select value={form.payment_mode} onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60">
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Reference</label>
                <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="UTR / Cheque No." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 transition-all">
                {submitting ? "Saving..." : "Create Payment"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          {["ALL", "PENDING", "APPROVED", "PAID", "REJECTED"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${filterStatus === s ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              {s} {s !== "ALL" && totals[s] ? `(${fmt(totals[s])})` : ""}
            </button>
          ))}
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">payments</span>
              <p className="text-sm">No payments found.</p>
            </div>
          ) : displayed.map((p) => (
            <div key={p.payment_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
              <div>
                <p className="font-bold text-slate-100 font-mono">{p.payment_no ?? p.payment_id}</p>
                <p className="text-slate-500 mt-0.5">{p.supplier_name ?? p.supplier_id} - {p.payment_mode} - {p.payment_date ?? "—"}</p>
                {p.reference && <p className="text-slate-600 text-[10px]">Ref: {p.reference}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black font-mono text-teal-400 text-base">{fmt(p.amount)}</span>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[p.status] ?? ""}`}>{p.status}</span>
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

export default SupplierPaymentModal;
