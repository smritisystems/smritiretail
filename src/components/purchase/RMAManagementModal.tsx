/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.91.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import RMAEngine, {
  RMARequest,
  RMAStatus,
  RMAReturnReason,
  RMAResolutionType,
} from "../../utils/rmaEngine";

interface RMAManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_COLOR: Record<RMAStatus, string> = {
  DRAFT:                  "text-slate-400 bg-slate-700/40 border-slate-600/40",
  SUBMITTED:              "text-blue-300 bg-blue-500/20 border-blue-500/30",
  APPROVED:               "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  IN_TRANSIT:             "text-amber-300 bg-amber-500/20 border-amber-500/30",
  RECEIVED_AT_WAREHOUSE:  "text-cyan-300 bg-cyan-500/20 border-cyan-500/30",
  QUALITY_INSPECTION:     "text-violet-300 bg-violet-500/20 border-violet-500/30",
  CREDIT_NOTE_ISSUED:     "text-teal-300 bg-teal-500/20 border-teal-500/30",
  REFUND_PROCESSED:       "text-emerald-300 bg-emerald-600/20 border-emerald-500/30",
  REJECTED:               "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CLOSED:                 "text-slate-500 bg-slate-800/40 border-slate-700/40",
};

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE_PRODUCT: "Defective Product", WRONG_ITEM_SHIPPED: "Wrong Item Shipped",
  SIZE_COLOR_MISMATCH: "Size / Color Mismatch", CUSTOMER_CHANGED_MIND: "Customer Changed Mind",
  DUPLICATE_ORDER: "Duplicate Order", DAMAGED_IN_TRANSIT: "Damaged in Transit",
  QUALITY_BELOW_EXPECTATION: "Quality Below Expectation", SUPPLIER_OVERSHIPMENT: "Supplier Overshipment",
};

function makeSampleRMAs(): RMARequest[] {
  const r1 = RMAEngine.create({
    type: "CUSTOMER_RETURN", originalSalesVoucher: "INV-2026-0042", customerId: "CUST-001",
    items: [
      { sku: "APP-POLO-NAVY-M", productName: "Polo Shirt Navy M", returnQty: 1, originalUnitPrice: 1200, condition: "DEFECTIVE", restockAction: "QUARANTINE" },
      { sku: "DNM-SLIM-BLK-32", productName: "Slim Denim Black", returnQty: 1, originalUnitPrice: 1999, condition: "AS_NEW", restockAction: "RESTOCK" },
    ],
    reason: "DEFECTIVE_PRODUCT", resolution: "REFUND", initiatedBy: "COUNTER-OPR-01",
  });
  let r1a = RMAEngine.transition(r1, "APPROVED", "MGR-001", "Defect verified — approved");
  r1a = RMAEngine.transition(r1a, "IN_TRANSIT", "LOGISTICS-01", "Return pickup scheduled");
  r1a = RMAEngine.transition(r1a, "RECEIVED_AT_WAREHOUSE", "WH-OPR-01", "Parcel received and logged");
  r1a = RMAEngine.transition(r1a, "CREDIT_NOTE_ISSUED", "ACCOUNTS-01", "Credit note CN-2026-0001 issued", { creditNoteNumber: "CN-2026-0001", refundAmount: 3199 });

  const r2 = RMAEngine.create({
    type: "CUSTOMER_RETURN", originalSalesVoucher: "INV-2026-0087", customerId: "CUST-002",
    items: [{ sku: "FTW-SNEAKER-WHT-8", productName: "Sneakers White", returnQty: 1, originalUnitPrice: 2800, condition: "AS_NEW", restockAction: "RESTOCK" }],
    reason: "CUSTOMER_CHANGED_MIND", resolution: "STORE_CREDIT", initiatedBy: "COUNTER-OPR-02",
  });

  const r3 = RMAEngine.create({
    type: "SUPPLIER_RETURN", originalPONumber: "PO-SUP-001-099", supplierId: "SUP-001",
    items: [{ sku: "APP-SHIRT-WHT-L", productName: "Formal Shirt White L", returnQty: 25, originalUnitPrice: 800, condition: "DEFECTIVE", restockAction: "RETURN_TO_SUPPLIER" }],
    reason: "WRONG_ITEM_SHIPPED", resolution: "SUPPLIER_CREDIT_NOTE", initiatedBy: "PURCHASE-MGR",
  });

  return [r1a, r2, r3];
}

