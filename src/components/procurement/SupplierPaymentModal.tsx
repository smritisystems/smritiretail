/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.113.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import SupplierPaymentEngine, {
  SupplierInvoice, AgingBucket, InvoiceStatus,
} from "../../utils/supplierPaymentEngine";

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const BUCKET_STYLE: Record<AgingBucket, string> = {
  CURRENT:    "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  OVERDUE_30: "text-amber-300 bg-amber-500/15 border-amber-500/25",
  OVERDUE_60: "text-orange-300 bg-orange-500/15 border-orange-500/25",
  OVERDUE_90: "text-red-300 bg-red-500/15 border-red-500/25",
  CRITICAL:   "text-rose-300 bg-rose-600/25 border-rose-500/40",
};

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  UNPAID:          "text-amber-300 bg-amber-500/15 border-amber-500/25",
  PARTIALLY_PAID:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  PAID:            "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  OVERDUE:         "text-rose-300 bg-rose-500/15 border-rose-500/25",
  DISPUTED:        "text-slate-300 bg-slate-600/15 border-slate-500/25",
};

const fmt = (n: number) => `â‚¹${n.toLocaleString("en-IN")}`;

const NOW = new Date("2026-08-28T00:00:00.000Z");

function buildSampleInvoices(): SupplierInvoice[] {
  const base = { branchCode: "BR-MUM-01" };
  const invs = [
    SupplierPaymentEngine.createInvoice({ ...base, vendorId: "VNDR-001", vendorName: "Textile Exports Ltd",    invoiceNo: "INV-TE-0081", invoiceAmt: 45000, invoiceDate: "2026-07-29", terms: "NET_30", earlyPayCutoffDays: 10, earlyPayDiscountPct: 2 }, NOW),
    SupplierPaymentEngine.createInvoice({ ...base, vendorId: "VNDR-001", vendorName: "Textile Exports Ltd",    invoiceNo: "INV-TE-0072", invoiceAmt: 30000, invoiceDate: "2026-06-01", terms: "NET_30" }, NOW),
    SupplierPaymentEngine.createInvoice({ ...base, vendorId: "VNDR-002", vendorName: "Craft Weaves Pvt Ltd",   invoiceNo: "INV-CW-0041", invoiceAmt: 60000, invoiceDate: "2026-03-01", terms: "NET_30" }, NOW),
    SupplierPaymentEngine.createInvoice({ ...base, vendorId: "VNDR-002", vendorName: "Craft Weaves Pvt Ltd",   invoiceNo: "INV-CW-0055", invoiceAmt: 20000, invoiceDate: "2026-08-10", terms: "NET_45" }, NOW),
    SupplierPaymentEngine.createInvoice({ ...base, vendorId: "VNDR-003", vendorName: "Fabric House Mumbai",    invoiceNo: "INV-FH-0019", invoiceAmt: 15000, invoiceDate: "2026-08-20", terms: "NET_30", earlyPayCutoffDays: 7, earlyPayDiscountPct: 1.5 }, NOW),
  ];
  return SupplierPaymentEngine.refreshAging(invs, NOW);
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(buildSampleInvoices);
  const [selectedId, setSelectedId] = useState(invoices[0]?.invoiceId ?? "");
  const [activeTab, setActiveTab]   = useState<"INVOICES" | "AGING" | "CALENDAR">("INVOICES");
  const [payAmt, setPayAmt]         = useState("");
  const [payRef, setPayRef]         = useState("");
  const [payDate, setPayDate]       = useState("2026-08-28");

  const selected   = invoices.find((i) => i.invoiceId === selectedId);
  const agingReport = useMemo(() => SupplierPaymentEngine.vendorAgingReport(invoices, NOW), [invoices]);
  const calendar    = useMemo(() => SupplierPaymentEngine.buildDueCalendar(invoices), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((s, i) => s + i.outstandingAmt, 0), [invoices]);

  if (!isOpen) return null;

  const handlePay = () => {
    if (!selected || !payAmt) return;
    const amt = parseFloat(payAmt);
    if (isNaN(amt) || amt <= 0) return;
    const updated = SupplierPaymentEngine.recordPayment(selected, amt, payDate, payRef || `REF-${Date.now()}`);
    setInvoices((prev) => prev.map((i) => i.invoiceId === updated.invoiceId ? updated : i));
    const discount = updated.payments.at(-1)?.earlyPayDiscount ?? 0;
    onNotification?.(
      "Payment Recorded",
      `${selected.invoiceNo} â€” paid ${fmt(amt)}${discount > 0 ? ` Â· Early-pay discount: ${fmt(discount)}` : ""}`,
      "success"
    );
    setPayAmt("");
    setPayRef("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Supplier Payment Terms & Aging Engine</h2>
              <p className="text-xs text-slate-400">Aging Buckets Â· Due Calendar Â· Early-Pay Discount Â· Payment Ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["INVOICES", "AGING", "CALENDAR"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "AGING" ? "Aging Report" : tab === "CALENDAR" ? "Due Calendar" : "Invoices"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Total outstanding strip */}
        <div className="flex items-center gap-6 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          <span className="text-slate-500">Total Outstanding:</span>
          <span className="font-black font-mono text-orange-400">{fmt(totalOutstanding)}</span>
          <span className="text-slate-500 ml-4">Invoices:</span>
          <span className="font-bold font-mono text-slate-300">{invoices.length}</span>
          {(["CURRENT", "OVERDUE_30", "OVERDUE_60", "OVERDUE_90", "CRITICAL"] as AgingBucket[]).map((b) => {
            const count = invoices.filter((i) => i.agingBucket === b && i.status !== "PAID").length;
            if (!count) return null;
            return (
              <div key={b} className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${BUCKET_STYLE[b]}`}>{b.replace("_", " ")}</span>
                <span className="font-mono text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Invoice sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {invoices.map((inv) => (
              <button key={inv.invoiceId} onClick={() => { setSelectedId(inv.invoiceId); setActiveTab("INVOICES"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === inv.invoiceId ? "bg-orange-950/20 border-orange-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{inv.invoiceNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{inv.vendorName}</p>
                <p className="text-xs font-mono font-bold text-orange-400 mt-0.5">{fmt(inv.outstandingAmt)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${BUCKET_STYLE[inv.agingBucket]}`}>
                    {inv.agingBucket.replace("_", " ")}
                  </span>
                  {inv.daysOverdue > 0 && <span className="text-[8px] text-rose-400">{inv.daysOverdue}d overdue</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "INVOICES" && selected && (
              <div className="space-y-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold font-mono text-slate-100">{selected.invoiceNo}</p>
                    <p className="text-xs text-slate-400">{selected.vendorName} Â· {selected.branchCode}</p>
                    <p className="text-[10px] text-slate-500">Terms: {selected.terms} Â· Due: {selected.dueDate} Â· Early-pay cutoff: {selected.earlyPayCutoffDays}d at {selected.earlyPayDiscountPct}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${BUCKET_STYLE[selected.agingBucket]}`}>{selected.agingBucket.replace("_", " ")}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Amount grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Invoice Amount",  value: fmt(selected.invoiceAmt),       color: "text-slate-300" },
                    { label: "Paid",            value: fmt(selected.paidAmt),           color: "text-emerald-400" },
                    { label: "Outstanding",     value: fmt(selected.outstandingAmt),    color: "text-orange-400 text-lg font-black" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                      <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Payment form */}
                {selected.status !== "PAID" && (
                  <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Record Payment</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <input type="number" placeholder="Amount" value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                        className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500/60" />
                      <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500/60" />
                      <input type="text" placeholder="Reference" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                        className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500/60" />
                      <button onClick={handlePay}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 transition-all">
                        Pay
                      </button>
                    </div>
                    {payDate && payAmt && (
                      <p className="text-[10px] text-slate-400">
                        {(() => {
                          const days = Math.floor((new Date(payDate).getTime() - new Date(selected.invoiceDate).getTime()) / 86400000);
                          return days <= selected.earlyPayCutoffDays
                            ? `âœ“ Early-pay discount applies: ${fmt(Math.round(parseFloat(payAmt || "0") * selected.earlyPayDiscountPct / 100 * 100) / 100)} (${selected.earlyPayDiscountPct}%)`
                            : `âœ— Payment on day ${days} â€” beyond ${selected.earlyPayCutoffDays}-day cutoff`;
                        })()}
                      </p>
                    )}
                  </div>
                )}

                {/* Payment history */}
                {selected.payments.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Payment History</p>
                    <div className="space-y-2">
                      {selected.payments.map((p) => (
                        <div key={p.paymentId} className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs font-mono">
                          <span className="text-slate-300">{fmt(p.paidAmt)}</span>
                          <span className="text-slate-600">Â·</span>
                          <span className="text-slate-500">{p.paidOn}</span>
                          <span className="text-slate-600">Â·</span>
                          <span className="text-slate-500">{p.reference}</span>
                          {p.earlyPayDiscount > 0 && (
                            <span className="ml-auto text-emerald-400 text-[10px] font-bold">
                              Early-pay: -{fmt(p.earlyPayDiscount)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "AGING" && (
              <div className="space-y-5">
                <p className="text-sm font-bold text-slate-200">Vendor Aging Report â€” {NOW.toLocaleDateString("en-IN")}</p>
                {agingReport.map((vendor) => (
                  <div key={vendor.vendorId} className="bg-slate-800/20 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{vendor.vendorName}</p>
                        <p className="text-[10px] text-slate-500">{vendor.invoiceCount} invoice(s) Â· Oldest: {vendor.oldestDueDays}d overdue</p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black font-mono text-orange-400">{fmt(vendor.totalOutstanding)}</div>
                        {vendor.criticalAmt > 0 && <div className="text-[10px] text-rose-400 font-bold">CRITICAL: {fmt(vendor.criticalAmt)}</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {vendor.buckets.map((b) => (
                        <div key={b.bucket} className={`rounded-lg p-2 text-center text-xs border ${b.totalAmt > 0 ? BUCKET_STYLE[b.bucket] : "bg-slate-900/30 border-slate-800/30 text-slate-600"}`}>
                          <div className="font-black font-mono">{b.count > 0 ? fmt(b.totalAmt) : "â€”"}</div>
                          <div className="text-[9px] opacity-70 mt-0.5">{b.label.split(" ")[0]}<br />{b.label.split(" ").slice(1).join(" ")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "CALENDAR" && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-200">Payment Due Calendar</p>
                {calendar.length === 0
                  ? <p className="text-slate-500 text-sm text-center py-12">No outstanding invoices.</p>
                  : calendar.map((entry) => {
                    const isPast = new Date(entry.dueDate) < NOW;
                    return (
                      <div key={entry.dueDate} className={`rounded-xl border p-4 ${isPast ? "bg-rose-950/15 border-rose-700/30" : "bg-slate-800/20 border-slate-700/40"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black font-mono ${isPast ? "text-rose-400" : "text-slate-200"}`}>{entry.dueDate}</span>
                            {isPast && <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">OVERDUE</span>}
                          </div>
                          <span className="text-sm font-black font-mono text-orange-400">{fmt(entry.totalDue)}</span>
                        </div>
                        <div className="space-y-1">
                          {entry.invoices.map((inv) => (
                            <div key={inv.invoiceId} className="flex items-center justify-between text-xs px-2">
                              <span className="text-slate-400 font-mono">{inv.invoiceNo}</span>
                              <span className="text-slate-500">{inv.vendorName}</span>
                              <span className="font-mono text-slate-300">{fmt(inv.outstandingAmt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                }
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

export default SupplierPaymentModal;

