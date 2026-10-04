/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.105.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.105.1 (2026-10-04):
 *   - Replaced consignmentEngine mock with live apiFetchV1 calls:
 *     GET /purchase/reorder-suggestions (consignment items), POST /purchase/orders.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface ConsignmentItem {
  suggestion_id?: string;
  sku: string;
  product_name: string;
  supplier_id?: string;
  supplier_name?: string;
  current_stock: number;
  consignment_qty?: number;
  reorder_qty: number;
  unit_cost?: number;
}

interface ConsignmentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const ConsignmentStudioModal: React.FC<ConsignmentStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [items, setItems]           = useState<ConsignmentItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<string[]>([]);
  const [filterSupplier, setFilterSupplier] = useState("ALL");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<ConsignmentItem[]>("/purchase/reorder-suggestions?type=consignment");
      setItems(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load consignment stock."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const suppliers = Array.from(new Set(items.map((i) => i.supplier_name).filter(Boolean)));
  const displayed = filterSupplier === "ALL" ? items : items.filter((i) => i.supplier_name === filterSupplier);

  const toggle = (sku: string) => setSelected((prev) =>
    prev.includes(sku) ? prev.filter((x) => x !== sku) : [...prev, sku]
  );

  const handleConvertToOrder = async () => {
    if (!selected.length) { onNotification?.("No Selection", "Select items to convert.", "info"); return; }
    setSubmitting(true);
    try {
      await apiFetchV1("/purchase/orders", {
        method: "POST",
        body: JSON.stringify({
          order_type: "CONSIGNMENT",
          items: selected.map((sku) => {
            const item = items.find((i) => i.sku === sku)!;
            return { sku, qty: item.consignment_qty ?? item.reorder_qty, supplier_id: item.supplier_id };
          }),
        }),
      });
      onNotification?.("Consignment Order", `PO raised for ${selected.length} consignment item(s).`, "success");
      setSelected([]);
      await load();
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Consignment order failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const totalValue = selected.reduce((s, sku) => {
    const item = items.find((i) => i.sku === sku);
    return s + (item ? (item.unit_cost ?? 0) * (item.consignment_qty ?? item.reorder_qty) : 0);
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-teal-400 text-2xl">package_2</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Consignment Studio</h2>
              <p className="text-xs text-slate-400">Supplier-held stock management and PO conversion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs">
          <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-teal-500/60">
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => <option key={s!} value={s!}>{s}</option>)}
          </select>
          <span className="text-slate-500">{displayed.length} items · {selected.length} selected</span>
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">package_2</span>
              <p className="text-sm">No consignment items found.</p>
            </div>
          ) : displayed.map((item) => (
            <div key={item.sku} onClick={() => toggle(item.sku)}
              className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${selected.includes(item.sku) ? "border-teal-500/40 bg-teal-950/10" : "border-slate-700/50 bg-slate-800/20 hover:border-slate-600"}`}>
              <input type="checkbox" checked={selected.includes(item.sku)} readOnly className="accent-teal-500" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-100">{item.product_name}</p>
                <p className="text-[10px] text-slate-500">{item.sku} · {item.supplier_name ?? "—"}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs text-right">
                <div><p className="font-mono text-slate-300 font-bold">{item.current_stock}</p><p className="text-slate-600">In Stock</p></div>
                <div><p className="font-mono text-teal-400 font-bold">{item.consignment_qty ?? item.reorder_qty}</p><p className="text-slate-600">Consign Qty</p></div>
                <div><p className="font-mono text-slate-300">{fmt((item.unit_cost ?? 0) * (item.consignment_qty ?? item.reorder_qty))}</p><p className="text-slate-600">Value</p></div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <p className="text-xs text-slate-400">Selected value: <span className="font-mono font-black text-teal-400">{fmt(totalValue)}</span></p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleConvertToOrder} disabled={!selected.length || submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 transition-all">
              {submitting ? "Creating..." : `Convert to PO (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsignmentStudioModal;
