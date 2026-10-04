/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.113.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.113.1 (2026-10-04):
 *   - Replaced markdownEngine mock with live apiFetchV1:
 *     GET /pricing/books, GET /pricing/sales-factors, POST /pricing/resolve/bulk.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface SalesFactor {
  factor_id: string;
  sku: string;
  product_name?: string;
  current_price?: number;
  sell_through_pct?: number;
  weeks_on_hand?: number;
  recommended_markdown_pct?: number;
  season?: string;
}

interface MarkdownPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

const URGENCY = (woh?: number) => {
  if (!woh) return { label: "N/A", color: "text-slate-500" };
  if (woh > 12) return { label: "URGENT", color: "text-rose-400" };
  if (woh > 6)  return { label: "MONITOR", color: "text-amber-400" };
  return { label: "OK", color: "text-emerald-400" };
};

export const MarkdownPlanningModal: React.FC<MarkdownPlanningModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [factors, setFactors]   = useState<SalesFactor[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [search, setSearch]     = useState("");
  const [filterUrgent, setFilterUrgent] = useState(false);

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<SalesFactor[]>("/pricing/sales-factors");
      setFactors(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load markdown planning data."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );

  const displayed = factors.filter((f) => {
    const matchSearch = !search || f.sku.toLowerCase().includes(search.toLowerCase()) || (f.product_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchUrgent = !filterUrgent || (f.weeks_on_hand ?? 0) > 6;
    return matchSearch && matchUrgent;
  });

  const handleApply = async () => {
    if (!selected.length) { onNotification?.("No Selection", "Select items to apply markdown.", "info"); return; }
    setApplying(true);
    try {
      await apiFetchV1("/pricing/resolve/bulk", {
        method: "POST",
        body: JSON.stringify({
          items: selected.map((id) => {
            const f = factors.find((x) => x.factor_id === id)!;
            return { sku: f.sku, qty: 1, markdown_override_pct: f.recommended_markdown_pct };
          }),
        }),
      });
      onNotification?.("Markdown Applied", `${selected.length} item(s) marked down.`, "success");
      setSelected([]);
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Markdown application failed.", "error"); }
    finally { setApplying(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-fuchsia-400 text-2xl">trending_down</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Markdown Planning Studio</h2>
              <p className="text-xs text-slate-400">Sell-through · Weeks-on-hand · AI-recommended markdowns</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or product..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-fuchsia-500/60 w-44" />
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors">
            <input type="checkbox" checked={filterUrgent} onChange={(e) => setFilterUrgent(e.target.checked)} className="accent-fuchsia-500" />
            Urgent only (&gt;6 WOH)
          </label>
          <span className="text-slate-500">{displayed.length} items</span>
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-600 uppercase text-[9px] border-b border-slate-800">
              <th className="py-2 px-3 text-left w-8"></th>
              <th className="py-2 px-3 text-left">SKU / Product</th>
              <th className="py-2 px-3 text-right">Current Price</th>
              <th className="py-2 px-3 text-right">Sell-Through %</th>
              <th className="py-2 px-3 text-right">Weeks on Hand</th>
              <th className="py-2 px-3 text-right">Rec. Markdown %</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800/40">
              {displayed.length === 0 && !loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">No items found.</td></tr>
              ) : displayed.map((f) => {
                const urg = URGENCY(f.weeks_on_hand);
                return (
                  <tr key={f.factor_id} onClick={() => toggle(f.factor_id)}
                    className={`cursor-pointer hover:bg-slate-800/20 transition-colors ${selected.includes(f.factor_id) ? "bg-fuchsia-950/10" : ""}`}>
                    <td className="py-2.5 px-3">
                      <input type="checkbox" checked={selected.includes(f.factor_id)} readOnly className="accent-fuchsia-500" />
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-mono text-slate-200">{f.sku}</p>
                      <p className="text-slate-500 text-[10px]">{f.product_name}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">{fmt(f.current_price ?? 0)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">{f.sell_through_pct ?? "—"}%</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${urg.color}`}>{f.weeks_on_hand ?? "—"}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-fuchsia-400">{f.recommended_markdown_pct ?? 0}%</td>
                    <td className="py-2.5 px-3 text-center"><span className={`text-[9px] font-bold ${urg.color}`}>{urg.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <span className="text-xs text-slate-400">{selected.length} items selected for markdown</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleApply} disabled={!selected.length || applying}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 transition-all">
              {applying ? "Applying..." : `Apply Markdowns (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownPlanningModal;