export const RMAManagementModal: React.FC<RMAManagementModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [rmas, setRmas] = useState<RMARequest[]>(makeSampleRMAs);
  const [selectedRMA, setSelectedRMA] = useState<string>(rmas[0]?.rmaNumber ?? "");
  const [activeTab, setActiveTab] = useState<"LIST" | "METRICS">("LIST");

  const selected = rmas.find((r) => r.rmaNumber === selectedRMA);
  const metrics = useMemo(() => RMAEngine.computeMetrics(rmas), [rmas]);

  if (!isOpen) return null;

  const handleTransition = (rma: RMARequest, toStatus: RMAStatus, remarks: string) => {
    const updated = RMAEngine.transition(rma, toStatus, "OPR-001", remarks);
    setRmas((prev) => prev.map((r) => r.rmaNumber === rma.rmaNumber ? updated : r));
    onNotification?.("Status Updated", `${rma.rmaNumber} → ${toStatus}`, "success");
  };

  const NEXT_ACTIONS: Partial<Record<RMAStatus, { label: string; next: RMAStatus; color: string }>> = {
    SUBMITTED:             { label: "Approve",             next: "APPROVED",              color: "bg-emerald-600 hover:bg-emerald-500" },
    APPROVED:              { label: "Mark In Transit",      next: "IN_TRANSIT",            color: "bg-amber-600 hover:bg-amber-500" },
    IN_TRANSIT:            { label: "Receive at Warehouse", next: "RECEIVED_AT_WAREHOUSE", color: "bg-cyan-600 hover:bg-cyan-500" },
    RECEIVED_AT_WAREHOUSE: { label: "Start Inspection",     next: "QUALITY_INSPECTION",    color: "bg-violet-600 hover:bg-violet-500" },
    QUALITY_INSPECTION:    { label: "Issue Credit Note",    next: "CREDIT_NOTE_ISSUED",    color: "bg-teal-600 hover:bg-teal-500" },
    CREDIT_NOTE_ISSUED:    { label: "Mark Closed",          next: "CLOSED",                color: "bg-slate-600 hover:bg-slate-500" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <span className="material-symbols-outlined text-2xl">assignment_return</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Return Merchandise Authorization & Reverse Logistics</h2>
              <p className="text-xs text-slate-400">Customer Returns · Supplier Returns · Credit Notes · Audit Trail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("LIST")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "LIST" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-slate-400 hover:text-slate-200"}`}>RMA Queue</button>
            <button onClick={() => setActiveTab("METRICS")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "METRICS" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>Metrics</button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {activeTab === "LIST" ? (
          <div className="flex flex-1 overflow-hidden">
            {/* RMA List */}
            <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">RMA Queue ({rmas.length})</p>
              {rmas.map((r) => {
                const sc = STATUS_COLOR[r.status];
                return (
                  <button key={r.rmaNumber} onClick={() => setSelectedRMA(r.rmaNumber)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedRMA === r.rmaNumber ? "bg-rose-950/20 border-rose-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                    <div className="text-xs font-bold text-slate-200 font-mono">{r.rmaNumber}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.type === "CUSTOMER_RETURN" ? "Customer Return" : "Supplier Return"}</div>
                    <span className={`inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sc}`}>{r.status}</span>
                  </button>
                );
              })}
            </div>

            {/* RMA Detail */}
            {selected && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Status + Action */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-100 font-mono">{selected.rmaNumber}</p>
                    <p className="text-xs text-slate-400">{REASON_LABELS[selected.reason]} · Resolution: {selected.resolution.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_COLOR[selected.status]}`}>{selected.status}</span>
                    {NEXT_ACTIONS[selected.status] && (
                      <button
                        onClick={() => handleTransition(selected, NEXT_ACTIONS[selected.status]!.next, "Status advanced via RMA console")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${NEXT_ACTIONS[selected.status]!.color}`}>
                        {NEXT_ACTIONS[selected.status]!.label}
                      </button>
                    )}
                  </div>
                </div>

                {/* Refund Summary */}
                {(() => {
                  const { grossReturnValue, restockingFeeAmt, netRefundAmount } = RMAEngine.calculateRefund(selected, 10);
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Gross Return Value", value: `₹${grossReturnValue.toLocaleString("en-IN")}`, color: "text-slate-300" },
                        { label: "Restocking Fee (10%)", value: restockingFeeAmt > 0 ? `-₹${restockingFeeAmt.toLocaleString("en-IN")}` : "—", color: "text-rose-400" },
                        { label: "Net Refund / Credit", value: `₹${netRefundAmount.toLocaleString("en-IN")}`, color: "text-emerald-400" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                          <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Line Items */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Return Items</p>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">SKU</th><th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3 text-right">Unit Price</th><th className="py-2 px-3 text-right">Return Value</th><th className="py-2 px-3 text-center">Condition</th><th className="py-2 px-3 text-center">Restock</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selected.items.map((item) => (
                          <tr key={item.lineId}>
                            <td className="py-2 px-3"><div className="text-slate-200 font-sans font-medium">{item.productName}</div><div className="text-[10px] text-slate-500">{item.sku}</div></td>
                            <td className="py-2 px-3 text-right text-slate-300">{item.returnQty}</td>
                            <td className="py-2 px-3 text-right text-slate-300">₹{item.originalUnitPrice}</td>
                            <td className="py-2 px-3 text-right text-amber-400 font-bold">₹{item.returnValue}</td>
                            <td className="py-2 px-3 text-center"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700/40 bg-slate-800/40 text-slate-300">{item.condition}</span></td>
                            <td className="py-2 px-3 text-center"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${item.restockAction === "RESTOCK" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border-rose-500/30"}`}>{item.restockAction}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trail */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Audit Trail</p>
                  <div className="space-y-2">
                    {[...selected.auditTrail].reverse().map((entry) => (
                      <div key={entry.auditId} className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[entry.fromStatus]}`}>{entry.fromStatus}</span>
                            <span className="text-slate-500 text-[10px]">→</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[entry.toStatus]}`}>{entry.toStatus}</span>
                            <span className="text-slate-500 text-[10px] ml-auto font-mono">{new Date(entry.timestamp).toLocaleTimeString("en-IN")}</span>
                          </div>
                          <p className="text-slate-400 mt-1">{entry.remarks} <span className="text-slate-600">— {entry.performedBy}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ?? METRICS ?????????????????????????????????????????????????????? */
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total RMAs", value: metrics.totalRMAs, color: "text-slate-300" },
                { label: "Pending Approval", value: metrics.pendingApproval, color: "text-blue-400" },
                { label: "In Transit", value: metrics.inTransit, color: "text-amber-400" },
                { label: "Credit Notes Issued", value: metrics.creditNotesIssued, color: "text-teal-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-slate-400 mb-3">Returns by Reason</p>
                {Object.entries(metrics.byReason ?? {}).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-xs text-slate-300 py-1.5 border-b border-slate-800/40 last:border-0">
                    <span>{REASON_LABELS[reason] ?? reason}</span>
                    <span className="font-bold font-mono text-rose-400">{typeof count === "number" ? count : Number(count ?? 0)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-slate-400 mb-3">Financial Summary</p>
                {[
                  { label: "Total Return Value", value: `₹${metrics.totalReturnValue.toLocaleString("en-IN")}` },
                  { label: "Credit Notes Value", value: `₹${metrics.totalCreditNoteValue.toLocaleString("en-IN")}` },
                  { label: "Avg Resolution", value: `${metrics.avgResolutionDays} days` },
                ].map((m) => (
                  <div key={m.label} className="flex justify-between text-xs text-slate-300 py-1.5 border-b border-slate-800/40 last:border-0">
                    <span className="text-slate-400">{m.label}</span>
                    <span className="font-bold font-mono text-amber-400">{m.value}</span>
                  </div>
                ))}
              </div>
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

export default RMAManagementModal;

