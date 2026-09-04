/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.107.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import CommissionEngine, {
  RepCommissionSummary, CommissionPayout, CommissionStatus,
  DEFAULT_COMMISSION_CONFIG, SalesRepTarget, SalesEntry,
} from "../../utils/commissionEngine";

interface CommissionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const PAYOUT_STYLE: Record<CommissionStatus, string> = {
  PENDING:   "text-amber-300 bg-amber-500/20 border-amber-500/30",
  APPROVED:  "text-sky-300 bg-sky-500/20 border-sky-500/30",
  PAID:      "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  DISPUTED:  "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED: "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

const PERIOD  = "2026-08";
const BRANCH1 = "BR-MUM-01";
const BRANCH2 = "BR-DEL-01";

const TARGETS: SalesRepTarget[] = [
  { repId: "REP-01", repName: "Vikram Singh",   branchCode: BRANCH1, period: PERIOD, revenueTarget: 150000, unitTarget: 300 },
  { repId: "REP-02", repName: "Ananya Pillai",  branchCode: BRANCH1, period: PERIOD, revenueTarget: 150000, unitTarget: 300 },
  { repId: "REP-03", repName: "Rajesh Sharma",  branchCode: BRANCH1, period: PERIOD, revenueTarget: 100000, unitTarget: 200 },
  { repId: "REP-04", repName: "Meena Nair",     branchCode: BRANCH2, period: PERIOD, revenueTarget: 120000, unitTarget: 250 },
  { repId: "REP-05", repName: "Suresh Pillai",  branchCode: BRANCH2, period: PERIOD, revenueTarget: 120000, unitTarget: 250 },
];

const ENTRIES: SalesEntry[] = [
  { txnId: "T001", repId: "REP-01", branchCode: BRANCH1, txnDate: "2026-08-12", grossSales: 220000, returns: 10000, discounts: 5000,  unitsSold: 380 },
  { txnId: "T002", repId: "REP-02", branchCode: BRANCH1, txnDate: "2026-08-15", grossSales: 130000, returns: 5000,  discounts: 3000,  unitsSold: 260 },
  { txnId: "T003", repId: "REP-03", branchCode: BRANCH1, txnDate: "2026-08-18", grossSales: 90000,  returns: 2000,  discounts: 1500,  unitsSold: 180 },
  { txnId: "T004", repId: "REP-04", branchCode: BRANCH2, txnDate: "2026-08-10", grossSales: 160000, returns: 8000,  discounts: 4000,  unitsSold: 310 },
  { txnId: "T005", repId: "REP-05", branchCode: BRANCH2, txnDate: "2026-08-20", grossSales: 105000, returns: 3000,  discounts: 2000,  unitsSold: 210 },
];

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export const CommissionStudioModal: React.FC<CommissionStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [activeTab, setActiveTab]   = useState<"LEADERBOARD" | "BREAKDOWN" | "LEDGER">("LEADERBOARD");
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [filterBranch, setFilterBranch]   = useState<string>("ALL");

  const summaries: RepCommissionSummary[] = useMemo(
    () => CommissionEngine.computeBranchCommissions(TARGETS, ENTRIES, DEFAULT_COMMISSION_CONFIG),
    []
  );

  const displayed = filterBranch === "ALL" ? summaries : summaries.filter((s) => s.branchCode === filterBranch);
  const selected  = summaries.find((s) => s.repId === selectedRepId);

  const ledger = useMemo(() => CommissionEngine.payoutLedger(payouts), [payouts]);

  if (!isOpen) return null;

  const handleRaise = (summary: RepCommissionSummary) => {
    if (payouts.find((p) => p.repId === summary.repId && p.period === summary.period)) {
      onNotification?.("Already Raised", `Payout for ${summary.repName} already exists`, "info");
      return;
    }
    const p = CommissionEngine.raisePayout(summary);
    setPayouts((prev) => [...prev, p]);
    onNotification?.("Payout Raised", `${p.payoutNo} — ${fmt(p.totalCommission)}`, "success");
  };

  const transition = (payoutId: string, action: "approve" | "paid" | "dispute") => {
    setPayouts((prev) => prev.map((p) => {
      if (p.payoutId !== payoutId) return p;
      if (action === "approve") return CommissionEngine.approve(p, "HR-MGR-01");
      if (action === "paid")    return CommissionEngine.markPaid(p, "BANK-TRANSFER");
      if (action === "dispute") return CommissionEngine.dispute(p, "Under review by HR");
      return p;
    }));
    onNotification?.("Payout Updated", `Status changed`, "success");
  };

