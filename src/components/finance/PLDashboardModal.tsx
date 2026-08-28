/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.102.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import PLDashboardEngine, {
  BranchPLReport, SalesTxn, ShrinkageEntry, OperatingCost, PeriodType,
} from "../../../utils/plDashboardEngine";

interface PLDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BRANCHES = ["BR-MUM-01", "BR-DEL-01", "BR-BLR-01"];

function seed(branch: string, month: string, grossMultiplier: number): SalesTxn[] {
  return [
    { txnId: `${branch}-W1`, branchCode: branch, txnDate: `${month}-05`, grossSales: Math.round(85000 * grossMultiplier), returns: 3000, cogs: Math.round(51000 * grossMultiplier), discountGiven: Math.round(5000 * grossMultiplier) },
    { txnId: `${branch}-W2`, branchCode: branch, txnDate: `${month}-12`, grossSales: Math.round(120000 * grossMultiplier), returns: 5000, cogs: Math.round(72000 * grossMultiplier), discountGiven: Math.round(18000 * grossMultiplier) },
    { txnId: `${branch}-W3`, branchCode: branch, txnDate: `${month}-20`, grossSales: Math.round(95000 * grossMultiplier), returns: 2000, cogs: Math.round(57000 * grossMultiplier), discountGiven: Math.round(4000 * grossMultiplier) },
    { txnId: `${branch}-W4`, branchCode: branch, txnDate: `${month}-28`, grossSales: Math.round(110000 * grossMultiplier), returns: 4000, cogs: Math.round(66000 * grossMultiplier), discountGiven: Math.round(8000 * grossMultiplier) },
  ];
}

function seedShrinkage(branch: string, month: string): ShrinkageEntry[] {
  return [
    { entryId: `SHR-${branch}-1`, branchCode: branch, date: `${month}-10`, reason: "THEFT",  costValue: 4500, qty: 5 },
    { entryId: `SHR-${branch}-2`, branchCode: branch, date: `${month}-25`, reason: "DAMAGE", costValue: 1800, qty: 3 },
  ];
}

function seedOpCost(branch: string, period: string, factor: number): OperatingCost {
  return { branchCode: branch, period, rent: Math.round(45000 * factor), staffCost: Math.round(120000 * factor), utilities: 8000, other: 5000 };
}

const MONTHS = ["2026-06", "2026-07", "2026-08"];

const METRIC_COLORS = {
  positive: "text-emerald-400",
  negative: "text-rose-400",
  neutral:  "text-slate-300",
};

function fmt(n: number) { return `₹${Math.abs(n).toLocaleString("en-IN")}`; }

