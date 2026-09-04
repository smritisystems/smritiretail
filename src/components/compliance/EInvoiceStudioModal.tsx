/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.94.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import EInvoiceEngine, {
  EInvoice,
  GSTParty,
  BulkPrintJob,
} from "../../utils/eInvoiceEngine";

interface EInvoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:                "text-slate-400 bg-slate-700/30 border-slate-600/30",
  PENDING_REGISTRATION: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  REGISTERED:           "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  CANCELLED:            "text-rose-300 bg-rose-500/20 border-rose-500/30",
  PRINT_QUEUED:         "text-amber-300 bg-amber-500/20 border-amber-500/30",
  PRINTED:              "text-teal-300 bg-teal-500/20 border-teal-500/30",
};

const SUPPLIER: GSTParty = {
  gstin: "27AABCS1234A1Z5", legalName: "SMRITI Fashion Pvt. Ltd.", tradeName: "SMRITI Books",
  address1: "123 Commerce Road, Fort", location: "Mumbai", pincode: "400001", stateCode: "27",
};
const BUYER: GSTParty = {
  gstin: "29AABCB5678B2Z6", legalName: "Kalyan Retailers Ltd.",
  address1: "45 MG Road", location: "Bengaluru", pincode: "560001", stateCode: "29",
};

function makeSampleInvoices(): EInvoice[] {
  const itemA = EInvoiceEngine.computeLineItem({ slNo: 1, description: "Polo Shirt Navy M", hsn: "62052090", qty: 50, unit: "NOS", unitPrice: 1000, gstRate: 12, isInterState: true });
  const itemB = EInvoiceEngine.computeLineItem({ slNo: 2, description: "Slim Denim Black 32", hsn: "62034290", qty: 30, unit: "NOS", unitPrice: 1800, gstRate: 12, isInterState: true });

  const d1 = EInvoiceEngine.createDraft({ docType: "INV", docNo: "SMRITI/2026-27/001", docDate: "28/08/2026", supplier: SUPPLIER, buyer: BUYER, items: [itemA] });
  const d2 = EInvoiceEngine.createDraft({ docType: "INV", docNo: "SMRITI/2026-27/002", docDate: "28/08/2026", supplier: SUPPLIER, buyer: BUYER, items: [itemA, itemB] });
  const d3 = EInvoiceEngine.createDraft({ docType: "CRN", docNo: "SMRITI/CRN/2026-27/001", docDate: "28/08/2026", supplier: SUPPLIER, buyer: BUYER, items: [itemB] });

  const r1 = EInvoiceEngine.registerIRN(d1);
  const r2 = EInvoiceEngine.registerIRN(d2);

  return [r1, r2, d3];
}

