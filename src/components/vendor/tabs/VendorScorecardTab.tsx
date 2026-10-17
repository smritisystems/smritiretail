/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.104.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.104.1 (2026-10-04):
 *   - Replaced supplierScorecardEngine mock with live apiFetchV1 call:
 *     GET /purchase/reports/outstanding.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import type { VendorDetail } from "../../../types/vendor";

interface SupplierOutstanding {
  supplier_id: string;
  supplier_name?: string;
  total_orders?: number;
  total_value?: number;
  outstanding_value?: number;
  overdue_value?: number;
  on_time_delivery_pct?: number;
  quality_score?: number;
  last_order_date?: string;
}

interface VendorScorecardTabProps {
  supplierId?: string;
  vendor?: VendorDetail;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

const ScoreBar: React.FC<{ label: string; score: number; color: string }> = ({ label, score, color }) => (
  <div>
    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
      <span>{label}</span><span className={`font-mono font-bold ${color}`}>{score}%</span>
    </div>
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  </div>
);

export const VendorScorecardTab: React.FC<VendorScorecardTabProps> = ({ supplierId, vendor }) => {
  const effectiveSupplierId = supplierId ?? vendor?.id;
  const [data, setData]         = useState<SupplierOutstanding[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await apiFetchV1<SupplierOutstanding[]>(`/purchase/reports/outstanding${effectiveSupplierId ? `?supplier_id=${effectiveSupplierId}` : ""}`);
      setData(result ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load vendor scorecard."); }
    finally { setLoading(false); }
  }, [effectiveSupplierId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 text-xs text-slate-500 animate-pulse">Loading vendor scorecard...</div>;
  if (error)   return <div className="p-4 m-4 text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-xl">{error}</div>;
  if (!data.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
      <span className="material-symbols-outlined text-4xl">storefront</span>
      <p className="text-sm">No vendor scorecard data available.</p>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {data.map((s) => (
        <div key={s.supplier_id} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-100">{s.supplier_name ?? s.supplier_id}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Last order: {s.last_order_date ?? "—"} · {s.total_orders ?? 0} orders total</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-300">{fmt(s.total_value ?? 0)}</p>
              <p className="text-[10px] text-slate-600">Total Business</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs text-center">
            {[
              { label: "Outstanding",  value: fmt(s.outstanding_value ?? 0),  color: "text-amber-400" },
              { label: "Overdue",      value: fmt(s.overdue_value ?? 0),      color: (s.overdue_value ?? 0) > 0 ? "text-rose-400 font-black" : "text-slate-400" },
              { label: "On-Time %",    value: `${s.on_time_delivery_pct ?? 0}%`, color: (s.on_time_delivery_pct ?? 0) >= 85 ? "text-emerald-400" : "text-amber-400" },
            ].map((m) => (
              <div key={m.label} className="bg-slate-900/60 border border-slate-800/40 rounded-lg p-2.5">
                <div className={`font-mono font-bold text-sm ${m.color}`}>{m.value}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            <ScoreBar label="On-Time Delivery"  score={s.on_time_delivery_pct ?? 0} color={`text-${(s.on_time_delivery_pct ?? 0) >= 85 ? "emerald" : "amber"}-400`} />
            <ScoreBar label="Quality Score"     score={s.quality_score ?? 0}        color={`text-${(s.quality_score ?? 0) >= 80 ? "emerald" : "amber"}-400`} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default VendorScorecardTab;
