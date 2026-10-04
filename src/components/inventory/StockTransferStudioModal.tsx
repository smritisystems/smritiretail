/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.115.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.115.1 (2026-10-04):
 *   - Replaced stockTransferEngine mock with live apiFetchV1 calls:
 *     GET /wms/transfers, POST /wms/transfers,
 *     POST /wms/transfers/{id}/dispatch, POST /wms/transfers/{id}/receive.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface StockTransfer {
  transfer_id: string;
  transfer_no?: string;
  from_warehouse?: string;
  to_warehouse?: string;
  status: string;
  transfer_date?: string;
  notes?: string;
  items?: TransferItem[];
}

interface TransferItem {
  sku: string;
  product_name?: string;
  qty: number;
  uom?: string;
}

interface StockTransferStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:       "text-slate-400 bg-slate-800/30 border-slate-700/30",
  DISPATCHED:  "text-amber-300 bg-amber-500/15 border-amber-500/25",
  IN_TRANSIT:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  RECEIVED:    "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  CANCELLED:   "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

export const StockTransferStudioModal: React.FC<StockTransferStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [transfers, setTransfers]   = useState<StockTransfer[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [form, setForm] = useState({ from_warehouse: "", to_warehouse: "", notes: "", sku: "", qty: "1" });

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<StockTransfer[]>("/wms/transfers");
      setTransfers(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load transfers."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const displayed = filterStatus === "ALL" ? transfers : transfers.filter((t) => t.status === filterStatus);

  const handleCreate = async () => {
    if (!form.from_warehouse || !form.to_warehouse || !form.sku) {
      onNotification?.("Validation", "From/To warehouse and SKU are required.", "info"); return;
    }
    setSubmitting(true);
    try {
      const t = await apiFetchV1<StockTransfer>("/wms/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_warehouse: form.from_warehouse, to_warehouse: form.to_warehouse, notes: form.notes,
          items: [{ sku: form.sku, qty: parseInt(form.qty) || 1 }],
        }),
      });
      if (t) {
        setTransfers((prev) => [t, ...prev]);
        onNotification?.("Transfer Created", `${t.transfer_no ?? t.transfer_id}`, "success");
        setShowForm(false);
        setForm({ from_warehouse: "", to_warehouse: "", notes: "", sku: "", qty: "1" });
      }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Transfer creation failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleAction = async (id: string, action: "dispatch" | "receive") => {
    try {
      const t = await apiFetchV1<StockTransfer>(`/wms/transfers/${id}/${action}`, { method: "POST" });
      if (t) setTransfers((prev) => prev.map((x) => x.transfer_id === id ? t : x));
      onNotification?.("Updated", `Transfer ${action}ed.`, "success");
    } catch (e: any) { onNotification?.("Error", e?.message ?? `${action} failed.`, "error"); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-sky-400 text-2xl">sync_alt</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Stock Transfer Studio</h2>
              <p className="text-xs text-slate-400">Inter-warehouse transfers - dispatch - receive</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all">
              + New Transfer
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        {showForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">New Stock Transfer</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: "From Warehouse", key: "from_warehouse", placeholder: "WH-MUM-01" },
                { label: "To Warehouse",   key: "to_warehouse",   placeholder: "WH-DEL-01" },
                { label: "SKU",            key: "sku",            placeholder: "SKU-001" },
                { label: "Qty",            key: "qty",            placeholder: "1", type: "number" },
                { label: "Notes",          key: "notes",          placeholder: "Transfer reason..." },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/60" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 transition-all">
                {submitting ? "Creating..." : "Create Transfer"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          {["ALL", "DRAFT", "DISPATCHED", "IN_TRANSIT", "RECEIVED", "CANCELLED"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${filterStatus === s ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              {s}
            </button>
          ))}
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">sync_alt</span>
              <p className="text-sm">No transfers found.</p>
            </div>
          ) : displayed.map((t) => (
            <div key={t.transfer_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
              <div>
                <p className="font-bold text-slate-100 font-mono">{t.transfer_no ?? t.transfer_id}</p>
                <p className="text-slate-500 mt-0.5">{t.from_warehouse} → {t.to_warehouse} · {t.transfer_date ?? "—"}</p>
                {t.notes && <p className="text-slate-600 text-[10px]">{t.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[t.status] ?? ""}`}>{t.status}</span>
                {t.status === "DRAFT"      && <button onClick={() => handleAction(t.transfer_id, "dispatch")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all">Dispatch</button>}
                {t.status === "DISPATCHED" && <button onClick={() => handleAction(t.transfer_id, "receive")}  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">Receive</button>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default StockTransferStudioModal;
