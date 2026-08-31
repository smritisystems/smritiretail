/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.90.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import SupplierScorecardEngine, {
  SupplierProfile,
  PurchaseOrderRecord,
  SupplierScorecardEntry,
  SupplierSLAStatus,
} from "../../utils/supplierScorecardEngine";

interface SupplierScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLES: Record<SupplierSLAStatus, { bg: string; border: string; text: string; badge: string }> = {
  GREEN:    { bg: "bg-emerald-950/20", border: "border-emerald-600/40", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  AMBER:    { bg: "bg-amber-950/20",   border: "border-amber-600/40",   text: "text-amber-400",   badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  RED:      { bg: "bg-rose-950/20",    border: "border-rose-600/40",    text: "text-rose-400",    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  CRITICAL: { bg: "bg-red-950/30",     border: "border-red-600/50",     text: "text-red-400",     badge: "bg-red-600/20 text-red-300 border-red-500/30" },
};

const SAMPLE_PROFILES: SupplierProfile[] = [
  { supplierId: "SUP-001", supplierName: "Kapoor Textiles Ltd.",    gstIn: "27AABCK1234A1Z5", category: "Apparel",     contractedLeadTimeDays: 7,  contractedFillRatePct: 95, penaltyPerDayDelay: 500 },
  { supplierId: "SUP-002", supplierName: "Mehta Synthetics Pvt.",   gstIn: "29AABCM5678B2Z6", category: "Footwear",    contractedLeadTimeDays: 10, contractedFillRatePct: 90, penaltyPerDayDelay: 200 },
  { supplierId: "SUP-003", supplierName: "Sharma Accessories Co.",  gstIn: "07AABCS9012C3Z7", category: "Accessories", contractedLeadTimeDays: 5,  contractedFillRatePct: 98, penaltyPerDayDelay: 300 },
];

function makeSampleOrders(): PurchaseOrderRecord[] {
  const makeO = (supplierId: string, poNum: string, oQty: number, acc: number, rej: number, daysLate: number): PurchaseOrderRecord => {
    const pd = new Date(2026, 5, 1); const ed = new Date(pd); ed.setDate(ed.getDate() + 7); const ad = new Date(ed); ad.setDate(ad.getDate() + daysLate);
    return { poNumber: poNum, supplierId, orderedQty: oQty, orderedValue: oQty * 800, poDate: pd.toISOString(), expectedDeliveryDate: ed.toISOString(), actualDeliveryDate: ad.toISOString(), receivedQty: acc + rej, acceptedQty: acc, rejectedQty: rej, qualityVerdict: rej > 0 ? "PARTIAL_REJECTION" : "ACCEPTED" };
  };
  return [
    makeO("SUP-001","PO-001",200,198,2,0), makeO("SUP-001","PO-002",150,148,0,0), makeO("SUP-001","PO-003",100,90,5,3),
    makeO("SUP-002","PO-004",300,240,30,5), makeO("SUP-002","PO-005",250,210,20,8),
    makeO("SUP-003","PO-006",80,80,0,0), makeO("SUP-003","PO-007",100,99,1,1),
  ];
}

export const SupplierScorecardModal: React.FC<SupplierScorecardModalProps> = ({ isOpen, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>("SUP-001");

  const report = useMemo(() => SupplierScorecardEngine.generateReport(SAMPLE_PROFILES, makeSampleOrders()), []);
  const selected = report.entries.find((e) => e.supplierId === selectedId) ?? report.entries[0];

  if (!isOpen) return null;

  const st = STATUS_STYLES[selected.slaStatus];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Supplier Scorecard & Vendor SLA Compliance Audit</h2>
              <p className="text-xs text-slate-400">OTD % Â· Fill Rate Â· Quality Rejection Â· Penalty Accrual Â· Composite Score</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-5 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/30">
          {[
            { label: "Total Suppliers", value: report.totalSuppliers, color: "text-slate-300" },
            { label: "Green", value: report.greenSuppliers, color: "text-emerald-400" },
            { label: "Amber", value: report.amberSuppliers, color: "text-amber-400" },
            { label: "Red", value: report.redSuppliers, color: "text-rose-400" },
            { label: "Critical", value: report.criticalSuppliers, color: "text-red-400" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3 text-center">
              <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Supplier List */}
          <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Suppliers (ranked)</p>
            {report.entries.map((entry) => {
              const tc = STATUS_STYLES[entry.slaStatus];
              return (
                <button key={entry.supplierId} onClick={() => setSelectedId(entry.supplierId)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedId === entry.supplierId ? `${tc.bg} ${tc.border}` : "border-transparent hover:bg-slate-800/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">{entry.supplierName}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tc.badge}`}>{entry.slaStatus}</span>
                  </div>
                  <div className={`text-lg font-black font-mono mt-0.5 ${tc.text}`}>{entry.scorecard}<span className="text-[10px] text-slate-500">/100</span></div>
                </button>
              );
            })}
          </div>

          {/* Supplier Detail */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Profile Header */}
            <div className={`rounded-2xl border p-5 ${st.bg} ${st.border}`}>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xl font-bold text-slate-100">{selected.supplierName}</p>
                  <p className="text-xs text-slate-400">{selected.category} Â· GSTIN: {SAMPLE_PROFILES.find((p) => p.supplierId === selected.supplierId)?.gstIn ?? "â€”"}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.badge}`}>{selected.slaStatus}</span>
                    <span className="text-xs text-slate-400">{selected.totalOrders} POs processed</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-black font-mono ${st.text}`}>{selected.scorecard}</div>
                  <div className="text-[10px] text-slate-400">Composite Score / 100</div>
                  {selected.totalPenaltyAccrued > 0 && (
                    <div className="text-xs text-rose-400 font-bold mt-1">Penalty: â‚¹{selected.totalPenaltyAccrued.toLocaleString("en-IN")}</div>
                  )}
                </div>
              </div>

              {/* Score Bar */}
              <div className="mt-4">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${selected.scorecard >= 85 ? "bg-emerald-500" : selected.scorecard >= 70 ? "bg-amber-500" : selected.scorecard >= 50 ? "bg-rose-500" : "bg-red-600"}`}
                    style={{ width: `${selected.scorecard}%` }} />
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "On-Time Delivery", value: `${selected.onTimeDeliveryPct}%`, sub: `${selected.onTimeDeliveries}/${selected.totalOrders} on time`, color: selected.onTimeDeliveryPct >= 90 ? "text-emerald-400" : selected.onTimeDeliveryPct >= 75 ? "text-amber-400" : "text-rose-400" },
                { label: "Fill Rate", value: `${selected.fillRatePct}%`, sub: `Contracted: 95%`, color: selected.fillRatePct >= 95 ? "text-emerald-400" : "text-amber-400" },
                { label: "Quality Rejection", value: `${selected.qualityRejectionPct}%`, sub: `${selected.lateDeliveries} late deliveries`, color: selected.qualityRejectionPct <= 2 ? "text-emerald-400" : selected.qualityRejectionPct <= 5 ? "text-amber-400" : "text-rose-400" },
                { label: "Avg Lead Time", value: `${selected.avgLeadTimeDays}d`, sub: `Contracted: ${selected.contractedLeadTimeDays}d`, color: selected.avgLeadTimeDays <= selected.contractedLeadTimeDays ? "text-emerald-400" : "text-rose-400" },
                { label: "Late Deliveries", value: selected.lateDeliveries, sub: `of ${selected.totalOrders} POs`, color: selected.lateDeliveries === 0 ? "text-emerald-400" : "text-rose-400" },
                { label: "Penalty Accrued", value: `â‚¹${selected.totalPenaltyAccrued.toLocaleString("en-IN")}`, sub: "Current period", color: selected.totalPenaltyAccrued === 0 ? "text-emerald-400" : "text-rose-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{m.label}</div>
                  <div className="text-[10px] text-slate-500">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* PO Table */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent Purchase Orders</p>
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">PO No.</th>
                      <th className="py-2 px-3 text-right">Ordered</th>
                      <th className="py-2 px-3 text-right">Accepted</th>
                      <th className="py-2 px-3 text-right">Rejected</th>
                      <th className="py-2 px-3 text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {selected.orders.map((o) => (
                      <tr key={o.poNumber}>
                        <td className="py-2 px-3 text-slate-300">{o.poNumber}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{o.orderedQty}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">{o.acceptedQty ?? "â€”"}</td>
                        <td className="py-2 px-3 text-right text-rose-400">{o.rejectedQty ?? 0}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${o.qualityVerdict === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border-rose-500/30"}`}>
                            {o.qualityVerdict ?? "PENDING"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default SupplierScorecardModal;

