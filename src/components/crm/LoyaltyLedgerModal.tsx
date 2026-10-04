/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.100.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.100.1 (2026-10-04):
 *   - Replaced loyaltyLedgerEngine mock with live apiFetchV1:
 *     GET /crm-growth/loyalty/members/{member_id}/ledger.
 */

import React, { useState, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface LedgerEntry {
  entry_id: string;
  transaction_type: string;
  points: number;
  balance_after?: number;
  reference?: string;
  notes?: string;
  created_at?: string;
}

interface LoyaltyLedgerResponse {
  member_id: string;
  customer_name?: string;
  tier?: string;
  points_balance?: number;
  entries?: LedgerEntry[];
}

interface LoyaltyLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export const LoyaltyLedgerModal: React.FC<LoyaltyLedgerModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [memberId, setMemberId] = useState("");
  const [data, setData]         = useState<LoyaltyLedgerResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    if (!memberId.trim()) { onNotification?.("Validation", "Member ID is required.", "info"); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const result = await apiFetchV1<LoyaltyLedgerResponse>(`/crm-growth/loyalty/members/${memberId.trim()}/ledger`);
      setData(result ?? null);
      if (!result) setError("No ledger found for this member.");
    } catch (e: any) { setError(e?.message ?? "Ledger lookup failed."); }
    finally { setLoading(false); }
  }, [memberId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400 text-2xl">receipt_long</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Loyalty Points Ledger</h2>
              <p className="text-xs text-slate-400">Full transaction history · Balance tracking</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-3">
            <input value={memberId} onChange={(e) => setMemberId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="Enter Member ID (e.g. MBR-001)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-yellow-500/60" />
            <button onClick={handleLookup} disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 transition-all">
              {loading ? "Loading..." : "Load Ledger"}
            </button>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-xl px-4 py-3">{error}</div>}

          {data && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                <div>
                  <p className="text-sm font-bold text-slate-100">{data.customer_name ?? data.member_id}</p>
                  <p className="text-xs text-slate-400">{data.tier ?? "—"} member</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black font-mono text-yellow-400">⭐ {data.points_balance ?? 0}</p>
                  <p className="text-[10px] text-slate-500">Current Balance</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Transaction History</p>
                <div className="space-y-1.5">
                  {(data.entries ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No transactions found.</p>
                  ) : (data.entries ?? []).map((e) => (
                    <div key={e.entry_id} className="flex items-center justify-between p-3 bg-slate-800/20 border border-slate-700/40 rounded-xl text-xs gap-3">
                      <div>
                        <p className="font-semibold text-slate-200">{e.transaction_type.replace(/_/g, " ")}</p>
                        {e.reference && <p className="text-slate-500 text-[10px]">{e.reference}</p>}
                        {e.notes && <p className="text-slate-600 text-[10px]">{e.notes}</p>}
                        <p className="text-slate-600 text-[10px]">{e.created_at ? new Date(e.created_at).toLocaleDateString("en-IN") : "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-mono font-black ${e.points >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {e.points >= 0 ? "+" : ""}{e.points} pts
                        </p>
                        {e.balance_after != null && <p className="text-slate-600 text-[10px]">Bal: {e.balance_after}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

export default LoyaltyLedgerModal;