export const PLDashboardModal: React.FC<PLDashboardModalProps> = ({ isOpen, onClose }) => {
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [selectedPeriod, setSelectedPeriod] = useState("2026-08");
  const [periodType, setPeriodType]         = useState<PeriodType>("MONTHLY");
  const [activeTab, setActiveTab]           = useState<"PL" | "TREND" | "COMPARE">("PL");

  const allTxns:  SalesTxn[]      = useMemo(() => BRANCHES.flatMap((b, i) => MONTHS.flatMap((m) => seed(b, m, 1 + i * 0.3))), []);
  const allShrink: ShrinkageEntry[] = useMemo(() => BRANCHES.flatMap((b) => MONTHS.flatMap((m) => seedShrinkage(b, m))), []);
  const allOp:    OperatingCost[]  = useMemo(() => BRANCHES.flatMap((b, i) => MONTHS.map((m) => seedOpCost(b, m, 1 + i * 0.15))), []);

  const report: BranchPLReport = useMemo(() => PLDashboardEngine.computePL({
    branchCode: selectedBranch,
    periodType,
    periodLabel: selectedPeriod,
    fromDate: `${selectedPeriod}-01`,
    toDate:   `${selectedPeriod}-31`,
    transactions: allTxns,
    shrinkage:    allShrink,
    operatingCosts: allOp,
  }), [selectedBranch, selectedPeriod, periodType, allTxns, allShrink, allOp]);

  const trendReports = useMemo(() => MONTHS.map((m) => PLDashboardEngine.computePL({
    branchCode: selectedBranch, periodType: "MONTHLY", periodLabel: m,
    fromDate: `${m}-01`, toDate: `${m}-31`,
    transactions: allTxns, shrinkage: allShrink, operatingCosts: allOp,
  })), [selectedBranch, allTxns, allShrink, allOp]);

  const trend = useMemo(() => PLDashboardEngine.computeTrend(trendReports), [trendReports]);

  const compareReports = useMemo(() => PLDashboardEngine.compareBranches(
    BRANCHES.map((b) => PLDashboardEngine.computePL({
      branchCode: b, periodType: "MONTHLY", periodLabel: selectedPeriod,
      fromDate: `${selectedPeriod}-01`, toDate: `${selectedPeriod}-31`,
      transactions: allTxns, shrinkage: allShrink, operatingCosts: allOp,
    }))
  ), [selectedPeriod, allTxns, allShrink, allOp]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <span className="material-symbols-outlined text-2xl">bar_chart_4_bars</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Store-Level Profit & Loss Dashboard</h2>
              <p className="text-xs text-slate-400">Revenue · COGS · GM% · Shrinkage · Markdown · Net Profit · Multi-Period Trend</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["PL", "TREND", "COMPARE"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "PL" ? "P&L" : tab === "TREND" ? "Trend" : "Compare"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Control strip */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/30 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Branch</span>
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60">
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Period</span>
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60">
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {report.netProfit >= 0
              ? <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">📈 Profitable</span>
              : <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-full">📉 Loss Making</span>
            }
          </div>
        </div>

        {/* KPI strip */}
        {activeTab === "PL" && (
          <div className="grid grid-cols-5 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/20">
            {[
              { label: "Net Revenue",   value: fmt(report.netRevenue),         color: "text-slate-300" },
              { label: "Gross Margin",  value: `${report.grossMarginPct}%`,    color: "text-violet-400" },
              { label: "Shrinkage",     value: fmt(report.shrinkageCost),      color: report.shrinkageCost > 10000 ? "text-amber-400" : "text-slate-400" },
              { label: "Markdown Cost", value: fmt(report.markdownCost),       color: report.markdownCost > 10000 ? "text-orange-400" : "text-slate-400" },
              { label: "Net Profit",    value: `${fmt(report.netProfit)} (${report.netMarginPct}%)`, color: report.netProfit >= 0 ? "text-emerald-400" : "text-rose-400" },
            ].map((m) => (
              <div key={m.label} className="px-4 py-3 text-center">
                <div className={`text-sm font-black font-mono ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "PL" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* P&L waterfall */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
              <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profit & Loss Statement — {report.periodLabel} · {report.branchCode}</p>
              </div>
              <div className="divide-y divide-slate-800/40">
                {report.plLines.map((line, i) => {
                  const isTotal = ["Net Revenue", "Gross Margin", "Net Profit"].includes(line.label);
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${isTotal ? "bg-slate-900/60" : ""}`}>
                      <div className="flex items-center gap-2">
                        {line.isDeduction && <span className="text-slate-600 text-[10px]">↳</span>}
                        <span className={`text-xs ${isTotal ? "font-bold text-slate-100" : "text-slate-400"}`}>{line.label}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        {line.pctOfRevenue !== undefined && (
                          <span className="text-[10px] font-mono text-slate-600 w-12 text-right">{line.pctOfRevenue}%</span>
                        )}
                        <span className={`font-mono font-bold ${isTotal ? "text-sm" : "text-xs"} ${line.value < 0 ? "text-rose-400" : line.value > 0 && isTotal ? "text-emerald-400" : "text-slate-300"}`}>
                          {line.value < 0 ? `(${fmt(line.value)})` : fmt(line.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Supporting metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Transactions", value: report.txnCount, color: "text-slate-300" },
                { label: "Avg Order Value", value: fmt(report.avgOrderValue), color: "text-sky-400" },
                { label: "Return Rate", value: `${report.returnRate}%`, color: report.returnRate > 5 ? "text-amber-400" : "text-slate-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                  <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "TREND" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Avg GM%", value: `${trend.avgGrossMarginPct}%`, color: "text-violet-400" },
                { label: "Avg Net Margin%", value: `${trend.avgNetMarginPct}%`, color: trend.avgNetMarginPct >= 0 ? "text-emerald-400" : "text-rose-400" },
                { label: "Revenue Growth (MoM)", value: `${trend.revenueGrowthPct >= 0 ? "+" : ""}${trend.revenueGrowthPct}%`, color: trend.revenueGrowthPct >= 0 ? "text-emerald-400" : "text-rose-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Period-by-Period Breakdown</p>
              <div className="space-y-3">
                {trend.periods.map((p) => (
                  <div key={p.periodLabel} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-slate-200">{p.periodLabel}</span>
                      <span className="font-mono font-black text-slate-100">{fmt(p.netRevenue)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-bold font-mono text-violet-400">{p.grossMarginPct}%</div>
                        <div className="text-[10px] text-slate-500">GM%</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-bold font-mono ${p.netMarginPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{p.netMarginPct}%</div>
                        <div className="text-[10px] text-slate-500">Net Margin%</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold font-mono text-amber-400">{fmt(p.shrinkageCost)}</div>
                        <div className="text-[10px] text-slate-500">Shrinkage</div>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.grossMarginPct))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "COMPARE" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Branch Ranking — {selectedPeriod} (sorted by net profit)</p>
            {compareReports.map((r, i) => (
              <div key={r.branchCode} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-amber-700"}`}>#{i + 1}</span>
                    <span className="text-sm font-bold text-slate-200">{r.branchCode}</span>
                  </div>
                  <span className={`font-black font-mono text-lg ${r.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {r.netProfit >= 0 ? "+" : ""}{fmt(r.netProfit)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  {[
                    { label: "Revenue",  value: fmt(r.netRevenue),      color: "text-slate-300" },
                    { label: "GM%",      value: `${r.grossMarginPct}%`, color: "text-violet-400" },
                    { label: "Shrinkage",value: fmt(r.shrinkageCost),   color: "text-amber-400" },
                    { label: "Net Margin",value: `${r.netMarginPct}%`,  color: r.netMarginPct >= 0 ? "text-emerald-400" : "text-rose-400" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/40">
                      <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default PLDashboardModal;
