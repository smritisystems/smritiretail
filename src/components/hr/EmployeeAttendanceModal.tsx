/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.121.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import EmployeeAttendanceEngine, {
  EmployeeProfile, AttendanceRecord, PayoutRecord, CommissionResult,
} from "../../utils/employeeAttendanceEngine";

interface EmployeeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ABSENT:   "text-rose-400 bg-rose-500/10 border-rose-500/20",
  LEAVE:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
  HALF_DAY: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  HOLIDAY:  "text-slate-400 bg-slate-700/10 border-slate-600/20",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const PROFILES: EmployeeProfile[] = [
  { empId: "EMP-001", name: "Priya Sharma",  branchCode: "BR-MUM-01", designation: "Sales Associate", baseSalary: 25000, commissionType: "FLAT_PCT",  flatPct: 1.5, targetAmt: 200000, targetBonusPct: 10 },
  { empId: "EMP-002", name: "Rajan Kumar",   branchCode: "BR-MUM-01", designation: "Senior Sales",    baseSalary: 35000, commissionType: "TIERED",
    slabs: [{ fromAmt: 0, toAmt: 100000, pct: 1 }, { fromAmt: 100000, toAmt: 200000, pct: 1.5 }, { fromAmt: 200000, toAmt: Infinity, pct: 2 }],
    targetAmt: 300000 },
  { empId: "EMP-003", name: "Aisha Verma",   branchCode: "BR-MUM-01", designation: "Cashier",         baseSalary: 20000, commissionType: "FLAT_PCT",  flatPct: 1.0 },
];

const NET_SALES: Record<string, number> = { "EMP-001": 310000, "EMP-002": 250000, "EMP-003": 130000 };
const PERIOD = "2026-08";
const WORKING_DAYS = 26;

function buildSampleData() {
  const attendanceMap: Record<string, AttendanceRecord[]> = {};
  const commissionMap: Record<string, CommissionResult>   = {};
  const payoutList:   PayoutRecord[] = [];

  for (const p of PROFILES) {
    const recs: AttendanceRecord[] = [];
    // 22 full days
    for (let i = 1; i <= 22; i++) {
      const r = EmployeeAttendanceEngine.clockIn(p.empId, `2026-08-${String(i).padStart(2,"0")}`, "09:00");
      recs.push(EmployeeAttendanceEngine.clockOut(r, "18:00"));
    }
    // 1 half day
    const hd = EmployeeAttendanceEngine.clockIn(p.empId, "2026-08-23", "09:00");
    recs.push(EmployeeAttendanceEngine.clockOut(hd, "11:30"));
    // 1 absent + 1 casual leave + 1 unpaid
    recs.push(EmployeeAttendanceEngine.markAbsent(p.empId, "2026-08-24"));
    recs.push(EmployeeAttendanceEngine.markLeave(p.empId,  "2026-08-25", "CASUAL"));
    recs.push(EmployeeAttendanceEngine.markLeave(p.empId,  "2026-08-26", "UNPAID"));
    attendanceMap[p.empId] = recs;
    const commission = EmployeeAttendanceEngine.computeCommission(p, NET_SALES[p.empId], PERIOD);
    commissionMap[p.empId] = commission;
    payoutList.push(EmployeeAttendanceEngine.computePayout(p, recs, commission, WORKING_DAYS));
  }
  return { attendanceMap, commissionMap, payoutList };
}

