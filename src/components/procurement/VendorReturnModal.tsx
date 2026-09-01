/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.103.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import VendorReturnEngine, {
  ReturnToVendorOrder, RTVStatus, ReturnReason,
} from "../../utils/vendorReturnEngine";

interface VendorReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<RTVStatus, string> = {
  DRAFT:               "text-slate-400 bg-slate-700/30 border-slate-600/30",
  SUBMITTED:           "text-blue-300 bg-blue-500/20 border-blue-500/30",
  VENDOR_ACKNOWLEDGED: "text-sky-300 bg-sky-500/20 border-sky-500/30",
  GOODS_DISPATCHED:    "text-violet-300 bg-violet-500/20 border-violet-500/30",
  VENDOR_RECEIVED:     "text-teal-300 bg-teal-500/20 border-teal-500/30",
  DEBIT_NOTE_RAISED:   "text-indigo-300 bg-indigo-500/20 border-indigo-500/30",
  SETTLED:             "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  DISPUTED:            "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED:           "text-slate-500 bg-slate-800/40 border-slate-700/40",
};

const RETURN_REASONS: ReturnReason[] = ["QUALITY_DEFECT","DAMAGED_IN_TRANSIT","WRONG_ITEM","EXCESS_SUPPLY","SHORT_EXPIRY","PRICE_DISCREPANCY","SPECIFICATION_MISMATCH"];

function buildSampleRTVs(): ReturnToVendorOrder[] {
  // RTV 1: At DEBIT_NOTE_RAISED with partial settlement
  let r1 = VendorReturnEngine.createRTV({ vendorId: "VND-001", vendorName: "Reliable Fabrics Ltd.", branchCode: "BR-MUM-01", originalPONo: "PO-20260815-0012",
    lines: [
      { sku: "FAB-COTTON-WHT", productName: "Cotton Fabric White 1m", returnQty: 50, unitCost: 120, gstRate: 5, reason: "QUALITY_DEFECT" },
      { sku: "FAB-DENIM-BLU",  productName: "Denim Fabric Blue 1m",   returnQty: 20, unitCost: 250, gstRate: 5, reason: "DAMAGED_IN_TRANSIT" },
    ], requestedBy: "STORE-MGR-01" });
  r1 = VendorReturnEngine.submit(r1, "STORE-MGR-01");
  r1 = VendorReturnEngine.acknowledge(r1, "VND-REP-01");
  r1 = VendorReturnEngine.dispatch(r1, "DELHIVERY-9921", "WH-OPR-01");
  r1 = VendorReturnEngine.confirmVendorReceipt(r1, "VND-WH-01");
  r1 = VendorReturnEngine.raiseDebitNote(r1, "ACC-MGR-01");
  r1 = VendorReturnEngine.settleDebitNote(r1, 6000, "ACC-MGR-01");

  // RTV 2: Just submitted
  let r2 = VendorReturnEngine.createRTV({ vendorId: "VND-002", vendorName: "Metro Accessories Co.", branchCode: "BR-DEL-01",
    lines: [{ sku: "ACC-BELT-BRN", productName: "Leather Belt Brown", returnQty: 15, unitCost: 350, gstRate: 12, reason: "WRONG_ITEM" }],
    requestedBy: "MGR-DEL-01" });
  r2 = VendorReturnEngine.submit(r2, "MGR-DEL-01");

  // RTV 3: Fully settled
  let r3 = VendorReturnEngine.createRTV({ vendorId: "VND-001", vendorName: "Reliable Fabrics Ltd.", branchCode: "BR-BLR-01",
    lines: [{ sku: "FAB-SILK-RED", productName: "Silk Red 1m", returnQty: 10, unitCost: 600, gstRate: 5, reason: "SHORT_EXPIRY" }],
    requestedBy: "MGR-BLR-01" });
  r3 = VendorReturnEngine.submit(r3, "MGR-BLR-01");
  r3 = VendorReturnEngine.acknowledge(r3, "VND-REP-01");
  r3 = VendorReturnEngine.dispatch(r3, "BLUEDART-4455", "WH-BLR-01");
  r3 = VendorReturnEngine.confirmVendorReceipt(r3, "VND-WH-02");
  r3 = VendorReturnEngine.raiseDebitNote(r3, "ACC-BLR-01");
  r3 = VendorReturnEngine.settleDebitNote(r3, r3.debitNote!.totalAmount, "ACC-BLR-01");

  return [r1, r2, r3];
}

