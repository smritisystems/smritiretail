/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.119.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import CustomerCreditEngine, {
  CreditAccount, AgingBucket, CreditAccountStatus,
} from "../../../utils/customerCreditEngine";

interface CustomerCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<CreditAccountStatus, string> = {
  ACTIVE:     "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  ON_HOLD:    "text-amber-300 bg-amber-500/15 border-amber-500/25",
  SUSPENDED:  "text-rose-300 bg-rose-500/15 border-rose-500/25",
  CLOSED:     "text-slate-400 bg-slate-700/15 border-slate-600/25",
};

const BUCKET_STYLE: Record<AgingBucket, string> = {
  CURRENT:    "text-emerald-400",
  OVERDUE_30: "text-sky-400",
  OVERDUE_60: "text-amber-400",
  OVERDUE_90: "text-orange-400",
  CRITICAL:   "text-rose-400",
};

const BUCKET_LABELS: Record<AgingBucket, string> = {
  CURRENT:    "Current",
  OVERDUE_30: "1–30d",
  OVERDUE_60: "31–60d",
  OVERDUE_90: "61–90d",
  CRITICAL:   ">90d",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const asOf = new Date("2026-08-28T00:00:00.000Z");

function buildSampleAccounts(): CreditAccount[] {
  let a1 = CustomerCreditEngine.setLimit({ customerId: "C-001", customerName: "Apex Garments Pvt Ltd", creditLimit: 500000, paymentTermDays: 30 });
  a1 = CustomerCreditEngine.postInvoice(a1, "INV-1001", 120000, "2026-05-01", asOf);
  a1 = CustomerCreditEngine.postInvoice(a1, "INV-1002",  80000, "2026-07-15", asOf);
  const { account: a1p } = CustomerCreditEngine.postPayment(a1, 120000, "2026-08-01", "NEFT-001");
  a1 = a1p;

  let a2 = CustomerCreditEngine.setLimit({ customerId: "C-002", customerName: "Blue Thread Co", creditLimit: 200000, paymentTermDays: 45 });
  a2 = CustomerCreditEngine.postInvoice(a2, "INV-2001", 90000, "2026-04-01", asOf);
  a2 = CustomerCreditEngine.postInvoice(a2, "INV-2002", 70000, "2026-07-01", asOf);
  a2 = CustomerCreditEngine.holdCredit(a2, "ACCOUNTS", "Overdue balance");

  let a3 = CustomerCreditEngine.setLimit({ customerId: "C-003", customerName: "Craft Weaves Ltd", creditLimit: 300000, paymentTermDays: 30 });
  a3 = CustomerCreditEngine.postInvoice(a3, "INV-3001", 50000, "2026-08-01", asOf);

  return [a1, a2, a3];
}

export const CustomerCreditModal: React.FC<CustomerCreditModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [accounts, setAccounts]     = useState<CreditAccount[]>(buildSampleAccounts);
  const [selectedId, setSelectedId] = useState(accounts[0]?.accountId ?? "");
  const [payAmt, setPayAmt]         = useState("");
  const [payRef, setPayRef]         = useState("");
  const [activeTab, setActiveTab]   = useState<"INVOICES" | "AGING" | "PAYMENTS">("INVOICES");

  const selected    = accounts.find((a) => a.accountId === selectedId);
  const agingReport = useMemo(() => CustomerCreditEngine.agingReport(accounts, asOf), [accounts]);

  if (!isOpen) return null;

  const update = (updated: CreditAccount) =>
    setAccounts((prev) => prev.map((a) => a.accountId === updated.accountId ? updated : updated));

  const handlePayment = () => {
    if (!selected || !payAmt) return;
    const amt = parseFloat(payAmt);
    if (isNaN(amt) || amt <= 0) return;
    try {
      const { account: updated, paymentRecord } = CustomerCreditEngine.postPayment(selected, amt, new Date().toISOString().slice(0, 10), payRef || "MANUAL");
      setAccounts((prev) => prev.map((a) => a.accountId === updated.accountId ? updated : a));
      setPayAmt(""); setPayRef("");
      onNotification?.("Payment Posted", `${fmt(amt)} allocated across ${paymentRecord.allocations.length} invoice(s)`, "success");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleHold = () => {
    if (!selected) return;
    const updated = CustomerCreditEngine.holdCredit(selected, "ACCOUNTS", "Manual hold");
    setAccounts((prev) => prev.map((a) => a.accountId === updated.accountId ? updated : a));
    onNotification?.("Credit Hold", selected.customerName, "info");
  };

  const handleRelease = () => {
    if (!selected) return;
    const updated = CustomerCreditEngine.releaseCredit(selected, "ACCOUNTS");
    setAccounts((prev) => prev.map((a) => a.accountId === updated.accountId ? updated : a));
    onNotification?.("Credit Released", selected.customerName, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">💳</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer Credit Limit & Outstanding Engine</h2>
              <p className="text-xs text-slate-400">Credit Limit · FIFO Payment · Aging · Hold / Release</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["INVOICES", "AGING", "PAYMENTS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "PAYMENTS" ? "Payments" : tab === "AGING" ? "Aging Report" : "Invoices"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2 transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Account sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {accounts.map((a) => {
              const util = a.utilisationPct;
              return (
                <button key={a.accountId} onClick={() => { setSelectedId(a.accountId); setActiveTab("INVOICES"); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === a.accountId ? "bg-indigo-950/20 border-indigo-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                  <p className="text-[10px] font-bold text-slate-200 truncate">{a.customerName}</p>
                  <p className="text-xs font-black font-mono mt-0.5 text-indigo-400">{fmt(a.outstandingAmt)}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                    {a.limitBreached && <span className="text-[8px] font-bold text-rose-400 border border-rose-500/30 bg-rose-500/10 px-1 py-0.5 rounded-full">BREACHED</span>}
                  </div>
                  {/* Mini utilisation bar */}
                  <div className="mt-2 h-1 w-full bg-slate-700/40 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${util > 100 ? "bg-rose-500" : util > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                      style={{ width: `${Math.min(util, 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5">{util}% utilised</p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Account header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-100">{selected.customerName}</p>
                  <p className="text-xs text-slate-400">{selected.customerId} · {selected.paymentTermDays}d terms{selected.graceDays ? ` + ${selected.graceDays}d grace` : ""}</p>
                  {selected.holdReason && <p className="text-[10px] text-amber-400">⚠ Hold: {selected.holdReason}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  {selected.status === "ACTIVE"   && <button onClick={handleHold}    className="px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30 hover:bg-amber-950/30 rounded-xl">Hold Credit</button>}
                  {selected.status === "ON_HOLD"  && <button onClick={handleRelease} className="px-3 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/30 rounded-xl">Release</button>}
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Credit Limit",    value: fmt(selected.creditLimit),    color: "text-slate-400" },
                  { label: "Outstanding",     value: fmt(selected.outstandingAmt), color: selected.limitBreached ? "text-rose-400 font-black" : "text-indigo-400 font-black" },
                  { label: "Available",       value: fmt(Math.max(0, selected.availableCredit)), color: "text-emerald-400" },
                  { label: "Utilisation",     value: `${selected.utilisationPct}%`, color: selected.utilisationPct > 100 ? "text-rose-400" : selected.utilisationPct > 80 ? "text-amber-400" : "text-teal-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                    <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {activeTab === "INVOICES" && (
                <>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Invoice</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-right">Outstanding</th>
                        <th className="py-2 px-3">Bucket</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {selected.invoices.map((i) => (
                          <tr key={i.invoiceId} className={i.status === "OVERDUE" ? "bg-rose-950/10" : ""}>
                            <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{i.invoiceNo}</p><p className={`text-[9px] font-bold ${i.status === "PAID" ? "text-emerald-400" : i.status === "OVERDUE" ? "text-rose-400" : "text-sky-400"}`}>{i.status}</p></td>
                            <td className="py-2 px-3 text-[10px] text-slate-400">{i.dueDate}</td>
                            <td className="py-2 px-3 text-right text-slate-400">{fmt(i.invoiceAmt)}</td>
                            <td className="py-2 px-3 text-right font-bold text-indigo-400">{fmt(i.outstandingAmt)}</td>
                            <td className="py-2 px-3 font-sans"><span className={`text-[9px] font-bold ${BUCKET_STYLE[i.agingBucket]}`}>{BUCKET_LABELS[i.agingBucket]}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Payment form */}
                  <div className="bg-slate-800/20 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Post Payment (FIFO Allocation)</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <input type="number" placeholder="Amount" value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                        className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60" />
                      <input type="text" placeholder="Reference" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                        className="w-40 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60" />
                      <button onClick={handlePayment}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                        Post Payment
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "AGING" && (
                <div className="space-y-3">
                  {agingReport.map((r) => (
                    <div key={r.customerId} className={`bg-slate-800/20 border rounded-xl p-4 space-y-3 ${r.limitBreached ? "border-rose-500/30" : "border-slate-700/60"}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{r.customerName}</p>
                          <p className="text-[10px] text-slate-500">Limit: {fmt(r.creditLimit)} · Outstanding: {fmt(r.outstanding)} · {r.utilisationPct}%</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                          {r.limitBreached && <span className="text-[9px] font-bold text-rose-400 border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 rounded-full">LIMIT BREACHED</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {r.buckets.map((b) => (
                          <div key={b.bucket} className={`text-center p-2 rounded-lg bg-slate-900/40 border ${b.totalAmt > 0 ? "border-slate-700/60" : "border-transparent opacity-40"}`}>
                            <div className={`text-xs font-bold font-mono ${BUCKET_STYLE[b.bucket]}`}>{fmt(b.totalAmt)}</div>
                            <div className="text-[9px] text-slate-600 mt-0.5">{BUCKET_LABELS[b.bucket]}</div>
                            <div className="text-[9px] text-slate-600">{b.count} inv</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "PAYMENTS" && (
                <div className="space-y-3">
                  {selected.payments.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No payments recorded.</p>}
                  {[...selected.payments].reverse().map((p) => (
                    <div key={p.paymentId} className="bg-slate-800/20 border border-slate-700/60 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <p className="font-bold text-slate-200 font-mono">{fmt(p.paidAmt)}</p>
                        <p className="text-slate-500">{p.paidOn} · {p.reference}</p>
                      </div>
                      <div className="space-y-1">
                        {p.allocations.map((al) => (
                          <div key={al.invoiceId} className="flex items-center justify-between text-[10px] px-2 py-1 bg-slate-900/30 rounded-lg">
                            <span className="font-mono text-slate-400">{al.invoiceNo}</span>
                            <span className="text-indigo-400">−{fmt(al.allocatedAmt)}</span>
                            <span className="text-slate-500">bal: {fmt(al.balanceAfter)}</span>
                          </div>
                        ))}
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

export default CustomerCreditModal;
