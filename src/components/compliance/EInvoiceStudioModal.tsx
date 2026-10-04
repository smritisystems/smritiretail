/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Version      : 3.120.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.120.1 (2026-10-04):
 *   - Replaced eInvoiceEngine mock with live apiFetchV1 calls:
 *     GET /einvoice-studio/einvoice, POST /einvoice-studio/einvoice/generate,
 *     POST /einvoice-studio/einvoice/cancel.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface EInvoice {
  id: string;
  invoice_id: string;
  invoice_no: string;
  gstin_supplier?: string;
  gstin_buyer?: string;
  invoice_value?: number;
  irn?: string;
  ack_no?: string;
  ack_date?: string;
  status: string;
  cancel_reason?: string;
  retry_count: number;
  error_detail?: string;
  created_at?: string;
}

interface EInvoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "text-amber-300 bg-amber-500/15 border-amber-500/25",
  GENERATED: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  CANCELLED: "text-rose-300 bg-rose-500/15 border-rose-500/25",
  FAILED:    "text-red-400 bg-red-900/20 border-red-700/30",
};

export const EInvoiceStudioModal: React.FC<EInvoiceStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [invoices, setInvoices]     = useState<EInvoice[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"LIST" | "GENERATE" | "CANCEL">("LIST");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [genForm, setGenForm]       = useState({ invoice_id: "", invoice_no: "", gstin_supplier: "", gstin_buyer: "", invoice_value: "" });
  const [cancelIrn, setCancelIrn]   = useState("");
  const [cancelReason, setCancelReason] = useState("1");
  const [cancelRemark, setCancelRemark] = useState("");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const qs = filterStatus !== "ALL" ? `?status=${filterStatus}` : "";
      const data = await apiFetchV1<EInvoice[]>(`/einvoice-studio/einvoice${qs}`);
      setInvoices(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load e-invoices."); }
    finally { setLoading(false); }
  }, [isOpen, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!genForm.invoice_id || !genForm.invoice_no) { onNotification?.("Validation", "Invoice ID and Invoice No are required.", "info"); return; }
    setSubmitting(true);
    try {
      const inv = await apiFetchV1<EInvoice>("/einvoice-studio/einvoice/generate", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: genForm.invoice_id,
          invoice_no: genForm.invoice_no,
          gstin_supplier: genForm.gstin_supplier || undefined,
          gstin_buyer: genForm.gstin_buyer || undefined,
          invoice_value: genForm.invoice_value ? parseFloat(genForm.invoice_value) : undefined,
        }),
      });
      if (inv) {
        setInvoices((p) => [inv, ...p]);
        onNotification?.("IRN Generated", `IRN: ${inv.irn?.slice(0, 20)}...`, "success");
        setActiveTab("LIST");
        setGenForm({ invoice_id: "", invoice_no: "", gstin_supplier: "", gstin_buyer: "", invoice_value: "" });
      }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "IRN generation failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!cancelIrn) { onNotification?.("Validation", "IRN is required.", "info"); return; }
    setSubmitting(true);
    try {
      const inv = await apiFetchV1<EInvoice>("/einvoice-studio/einvoice/cancel", {
        method: "POST",
        body: JSON.stringify({ irn: cancelIrn, cancel_reason: cancelReason, cancel_remark: cancelRemark || undefined }),
      });
      if (inv) setInvoices((p) => p.map((x) => x.id === inv.id ? inv : x));
      onNotification?.("IRN Cancelled", "E-Invoice has been cancelled.", "success");
      setCancelIrn(""); setCancelReason("1"); setCancelRemark("");
      setActiveTab("LIST");
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Cancellation failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const displayed = filterStatus === "ALL" ? invoices : invoices.filter((i) => i.status === filterStatus);
  const stats = {
    generated: invoices.filter((i) => i.status === "GENERATED").length,
    pending:   invoices.filter((i) => i.status === "PENDING").length,
    failed:    invoices.filter((i) => i.status === "FAILED").length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-400 text-2xl">receipt</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">E-Invoice Studio (IRP / NIC)</h2>
              <p className="text-xs text-slate-400">Generate IRN · Cancel e-invoices · Track GST compliance</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(["LIST", "GENERATE", "CANCEL"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {t === "LIST" ? "E-Invoices" : t === "GENERATE" ? "Generate IRN" : "Cancel IRN"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/30 text-xs text-center">
          {[
            { label: "IRNs Generated", value: stats.generated, color: "text-emerald-400" },
            { label: "Pending",        value: stats.pending,   color: "text-amber-400" },
            { label: "Failed",         value: stats.failed,    color: "text-rose-400" },
          ].map((m) => (
            <div key={m.label}>
              <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "LIST" && (
            <>
              <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs">
                {["ALL", "PENDING", "GENERATED", "CANCELLED", "FAILED"].map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${filterStatus === s ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                    {s}
                  </button>
                ))}
                {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
              </div>
              <div className="p-4 space-y-2">
                {displayed.length === 0 && !loading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                    <span className="material-symbols-outlined text-4xl">receipt</span>
                    <p className="text-sm">No e-invoices found. Generate one to start.</p>
                  </div>
                ) : displayed.map((inv) => (
                  <div key={inv.id} className="p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-100 font-mono">{inv.invoice_no}</p>
                        <p className="text-slate-500 mt-0.5">{inv.gstin_supplier ?? "—"} → {inv.gstin_buyer ?? "—"}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${STATUS_STYLE[inv.status] ?? ""}`}>{inv.status}</span>
                    </div>
                    {inv.irn && (
                      <div className="bg-slate-900/60 border border-slate-800/40 rounded-lg px-3 py-2">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">IRN</p>
                        <p className="font-mono text-emerald-400 text-[10px] break-all">{inv.irn}</p>
                        {inv.ack_no && <p className="text-slate-500 text-[10px] mt-0.5">ACK: {inv.ack_no}</p>}
                      </div>
                    )}
                    {inv.error_detail && <p className="text-rose-400 text-[10px] bg-rose-950/20 rounded px-2 py-1">{inv.error_detail}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "GENERATE" && (
            <div className="p-6 space-y-4 text-xs max-w-lg">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Generate IRN</p>
              {[
                { label: "Invoice ID (SMRITI) *", key: "invoice_id",     placeholder: "INV-UUID" },
                { label: "Invoice No *",           key: "invoice_no",     placeholder: "INV-2026-001" },
                { label: "GSTIN Supplier",         key: "gstin_supplier", placeholder: "27AABCU9603R1ZX" },
                { label: "GSTIN Buyer",            key: "gstin_buyer",    placeholder: "27AABCU9603R1ZX" },
                { label: "Invoice Value (₹)",      key: "invoice_value",  placeholder: "50000", type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={(genForm as any)[f.key]}
                    onChange={(e) => setGenForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500/60" />
                </div>
              ))}
              <button onClick={handleGenerate} disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-all">
                {submitting ? "Generating IRN..." : "Generate IRN"}
              </button>
            </div>
          )}

          {activeTab === "CANCEL" && (
            <div className="p-6 space-y-4 text-xs max-w-lg">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Cancel IRN</p>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">IRN *</label>
                <input value={cancelIrn} onChange={(e) => setCancelIrn(e.target.value)} placeholder="64-character IRN hash"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-rose-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Cancel Reason *</label>
                <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500/60">
                  <option value="1">1 — Duplicate</option>
                  <option value="2">2 — Data Entry Mistake</option>
                  <option value="3">3 — Order Cancelled</option>
                  <option value="4">4 — Others</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Remark</label>
                <input value={cancelRemark} onChange={(e) => setCancelRemark(e.target.value)} placeholder="Optional remark..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500/60" />
              </div>
              <button onClick={handleCancel} disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-all">
                {submitting ? "Cancelling..." : "Cancel IRN"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default EInvoiceStudioModal;
