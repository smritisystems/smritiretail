/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.110.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.110.1 (2026-10-04):
 *   - Replaced pricingDiscountEngine mock with live apiFetchV1 calls:
 *     GET /pricing/books, GET /pricing/tiers, POST /pricing/resolve.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface PriceBook {
  book_id: string;
  book_name: string;
  currency?: string;
  is_default?: boolean;
  valid_from?: string;
  valid_to?: string;
  entry_count?: number;
}

interface CustomerPriceTier {
  tier_id: string;
  tier_name: string;
  discount_pct?: number;
  min_order_value?: number;
}

interface PricingResolution {
  sku: string;
  base_price: number;
  resolved_price: number;
  discount_pct?: number;
  price_book?: string;
}

interface PricingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const PricingStudioModal: React.FC<PricingStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [books, setBooks]     = useState<PriceBook[]>([]);
  const [tiers, setTiers]     = useState<CustomerPriceTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"BOOKS" | "TIERS" | "RESOLVE">("BOOKS");
  const [resolveSku, setResolveSku]     = useState("");
  const [resolveQty, setResolveQty]     = useState("1");
  const [resolution, setResolution]     = useState<PricingResolution | null>(null);
  const [resolving, setResolving]       = useState(false);

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const [booksData, tiersData] = await Promise.all([
        apiFetchV1<PriceBook[]>("/pricing/books"),
        apiFetchV1<CustomerPriceTier[]>("/pricing/tiers"),
      ]);
      setBooks(booksData ?? []);
      setTiers(tiersData ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load pricing data."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!resolveSku) { onNotification?.("Validation", "SKU is required.", "info"); return; }
    setResolving(true); setResolution(null);
    try {
      const r = await apiFetchV1<PricingResolution>("/pricing/resolve", {
        method: "POST",
        body: JSON.stringify({ sku: resolveSku, qty: parseInt(resolveQty) || 1 }),
      });
      setResolution(r ?? null);
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Price resolution failed.", "error"); }
    finally { setResolving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-cyan-400 text-2xl">sell</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Pricing Studio</h2>
              <p className="text-xs text-slate-400">Price books · Customer tiers · Price resolution engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["BOOKS", "TIERS", "RESOLVE"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "BOOKS" ? "Price Books" : tab === "TIERS" ? "Customer Tiers" : "Resolve Price"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="text-center py-12 text-slate-500 text-xs animate-pulse">Loading pricing data...</div>}

          {!loading && activeTab === "BOOKS" && (
            <div className="space-y-2">
              {books.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl">menu_book</span>
                  <p className="text-sm">No price books configured.</p>
                </div>
              ) : books.map((b) => (
                <div key={b.book_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
                  <div>
                    <p className="font-bold text-slate-100">{b.book_name}</p>
                    <p className="text-slate-500 mt-0.5">{b.currency ?? "INR"} · {b.entry_count ?? 0} entries · {b.valid_from ?? "—"} to {b.valid_to ?? "Open"}</p>
                  </div>
                  {b.is_default && <span className="text-[9px] font-bold px-2 py-1 rounded-full border text-cyan-300 bg-cyan-500/15 border-cyan-500/25">DEFAULT</span>}
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === "TIERS" && (
            <div className="space-y-2">
              {tiers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl">grade</span>
                  <p className="text-sm">No customer price tiers configured.</p>
                </div>
              ) : tiers.map((t) => (
                <div key={t.tier_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
                  <p className="font-bold text-slate-100">{t.tier_name}</p>
                  <div className="flex items-center gap-4 text-right">
                    <div><p className="font-mono text-cyan-400 font-bold">{t.discount_pct ?? 0}%</p><p className="text-slate-600 text-[10px]">Discount</p></div>
                    <div><p className="font-mono text-slate-300">{fmt(t.min_order_value ?? 0)}</p><p className="text-slate-600 text-[10px]">Min Order</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === "RESOLVE" && (
            <div className="space-y-5 max-w-xl mx-auto">
              <p className="text-xs text-slate-400">Enter a SKU to resolve its effective selling price from the active price book and customer tier.</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">SKU *</label>
                  <input value={resolveSku} onChange={(e) => setResolveSku(e.target.value)} placeholder="SKU-001"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/60" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Quantity</label>
                  <input type="number" min={1} value={resolveQty} onChange={(e) => setResolveQty(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/60" />
                </div>
              </div>
              <button onClick={handleResolve} disabled={resolving}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 transition-all">
                {resolving ? "Resolving..." : "Resolve Price"}
              </button>
              {resolution && (
                <div className="bg-slate-800/40 border border-cyan-500/20 rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Resolution Result</p>
                  {[
                    { label: "SKU",            value: resolution.sku,              mono: true },
                    { label: "Base Price",      value: fmt(resolution.base_price),  color: "text-slate-300" },
                    { label: "Discount",        value: `${resolution.discount_pct ?? 0}%`, color: "text-amber-400" },
                    { label: "Resolved Price",  value: fmt(resolution.resolved_price), color: "text-cyan-400 font-black text-base" },
                    { label: "Price Book",      value: resolution.price_book ?? "—", mono: true },
                  ].map((line) => (
                    <div key={line.label} className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                      <span className="text-xs text-slate-500">{line.label}</span>
                      <span className={`font-mono text-xs ${line.color ?? "text-slate-200"}`}>{line.value}</span>
                    </div>
                  ))}
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

export default PricingStudioModal;
