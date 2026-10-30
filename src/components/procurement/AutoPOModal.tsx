/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.122.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.122.1 (2026-10-04):
 *   - Replaced AutoPOEngine mock (ITEMS[]) with live apiFetchV1 calls:
 *     GET /purchase/reorder-suggestions, POST /purchase/reorder-suggestions/convert.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface ReorderSuggestion {
  suggestion_id?: string;
  sku: string;
  product_name: string;
  branch_code?: string;
  supplier_id?: string;
  supplier_name?: string;
  current_stock: number;
  reorder_point: number;
  reorder_qty: number;
  unit_cost?: number;
  lead_time_days?: number;
  severity?: string;
}

interface AutoPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  LOW:      "text-amber-400 bg-amber-500/10 border-amber-500/20",
  NORMAL:   "text-sky-400 bg-sky-500/10 border-sky-500/20",
};

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const AutoPOModal: React.FC<AutoPOModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [breaches, setBreaches]       = useState<ReorderSuggestion[]>([]);
  const [selected, setSelected]       = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading]         = useState(false);
  const [converting, setConverting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [filterSupplier, setFilterSupplier] = useState("ALL");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<ReorderSuggestion[]>("/purchase/reorder-suggestions");
      setBreaches(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reorder suggestions.");
      onNotification?.("Error", "Could not load stock breach data.", "error");
    } finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const suppliers = Array.from(new Set(breaches.map((b) => b.supplier_name).filter(Boolean)));
  const displayed = filterSupplier === "ALL" ? breaches : breaches.filter((b) => b.supplier_name === filterSupplier);

  const toggleSelect = (sku: string) => {
    setSelected((prev) =>
      prev.find((s) => s.sku === sku) ? prev.filter((s) => s.sku !== sku) : [...prev, breaches.find((b) => b.sku === sku)!]
    );
  };

  const handleConvert = async () => {
    if (!selected.length) { onNotification?.("No Items", "Select at least one breach to convert.", "info"); return; }
    setConverting(true);
    try {
      const result = await apiFetchV1("/purchase/reorder-suggestions/convert", {
        method: "POST",
        body: JSON.stringify({ skus: selected.map((s) => s.sku) }),
      });
      onNotification?.("PO Created", `Purchase order raised for ${selected.length} item(s).`, "success");
      setSelected([]);
      await load();
    } catch (e: any) {
      onNotification?.("Error", e?.message ?? "PO conversion failed.", "error");
    } finally { setConverting(false); }
  };

  const totalValue = selected.reduce((s, b) => s + (b.unit_cost ?? 0) * b.reorder_qty, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-400 text-2xl">inventory_2</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Auto Purchase Order</h2>
              <p className="text-xs text-slate-400">Stock breach detection - automatic PO generation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/30 text-xs">
          <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/60">
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => <option key={s!} value={s!}>{s}</option>)}
          </select>
          <span className="text-slate-500">Breaches: <strong className="text-slate-200">{displayed.length}</strong></span>
          <span className="text-slate-500">Selected: <strong className="text-amber-400">{selected.length}</strong></span>
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
              <p className="text-sm">No stock breaches detected.</p>
            </div>
          ) : displayed.map((b) => {
            const isSelected = !!selected.find((s) => s.sku === b.sku);
            const sev = b.severity ?? (b.current_stock === 0 ? "CRITICAL" : "NORMAL");
            return (
              <div key={b.sku} onClick={() => toggleSelect(b.sku)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? "border-amber-500/40 bg-amber-950/10" : "border-slate-700/50 bg-slate-800/20 hover:border-slate-600"}`}>
                <input type="checkbox" checked={isSelected} readOnly className="accent-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-100">{b.product_name}</p>
                  <p className="text-[10px] text-slate-500">{b.sku} - {b.supplier_name ?? "—"}</p>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs text-right">
                  <div><p className="font-mono text-rose-400 font-bold">{b.current_stock}</p><p className="text-slate-600">Current</p></div>
                  <div><p className="font-mono text-slate-300">{b.reorder_point}</p><p className="text-slate-600">Reorder Pt</p></div>
                  <div><p className="font-mono text-amber-400 font-bold">{b.reorder_qty}</p><p className="text-slate-600">Order Qty</p></div>
                  <div><p className="font-mono text-teal-400">{fmt((b.unit_cost ?? 0) * b.reorder_qty)}</p><p className="text-slate-600">Value</p></div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${SEVERITY_STYLE[sev] ?? ""}`}>{sev}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <div className="text-xs text-slate-400">
            Selected value: <span className="font-mono font-bold text-amber-400">{fmt(totalValue)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleConvert} disabled={!selected.length || converting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {converting ? "Creating PO..." : `Convert to PO (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoPOModal;