export const EInvoiceStudioModal: React.FC<EInvoiceStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [invoices, setInvoices] = useState<EInvoice[]>(makeSampleInvoices);
  const [selectedId, setSelectedId] = useState<string>(invoices[0]?.invoiceId ?? "");
  const [printJob, setPrintJob] = useState<BulkPrintJob | null>(null);
  const [activeTab, setActiveTab] = useState<"INVOICES" | "PRINT_QUEUE">("INVOICES");

  const selected = invoices.find((i) => i.invoiceId === selectedId);
  const registeredCount = invoices.filter((i) => i.status === "REGISTERED").length;
  const printQueuedCount = invoices.filter((i) => i.status === "PRINT_QUEUED").length;

  if (!isOpen) return null;

  const handleRegister = (inv: EInvoice) => {
    const registered = EInvoiceEngine.registerIRN(inv);
    setInvoices((prev) => prev.map((i) => i.invoiceId === inv.invoiceId ? registered : i));
    onNotification?.("IRN Registered", `IRN generated for ${inv.docNo}`, "success");
  };

  const handleBulkPrint = () => {
    const registered = invoices.filter((i) => i.status === "REGISTERED");
    if (registered.length === 0) { onNotification?.("Nothing to Print", "No registered invoices available.", "error"); return; }
    const { job, invoices: updated } = EInvoiceEngine.createBulkPrintJob(invoices);
    setInvoices(updated);
    const completed = EInvoiceEngine.completePrintJob(job, registered.length, 0);
    setPrintJob(completed);
    setActiveTab("PRINT_QUEUE");
    onNotification?.("Print Job Created", `${registered.length} invoice(s) queued for print.`, "success");
  };

  const handleCancel = (inv: EInvoice) => {
    try {
      const cancelled = EInvoiceEngine.cancelIRN(inv, "Cancelled via e-Invoice Studio");
      setInvoices((prev) => prev.map((i) => i.invoiceId === inv.invoiceId ? cancelled : i));
      onNotification?.("IRN Cancelled", `${inv.docNo} cancelled.`, "info");
    } catch {
      onNotification?.("Cannot Cancel", "Only registered invoices can be cancelled.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">GST e-Invoice IRN Generation & QR Code Printing Studio</h2>
              <p className="text-xs text-slate-400">GSTN API v1.03 · SHA-256 IRN · CBIC QR Payload · Bulk Print Queue</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["INVOICES", "PRINT_QUEUE"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "PRINT_QUEUE" ? `Print Queue (${printQueuedCount})` : tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-4 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/30">
          {[
            { label: "Total Invoices", value: invoices.length, color: "text-slate-300" },
            { label: "Registered", value: registeredCount, color: "text-emerald-400" },
            { label: "Drafts", value: invoices.filter((i) => i.status === "DRAFT").length, color: "text-slate-400" },
            { label: "Cancelled", value: invoices.filter((i) => i.status === "CANCELLED").length, color: "text-rose-400" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3 text-center">
              <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        {activeTab === "INVOICES" ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Invoice List */}
            <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoices</p>
                <button onClick={handleBulkPrint} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 transition-all">
                  ðŸ–¨ Bulk Print
                </button>
              </div>
              {invoices.map((inv) => (
                <button key={inv.invoiceId} onClick={() => setSelectedId(inv.invoiceId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === inv.invoiceId ? "bg-orange-950/20 border-orange-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                  <div className="text-[10px] font-bold text-slate-200 font-mono truncate">{inv.docNo}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{inv.docType} · ₹{inv.totals.grandTotal.toLocaleString("en-IN")}</div>
                  <span className={`inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
                </button>
              ))}
            </div>

            {/* Invoice Detail */}
            {selected && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Actions */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-100 font-mono">{selected.docNo}</p>
                    <p className="text-xs text-slate-400">{selected.docType === "INV" ? "Tax Invoice" : selected.docType === "CRN" ? "Credit Note" : "Debit Note"} · {selected.docDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                    {selected.status === "DRAFT" && (
                      <button onClick={() => handleRegister(selected)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 transition-all shadow-lg shadow-orange-500/20">
                        ðŸ” Register IRN
                      </button>
                    )}
                    {selected.status === "REGISTERED" && (
                      <button onClick={() => handleCancel(selected)} className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all">
                        Cancel IRN
                      </button>
                    )}
                  </div>
                </div>

                {/* IRN + QR Block */}
                {selected.irn && (
                  <div className="bg-orange-950/20 border border-orange-500/30 rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-orange-300 uppercase tracking-wide">GSTN Registration Details</p>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Invoice Registration Number (IRN)</p>
                      <p className="text-xs font-mono text-orange-200 break-all bg-slate-950/40 rounded-lg p-2 border border-slate-800">{selected.irn}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-[10px] text-slate-500 mb-0.5">ACK Number</p><p className="text-xs font-mono text-slate-300">{selected.ackNo}</p></div>
                      <div><p className="text-[10px] text-slate-500 mb-0.5">ACK Date</p><p className="text-xs text-slate-300">{selected.ackDate ? new Date(selected.ackDate).toLocaleString("en-IN") : "—"}</p></div>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">QR Payload (CBIC Spec)</p>
                      <p className="text-[10px] font-mono text-slate-400 break-all bg-slate-950/40 rounded-lg p-2 border border-slate-800">{selected.qrPayload}</p>
                    </div>
                  </div>
                )}

                {/* Parties */}
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: "Supplier", party: selected.supplier }, { label: "Buyer", party: selected.buyer }].map((p) => (
                    <div key={p.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">{p.label}</p>
                      <p className="text-xs font-bold text-slate-200">{p.party.legalName}</p>
                      <p className="text-[10px] text-orange-400 font-mono">{p.party.gstin}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.party.location}, {p.party.stateCode}</p>
                    </div>
                  ))}
                </div>

                {/* Line Items */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Line Items</p>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Description</th><th className="py-2 px-3 text-center">HSN</th><th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3 text-right">Taxable</th><th className="py-2 px-3 text-right">GST%</th><th className="py-2 px-3 text-right">IGST</th><th className="py-2 px-3 text-right">Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selected.items.map((item) => (
                          <tr key={item.slNo}>
                            <td className="py-2 px-3 font-sans text-slate-200">{item.description}</td>
                            <td className="py-2 px-3 text-center text-slate-400">{item.hsn}</td>
                            <td className="py-2 px-3 text-right text-slate-300">{item.qty}</td>
                            <td className="py-2 px-3 text-right text-slate-300">₹{item.taxableValue.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 text-right text-slate-400">{item.gstRate}%</td>
                            <td className="py-2 px-3 text-right text-orange-400">{item.igst > 0 ? `₹${item.igst}` : `₹${item.cgst}+₹${item.sgst}`}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-100">₹{item.lineTotal.toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t border-slate-800 px-3 py-2 grid grid-cols-4 gap-2 text-[10px] font-mono">
                      {[
                        { label: "Taxable", value: selected.totals.taxableValue },
                        { label: "IGST", value: selected.totals.totalIGST },
                        { label: "Round Off", value: selected.totals.roundOff },
                        { label: "Grand Total", value: selected.totals.grandTotal },
                      ].map((t) => (
                        <div key={t.label} className="text-center">
                          <div className="text-slate-500">{t.label}</div>
                          <div className={`font-bold ${t.label === "Grand Total" ? "text-orange-400" : "text-slate-300"}`}>₹{t.value.toLocaleString("en-IN")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ?? PRINT QUEUE ???????????????????????????????????????????????? */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!printJob ? (
              <div className="text-center py-10 text-slate-500 text-sm">No print job created yet. Use "Bulk Print" from the invoice list.</div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-2xl border p-5 ${printJob.status === "COMPLETED" ? "bg-emerald-950/20 border-emerald-500/30" : "bg-amber-950/20 border-amber-500/30"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-100 font-mono">{printJob.jobId}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{printJob.invoiceIds.length} invoice(s) · Created {new Date(printJob.createdAt).toLocaleTimeString("en-IN")}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${printJob.status === "COMPLETED" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" : "text-amber-300 bg-amber-500/20 border-amber-500/30"}`}>{printJob.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: "Total Queued", value: printJob.invoiceIds.length, color: "text-slate-300" },
                      { label: "Printed", value: printJob.printedCount, color: "text-emerald-400" },
                      { label: "Failed", value: printJob.failedCount, color: "text-rose-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 text-center">
                        <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {invoices.filter((i) => printJob.invoiceIds.includes(i.invoiceId)).map((inv) => (
                  <div key={inv.invoiceId} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/60 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-slate-200 font-mono">{inv.docNo}</p>
                      <p className="text-slate-400 text-[10px] font-mono truncate">{inv.irn?.slice(0, 32)}...</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default EInvoiceStudioModal;

