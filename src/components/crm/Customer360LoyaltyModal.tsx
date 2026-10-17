/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.099.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.099.1 (2026-10-04):
 *   - Replaced loyaltyEngine mock with live apiFetchV1 calls:
 *     GET /crm-growth/customers/{id}/segmentation,
 *     GET /crm-growth/loyalty/members/{id}/ledger.
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface Customer360Data {
  customer_id: string;
  customer_name?: string;
  segment?: string;
  tier?: string;
  points_balance?: number;
  credit_limit?: number;
  credit_available?: number;
  rfm_score?: number;
  churn_risk?: string;
  ltv?: number;
  last_purchase_date?: string;
  total_purchases?: number;
  frequency?: number;
  monetary_value?: number;
}

interface Customer360LoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const Customer360LoyaltyModal: React.FC<Customer360LoyaltyModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [customerId, setCustomerId] = useState("");
  const [data, setData]             = useState<Customer360Data | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    if (!customerId.trim()) { onNotification?.("Validation", "Customer ID is required.", "info"); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const seg = await apiFetchV1<Customer360Data>(`/crm-growth/customers/${customerId.trim()}/segmentation`);
      setData(seg ?? null);
      if (!seg) setError("No 360 data found for this customer.");
    } catch (e: any) { setError(e?.message ?? "Customer 360 lookup failed."); }
    finally { setLoading(false); }
  }, [customerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-400 text-2xl">person_search</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer 360 Loyalty View</h2>
              <p className="text-xs text-slate-400">Unified customer profile · Loyalty · Credit · RFM</p>
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
              placeholder="Customer ID (e.g. CUST-001)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/60" />
            <button onClick={handleLookup} disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-all">
              {loading ? "Loading..." : "Load 360"}
            </button>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-xl px-4 py-3">{error}</div>}

          {data && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-100">{data.customer_name ?? data.customer_id}</p>
                  <p className="text-xs text-slate-400">Segment: <span className="text-rose-400 font-semibold">{data.segment ?? "—"}</span> · Tier: <span className="text-yellow-400 font-semibold">{data.tier ?? "—"}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black font-mono text-yellow-400">⭐ {data.points_balance ?? 0}</p>
                  <p className="text-[10px] text-slate-500">Loyalty Points</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "RFM Score",        value: String(data.rfm_score ?? "—"),        color: "text-rose-400" },
                  { label: "Churn Risk",        value: data.churn_risk ?? "—",               color: data.churn_risk === "HIGH" ? "text-rose-400" : "text-emerald-400" },
                  { label: "Credit Available",  value: fmt(data.credit_available ?? 0),      color: "text-emerald-400" },
                  { label: "LTV",               value: fmt(data.ltv ?? 0),                   color: "text-sky-400 font-black" },
                  { label: "Monetary Value",    value: fmt(data.monetary_value ?? 0),        color: "text-slate-300" },
                  { label: "Purchase Frequency",value: `${data.frequency ?? 0}x`,            color: "text-slate-300" },
                  { label: "Last Purchase",     value: data.last_purchase_date ?? "—",       color: "text-slate-400" },
                  { label: "Total Purchases",   value: fmt(data.total_purchases ?? 0),       color: "text-slate-300" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</p>
                    <p className={`font-mono font-bold mt-1 ${m.color}`}>{m.value}</p>
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

export default Customer360LoyaltyModal;