  const medal = (i: number) => i === 0 ? "ðŸ¥‡" : i === 1 ? "ðŸ¥ˆ" : i === 2 ? "ðŸ¥‰" : `#${i + 1}`;

  const AchBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Staff Commission & Incentive Engine</h2>
              <p className="text-xs text-slate-400">Tiered Commission · Target Bonus · Top Performer · Payout Ledger</p>
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

        {/* Period + Branch filter strip */}
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
              <option value={BRANCH1}>{BRANCH1}</option>
              <option value={BRANCH2}>{BRANCH2}</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-slate-500">Total Reps: <strong className="text-slate-200">{displayed.length}</strong></span>
            <span className="text-slate-500">Total Commission: <strong className="text-yellow-400">{fmt(displayed.reduce((s, r) => s + r.totalCommission, 0))}</strong></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "LEADERBOARD" && (
            <div className="space-y-3">
              {displayed.map((rep, i) => {
                const paidOut = payouts.find((p) => p.repId === rep.repId);
                return (
                  <div key={rep.repId} className={`bg-slate-800/30 border rounded-xl p-4 transition-all cursor-pointer ${selectedRepId === rep.repId ? "border-yellow-500/40 bg-yellow-950/10" : "border-slate-700/60 hover:border-slate-600"}`}
                    onClick={() => { setSelectedRepId(rep.repId); setActiveTab("BREAKDOWN"); }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{medal(i)}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-100">{rep.repName}</p>
                          <p className="text-[10px] text-slate-500">{rep.branchCode} · {rep.repId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {rep.topPerformerBonus > 0 && (
                          <span className="text-[9px] font-bold text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">? Top Performer</span>
                        )}
                        {rep.targetBonus > 0 && (
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">ðŸŽ¯ Target Achieved</span>
                        )}
                        <div className="text-right">
                          <p className="text-lg font-black font-mono text-yellow-400">{fmt(rep.totalCommission)}</p>
                          <p className="text-[10px] text-slate-500">Commission</p>
                        </div>
                        {!paidOut
                          ? <button onClick={(e) => { e.stopPropagation(); handleRaise(rep); }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-500 transition-all">
                              Raise Payout
                            </button>
                          : <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${PAYOUT_STYLE[paidOut.status]}`}>{paidOut.status}</span>
                        }
                      </div>
                    </div>
                    {/* Mini metrics */}
                    <div className="grid grid-cols-4 gap-3 mt-3 text-xs text-center">
                      {[
                        { label: "Net Sales",   value: fmt(rep.netSales),               color: "text-slate-300" },
                        { label: "Rev. Ach%",   value: `${rep.revenueAchievementPct}%`, color: rep.revenueAchievementPct >= 100 ? "text-emerald-400" : "text-amber-400" },
                        { label: "Units",       value: `${rep.unitsSold}/${rep.unitTarget}`, color: "text-sky-400" },
                        { label: "Unit Ach%",   value: `${rep.unitAchievementPct}%`,    color: rep.unitAchievementPct >= 100 ? "text-emerald-400" : "text-slate-400" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-900/60 border border-slate-800/40 rounded-lg p-2">
                          <div className={`font-bold font-mono text-xs ${m.color}`}>{m.value}</div>
                          <div className="text-[9px] text-slate-600 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <AchBar pct={rep.revenueAchievementPct} color={rep.revenueAchievementPct >= 100 ? "bg-emerald-500" : "bg-yellow-500"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "BREAKDOWN" && selected && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-lg font-bold text-slate-100">{selected.repName}</p>
                  <p className="text-xs text-slate-400">{selected.branchCode} · {selected.repId} · {selected.period}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black font-mono text-yellow-400">{fmt(selected.totalCommission)}</p>
                  <p className="text-[10px] text-slate-500">Total Commission</p>
                </div>
              </div>

              {/* Commission breakdown */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Commission Computation</p>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {[
                    { label: "Gross Sales",         value: fmt(selected.grossSales),        color: "text-slate-300" },
                    { label: "Returns",             value: `(${fmt(selected.returns)})`,     color: "text-rose-400" },
                    { label: "Discounts",           value: `(${fmt(selected.discounts)})`,   color: "text-orange-400" },
                    { label: "Net Sales (Commission Base)", value: fmt(selected.netSales),   color: "text-slate-100", bold: true },
                    { label: "Tiered Commission",   value: fmt(selected.tieredCommission),   color: "text-yellow-400" },
                    { label: "Target Achievement Bonus", value: fmt(selected.targetBonus),   color: "text-emerald-400" },
                    { label: "Top Performer Bonus", value: fmt(selected.topPerformerBonus),  color: "text-yellow-300" },
                    { label: "Total Commission",    value: fmt(selected.totalCommission),    color: "text-yellow-400", bold: true },
                  ].map((line) => (
                    <div key={line.label} className={`flex justify-between items-center px-4 py-2.5 font-mono ${line.bold ? "bg-slate-900/60" : ""}`}>
                      <span className={`text-xs ${line.bold ? "font-bold text-slate-100" : "text-slate-400"}`}>{line.label}</span>
                      <span className={`font-mono font-bold ${line.color} ${line.bold ? "text-sm" : "text-xs"}`}>{line.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tier slab detail */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Progressive Tier Slabs Applied</p>
                <div className="space-y-2">
                  {selected.appliedTiers.map((at, i) => (
                    <div key={i} className="flex items-center gap-4 bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 text-xs">
                      <div className="flex-1">
                        <span className="text-slate-400">
                          ₹{at.tier.fromValue.toLocaleString("en-IN")} — {at.tier.toValue === Infinity ? "?" : `₹${at.tier.toValue.toLocaleString("en-IN")}`}
                        </span>
                        <span className="text-yellow-400 font-bold ml-2">@ {at.tier.ratePct}%</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-slate-300">{fmt(at.salesInSlab)} in slab</p>
                        <p className="font-mono font-bold text-yellow-400">+{fmt(at.commission)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Revenue Target",      value: fmt(selected.revenueTarget),       color: "text-slate-300" },
                  { label: "Revenue Achievement", value: `${selected.revenueAchievementPct}%`, color: selected.revenueAchievementPct >= 100 ? "text-emerald-400" : "text-amber-400" },
                  { label: "Unit Target",         value: String(selected.unitTarget),        color: "text-slate-300" },
                  { label: "Unit Achievement",    value: `${selected.unitAchievementPct}%`,  color: selected.unitAchievementPct >= 100 ? "text-emerald-400" : "text-slate-400" },
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
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Pending",  value: fmt(ledger.totalPending),   count: ledger.pendingCount,   color: "text-amber-400" },
                  { label: "Approved", value: fmt(ledger.totalApproved),  count: ledger.approvedCount,  color: "text-sky-400" },
                  { label: "Paid",     value: fmt(ledger.totalPaid),      count: ledger.paidCount,      color: "text-emerald-400" },
                  { label: "Disputed", value: fmt(ledger.totalDisputed),  count: ledger.disputedCount,  color: "text-rose-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label} ({m.count})</div>
                  </div>
                ))}
              </div>

              {payouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl">receipt_long</span>
                  <p className="text-sm">No payouts raised yet. Go to Leaderboard and click "Raise Payout".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.map((p) => (
                    <div key={p.payoutId} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-xs font-bold font-mono text-slate-200">{p.payoutNo}</p>
                          <p className="text-[10px] text-slate-400">{p.repName} · {p.branchCode} · {p.period}</p>
                          {p.paidAt && <p className="text-[10px] text-emerald-400 mt-0.5">Paid via {p.paidVia} on {new Date(p.paidAt).toLocaleDateString("en-IN")}</p>}
                          {p.notes && <p className="text-[10px] text-rose-400 mt-0.5">{p.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${PAYOUT_STYLE[p.status]}`}>{p.status}</span>
                          <span className="text-base font-black font-mono text-yellow-400">{fmt(p.totalCommission)}</span>
                          <div className="flex gap-1.5">
                            {p.status === "PENDING"  && <button onClick={() => transition(p.payoutId, "approve")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all">Approve</button>}
                            {p.status === "APPROVED" && <button onClick={() => transition(p.payoutId, "paid")}    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">Mark Paid</button>}
                            {["PENDING","APPROVED"].includes(p.status) && <button onClick={() => transition(p.payoutId, "dispute")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-rose-700 hover:bg-rose-600 transition-all">Dispute</button>}
                          </div>
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

export default CommissionStudioModal;

