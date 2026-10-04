/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.101.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.101.1 (2026-10-04):
 *   - Replaced loyaltyTierEngine mock with live apiFetchV1:
 *     POST /crm-growth/loyalty/enroll-member, POST /crm-growth/loyalty/adjust-points.
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface LoyaltyMember {
  member_id: string;
  member_no?: string;
  customer_name?: string;
  tier?: string;
  points_balance?: number;
  total_earned?: number;
  total_redeemed?: number;
}

interface LoyaltyTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TIER_STYLE: Record<string, string> = {
  BRONZE:   "text-amber-700 bg-amber-900/20 border-amber-700/30",
  SILVER:   "text-slate-300 bg-slate-700/20 border-slate-500/30",
  GOLD:     "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  PLATINUM: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  DIAMOND:  "text-violet-300 bg-violet-500/10 border-violet-500/20",
};

export const LoyaltyTierModal: React.FC<LoyaltyTierModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [activeTab, setActiveTab] = useState<"ENROLL" | "ADJUST">("ENROLL");
  const [enrollForm, setEnrollForm] = useState({ customer_id: "", tier: "SILVER", mobile: "" });
  const [adjustForm, setAdjustForm] = useState({ member_id: "", points: "", reason: "", operation: "CREDIT" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<LoyaltyMember | null>(null);

  const handleEnroll = useCallback(async () => {
    if (!enrollForm.customer_id) { onNotification?.("Validation", "Customer ID is required.", "info"); return; }
    setSubmitting(true);
    try {
      const m = await apiFetchV1<LoyaltyMember>("/crm-growth/loyalty/enroll-member", {
        method: "POST",
        body: JSON.stringify({ customer_id: enrollForm.customer_id, tier: enrollForm.tier, mobile: enrollForm.mobile }),
      });
      setResult(m ?? null);
      onNotification?.("Enrolled", `${m?.customer_name ?? "Customer"} enrolled as ${m?.tier ?? "SILVER"}.`, "success");
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Enrollment failed.", "error"); }
    finally { setSubmitting(false); }
  }, [enrollForm]);

  const handleAdjust = useCallback(async () => {
    if (!adjustForm.member_id || !adjustForm.points) { onNotification?.("Validation", "Member ID and points are required.", "info"); return; }
    setSubmitting(true);
    try {
      await apiFetchV1("/crm-growth/loyalty/adjust-points", {
        method: "POST",
        body: JSON.stringify({
          member_id: adjustForm.member_id,
          points: parseFloat(adjustForm.points) * (adjustForm.operation === "DEBIT" ? -1 : 1),
          reason: adjustForm.reason,
        }),
      });
      onNotification?.("Points Adjusted", `${adjustForm.points} pts ${adjustForm.operation.toLowerCase()}ed.`, "success");
      setAdjustForm({ member_id: "", points: "", reason: "", operation: "CREDIT" });
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Points adjustment failed.", "error"); }
    finally { setSubmitting(false); }
  }, [adjustForm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-lg max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400 text-2xl">stars</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Loyalty Tier Manager</h2>
              <p className="text-xs text-slate-400">Enroll members · Adjust loyalty points</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["ENROLL", "ADJUST"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {t === "ENROLL" ? "Enroll Member" : "Adjust Points"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-1">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "ENROLL" && (
            <div className="space-y-3 text-xs">
              {[
                { label: "Customer ID *", key: "customer_id", placeholder: "CUST-001" },
                { label: "Mobile",        key: "mobile",      placeholder: "9876543210" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input value={(enrollForm as any)[f.key]} onChange={(e) => setEnrollForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-yellow-500/60" />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Starting Tier</label>
                <div className="flex gap-2 flex-wrap">
                  {["BRONZE", "SILVER", "GOLD", "PLATINUM"].map((t) => (
                    <button key={t} onClick={() => setEnrollForm((p) => ({ ...p, tier: t }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${enrollForm.tier === t ? TIER_STYLE[t] ?? "" : "text-slate-500 border-slate-700 hover:border-slate-500"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {result && (
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 space-y-1.5">
                  <p className="text-emerald-400 font-bold text-sm">{result.customer_name}</p>
                  <p className="text-slate-400 text-[10px]">Member #{result.member_no ?? result.member_id} · Tier: <span className={`font-bold ${TIER_STYLE[result.tier ?? "SILVER"]?.split(" ")[0]}`}>{result.tier}</span></p>
                  <p className="font-mono text-yellow-400 font-bold">⭐ {result.points_balance ?? 0} pts</p>
                </div>
              )}
              <button onClick={handleEnroll} disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 transition-all">
                {submitting ? "Enrolling..." : "Enroll Member"}
              </button>
            </div>
          )}

          {activeTab === "ADJUST" && (
            <div className="space-y-3 text-xs">
              {[
                { label: "Member ID *", key: "member_id", placeholder: "MBR-001" },
                { label: "Points *",    key: "points",    placeholder: "100", type: "number" },
                { label: "Reason",      key: "reason",    placeholder: "Bonus credit, correction..." },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={(adjustForm as any)[f.key]}
                    onChange={(e) => setAdjustForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-yellow-500/60" />
                </div>
              ))}
              <div className="flex gap-2">
                {["CREDIT", "DEBIT"].map((op) => (
                  <button key={op} onClick={() => setAdjustForm((p) => ({ ...p, operation: op }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${adjustForm.operation === op
                      ? op === "CREDIT" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : "text-slate-500 border-slate-700 hover:border-slate-500"}`}>
                    {op}
                  </button>
                ))}
              </div>
              <button onClick={handleAdjust} disabled={submitting}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all ${adjustForm.operation === "CREDIT" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}>
                {submitting ? "Saving..." : `${adjustForm.operation === "CREDIT" ? "Credit" : "Debit"} ${adjustForm.points || "0"} Points`}
              </button>
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

export default LoyaltyTierModal;
