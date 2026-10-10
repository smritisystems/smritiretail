/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.114.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.114.1 (2026-10-04):
 *   - Replaced stockExpiryEngine mock with GET /wms/batch-stocks live API.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface BatchStock {
  batch_id: string;
  sku: string;
  product_name?: string;
  batch_no?: string;
  warehouse_id?: string;
  expiry_date?: string;
  qty: number;
  days_to_expiry?: number;
}

interface StockExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const EXPIRY_COLOR = (days?: number) => {
  if (days == null) return "text-slate-400";
  if (days <= 0)  return "text-rose-400 font-black";
  if (days <= 7)  return "text-rose-400";
  if (days <= 30) return "text-amber-400";
  if (days <= 90) return "text-yellow-400";
  return "text-emerald-400";
};

const EXPIRY_LABEL = (days?: number) => {
  if (days == null) return "No Expiry";
  if (days <= 0)  return "EXPIRED";
  if (days <= 7)  return "CRITICAL";
  if (days <= 30) return "NEAR EXPIRY";
  if (days <= 90) return "WATCH";
  return "OK";
};

export const StockExpiryModal: React.FC<StockExpiryModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [batches, setBatches] = useState<BatchStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [filterDays, setFilterDays] = useState(90);
  const [search, setSearch]   = useState("");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<BatchStock[]>("/wms/batch-stocks");
      // Compute days_to_expiry if not provided
      const today = new Date();
      setBatches((data ?? []).map((b) => ({
        ...b,
        days_to_expiry: b.expiry_date
          ? Math.floor((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
          : undefined,
      })));
    } catch (e: any) { setError(e?.message ?? "Failed to load batch stocks."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const filtered = batches.filter((b) => {
    const matchDays = b.days_to_expiry == null ? false : b.days_to_expiry <= filterDays;
    const matchSearch = !search || b.sku.toLowerCase().includes(search.toLowerCase()) || (b.product_name ?? "").toLowerCase().includes(search.toLowerCase());
    return matchDays && matchSearch;
  });

  const expired   = batches.filter((b) => (b.days_to_expiry ?? 1) <= 0).length;
  const critical  = batches.filter((b) => (b.days_to_expiry ?? 999) > 0 && (b.days_to_expiry ?? 999) <= 7).length;
  const nearExpiry = batches.filter((b) => (b.days_to_expiry ?? 999) > 7 && (b.days_to_expiry ?? 999) <= 30).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-400 text-2xl">event_busy</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Stock Expiry Manager</h2>
              <p className="text-xs text-slate-400">Batch-level expiry tracking - FEFO alerts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/30">
          {[
            { label: "Expired",    count: expired,    color: "text-rose-400 font-black" },
            { label: "Critical (<7d)", count: critical,  color: "text-rose-400" },
            { label: "Near Expiry (<30d)", count: nearExpiry, color: "text-amber-400" },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className={`text-2xl font-black font-mono ${m.color}`}>{m.count}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or product..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500/60 w-48" />
          <span className="text-slate-500">Show items expiring within:</span>
          {[7, 30, 60, 90, 365].map((d) => (
            <button key={d} onClick={() => setFilterDays(d)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${filterDays === d ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              {d}d
            </button>
          ))}
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-600 uppercase text-[9px] border-b border-slate-800">
              <th className="py-2 px-3 text-left">SKU / Product</th>
              <th className="py-2 px-3 text-left">Batch</th>
              <th className="py-2 px-3 text-left">Warehouse</th>
              <th className="py-2 px-3 text-right">Qty</th>
              <th className="py-2 px-3 text-center">Expiry</th>
              <th className="py-2 px-3 text-center">Days Left</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 && !loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">No expiring batches found.</td></tr>
              ) : filtered.map((b) => (
                <tr key={b.batch_id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <p className="font-mono text-slate-200">{b.sku}</p>
                    <p className="text-slate-500 text-[10px]">{b.product_name}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{b.batch_no ?? "—"}</td>
                  <td className="py-2.5 px-3 text-slate-400">{b.warehouse_id ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-300">{b.qty}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400">{b.expiry_date ?? "—"}</td>
                  <td className={`py-2.5 px-3 text-center font-mono font-bold ${EXPIRY_COLOR(b.days_to_expiry)}`}>{b.days_to_expiry ?? "—"}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${EXPIRY_COLOR(b.days_to_expiry)} border-current/30`}>{EXPIRY_LABEL(b.days_to_expiry)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default StockExpiryModal;
