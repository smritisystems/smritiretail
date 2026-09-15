/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.95.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import ShiftEngine, {
  ShiftEmployee,
  ShiftRecord,
  SalesAttributionRecord,
  CommissionResult,
  CommissionTier,
  COMMISSION_TIERS,
} from "../../utils/shiftEngine";

interface ShiftCommissionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TIER_STYLES: Record<CommissionTier, { badge: string; bar: string }> = {
  BRONZE:   { badge: "text-amber-700 bg-amber-900/30 border-amber-700/40",    bar: "bg-amber-600" },
  SILVER:   { badge: "text-slate-300 bg-slate-700/40 border-slate-500/40",    bar: "bg-slate-400" },
  GOLD:     { badge: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30", bar: "bg-yellow-400" },
  PLATINUM: { badge: "text-cyan-300 bg-cyan-500/20 border-cyan-500/30",       bar: "bg-cyan-400" },
};

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED:   "text-slate-400 bg-slate-700/30 border-slate-600/30",
  CLOCKED_IN:  "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  ON_BREAK:    "text-amber-300 bg-amber-500/20 border-amber-500/30",
  CLOCKED_OUT: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  ABSENT:      "text-rose-300 bg-rose-500/20 border-rose-500/30",
  HALF_DAY:    "text-violet-300 bg-violet-500/20 border-violet-500/30",
};

const SAMPLE_EMPLOYEES: ShiftEmployee[] = [
  { employeeId: "EMP-001", name: "Ananya Verma",   role: "Senior Associate", branchCode: "BR-MUM-01", baseHourlyRate: 120, commissionTier: "GOLD" },
  { employeeId: "EMP-002", name: "Rahul Gupta",    role: "Sales Associate",  branchCode: "BR-MUM-01", baseHourlyRate: 90,  commissionTier: "SILVER" },
  { employeeId: "EMP-003", name: "Deepa Krishnan", role: "Team Lead",        branchCode: "BR-MUM-01", baseHourlyRate: 150, commissionTier: "PLATINUM" },
];

const SAMPLE_ATTRIBUTIONS: Record<string, SalesAttributionRecord[]> = {
  "EMP-001": [
    { employeeId: "EMP-001", date: "2026-08-28", invoiceNo: "INV-001", saleValue: 55000, channel: "POS" },
    { employeeId: "EMP-001", date: "2026-08-28", invoiceNo: "INV-002", saleValue: 32000, channel: "POS" },
  ],
  "EMP-002": [
    { employeeId: "EMP-002", date: "2026-08-28", invoiceNo: "INV-003", saleValue: 28000, channel: "POS" },
    { employeeId: "EMP-002", date: "2026-08-28", invoiceNo: "INV-004", saleValue: 17000, channel: "WEBSITE" },
  ],
  "EMP-003": [
    { employeeId: "EMP-003", date: "2026-08-28", invoiceNo: "INV-005", saleValue: 90000, channel: "POS" },
    { employeeId: "EMP-003", date: "2026-08-28", invoiceNo: "INV-006", saleValue: 75000, channel: "POS" },
  ],
};

function makeSampleShifts(): Record<string, ShiftRecord> {
  const shifts: Record<string, ShiftRecord> = {};
  const clockInOffset = 8.5 * 60 * 60 * 1000;
  SAMPLE_EMPLOYEES.forEach((emp) => {
    let s = ShiftEngine.createShift({ employeeId: emp.employeeId, branchCode: emp.branchCode, date: "2026-08-28", scheduledStart: "09:00", scheduledEnd: "18:00" });
    const clockInTime = new Date(Date.now() - clockInOffset).toISOString();
    s = ShiftEngine.clockIn(s);
    s = ShiftEngine.clockOut({ ...s, clockInAt: clockInTime });
    shifts[emp.employeeId] = s;
  });
  return shifts;
}

