/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.101.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import ThreeWayMatchEngine, {
  PurchaseOrder,
  GoodsReceiptNote,
  VendorInvoice,
  ThreeWayMatchReport,
  MatchResult,
  POStatus,
  THREE_WAY_CONFIG,
} from "../../utils/threeWayMatchEngine";

interface POApprovalMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const PO_STATUS_STYLE: Record<POStatus, string> = {
  DRAFT:              "text-slate-400 bg-slate-700/30 border-slate-600/30",
  PENDING_APPROVAL:   "text-blue-300 bg-blue-500/20 border-blue-500/30",
  APPROVED:           "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  SENT:               "text-sky-300 bg-sky-500/20 border-sky-500/30",
  PARTIALLY_RECEIVED: "text-violet-300 bg-violet-500/20 border-violet-500/30",
  RECEIVED:           "text-teal-300 bg-teal-500/20 border-teal-500/30",
  INVOICED:           "text-indigo-300 bg-indigo-500/20 border-indigo-500/30",
  THREE_WAY_MATCHED:  "text-lime-300 bg-lime-500/20 border-lime-500/30",
  CLOSED:             "text-green-300 bg-green-600/20 border-green-500/30",
  DISPUTED:           "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED:          "text-slate-500 bg-slate-800/40 border-slate-700/40",
};

const MATCH_STYLE: Record<MatchResult, string> = {
  MATCHED:        "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  PRICE_VARIANCE: "text-amber-300 bg-amber-500/20 border-amber-500/30",
  QTY_VARIANCE:   "text-orange-300 bg-orange-500/20 border-orange-500/30",
  BOTH_VARIANCE:  "text-rose-300 bg-rose-500/20 border-rose-500/30",
  UNMATCHED:      "text-slate-400 bg-slate-700/30 border-slate-600/30",
};

function buildSamplePOs(): PurchaseOrder[] {
  // PO 1: PENDING_APPROVAL
  const po1 = ThreeWayMatchEngine.submitForApproval(
    ThreeWayMatchEngine.createPO({
      vendorId: "VND-001", vendorName: "Reliable Fabrics Ltd.",
      branchCode: "BR-MUM-01",
      lines: [
        { sku: "FAB-COTTON-WHT", productName: "Cotton Fabric White 1m", orderedQty: 500, unitPrice: 120, gstRate: 5 },
        { sku: "FAB-DENIM-BLU",  productName: "Denim Fabric Blue 1m",   orderedQty: 300, unitPrice: 250, gstRate: 5 },
      ],
      requestedBy: "PM-01", deliveryDate: "2026-09-05",
    }),
    "PM-01"
  );

  // PO 2: INVOICED (ready for 3-way match)
  let po2 = ThreeWayMatchEngine.createPO({
    vendorId: "VND-002", vendorName: "Metro Accessories Co.",
    branchCode: "BR-DEL-01",
    lines: [
      { sku: "ACC-BELT-BRN",  productName: "Leather Belt Brown",   orderedQty: 200, unitPrice: 350, gstRate: 12 },
      { sku: "ACC-WALLET-BLK",productName: "Wallet Black Leather", orderedQty: 100, unitPrice: 620, gstRate: 12 },
    ],
    requestedBy: "PM-02", deliveryDate: "2026-08-30",
  });
  po2 = ThreeWayMatchEngine.submitForApproval(po2, "PM-02");
  po2 = ThreeWayMatchEngine.approve(po2, "GM-PURCHASE");
  po2 = ThreeWayMatchEngine.markSent(po2, "PM-02");
  po2 = ThreeWayMatchEngine.applyGRN(po2, {
    grnId: "GRN-001", grnNo: "GRN-2026-0001", poId: po2.poId, vendorId: "VND-002",
    receivedBy: "WH-OPR-01", receivedAt: "2026-08-27T09:00:00Z",
    lines: [
      { lineId: "LINE-1", receivedQty: 200, receivedUnitPrice: 350 },
      { lineId: "LINE-2", receivedQty: 98, receivedUnitPrice: 620 }, // 2 short
    ],
  });
  po2 = ThreeWayMatchEngine.applyInvoice(po2, {
    invoiceId: "INV-001", invoiceNo: "MA/26-27/4421", poId: po2.poId, vendorId: "VND-002",
    invoiceDate: "2026-08-27T12:00:00Z", invoiceTotal: 0,
    lines: [
      { lineId: "LINE-1", invoicedQty: 200, invoicedUnitPrice: 355 }, // â‚¹5 price variance (1.43% > 1%)
      { lineId: "LINE-2", invoicedQty: 98,  invoicedUnitPrice: 620 },
    ],
  });

  // PO 3: CLOSED
  let po3 = ThreeWayMatchEngine.createPO({
    vendorId: "VND-003", vendorName: "Global Footwear Pvt. Ltd.",
    branchCode: "BR-BLR-01",
    lines: [{ sku: "FTW-SNEAKER-WHT", productName: "Sneakers White", orderedQty: 50, unitPrice: 1400, gstRate: 18 }],
    requestedBy: "PM-03",
  });
  po3 = ThreeWayMatchEngine.submitForApproval(po3, "PM-03");
  po3 = ThreeWayMatchEngine.approve(po3, "GM-PURCHASE");
  po3 = ThreeWayMatchEngine.markSent(po3, "PM-03");
  po3 = ThreeWayMatchEngine.applyGRN(po3, {
    grnId: "GRN-002", grnNo: "GRN-2026-0002", poId: po3.poId, vendorId: "VND-003",
    receivedBy: "WH-OPR-02", receivedAt: "2026-08-25T10:00:00Z",
    lines: [{ lineId: "LINE-1", receivedQty: 50, receivedUnitPrice: 1400 }],
  });
  po3 = ThreeWayMatchEngine.applyInvoice(po3, {
    invoiceId: "INV-002", invoiceNo: "GFW/1819", poId: po3.poId, vendorId: "VND-003",
    invoiceDate: "2026-08-25T14:00:00Z", invoiceTotal: 70000,
    lines: [{ lineId: "LINE-1", invoicedQty: 50, invoicedUnitPrice: 1400 }],
  });
  const r3 = ThreeWayMatchEngine.runThreeWayMatch(po3);
  po3 = ThreeWayMatchEngine.closeOrDispute(po3, r3, "ACCOUNTS-MGR");

  return [po1, po2, po3];
}

