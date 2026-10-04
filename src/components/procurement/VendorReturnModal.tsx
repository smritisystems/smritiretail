/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.119.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.119.1 (2026-10-04):
 *   - Replaced VendorReturnEngine mock with live apiFetchV1 calls:
 *     POST /purchase/debit-notes, GET /purchase/debit-notes (list by supplier).
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

const RETURN_REASONS = ["QUALITY_DEFECT", "DAMAGED_IN_TRANSIT", "WRONG_ITEM", "EXCESS_SUPPLY", "SHORT_EXPIRY", "PRICE_DISCREPANCY", "SPECIFICATION_MISMATCH"];

interface DebitNoteItem {
  sku: string;
  product_name: string;
  return_qty: number;
  unit_price: number;
  reason: string;
}

interface VendorReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const VendorReturnModal: React.FC<VendorReturnModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [supplierId, setSupplierId]   = useState("");
  const [grn, setGrn]                 = useState("");
  const [items, setItems]             = useState<DebitNoteItem[]>([{
    sku: "", product_name: "", return_qty: 1, unit_price: 0, reason: "QUALITY_DEFECT",
  }]);
  const [notes, setNotes]             = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState<any>(null);

  const addItem = () => setItems((prev) => [...prev, { sku: "", product_name: "", return_qty: 1, unit_price: 0, reason: "QUALITY_DEFECT" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof DebitNoteItem, val: string | number) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const totalValue = items.reduce((s, it) => s + it.return_qty * it.unit_price, 0);

  const handleSubmit = useCallback(async () => {
    if (!supplierId) { onNotification?.("Validation", "Supplier ID is required.", "info"); return; }
    if (items.some((it) => !it.sku || it.return_qty <= 0)) {
      onNotification?.("Validation", "All items must have a valid SKU and quantity.", "info"); return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetchV1("/purchase/debit-notes", {
        method: "POST",
        body: JSON.stringify({ supplier_id: supplierId, grn_no: grn, notes, items }),
      });
      setSubmitted(result);
      onNotification?.("Debit Note Created", `Vendor return recorded. Total: ${fmt(totalValue)}`, "success");
    } catch (e: any) {
      onNotification?.("Error", e?.message ?? "Debit note creation failed.", "error");
    } finally { setSubmitting(false); }
  }, [supplierId, grn, items, notes, totalValue]);

  if (!isOpen) return null;

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
          <h2 className="text-lg font-bold text-slate-100">Debit Note Created</h2>
          <p className="text-sm text-slate-400">Ref: <span className="font-mono text-emerald-400">{submitted?.debit_note_no ?? submitted?.id ?? "—"}</span></p>
          <p className="text-xl font-black font-mono text-emerald-400">{fmt(totalValue)}</p>
          <button onClick={() => { setSubmitted(null); setSupplierId(""); setGrn(""); setItems([{ sku: "", product_name: "", return_qty: 1, unit_price: 0, reason: "QUALITY_DEFECT" }]); setNotes(""); }}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">New Return</button>
          <button onClick={onClose} className="ml-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-400 text-2xl">assignment_return</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Vendor Return (Debit Note)</h2>
              <p className="text-xs text-slate-400">Return goods to supplier with a formal debit note</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Supplier ID *</label>
              <input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="SUP-001" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">GRN Number</label>
              <input value={grn} onChange={(e) => setGrn(e.target.value)} placeholder="GRN-2026-001" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/60" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-300">Return Items</p>
              <button onClick={addItem} className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-xs">
                  <div>
                    <label className="text-[9px] text-slate-600 block mb-1">SKU</label>
                    <input value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)}
                      placeholder="SKU-001" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-rose-500/60" />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-600 block mb-1">Qty</label>
                    <input type="number" min={1} value={item.return_qty} onChange={(e) => updateItem(i, "return_qty", parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-rose-500/60" />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-600 block mb-1">Unit Price</label>
                    <input type="number" min={0} value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-rose-500/60" />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-600 block mb-1">Reason</label>
                    <select value={item.reason} onChange={(e) => updateItem(i, "reason", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-rose-500/60">
                      {RETURN_REASONS.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <div className="flex-1">
                      <p className="text-[9px] text-slate-600">Value</p>
                      <p className="font-mono font-bold text-rose-400">{fmt(item.return_qty * item.unit_price)}</p>
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-slate-600 hover:text-rose-400 ml-1">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Additional remarks for this return..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/60 resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <p className="text-xs text-slate-400">Total Return Value: <span className="font-mono font-black text-rose-400">{fmt(totalValue)}</span></p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-all">
              {submitting ? "Creating..." : "Create Debit Note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorReturnModal;
