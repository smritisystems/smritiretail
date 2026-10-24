/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.112.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.112.1 (2026-10-04):
 *   - Replaced dynamicPricingEngine mock with live apiFetchV1 calls:
 *     POST /pricing/resolve/bulk, GET /pricing/books.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";

interface PriceBook {
  book_id: string;
  book_name: string;
  is_default?: boolean;
}

interface BulkPriceResult {
  sku: string;
  base_price: number;
  resolved_price: number;
  discount_pct?: number;
  applied_rule?: string;
}

interface DynamicPricingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const DynamicPricingStudioModal: React.FC<DynamicPricingStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [books, setBooks]         = useState<PriceBook[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [results, setResults]     = useState<BulkPriceResult[]>([]);
  const [resolving, setResolving] = useState(false);
  const [skuInput, setSkuInput]   = useState("");
  const [selectedBook, setSelectedBook] = useState("");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<PriceBook[]>("/pricing/books");
      setBooks(data ?? []);
      const def = (data ?? []).find((b: PriceBook) => b.is_default);
      if (def) setSelectedBook(def.book_id);
    } catch (e: any) { setError(e?.message ?? "Failed to load price books."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const handleBulkResolve = async () => {
    const skus = skuInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!skus.length) { onNotification?.("Validation", "Enter at least one SKU.", "info"); return; }
    setResolving(true); setResults([]);
    try {
      const data = await apiFetchV1<{ items: BulkPriceResult[] }>("/pricing/resolve/bulk", {
        method: "POST",
        body: JSON.stringify({
          items: skus.map((sku) => ({ sku, qty: 1 })),
          book_id: selectedBook || undefined,
        }),
      });
      setResults(data?.items ?? []);
      onNotification?.("Resolved", `${(data?.items ?? []).length} SKU(s) priced.`, "success");
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Bulk resolution failed.", "error"); }
    finally { setResolving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lime-400 text-2xl">auto_graph</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Dynamic Pricing Studio</h2>
              <p className="text-xs text-slate-400">Bulk price resolution · Rule-engine evaluation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex gap-5 flex-1 overflow-hidden p-5">
          <div className="w-72 flex-shrink-0 flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1.5">Price Book</label>
              <select value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-lime-500/60">
                <option value="">Default</option>
                {books.map((b) => <option key={b.book_id} value={b.book_id}>{b.book_name}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1.5">SKUs (one per line or comma-separated)</label>
              <textarea value={skuInput} onChange={(e) => setSkuInput(e.target.value)}
                placeholder={"SKU-001\nSKU-002\nSKU-003"}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-lime-500/60 resize-none font-mono min-h-[120px]" />
            </div>
            <button onClick={handleBulkResolve} disabled={resolving || loading}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-lime-600 hover:bg-lime-500 disabled:opacity-40 transition-all">
              {resolving ? "Resolving..." : "Resolve Bulk Prices"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <span className="material-symbols-outlined text-4xl">auto_graph</span>
                <p className="text-sm">Enter SKUs and click Resolve to see dynamic pricing.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((r) => (
                  <div key={r.sku} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
                    <div>
                      <p className="font-mono font-bold text-slate-200">{r.sku}</p>
                      {r.applied_rule && <p className="text-slate-500 text-[10px]">Rule: {r.applied_rule}</p>}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div><p className="font-mono text-slate-400 line-through">{fmt(r.base_price)}</p><p className="text-slate-600 text-[10px]">Base</p></div>
                      {(r.discount_pct ?? 0) > 0 && <div><p className="font-mono text-amber-400">-{r.discount_pct}%</p><p className="text-slate-600 text-[10px]">Discount</p></div>}
                      <div><p className="font-mono font-black text-lime-400 text-base">{fmt(r.resolved_price)}</p><p className="text-slate-600 text-[10px]">Final</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default DynamicPricingStudioModal;
