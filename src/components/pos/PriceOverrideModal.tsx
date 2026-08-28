/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.108.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import PriceOverrideEngine, {
  PriceOverrideRequest, OverrideStatus, AuthorityLevel,
  DEFAULT_OVERRIDE_CONFIG,
} from "../../../utils/priceOverrideEngine";

interface PriceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<OverrideStatus, string> = {
  PENDING:      "text-amber-300 bg-amber-500/20 border-amber-500/30",
  APPROVED:     "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  AUTO_APPROVED:"text-teal-300 bg-teal-500/20 border-teal-500/30",
  REJECTED:     "text-rose-300 bg-rose-500/20 border-rose-500/30",
  EXPIRED:      "text-slate-500 bg-slate-800/30 border-slate-700/30",
  CANCELLED:    "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

const AUTHORITY_STYLE: Record<AuthorityLevel, string> = {
  CASHIER:    "text-slate-400",
  SUPERVISOR: "text-sky-400",
  MANAGER:    "text-violet-400",
  GM:         "text-orange-400",
  DIRECTOR:   "text-red-400",
};

function buildSampleRequests(): PriceOverrideRequest[] {
  const base = { branchCode: "BR-MUM-01", posTerminal: "POS-03", requestedBy: "CASHIER-007" };
  const r1 = PriceOverrideEngine.createRequest({ ...base, sku: "FAB-DENIM-BLU", productName: "Denim Blue 1m", standardPrice: 250, requestedPrice: 246 });   // AUTO_APPROVED 1.6%
  const r2 = PriceOverrideEngine.createRequest({ ...base, sku: "FAB-SILK-RED",  productName: "Silk Red 1m",   standardPrice: 600, requestedPrice: 570 });   // PENDING 5%
  let r3   = PriceOverrideEngine.createRequest({ ...base, sku: "ACC-BELT-BRN",  productName: "Leather Belt",  standardPrice: 350, requestedPrice: 297.5 }); // MANAGER 15%
  r3 = PriceOverrideEngine.approve(r3, "MGR-001", "MANAGER", "Customer VIP — approved");
  const r4 = PriceOverrideEngine.createRequest({ ...base, sku: "FAB-LINEN-WHT", productName: "Linen White 1m", standardPrice: 180, requestedPrice: 162 }); // PENDING 10%
  return [r1, r2, r3, r4];
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const PriceOverrideModal: React.FC<PriceOverrideModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [requests, setRequests] = useState<PriceOverrideRequest[]>(buildSampleRequests);
  const [selectedId, setSelectedId] = useState(requests[0]?.requestId ?? "");
  const [approverAuthority, setApproverAuthority] = useState<AuthorityLevel>("MANAGER");

  const selected = requests.find((r) => r.requestId === selectedId);
  const update   = (r: PriceOverrideRequest) => setRequests((prev) => prev.map((x) => x.requestId === r.requestId ? r : x));

  const report = useMemo(() => PriceOverrideEngine.auditReport(requests), [requests]);

  if (!isOpen) return null;

  const handleApprove = () => {
    if (!selected) return;
    try {
      const approved = PriceOverrideEngine.approve(selected, "MGR-001", approverAuthority, "Approved via Price Override Studio");
      update(approved);
      onNotification?.("Approved", `${selected.requestNo} approved by ${approverAuthority}`, "success");
    } catch (e: any) {
      onNotification?.("Authority Error", e.message, "error");
    }
  };

  const handleReject = () => {
    if (!selected) return;
    const rejected = PriceOverrideEngine.reject(selected, "MGR-001", "Price threshold exceeded — policy violation");
    update(rejected);
    onNotification?.("Rejected", `${selected.requestNo} rejected`, "info");
  };

  const handleExpirePending = () => {
    const future = new Date(Date.now() + 99 * 60000);
    setRequests((prev) => PriceOverrideEngine.expireBatch(prev, future));
    onNotification?.("Expired", "All expired pending requests marked", "info");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <span className="material-symbols-outlined text-2xl">price_change</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Price Override Approval Engine</h2>
              <p className="text-xs text-slate-400">Deviation Matrix · Authority Levels · Audit Log · Auto-Approve</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExpirePending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-amber-400 hover:text-amber-200 hover:bg-amber-900/20 transition-colors border border-amber-700/30">
              Expire Pending
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Audit summary strip */}
        <div className="flex items-center gap-6 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "Total",          value: report.total,         color: "text-slate-300" },
            { label: "Auto-Approved",  value: report.autoApproved,  color: "text-teal-400" },
            { label: "Approved",       value: report.approved,       color: "text-emerald-400" },
            { label: "Pending",        value: report.pending,        color: "text-amber-400" },
            { label: "Rejected",       value: report.rejected,       color: "text-rose-400" },
            { label: "Expired",        value: report.expired,        color: "text-slate-500" },
            { label: "Avg Dev%",       value: `${report.avgDeviationPct}%`, color: "text-orange-400" },
            { label: "Total Deviation",value: fmt(report.totalDeviationAmt), color: "text-red-400" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-bold font-mono ${m.color}`}>{m.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Request list */}
          <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {requests.map((r) => (
              <button key={r.requestId} onClick={() => setSelectedId(r.requestId)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === r.requestId ? "bg-violet-950/20 border-violet-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{r.requestNo}</p>
                <p className="text-xs text-slate-300 mt-0.5">{r.productName}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>
                    {r.status.replace(/_/g, " ")}
                  </span>
                  <span className={`text-[10px] font-bold ${r.deviationPct > 10 ? "text-rose-400" : r.deviationPct > 5 ? "text-amber-400" : "text-slate-400"}`}>
                    {r.deviationPct}%
                  </span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold font-mono text-slate-100">{selected.requestNo}</p>
                  <p className="text-xs text-slate-400">{selected.productName} · {selected.sku}</p>
                  <p className="text-[10px] text-slate-500">{selected.branchCode} · {selected.posTerminal} · Requested by: {selected.requestedBy}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>
                  {selected.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Price card */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Standard Price",  value: fmt(selected.standardPrice),  color: "text-slate-300" },
                  { label: "Requested Price", value: fmt(selected.requestedPrice), color: "text-violet-400" },
                  { label: "Deviation",       value: `${selected.deviationPct}% (${fmt(Math.abs(selected.deviationAmt))})`,
                    color: selected.deviationPct > 10 ? "text-rose-400" : selected.deviationPct > 5 ? "text-amber-400" : "text-emerald-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Authority */}
              <div className="flex items-center gap-3 bg-slate-800/20 border border-slate-700/40 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-slate-500 text-lg">shield</span>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Required Authority</p>
                  <p className={`text-sm font-bold ${AUTHORITY_STYLE[selected.requiredAuthority]}`}>{selected.requiredAuthority}</p>
                </div>
                <div className="ml-auto text-[10px] text-slate-500">
                  Expires: {new Date(selected.expiresAt).toLocaleString("en-IN")}
                </div>
              </div>

              {/* Action panel */}
              {selected.status === "PENDING" && (
                <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Approval Action</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Approving as:</span>
                      <select value={approverAuthority} onChange={(e) => setApproverAuthority(e.target.value as AuthorityLevel)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60">
                        {(["CASHIER","SUPERVISOR","MANAGER","GM","DIRECTOR"] as AuthorityLevel[]).map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={handleApprove}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">
                      Approve
                    </button>
                    <button onClick={handleReject}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-600 transition-all">
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Deviation matrix reference */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Deviation Authority Matrix</p>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_OVERRIDE_CONFIG.deviationMatrix.map((rule, i) => (
                    <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs border ${selected.deviationPct >= rule.fromPct && selected.deviationPct < rule.toPct ? "bg-violet-950/20 border-violet-500/40" : "bg-slate-800/20 border-slate-800/40"}`}>
                      <span className="font-mono text-slate-400">{rule.fromPct}% – {rule.toPct === Infinity ? "∞" : `${rule.toPct}%`}</span>
                      <span className={`font-bold ${AUTHORITY_STYLE[rule.requiredAuthority]}`}>{rule.requiredAuthority}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit trail */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Audit Trail</p>
                <div className="space-y-2">
                  {[...selected.auditTrail].reverse().map((e) => (
                    <div key={e.auditId} className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 flex-shrink-0 ${
                        e.action === "APPROVED" || e.action === "AUTO_APPROVED" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                        : e.action === "REJECTED" ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                        : e.action === "EXPIRED"  ? "text-slate-500 bg-slate-800/20 border-slate-700/20"
                        : "text-slate-300 bg-slate-700/20 border-slate-600/20"
                      }`}>{e.action.replace(/_/g, " ")}</span>
                      <div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {e.performedBy}{e.authority ? ` (${e.authority})` : ""} · {new Date(e.timestamp).toLocaleString("en-IN")}
                        </p>
                        {e.reason && <p className="text-slate-400 mt-0.5">{e.reason}</p>}
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

export default PriceOverrideModal;