export const VendorReturnModal: React.FC<VendorReturnModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders] = useState<ReturnToVendorOrder[]>(buildSampleRTVs);
  const [selectedId, setSelectedId] = useState(orders[0]?.rtvId ?? "");
  const [activeTab, setActiveTab] = useState<"RTV" | "DEBIT" | "LEDGER">("RTV");
  const [settlementAmt, setSettlementAmt] = useState("");

  const selected = orders.find((o) => o.rtvId === selectedId);
  const update   = (r: ReturnToVendorOrder) => setOrders((prev) => prev.map((o) => o.rtvId === r.rtvId ? r : o));

  const ledger = useMemo(() => VendorReturnEngine.computeVendorBalance(orders, "VND-001"), [orders]);

  if (!isOpen) return null;

  const handleAction = (action: string) => {
    if (!selected) return;
    let r = selected;
    if (action === "submit")   r = VendorReturnEngine.submit(r, "STORE-MGR");
    if (action === "ack")      r = VendorReturnEngine.acknowledge(r, "VND-REP");
    if (action === "dispatch") r = VendorReturnEngine.dispatch(r, `LOG-${Date.now().toString().slice(-4)}`, "WH-OPR");
    if (action === "receive")  r = VendorReturnEngine.confirmVendorReceipt(r, "VND-WH");
    if (action === "debit")    r = VendorReturnEngine.raiseDebitNote(r, "ACC-MGR");
    if (action === "settle") {
      const amt = parseFloat(settlementAmt);
      if (!isNaN(amt) && amt > 0) { r = VendorReturnEngine.settleDebitNote(r, amt, "ACC-MGR"); setSettlementAmt(""); }
      else return;
    }
    update(r);
    onNotification?.("RTV Updated", `${r.rtvNo} â†’ ${r.status.replace(/_/g, " ")}`, "success");
  };

  const actionBtn = (label: string, action: string, color: string) => (
    <button onClick={() => handleAction(action)}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all ${color}`}>
      {label}
    </button>
  );

  const nextAction = selected && {
    DRAFT:               { label: "Submit RTV", action: "submit",   color: "bg-blue-600 hover:bg-blue-500" },
    SUBMITTED:           { label: "Vendor Acknowledge", action: "ack", color: "bg-sky-600 hover:bg-sky-500" },
    VENDOR_ACKNOWLEDGED: { label: "Mark Dispatched", action: "dispatch", color: "bg-violet-600 hover:bg-violet-500" },
    GOODS_DISPATCHED:    { label: "Confirm Vendor Receipt", action: "receive", color: "bg-teal-600 hover:bg-teal-500" },
    VENDOR_RECEIVED:     { label: "Raise Debit Note", action: "debit", color: "bg-indigo-600 hover:bg-indigo-500" },
    DEBIT_NOTE_RAISED:   null,
    SETTLED: null, DISPUTED: null, CANCELLED: null,
  }[selected.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <span className="material-symbols-outlined text-2xl">assignment_return</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Vendor Return & Debit Note Engine</h2>
              <p className="text-xs text-slate-400">RTV Lifecycle Â· Auto Debit Note Â· GST Reversal Â· Partial Settlement Â· Vendor Balance Ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["RTV", "DEBIT", "LEDGER"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "DEBIT" ? "Debit Note" : tab === "LEDGER" ? "Vendor Ledger" : "RTV Workflow"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* RTV sidebar */}
          <div className="w-60 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Return Orders ({orders.length})</p>
            {orders.map((o) => (
              <button key={o.rtvId} onClick={() => { setSelectedId(o.rtvId); setActiveTab("RTV"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.rtvId ? "bg-rose-950/20 border-rose-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <div className="text-xs font-bold text-slate-200 font-mono">{o.rtvNo}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{o.vendorName}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{o.status.replace(/_/g, " ")}</span>
                  <span className="text-[10px] font-mono text-slate-400">â‚¹{o.totalWithGST.toLocaleString("en-IN")}</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === "RTV" && (
                <>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-lg font-bold font-mono text-slate-100">{selected.rtvNo}</p>
                      <p className="text-xs text-slate-400">{selected.vendorName} Â· {selected.branchCode}</p>
                      {selected.originalPONo && <p className="text-[10px] text-indigo-400 mt-0.5">PO: {selected.originalPONo}</p>}
                      {selected.approvedBy && <p className="text-[10px] text-emerald-400">Acknowledged by: {selected.approvedBy}</p>}
                      {selected.dispatchRef && <p className="text-[10px] text-sky-400">Dispatch: {selected.dispatchRef}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status.replace(/_/g, " ")}</span>
                      {nextAction && actionBtn(nextAction.label, nextAction.action, nextAction.color)}
                      {selected.status === "DEBIT_NOTE_RAISED" && selected.debitNote?.status !== "SETTLED" && (
                        <div className="flex items-center gap-2">
                          <input type="number" placeholder="₹ Amount" value={settlementAmt} data-field-key="selling_price" onChange={(e) => setSettlementAmt(e.target.value)}
                            className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500/60" />
                          {actionBtn("Settle", "settle", "bg-emerald-600 hover:bg-emerald-500")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Net Return Value", value: `â‚¹${selected.totalNetValue.toLocaleString("en-IN")}`, color: "text-slate-300" },
                      { label: "GST Reversal",     value: `â‚¹${selected.totalGST.toLocaleString("en-IN")}`,     color: "text-rose-400" },
                      { label: "Total Debit",      value: `â‚¹${selected.totalWithGST.toLocaleString("en-IN")}`, color: "text-indigo-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                        <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Lines table */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Reason</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-3 text-right">GST</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selected.lines.map((l) => (
                          <tr key={l.lineId}>
                            <td className="py-2 px-3 font-sans text-slate-200">{l.productName}<div className="text-[10px] text-slate-500">{l.sku}</div></td>
                            <td className="py-2 px-3"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">{l.reason.replace(/_/g, " ")}</span></td>
                            <td className="py-2 px-3 text-right text-slate-400">{l.returnQty}</td>
                            <td className="py-2 px-3 text-right text-slate-300">â‚¹{l.unitCost}</td>
                            <td className="py-2 px-3 text-right text-rose-400">â‚¹{l.gstAmount}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-100">â‚¹{l.totalWithGST.toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Audit trail */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Audit Trail</p>
                    <div className="space-y-2">
                      {[...selected.auditTrail].reverse().map((e) => (
                        <div key={e.auditId} className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[e.toStatus]}`}>{e.toStatus.replace(/_/g, " ")}</span>
                              <span className="text-slate-500 text-[10px] font-mono">{e.performedBy} Â· {new Date(e.timestamp).toLocaleString("en-IN")}</span>
                            </div>
                            {e.note && <p className="text-slate-400 mt-1">{e.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "DEBIT" && (
                selected.debitNote ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-lg font-bold font-mono text-slate-100">{selected.debitNote.debitNoteNo}</p>
                        <p className="text-xs text-slate-400">{selected.debitNote.vendorName} Â· Issued {new Date(selected.debitNote.issuedAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      <span className={`text-sm font-black px-3 py-1.5 rounded-full border ${
                        selected.debitNote.status === "SETTLED" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                        selected.debitNote.status === "PARTIALLY_SETTLED" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                        "text-indigo-300 bg-indigo-500/20 border-indigo-500/30"
                      }`}>{selected.debitNote.status.replace(/_/g, " ")}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Net Amount",   value: `â‚¹${selected.debitNote.netAmount.toLocaleString("en-IN")}`,      color: "text-slate-300" },
                        { label: "Settled",      value: `â‚¹${selected.debitNote.settledAmount.toLocaleString("en-IN")}`,  color: "text-emerald-400" },
                        { label: "Outstanding",  value: `â‚¹${selected.debitNote.outstandingAmount.toLocaleString("en-IN")}`, color: selected.debitNote.outstandingAmount > 0 ? "text-rose-400" : "text-slate-500" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                          <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Settlement Progress</span>
                        <span>{Math.round((selected.debitNote.settledAmount / selected.debitNote.totalAmount) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (selected.debitNote.settledAmount / selected.debitNote.totalAmount) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3 text-right">GST</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {selected.debitNote.lines.map((l, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 font-sans text-slate-300 text-xs">{l.description}</td>
                              <td className="py-2 px-3 text-right text-slate-400">{l.qty}</td>
                              <td className="py-2 px-3 text-right text-slate-300">â‚¹{l.lineValue.toLocaleString("en-IN")}</td>
                              <td className="py-2 px-3 text-right text-rose-400">â‚¹{l.gstAmount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                    No debit note raised yet for this RTV.
                  </div>
                )
              )}

              {activeTab === "LEDGER" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Total Debit Notes",  value: ledger.totalDebitNotes, color: "text-slate-300" },
                      { label: "Total Debit Value",  value: `â‚¹${ledger.totalDebitValue.toLocaleString("en-IN")}`, color: "text-indigo-400" },
                      { label: "Total Settled",      value: `â‚¹${ledger.totalSettled.toLocaleString("en-IN")}`, color: "text-emerald-400" },
                      { label: "Outstanding",        value: `â‚¹${ledger.totalOutstanding.toLocaleString("en-IN")}`, color: ledger.totalOutstanding > 0 ? "text-rose-400" : "text-slate-500" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                        <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Open Debit Notes â€” {ledger.vendorName}</p>
                  {ledger.openDebitNotes.length === 0
                    ? <p className="text-slate-500 text-sm">All debit notes fully settled.</p>
                    : ledger.openDebitNotes.map((dn) => (
                      <div key={dn.debitNoteId} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold font-mono text-slate-200">{dn.debitNoteNo}</p>
                          <p className="text-[10px] text-slate-400">Total: â‚¹{dn.totalAmount.toLocaleString("en-IN")} Â· Settled: â‚¹{dn.settledAmount.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black font-mono text-rose-400">â‚¹{dn.outstandingAmount.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-slate-500">outstanding</p>
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

export default VendorReturnModal;