export const EmployeeAttendanceModal: React.FC<EmployeeAttendanceModalProps> = ({ isOpen, onClose }) => {
  const { attendanceMap, commissionMap, payoutList } = useMemo(buildSampleData, []);
  const [selectedEmpId, setSelectedEmpId] = useState(PROFILES[0].empId);
  const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "COMMISSION" | "PAYOUT">("ATTENDANCE");

  const profile    = PROFILES.find((p) => p.empId === selectedEmpId)!;
  const attendance = attendanceMap[selectedEmpId] ?? [];
  const commission = commissionMap[selectedEmpId];
  const payout     = payoutList.find((p) => p.empId === selectedEmpId);
  const report     = useMemo(() => EmployeeAttendanceEngine.periodReport(payoutList), [payoutList]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-2xl">ðŸ‘¤</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Employee Attendance & Commission Engine</h2>
              <p className="text-xs text-slate-400">Attendance · Clock-In/Out · Commission Slabs · Payout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["ATTENDANCE", "COMMISSION", "PAYOUT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "COMMISSION" ? "Commission" : tab === "PAYOUT" ? "Payout" : "Attendance"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2"><span className="material-symbols-outlined text-lg">close</span></button>
          </div>
        </div>

        {/* Period summary strip */}
        <div className="flex items-center gap-5 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "Headcount",   value: report.totalHeadcount },
            { label: "Net Payout",  value: fmt(report.totalNetPayout),  style: "text-violet-400 font-black" },
            { label: "Commission",  value: fmt(report.totalCommission), style: "text-emerald-400" },
            { label: "Bonus",       value: fmt(report.totalBonus),      style: "text-amber-400" },
            { label: "Avg Attend.", value: `${report.avgAttendancePct}%`, style: report.avgAttendancePct >= 90 ? "text-emerald-400" : "text-amber-400" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-mono font-bold ${m.style ?? "text-slate-300"}`}>{m.value}</span>
            </div>
          ))}
          <span className="text-slate-600 ml-auto flex-shrink-0">Period: {PERIOD}</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Employee sidebar */}
          <div className="w-52 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {PROFILES.map((p) => {
              const py = payoutList.find((x) => x.empId === p.empId);
              return (
                <button key={p.empId} onClick={() => { setSelectedEmpId(p.empId); setActiveTab("ATTENDANCE"); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedEmpId === p.empId ? "bg-violet-950/20 border-violet-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                  <p className="text-xs font-bold text-slate-200">{p.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.designation}</p>
                  <p className="text-xs font-black font-mono text-violet-400 mt-1">{fmt(py?.netPayout ?? 0)}</p>
                  <p className="text-[9px] text-slate-600">{p.commissionType}</p>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Employee header */}
            <div>
              <p className="text-lg font-bold text-slate-100">{profile.name}</p>
              <p className="text-xs text-slate-400">{profile.empId} · {profile.designation} · {profile.branchCode}</p>
              <p className="text-[10px] text-slate-500">Base: {fmt(profile.baseSalary)}/mo · Commission: {profile.commissionType}{profile.flatPct ? ` @ ${profile.flatPct}%` : ""}</p>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-4 gap-3">
              {payout && [
                { label: "Present Days", value: `${payout.presentDays}/${payout.workingDays}`, color: "text-emerald-400 font-black" },
                { label: "LOP Days",     value: payout.lop,                                    color: payout.lop > 0 ? "text-rose-400" : "text-slate-400" },
                { label: "Commission",   value: fmt(payout.commissionAmt),                     color: "text-violet-400" },
                { label: "Net Payout",   value: fmt(payout.netPayout),                         color: "text-teal-400 font-black" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                  <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>

            {activeTab === "ATTENDANCE" && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {attendance.slice(0, 30).map((r) => (
                  <div key={r.recordId} className="flex items-center justify-between px-3 py-2 bg-slate-800/20 border border-slate-800/50 rounded-lg text-xs">
                    <span className="text-slate-400 font-mono">{r.date}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                    <span className="text-slate-500 font-mono">{r.clockInTime ?? "—"} → {r.clockOutTime ?? "—"}</span>
                    <span className="text-slate-400 font-mono">{r.hoursWorked != null ? `${r.hoursWorked}h` : r.leaveType ?? ""}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "COMMISSION" && commission && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { label: "Net Sales",     value: fmt(commission.netSales) },
                    { label: "Commission",    value: fmt(commission.commissionAmt) },
                    { label: "Target Bonus",  value: fmt(commission.targetBonusAmt) },
                    { label: "Target Amt",    value: fmt(commission.targetAmt) },
                    { label: "Achievement",   value: `${commission.targetAchievementPct}%` },
                    { label: "Total Earnings",value: fmt(commission.totalEarnings) },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between px-3 py-2 bg-slate-800/30 border border-slate-700/60 rounded-lg">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="font-mono font-bold text-slate-200">{m.value}</span>
                    </div>
                  ))}
                </div>
                {commission.slabBreakdown && (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-4 py-2 border-b border-slate-800">Tiered Slab Breakdown</p>
                    <table className="w-full text-xs text-left">
                      <thead><tr className="text-slate-600 uppercase text-[9px] border-b border-slate-800">
                        <th className="py-1.5 px-3">Slab</th><th className="py-1.5 px-3 text-right">Sales in Slab</th><th className="py-1.5 px-3 text-right">Rate</th><th className="py-1.5 px-3 text-right">Amount</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {commission.slabBreakdown.map((s, i) => (
                          <tr key={i}>
                            <td className="py-1.5 px-3 text-slate-400">{s.slab}</td>
                            <td className="py-1.5 px-3 text-right text-slate-400">{fmt(s.salesInSlab)}</td>
                            <td className="py-1.5 px-3 text-right text-slate-400">{s.rate}%</td>
                            <td className="py-1.5 px-3 text-right font-bold text-violet-400">{fmt(s.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "PAYOUT" && payout && (
              <div className="space-y-3 text-xs">
                {[
                  { label: "Base Salary",       value: fmt(payout.baseSalary) },
                  { label: "Earned Salary",      value: fmt(payout.earnedSalary), bold: true },
                  { label: "Commission",         value: fmt(payout.commissionAmt) },
                  { label: "Target Bonus",       value: fmt(payout.targetBonusAmt) },
                  { label: "Gross Payout",       value: fmt(payout.grossPayout), bold: true },
                  { label: `LOP (${payout.lop}d Ã— base/working)`, value: `-${fmt(Math.round((payout.lop / payout.workingDays) * payout.baseSalary * 100) / 100)}`, neg: true },
                  { label: "Net Payout",         value: fmt(payout.netPayout), bold: true, highlight: true },
                ].map((m) => (
                  <div key={m.label} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${m.highlight ? "bg-teal-950/20 border-teal-500/30" : "bg-slate-800/20 border-slate-700/60"}`}>
                    <span className={m.highlight ? "text-teal-300 font-bold" : "text-slate-400"}>{m.label}</span>
                    <span className={`font-mono font-bold ${m.highlight ? "text-teal-300" : m.neg ? "text-rose-400" : m.bold ? "text-slate-200" : "text-slate-300"}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAttendanceModal;

