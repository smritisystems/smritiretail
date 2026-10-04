/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.108.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.108.1 (2026-10-04):
 *   - Replaced BundlingEngine mock (SAMPLE_CART[]) with live apiFetchV1 calls:
 *     GET /promotions/campaigns, POST /promotions/campaigns,
 *     POST /promotions/evaluate.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  promo_type: string;
  status: string;
  discount_value?: number;
  min_qty?: number;
  valid_from?: string;
  valid_to?: string;
}

interface BundlingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const PROMO_TYPES = ["FLAT", "PERCENT", "BUY_X_GET_Y", "COMBO"];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  INACTIVE: "text-slate-400 bg-slate-700/20 border-slate-600/30",
  DRAFT:    "text-amber-300 bg-amber-500/15 border-amber-500/25",
  EXPIRED:  "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

export const BundlingModal: React.FC<BundlingModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [filterType, setFilterType]   = useState("ALL");
  const [form, setForm]               = useState({
    campaign_name: "", promo_type: "COMBO", discount_value: "", min_qty: "", valid_from: "", valid_to: "",
  });

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<Campaign[]>("/promotions/campaigns");
      setCampaigns(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load promotional campaigns.");
    } finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const displayed = filterType === "ALL" ? campaigns : campaigns.filter((c) => c.promo_type === filterType);

  const handleCreate = async () => {
    if (!form.campaign_name) { onNotification?.("Validation", "Campaign name is required.", "info"); return; }
    setSubmitting(true);
    try {
      const result = await apiFetchV1<Campaign>("/promotions/campaigns", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          discount_value: form.discount_value ? parseFloat(form.discount_value) : undefined,
          min_qty: form.min_qty ? parseInt(form.min_qty) : undefined,
        }),
      });
      if (result) {
        setCampaigns((prev) => [result, ...prev]);
        onNotification?.("Campaign Created", `"${result.campaign_name}" is now active.`, "success");
        setShowForm(false);
        setForm({ campaign_name: "", promo_type: "COMBO", discount_value: "", min_qty: "", valid_from: "", valid_to: "" });
      }
    } catch (e: any) {
      onNotification?.("Error", e?.message ?? "Campaign creation failed.", "error");
    } finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-400 text-2xl">redeem</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Bundling &amp; Combo Studio</h2>
              <p className="text-xs text-slate-400">Promotional campaigns - bundle offers - combo discounts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all">
              + New Campaign
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        {showForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">New Promotional Campaign</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Campaign Name *</label>
                <input value={form.campaign_name} onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))}
                  placeholder="Summer Combo Offer 2026" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Type</label>
                <select value={form.promo_type} onChange={(e) => setForm((f) => ({ ...f, promo_type: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60">
                  {PROMO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Discount Value</label>
                <input type="number" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                  placeholder="10 (% or flat)" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Min Qty</label>
                <input type="number" value={form.min_qty} onChange={(e) => setForm((f) => ({ ...f, min_qty: e.target.value }))}
                  placeholder="2" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Valid From</label>
                <input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition-all">
                {submitting ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          {["ALL", ...PROMO_TYPES].map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${filterType === t ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              {t}
            </button>
          ))}
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayed.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">redeem</span>
              <p className="text-sm">No campaigns found. Create one to get started.</p>
            </div>
          ) : displayed.map((c) => (
            <div key={c.campaign_id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
              <div>
                <p className="font-bold text-slate-100">{c.campaign_name}</p>
                <p className="text-slate-500 mt-0.5">{c.promo_type} - {c.valid_from ?? "—"} to {c.valid_to ?? "—"}</p>
                {c.discount_value != null && <p className="text-purple-400 font-mono text-[10px] mt-0.5">Discount: {c.discount_value}{c.promo_type === "PERCENT" ? "%" : " flat"}</p>}
              </div>
              <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[c.status] ?? ""}`}>{c.status}</span>
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

export default BundlingModal;