export const POApprovalMatchModal: React.FC<POApprovalMatchModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>(buildSamplePOs);
  const [selectedId, setSelectedId] = useState<string>(orders[0]?.poId ?? "");
  const [matchReport, setMatchReport] = useState<ThreeWayMatchReport | null>(null);
  const [activeTab, setActiveTab] = useState<"PO" | "MATCH">("PO");

  const selected = orders.find((o) => o.poId === selectedId);

  if (!isOpen) return null;

  const update = (po: PurchaseOrder) => setOrders((prev) => prev.map((o) => o.poId === po.poId ? po : o));

  const handleApprove = () => {
    if (!selected || selected.status !== "PENDING_APPROVAL") return;
    const po = ThreeWayMatchEngine.approve(selected, "GM-PURCHASE", "Approved from studio");
    update(po);
    onNotification?.("Approved", `${po.poNo} approved.`, "success");
  };

  const handleRunMatch = () => {
    if (!selected || selected.status !== "INVOICED") return;
    const report = ThreeWayMatchEngine.runThreeWayMatch(selected);
    setMatchReport(report);
    setActiveTab("MATCH");
  };

  const handleCloseOrDispute = () => {
    if (!selected || !matchReport) return;
    const po = ThreeWayMatchEngine.closeOrDispute(selected, matchReport, "ACCOUNTS-MGR");
    update(po);
    onNotification?.(
      po.status === "CLOSED" ? "PO Closed" : "Dispute Raised",
      `${po.poNo} â†’ ${po.status}`,
      po.status === "CLOSED" ? "success" : "error"
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Vendor PO Approval & 3-Way Match Engine</h2>
              <p className="text-xs text-slate-400">PO â†’ GRN â†’ Invoice Â· Â±{THREE_WAY_CONFIG.qtyTolerancePct}% Qty Â· Â±{THREE_WAY_CONFIG.priceTolerancePct}% Price Tolerance Â· MATCHED/DISPUTED</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["PO", "MATCH"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "PO" ? "PO Workflow" : "3-Way Match"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* PO sidebar */}
          <div className="w-60 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Purchase Orders ({orders.length})</p>
            {orders.map((o) => (
              <button key={o.poId} onClick={() => { setSelectedId(o.poId); setMatchReport(null); setActiveTab("PO"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.poId ? "bg-indigo-950/20 border-indigo-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <div className="text-xs font-bold text-slate-200 font-mono">{o.poNo}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{o.vendorName}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${PO_STATUS_STYLE[o.status]}`}>{o.status.replace(/_/g, " ")}</span>
                  <span className="text-[10px] font-mono text-slate-400">â‚¹{o.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === "PO" ? (
                <>
                  {/* PO header */}
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-lg font-bold font-mono text-slate-100">{selected.poNo}</p>
                      <p className="text-xs text-slate-400">{selected.vendorName} Â· {selected.branchCode}</p>
                      {selected.deliveryDate && <p className="text-xs text-indigo-400 mt-0.5">ðŸ“¦ EDD: {selected.deliveryDate}</p>}
                      {selected.approvedBy && <p className="text-[10px] text-emerald-400 mt-0.5">âœ“ Approved by: {selected.approvedBy}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${PO_STATUS_STYLE[selected.status]}`}>{selected.status.replace(/_/g, " ")}</span>
                      {selected.status === "PENDING_APPROVAL" && (
                        <button onClick={handleApprove} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">Approve</button>
                      )}
                      {selected.status === "INVOICED" && (
                        <button onClick={handleRunMatch} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">Run 3-Way Match</button>
                      )}
                    </div>
                  </div>

                  {/* PO totals */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Taxable Value", value: `â‚¹${selected.totalValue.toLocaleString("en-IN")}`, color: "text-slate-300" },
                      { label: "GST Total", value: `â‚¹${selected.taxTotal.toLocaleString("en-IN")}`, color: "text-indigo-400" },
                      { label: "Grand Total", value: `â‚¹${selected.grandTotal.toLocaleString("en-IN")}`, color: "text-emerald-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                        <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Lines */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">PO Lines</p>
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3 text-right">Ordered</th>
                          <th className="py-2 px-3 text-right">Received</th>
                          <th className="py-2 px-3 text-right">Invoiced</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">GST%</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {selected.lines.map((l) => (
                            <tr key={l.lineId}>
                              <td className="py-2 px-3 font-sans text-slate-200">{l.productName}<div className="text-[10px] text-slate-500">{l.sku}</div></td>
                              <td className="py-2 px-3 text-right text-slate-400">{l.orderedQty}</td>
                              <td className="py-2 px-3 text-right text-teal-400">{l.receivedQty ?? "â€”"}</td>
                              <td className="py-2 px-3 text-right text-indigo-400">{l.invoicedQty ?? "â€”"}</td>
                              <td className="py-2 px-3 text-right text-slate-300">â‚¹{l.unitPrice}</td>
                              <td className="py-2 px-3 text-right text-slate-400">{l.gstRate ?? 0}%</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-100">â‚¹{l.lineTotal.toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${PO_STATUS_STYLE[e.toStatus]}`}>{e.toStatus.replace(/_/g, " ")}</span>
                              <span className="text-slate-500 text-[10px] font-mono">{e.performedBy} Â· {new Date(e.timestamp).toLocaleString("en-IN")}</span>
                            </div>
                            {e.note && <p className="text-slate-400 mt-1">{e.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : matchReport ? (
                <>
                  {/* Match summary */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-100">3-Way Match Report</p>
                      <p className="text-xs text-slate-400">{matchReport.poNo} Â· {matchReport.vendorName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black px-3 py-1.5 rounded-full border ${MATCH_STYLE[matchReport.overallResult]}`}>{matchReport.overallResult.replace(/_/g, " ")}</span>
                      {(selected.status === "INVOICED") && (
                        <button onClick={handleCloseOrDispute}
                          className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${matchReport.requiresDispute ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"}`}>
                          {matchReport.requiresDispute ? "Raise Dispute" : "Close PO"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "PO Value",      value: `â‚¹${matchReport.totalPOValue.toLocaleString("en-IN")}`,      color: "text-slate-300" },
                      { label: "GRN Value",     value: `â‚¹${matchReport.totalGRNValue.toLocaleString("en-IN")}`,     color: "text-teal-400" },
                      { label: "Invoice Value", value: `â‚¹${matchReport.totalInvoiceValue.toLocaleString("en-IN")}`, color: "text-indigo-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                        <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Per-line match */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Per-Line Match Results</p>
                    <div className="space-y-3">
                      {matchReport.lines.map((line) => (
                        <div key={line.lineId} className={`rounded-xl border p-4 ${line.matchResult === "MATCHED" ? "bg-emerald-950/10 border-emerald-500/20" : "bg-rose-950/10 border-rose-500/20"}`}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-200">{line.productName} <span className="text-slate-500 font-mono ml-1">{line.sku}</span></p>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${MATCH_STYLE[line.matchResult]}`}>{line.matchResult.replace(/_/g, " ")}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            {[
                              { label: "Qty (PO/GRN/INV)", value: `${line.poQty} / ${line.grnQty} / ${line.invQty}` },
                              { label: "Price (PO/INV)", value: `â‚¹${line.poUnitPrice} / â‚¹${line.invUnitPrice}` },
                              { label: "Variances", value: `Qty: ${line.qtyVariancePct}% Â· Price: ${line.priceVariancePct}%` },
                            ].map((m) => (
                              <div key={m.label} className="bg-slate-900/40 rounded-lg p-2">
                                <div className="text-[10px] text-slate-500 mb-0.5">{m.label}</div>
                                <div className="font-mono text-slate-200 text-xs">{m.value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-3 mt-2 text-[10px]">
                            <span className={line.qtyVariancePct <= THREE_WAY_CONFIG.qtyTolerancePct ? "text-emerald-400" : "text-rose-400"}>
                              Qty: {line.qtyVariancePct <= THREE_WAY_CONFIG.qtyTolerancePct ? "âœ“" : "âœ—"} {THREE_WAY_CONFIG.qtyTolerancePct}% tolerance
                            </span>
                            <span className={line.priceVariancePct <= THREE_WAY_CONFIG.priceTolerancePct ? "text-emerald-400" : "text-rose-400"}>
                              Price: {line.priceVariancePct <= THREE_WAY_CONFIG.priceTolerancePct ? "âœ“" : "âœ—"} {THREE_WAY_CONFIG.priceTolerancePct}% tolerance
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                  Select an INVOICED PO and click <strong className="text-indigo-400 mx-1">Run 3-Way Match</strong> to view the report.
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

export default POApprovalMatchModal;

