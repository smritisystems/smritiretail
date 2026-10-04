/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.102.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.102.1 (2026-10-04):
 *   - Replaced customerSegmentationEngine mock with live apiFetchV1:
 *     GET /crm-growth/customers/{id}/segmentation.
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface SegmentationData {
  customer_id: string;
  customer_name?: string;
  segment?: string;
  rfm_score?: number;
  recency_days?: number;
  frequency?: number;
  monetary_value?: number;
  churn_risk?: string;
  ltv?: number;
  preferred_categories?: string[];
  last_purchase_date?: string;
}

interface CustomerSegmentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

const RISK_STYLE: Record<string, string> = {
  LOW:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  MEDIUM:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  HIGH:    "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export const CustomerSegmentationModal: React.FC<CustomerSegmentationModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [customerId, setCustomerId] = useState("");
  const [data, setData]             = useState<SegmentationData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    if (!customerId.trim()) { onNotification?.("Validation", "Customer ID is required.", "info"); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const result = await apiFetchV1<SegmentationData>(`/crm-growth/customers/${customerId.trim()}/segmentation`);
      setData(result ?? null);
      if (!result) setError("No segmentation data found for this customer.");
    } catch (e: any) {
      setError(e?.message ?? "Segmentation lookup failed.");
    } finally { setLoading(false); }
  }, [customerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-400 text-2xl">group_work</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer Segmentation</h2>
              <p className="text-xs text-slate-400">RFM analysis · Churn risk · LTV scoring</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex gap-3">
            <input value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="Enter Customer ID (e.g. CUST-001)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60" />
            <button onClick={handleLookup} disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-all">
              {loading ? "Loading..." : "Analyse"}
            </button>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-xl px-4 py-3">{error}</div>}

          {data && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-100">{data.customer_name ?? data.customer_id}</p>
                  <p className="text-xs text-slate-400">Segment: <span className="text-indigo-400 font-semibold">{data.segment ?? "—"}</span></p>
                </div>
                {data.rfm_score != null && (
                  <div className="text-center">
                    <p className="text-3xl font-black font-mono text-indigo-400">{data.rfm_score}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">RFM Score</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs text-center">
                {[
                  { label: "Recency",    value: `${data.recency_days ?? "—"}d`, color: "text-slate-300" },
                  { label: "Frequency",  value: `${data.frequency ?? "—"}x`,   color: "text-indigo-400" },
                  { label: "Monetary",   value: fmt(data.monetary_value ?? 0), color: "text-emerald-400 font-black" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
                    <div className={`font-mono font-bold ${m.color}`}>{m.value}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 text-xs">
                <span className="text-slate-500">Churn Risk</span>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${RISK_STYLE[data.churn_risk ?? "LOW"] ?? ""}`}>{data.churn_risk ?? "—"}</span>
              </div>

              {data.ltv != null && (
                <div className="bg-slate-800/30 border border-indigo-500/20 rounded-xl p-3 text-xs">
                  <span className="text-slate-500">Lifetime Value (LTV)</span>
                  <span className="font-mono font-black text-indigo-400 ml-3 text-sm">{fmt(data.ltv)}</span>
                </div>
              )}

              {(data.preferred_categories ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Preferred Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.preferred_categories!.map((cat) => (
                      <span key={cat} className="text-[9px] font-bold px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
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

export default CustomerSegmentationModal;
