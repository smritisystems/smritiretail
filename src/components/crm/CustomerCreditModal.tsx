/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.106.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.106.1 (2026-10-04):
 *   - Replaced customerCreditEngine mock with live apiFetchV1 call:
 *     GET /crm-growth/customers/{id}/segmentation.
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface CustomerSegmentation {
  customer_id: string;
  customer_name?: string;
  segment?: string;
  credit_limit?: number;
  credit_used?: number;
  credit_available?: number;
  payment_terms?: string;
  risk_score?: number;
  last_purchase_date?: string;
  total_purchases?: number;
}

interface CustomerCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

const RISK_COLOR = (score?: number) => {
  if (!score) return "text-slate-400";
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
};

export const CustomerCreditModal: React.FC<CustomerCreditModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [customerId, setCustomerId] = useState("");
  const [data, setData]             = useState<CustomerSegmentation | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    if (!customerId.trim()) { onNotification?.("Validation", "Customer ID is required.", "info"); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const result = await apiFetchV1<CustomerSegmentation>(`/crm-growth/customers/${customerId.trim()}/segmentation`);
      setData(result ?? null);
      if (!result) setError("No credit data found for this customer.");
    } catch (e: any) {
      setError(e?.message ?? "Customer credit lookup failed.");
      onNotification?.("Error", "Could not retrieve credit information.", "error");
    } finally { setLoading(false); }
  }, [customerId]);

  const creditPct = data ? Math.round(((data.credit_used ?? 0) / (data.credit_limit ?? 1)) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-400 text-2xl">credit_score</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer Credit Studio</h2>
              <p className="text-xs text-slate-400">Credit limit · Risk scoring · Payment terms</p>
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
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60" />
            <button onClick={handleLookup} disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-all">
              {loading ? "Loading..." : "Look Up"}
            </button>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-xl px-4 py-3">{error}</div>}

          {data && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-100">{data.customer_name ?? data.customer_id}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Segment: <span className="text-blue-400 font-semibold">{data.segment ?? "—"}</span> · Terms: <span className="text-slate-300">{data.payment_terms ?? "—"}</span></p>
                </div>
                {data.risk_score != null && (
                  <div className="text-center">
                    <p className={`text-3xl font-black font-mono ${RISK_COLOR(data.risk_score)}`}>{data.risk_score}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Risk Score</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Credit Position</p>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  {[
                    { label: "Credit Limit",     value: fmt(data.credit_limit ?? 0),     color: "text-slate-300" },
                    { label: "Used",             value: fmt(data.credit_used ?? 0),      color: "text-amber-400" },
                    { label: "Available",        value: fmt(data.credit_available ?? 0), color: "text-emerald-400 font-black" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-900/60 border border-slate-800/40 rounded-lg p-2.5">
                      <div className={`font-mono font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-[9px] text-slate-600 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Utilization</span><span className={creditPct > 80 ? "text-rose-400 font-bold" : "text-slate-400"}>{creditPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${creditPct > 80 ? "bg-rose-500" : creditPct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, creditPct)}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Last Purchase",  value: data.last_purchase_date ?? "—" },
                  { label: "Total Purchases",value: fmt(data.total_purchases ?? 0) },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</p>
                    <p className="font-mono font-bold text-slate-200 mt-1">{m.value}</p>
                  </div>
                ))}
              </div>
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

export default CustomerCreditModal;
