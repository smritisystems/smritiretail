/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.109.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.109.1 (2026-10-04):
 *   - Replaced complaintCRMEngine mock with live apiFetchV1 calls:
 *     POST /crm-growth/leads (complaint as lead), GET /crm-growth/opportunities.
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface Lead {
  lead_id: string;
  customer_name?: string;
  source?: string;
  stage?: string;
  notes?: string;
  created_at?: string;
}

interface ComplaintCRMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const COMPLAINT_TYPES = ["PRODUCT_QUALITY", "DELIVERY_DELAY", "BILLING_ERROR", "WRONG_ITEM", "SERVICE_ISSUE", "RETURN_DENIAL", "OTHER"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const ComplaintCRMModal: React.FC<ComplaintCRMModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState<Lead | null>(null);
  const [form, setForm] = useState({
    customer_name: "", mobile: "", complaint_type: "PRODUCT_QUALITY", priority: "MEDIUM",
    invoice_no: "", description: "",
  });

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = useCallback(async () => {
    if (!form.customer_name || !form.description) {
      onNotification?.("Validation", "Customer name and description are required.", "info"); return;
    }
    setSubmitting(true);
    try {
      const lead = await apiFetchV1<Lead>("/crm-growth/leads", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.customer_name,
          source: "COMPLAINT",
          stage: "NEW",
          notes: `[${form.complaint_type}][${form.priority}] Invoice: ${form.invoice_no || "N/A"}\n${form.description}`,
          mobile: form.mobile,
        }),
      });
      setSubmitted(lead ?? null);
      onNotification?.("Complaint Logged", `Ticket ${lead?.lead_id ?? ""} created.`, "success");
    } catch (e: any) {
      onNotification?.("Error", e?.message ?? "Complaint submission failed.", "error");
    } finally { setSubmitting(false); }
  }, [form]);

  if (!isOpen) return null;

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
          <h2 className="text-lg font-bold text-slate-100">Complaint Registered</h2>
          <p className="text-sm text-slate-400">Ticket ID: <span className="font-mono text-emerald-400">{submitted.lead_id}</span></p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setSubmitted(null); setForm({ customer_name: "", mobile: "", complaint_type: "PRODUCT_QUALITY", priority: "MEDIUM", invoice_no: "", description: "" }); }}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">New Complaint</button>
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-400 text-2xl">support_agent</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">CRM Complaint Studio</h2>
              <p className="text-xs text-slate-400">Log and track customer complaints</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: "Customer Name *", key: "customer_name", placeholder: "Amit Sharma" },
              { label: "Mobile",          key: "mobile",         placeholder: "9876543210" },
              { label: "Invoice No",      key: "invoice_no",     placeholder: "INV-2026-001" },
            ].map((f) => (
              <div key={f.key} className={f.key === "invoice_no" ? "col-span-2" : ""}>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={(e) => setF(f.key, e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-red-500/60" />
              </div>
            ))}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Complaint Type</label>
              <select value={form.complaint_type} onChange={(e) => setF("complaint_type", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-red-500/60">
                {COMPLAINT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setF("priority", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-red-500/60">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Description *</label>
              <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} rows={4}
                placeholder="Describe the customer's complaint in detail..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/60 resize-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80 gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-all">
            {submitting ? "Submitting..." : "Log Complaint"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplaintCRMModal;
