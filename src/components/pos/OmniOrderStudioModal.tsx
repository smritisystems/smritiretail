/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.111.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.111.1 (2026-10-04):
 *   - Replaced omniOrderEngine mock with live apiFetchV1 calls:
 *     GET /sales/orders, POST /sales/orders.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface SalesOrder {
  order_id: string;
  order_no?: string;
  customer_name?: string;
  status: string;
  total_amount?: number;
  channel?: string;
  order_date?: string;
}

interface OmniOrderStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:      "text-slate-400 bg-slate-800/30 border-slate-700/30",
  CONFIRMED:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  PROCESSING: "text-amber-300 bg-amber-500/15 border-amber-500/25",
  SHIPPED:    "text-violet-300 bg-violet-500/15 border-violet-500/25",
  DELIVERED:  "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  CANCELLED:  "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

const CHANNELS = ["IN_STORE", "ONLINE", "WHATSAPP", "PHONE", "B2B"];
const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const OmniOrderStudioModal: React.FC<OmniOrderStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders]         = useState<SalesOrder[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterChannel, setFilterChannel] = useState("ALL");
  const [form, setForm] = useState({ customer_name: "", channel: "IN_STORE", notes: "" });

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<SalesOrder[]>("/sales/orders");
      setOrders(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load orders."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const displayed = orders.filter((o) => {
    const ms = filterStatus === "ALL" || o.status === filterStatus;
    const mc = filterChannel === "ALL" || o.channel === filterChannel;
    return ms && mc;
  });

  const handleCreate = async () => {
    if (!form.customer_name) { onNotification?.("Validation", "Customer name is required.", "info"); return; }
    setSubmitting(true);
    try {
      const o = await apiFetchV1<SalesOrder>("/sales/orders", {
        method: "POST",
        body: JSON.stringify({ customer_name: form.customer_name, channel: form.channel, notes: form.notes }),
      });
      if (o) {
        setOrders((prev) => [o, ...prev]);
        onNotification?.("Order Created", `${o.order_no ?? o.order_id}`, "success");
        setShowForm(false);
        setForm({ customer_name: "", channel: "IN_STORE", notes: "" });
      }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Order creation failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const totalValue = displayed.reduce((s, o) => s + (o.total_amount ?? 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-violet-400 text-2xl">shopping_cart</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Omni-Order Studio</h2>
              <p className="text-xs text-slate-400">Multi-channel order management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all">+ New Order</button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><span className="material-symbols-outlined text-lg">close</span></button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        {showForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">New Order</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Customer Name *</label>
                <input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Channel</label>
                <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500/60">
                  {CHANNELS.map((c) => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Order notes"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500/60" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-all">
                {submitting ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          {["ALL", "DRAFT", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${filterStatus === s ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              {s}
            </button>
          ))}
          <span className="ml-auto text-slate-500 flex-shrink-0">{displayed.length} orders · {fmt(totalValue)}</span>
          {loading && <span className="text-slate-500 animate-pulse">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">shopping_cart</span>
              <p className="text-sm">No orders found.</p>
            </div>
          ) : displayed.map((o) => (
            <div key={o.order_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
              <div>
                <p className="font-bold text-slate-100 font-mono">{o.order_no ?? o.order_id}</p>
                <p className="text-slate-500 mt-0.5">{o.customer_name ?? "—"} · {o.channel ?? "—"} · {o.order_date ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black font-mono text-violet-400">{fmt(o.total_amount ?? 0)}</span>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[o.status] ?? ""}`}>{o.status}</span>
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

export default OmniOrderStudioModal;