export const ShiftCommissionStudioModal: React.FC<ShiftCommissionStudioModalProps> = ({ isOpen, onClose }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("EMP-001");
  const [activeTab, setActiveTab] = useState<"ROSTER" | "COMMISSION" | "TIERS">("ROSTER");

  const shifts = useMemo(makeSampleShifts, []);

  const commissions = useMemo<CommissionResult[]>(() =>
    SAMPLE_EMPLOYEES.map((emp) => ShiftEngine.calculateCommission(emp, SAMPLE_ATTRIBUTIONS[emp.employeeId] ?? [], shifts[emp.employeeId])),
    [shifts]
  );

  const selectedEmp = SAMPLE_EMPLOYEES.find((e) => e.employeeId === selectedEmpId)!;
  const selectedShift = shifts[selectedEmpId];
  const selectedCommission = commissions.find((c) => c.employeeId === selectedEmpId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Employee Shift Management & Commission Calculation Studio</h2>
              <p className="text-xs text-slate-400">Shift Roster · Clock-In/Out · Overtime · Tier-Based Commissions · Incentive Payouts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["ROSTER", "COMMISSION", "TIERS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {activeTab === "ROSTER" && (
          <div className="flex flex-1 overflow-hidden">
            {/* Employee list */}
            <div className="w-60 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Today's Roster</p>
              {SAMPLE_EMPLOYEES.map((emp) => {
                const shift = shifts[emp.employeeId];
                const ts = TIER_STYLES[emp.commissionTier];
                return (
                  <button key={emp.employeeId} onClick={() => setSelectedEmpId(emp.employeeId)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedEmpId === emp.employeeId ? "bg-violet-950/20 border-violet-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 truncate">{emp.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ts.badge}`}>{emp.commissionTier}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{emp.role}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[shift?.status ?? "SCHEDULED"]}`}>{shift?.status ?? "SCHEDULED"}</span>
                      {shift?.hoursWorked && <span className="text-[10px] text-slate-400 font-mono">{shift.hoursWorked}h</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Shift detail */}
            {selectedShift && selectedCommission && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-100">{selectedEmp.name}</p>
                    <p className="text-xs text-slate-400">{selectedEmp.role} · {selectedEmp.branchCode}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selectedShift.status]}`}>{selectedShift.status}</span>
                </div>

                {/* Shift KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Hours Worked", value: `${selectedShift.hoursWorked ?? 0}h`, color: "text-slate-300" },
                    { label: "Overtime", value: `${selectedShift.overtimeHours ?? 0}h`, color: selectedShift.overtimeHours! > 0 ? "text-amber-400" : "text-slate-500" },
                    { label: "Late Arrival", value: `${selectedShift.lateMinutes ?? 0}m`, color: selectedShift.lateMinutes! > 10 ? "text-rose-400" : "text-slate-400" },
                    { label: "Breaks", value: selectedShift.breaks.length, color: "text-slate-400" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                      <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Pay Summary */}
                <div className="bg-violet-950/20 border border-violet-500/30 rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold text-violet-300 uppercase tracking-wide">Pay Summary — {selectedEmp.commissionTier} Tier</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Base Pay", value: selectedCommission.basePay, color: "text-slate-300" },
                      { label: "Commission", value: selectedCommission.totalCommission, color: "text-violet-300" },
                      { label: "Total Pay", value: selectedCommission.totalPay, color: "text-emerald-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800/60">
                        <div className={`text-lg font-black font-mono ${m.color}`}>₹{m.value.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {selectedCommission.incentiveBonus > 0 && (
                    <p className="text-xs text-violet-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">emoji_events</span>
                      Incentive bonus ₹{selectedCommission.incentiveBonus.toLocaleString("en-IN")} applied — sales exceeded ₹{COMMISSION_TIERS[selectedCommission.tier].threshold.toLocaleString("en-IN")} threshold
                    </p>
                  )}
                </div>

                {/* Commission Breakdown */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Commission Breakdown ({selectedCommission.breakdown.length} invoices)</p>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Invoice</th><th className="py-2 px-3 text-right">Sale Value</th><th className="py-2 px-3 text-right">Commission</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedCommission.breakdown.map((b) => (
                          <tr key={b.invoiceNo}>
                            <td className="py-2 px-3 text-slate-300">{b.invoiceNo}</td>
                            <td className="py-2 px-3 text-right text-slate-300">₹{b.saleValue.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 text-right text-violet-400 font-bold">₹{b.commissionAmt.toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-800 bg-slate-950/40">
                          <td className="py-2 px-3 font-bold text-slate-200 font-sans">Total</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-200">₹{selectedCommission.totalSales.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-right font-bold text-violet-300">₹{selectedCommission.totalCommission.toLocaleString("en-IN")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "COMMISSION" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Commission Summary — 2026-08-28</p>
            {commissions.map((c) => {
              const emp = SAMPLE_EMPLOYEES.find((e) => e.employeeId === c.employeeId)!;
              const ts = TIER_STYLES[c.tier];
              const threshold = COMMISSION_TIERS[c.tier].threshold;
              const progressPct = Math.min(100, Math.round((c.totalSales / threshold) * 100));
              return (
                <div key={c.employeeId} className="bg-slate-800/30 border border-slate-700/60 rounded-2xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <p className="text-sm font-bold text-slate-100">{emp.name}</p>
                      <div className="flex items-center gap-2 mt-0.5"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ts.badge}`}>{c.tier}</span><span className="text-[10px] text-slate-400">{emp.role}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black font-mono text-emerald-400">₹{c.totalPay.toLocaleString("en-IN")}</div>
                      <div className="text-[10px] text-slate-500">Total Payout</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                    {[
                      { l: "Sales", v: `₹${c.totalSales.toLocaleString("en-IN")}`, c: "text-slate-300" },
                      { l: "Base Commission", v: `₹${c.baseCommission.toLocaleString("en-IN")}`, c: "text-violet-400" },
                      { l: "Incentive Bonus", v: `₹${c.incentiveBonus.toLocaleString("en-IN")}`, c: c.incentiveBonus > 0 ? "text-yellow-400" : "text-slate-600" },
                      { l: "Base Pay", v: `₹${c.basePay.toLocaleString("en-IN")}`, c: "text-slate-400" },
                    ].map((m) => (
                      <div key={m.l} className="bg-slate-900/60 rounded-xl p-2 text-center border border-slate-800/40">
                        <div className={`font-bold font-mono text-sm ${m.c}`}>{m.v}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{m.l}</div>
                      </div>
                    ))}
                  </div>
                  {/* Incentive progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Incentive Threshold Progress</span>
                      <span className={c.totalSales >= threshold ? "text-yellow-400 font-bold" : ""}>{progressPct}% of ₹{threshold.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${ts.bar}`} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "TIERS" && (
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Commission Tier Reference</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.entries(COMMISSION_TIERS) as [CommissionTier, typeof COMMISSION_TIERS[CommissionTier]][]).map(([tier, def]) => {
                const ts = TIER_STYLES[tier];
                return (
                  <div key={tier} className="bg-slate-800/30 border border-slate-700/60 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${ts.badge}`}>{tier}</span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">{def.label}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {[
                        { label: "Base Rate", value: `${(def.rate * 100).toFixed(1)}%` },
                        { label: "Incentive Rate", value: `+${(def.incentiveRate * 100).toFixed(1)}%` },
                        { label: "Incentive Threshold", value: `₹${def.threshold.toLocaleString("en-IN")}` },
                        { label: "On Sales Above", value: `Threshold` },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/40">
                          <div className="font-bold font-mono text-slate-200">{m.value}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ShiftCommissionStudioModal;

