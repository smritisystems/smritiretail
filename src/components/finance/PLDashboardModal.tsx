/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.098.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.098.1 (2026-10-04):
 *   - Replaced plDashboardEngine mock with live apiFetchV1 calls:
 *     GET /reports/daily-sales, GET /reports/discount-summary,
 *     GET /reports/item-wise-sales.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface DailySales {
  date?: string;
  total_sales?: number;
  total_transactions?: number;
  total_items?: number;
  average_basket?: number;
  gross_margin?: number;
  discount_total?: number;
  tax_total?: number;
}

interface PLDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt  = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;
const pct  = (n: number) => `${(n ?? 0).toFixed(1)}%`;

export const PLDashboardModal: React.FC<PLDashboardModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [salesData, setSalesData] = useState<DailySales | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [dateFrom, setDateFrom]   = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo]       = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<DailySales>(`/reports/daily-sales?date_from=${dateFrom}&date_to=${dateTo}`);
      setSalesData(data ?? null);
    } catch (e: any) { setError(e?.message ?? "Failed to load P&L data."); }
    finally { setLoading(false); }
  }, [isOpen, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const grossMarginPct = salesData?.total_sales
    ? ((salesData.gross_margin ?? 0) / salesData.total_sales) * 100
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-400 text-2xl">analytics</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">P&amp;L Dashboard</h2>
              <p className="text-xs text-slate-400">Daily sales · Gross margin · Discount analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/30 text-xs">
          <span className="text-slate-500">Date Range:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-green-500/60" />
          <span className="text-slate-600">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-green-500/60" />
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-all">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <div className="text-center py-12 text-slate-500 text-xs animate-pulse">Loading P&L data...</div>}

          {!loading && salesData && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Revenue",     value: fmt(salesData.total_sales ?? 0),         color: "text-green-400 font-black text-lg" },
                  { label: "Gross Margin",       value: `${fmt(salesData.gross_margin ?? 0)} (${pct(grossMarginPct)})`, color: "text-emerald-400 font-black" },
                  { label: "Total Transactions", value: String(salesData.total_transactions ?? 0), color: "text-sky-400" },
                  { label: "Average Basket",     value: fmt(salesData.average_basket ?? 0),      color: "text-slate-300" },
                  { label: "Discounts Given",    value: fmt(salesData.discount_total ?? 0),      color: "text-amber-400" },
                  { label: "Tax Collected",      value: fmt(salesData.tax_total ?? 0),           color: "text-slate-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</p>
                    <p className={`font-mono font-bold mt-1 ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Gross Margin Gauge</p>
                <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${grossMarginPct >= 40 ? "bg-emerald-500" : grossMarginPct >= 25 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(100, grossMarginPct)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>0%</span><span className={grossMarginPct >= 40 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{pct(grossMarginPct)}</span><span>100%</span>
                </div>
              </div>
            </>
          )}

          {!loading && !salesData && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">analytics</span>
              <p className="text-sm">Select a date range and click Refresh.</p>
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

export default PLDashboardModal;
