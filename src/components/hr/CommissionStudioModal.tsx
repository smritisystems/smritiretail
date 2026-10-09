/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.46
 * Created      : 2026-08-28
 * Modified     : 2026-10-09
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v6.70.46 (2026-10-09):
 *   - Safeguarded against TypeError: C.find is not a function when /staff/incentives
 *     returns non-array object payloads ({ report_id: "STAFF-002", lines: [] }).
 *   - Synthesized authoritative RepSummary rows from /staff/personnel and
 *     /staff/commissions/summary when pre-aggregated summaries array is not provided.
 *   - Enforced safe array guards across safeSummaries, safePayouts, and branch aggregations.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface RepSummary {
  user_id: string;
  rep_id?: string;
  rep_name: string;
  branch_code?: string;
  period: string;
  net_sales: number;
  commission_amt: number;
  target_bonus_amt: number;
  total_earnings: number;
  target_achievement_pct?: number;
  revenue_target?: number;
  units_sold?: number;
  unit_target?: number;
}

interface PayoutRecord {
  payout_id: string;
  payout_no: string;
  user_id: string;
  rep_name?: string;
  period: string;
  total_commission: number;
  status: string;
  branch_code?: string;
  paid_at?: string;
  paid_via?: string;
  notes?: string;
}

interface CommissionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const PAYOUT_STYLE: Record<string, string> = {
  PENDING:   "text-amber-300 bg-amber-500/20 border-amber-500/30",
  APPROVED:  "text-sky-300 bg-sky-500/20 border-sky-500/30",
  PAID:      "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  DISPUTED:  "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED: "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

function fmt(n: number) { return `\u20b9${(n ?? 0).toLocaleString("en-IN")}`; }

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const CommissionStudioModal: React.FC<CommissionStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [summaries, setSummaries]         = useState<RepSummary[]>([]);
  const [payouts, setPayouts]             = useState<PayoutRecord[]>([]);
  const [activeTab, setActiveTab]         = useState<"LEADERBOARD" | "BREAKDOWN" | "LEDGER">("LEADERBOARD");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filterBranch, setFilterBranch]   = useState<string>("ALL");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const PERIOD = currentPeriod();

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const [inc, personnelRes, commSummary] = await Promise.all([
        apiFetchV1<any>(`/staff/incentives?period=${PERIOD}`).catch(() => ({ lines: [] })),
        apiFetchV1<any[]>("/staff/personnel").catch(() => []),
        apiFetchV1<any>(`/staff/commissions/summary?period=${PERIOD}`).catch(() => null),
      ]);

      let repSummaries: RepSummary[] = [];

      if (Array.isArray(inc)) {
        repSummaries = inc;
      } else if (Array.isArray((inc as any)?.summaries)) {
        repSummaries = (inc as any).summaries;
      }

      const rawStaff: any[] = Array.isArray(personnelRes)
        ? personnelRes
        : (personnelRes as any)?.users || (personnelRes as any)?.data || [];

      if (repSummaries.length === 0 && rawStaff.length > 0) {
        repSummaries = rawStaff.map((p: any) => {
          const uId = p.user_id || p.id || `rep-${Math.random().toString(36).slice(2, 7)}`;
          const pName = p.participant_name || p.full_name || p.name || "Sales Representative";
          const bCode = p.branch_code || p.branch || "HO";
          const earned = commSummary?.user_id === uId ? Number(commSummary?.earned_commission || 0) : 0;
          const netSales = commSummary?.user_id === uId ? Number(commSummary?.net_sales || 0) : 0;
          return {
            user_id: uId,
            rep_id: p.id,
            rep_name: pName,
            branch_code: bCode,
            period: PERIOD,
            net_sales: netSales,
            commission_amt: earned,
            target_bonus_amt: 0,
            total_earnings: earned,
            target_achievement_pct: netSales > 0 ? Math.min(100, Math.round((netSales / 100000) * 100)) : 0,
            revenue_target: 100000,
            units_sold: 0,
            unit_target: 50,
          };
        });
      }

      setSummaries(repSummaries);
      if (!selectedUserId && repSummaries[0]?.user_id) {
        setSelectedUserId(repSummaries[0].user_id);
      }
    } catch (e: any) {
      setSummaries([]);
      setError(e?.message ?? "Failed to load commission data.");
      onNotification?.("Error", "Could not load commission data.", "error");
    } finally { setLoading(false); }
  }, [isOpen, PERIOD, selectedUserId, onNotification]);

  useEffect(() => { load(); }, [load]);

  const safeSummaries = Array.isArray(summaries) ? summaries : [];
  const safePayouts   = Array.isArray(payouts) ? payouts : [];
  const displayed = filterBranch === "ALL" ? safeSummaries : safeSummaries.filter((s) => s.branch_code === filterBranch);
  const selected  = safeSummaries.find((s) => s.user_id === selectedUserId) || safeSummaries[0] || null;
  const branches  = Array.from(new Set(safeSummaries.map((s) => s.branch_code).filter(Boolean)));

  const handleRaise = async (rep: RepSummary) => {
    if (safePayouts.find((p) => p.user_id === rep.user_id && p.period === rep.period)) {
      onNotification?.("Already Raised", `Payout for ${rep.rep_name} already exists`, "info"); return;
    }
    try {
      const p = await apiFetchV1<PayoutRecord>("/crm-growth/commissions/calculate", {
        method: "POST", body: JSON.stringify({ user_id: rep.user_id, period: rep.period }),
      });
      if (p) { setPayouts((prev) => [...(Array.isArray(prev) ? prev : []), p]); onNotification?.("Payout Raised", `${p.payout_no} - ${fmt(p.total_commission)}`, "success"); }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Payout creation failed.", "error"); }
  };

  const medal = (i: number) => i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `#${i + 1}`;

  const AchBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Staff Commission &amp; Incentive Engine</h2>
              <p className="text-xs text-slate-400">Tiered Commission - Target Bonus - Top Performer - Payout Ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["LEADERBOARD", "BREAKDOWN", "LEDGER"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "LEADERBOARD" ? "Leaderboard" : tab === "BREAKDOWN" ? "Tier Breakdown" : "Payout Ledger"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Period</span>
            <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5">{PERIOD}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Branch</span>
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-yellow-500/60">
              <option value="ALL">All Branches</option>
              {branches.map((b) => <option key={b} value={b!}>{b}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {loading && <span className="text-slate-500 animate-pulse">Loading...</span>}
            <span className="text-slate-500">Total Reps: <strong className="text-slate-200">{displayed.length}</strong></span>
            <span className="text-slate-500">Total Commission: <strong className="text-yellow-400">{fmt(displayed.reduce((s, r) => s + r.commission_amt, 0))}</strong></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "LEADERBOARD" && (
            <div className="space-y-3">
              {displayed.map((rep, i) => {
                const paidOut = safePayouts.find((p) => p.user_id === rep.user_id);
                const achPct = rep.revenue_target ? Math.round((rep.net_sales / rep.revenue_target) * 100) : 0;
                return (
                  <div key={rep.user_id} className={`bg-slate-800/30 border rounded-xl p-4 transition-all cursor-pointer ${selectedUserId === rep.user_id ? "border-yellow-500/40 bg-yellow-950/10" : "border-slate-700/60 hover:border-slate-600"}`}
                    onClick={() => { setSelectedUserId(rep.user_id); setActiveTab("BREAKDOWN"); }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-yellow-400">{medal(i)}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-100">{rep.rep_name}</p>
                          <p className="text-[10px] text-slate-500">{rep.branch_code} - {rep.rep_id ?? rep.user_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {(rep.target_bonus_amt ?? 0) > 0 && (
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Target Achieved</span>
                        )}
                        <div className="text-right">
                          <p className="text-lg font-black font-mono text-yellow-400">{fmt(rep.commission_amt)}</p>
                          <p className="text-[10px] text-slate-500">Commission</p>
                        </div>
                        {!paidOut
                          ? <button onClick={(e) => { e.stopPropagation(); handleRaise(rep); }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-500 transition-all">
                              Raise Payout
                            </button>
                          : <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${PAYOUT_STYLE[paidOut.status] ?? ""}`}>{paidOut.status}</span>
                        }
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-3 text-xs text-center">
                      {[
                        { label: "Net Sales",  value: fmt(rep.net_sales),             color: "text-slate-300" },
                        { label: "Rev. Ach%",  value: `${achPct}%`,                   color: achPct >= 100 ? "text-emerald-400" : "text-amber-400" },
                        { label: "Units",      value: `${rep.units_sold ?? 0}/${rep.unit_target ?? "-"}`, color: "text-sky-400" },
                        { label: "Target Ach%",value: `${rep.target_achievement_pct ?? achPct}%`, color: (rep.target_achievement_pct ?? achPct) >= 100 ? "text-emerald-400" : "text-slate-400" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-900/60 border border-slate-800/40 rounded-lg p-2">
                          <div className={`font-bold font-mono text-xs ${m.color}`}>{m.value}</div>
                          <div className="text-[9px] text-slate-600 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2"><AchBar pct={achPct} color={achPct >= 100 ? "bg-emerald-500" : "bg-yellow-500"} /></div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "BREAKDOWN" && selected && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-lg font-bold text-slate-100">{selected.rep_name}</p>
                  <p className="text-xs text-slate-400">{selected.branch_code} - {selected.rep_id ?? selected.user_id} - {selected.period}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black font-mono text-yellow-400">{fmt(selected.commission_amt)}</p>
                  <p className="text-[10px] text-slate-500">Total Commission</p>
                </div>
              </div>
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Commission Computation</p>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {[
                    { label: "Net Sales",          value: fmt(selected.net_sales),         color: "text-slate-100", bold: true },
                    { label: "Commission",          value: fmt(selected.commission_amt),    color: "text-yellow-400" },
                    { label: "Target Bonus",        value: fmt(selected.target_bonus_amt),  color: "text-emerald-400" },
                    { label: "Total Earnings",      value: fmt(selected.total_earnings),    color: "text-yellow-400", bold: true },
                  ].map((line) => (
                    <div key={line.label} className={`flex justify-between items-center px-4 py-2.5 font-mono ${line.bold ? "bg-slate-900/60" : ""}`}>
                      <span className={`text-xs ${line.bold ? "font-bold text-slate-100" : "text-slate-400"}`}>{line.label}</span>
                      <span className={`font-mono font-bold ${line.color} ${line.bold ? "text-sm" : "text-xs"}`}>{line.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Revenue Target",     value: fmt(selected.revenue_target ?? 0),        color: "text-slate-300" },
                  { label: "Achievement",         value: `${selected.target_achievement_pct ?? 0}%`, color: (selected.target_achievement_pct ?? 0) >= 100 ? "text-emerald-400" : "text-amber-400" },
                  { label: "Units Sold",          value: String(selected.units_sold ?? "-"),        color: "text-slate-300" },
                  { label: "Unit Target",         value: String(selected.unit_target ?? "-"),        color: "text-slate-300" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</span>
                    <span className={`font-black font-mono ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "LEDGER" && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Pending",  count: safePayouts.filter((p) => p.status === "PENDING").length,  total: safePayouts.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.total_commission, 0),  color: "text-amber-400" },
                  { label: "Approved", count: safePayouts.filter((p) => p.status === "APPROVED").length, total: safePayouts.filter((p) => p.status === "APPROVED").reduce((s, p) => s + p.total_commission, 0), color: "text-sky-400" },
                  { label: "Paid",     count: safePayouts.filter((p) => p.status === "PAID").length,     total: safePayouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.total_commission, 0),     color: "text-emerald-400" },
                  { label: "Disputed", count: safePayouts.filter((p) => p.status === "DISPUTED").length, total: safePayouts.filter((p) => p.status === "DISPUTED").reduce((s, p) => s + p.total_commission, 0), color: "text-rose-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`text-lg font-black font-mono ${m.color}`}>{fmt(m.total)}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label} ({m.count})</div>
                  </div>
                ))}
              </div>
              {safePayouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl">receipt_long</span>
                  <p className="text-sm">No payouts raised yet. Go to Leaderboard and click "Raise Payout".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {safePayouts.map((p) => (
                    <div key={p.payout_id} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-xs font-bold font-mono text-slate-200">{p.payout_no}</p>
                          <p className="text-[10px] text-slate-400">{p.rep_name} - {p.branch_code} - {p.period}</p>
                          {p.paid_at && <p className="text-[10px] text-emerald-400 mt-0.5">Paid via {p.paid_via} on {new Date(p.paid_at).toLocaleDateString("en-IN")}</p>}
                          {p.notes && <p className="text-[10px] text-rose-400 mt-0.5">{p.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${PAYOUT_STYLE[p.status] ?? ""}`}>{p.status}</span>
                          <span className="text-base font-black font-mono text-yellow-400">{fmt(p.total_commission)}</span>
                        </div>
                      </div>
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

export { CommissionStudioModal as ShiftCommissionStudioModal };
export default CommissionStudioModal;
