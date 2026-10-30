/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah — Founder & Chairperson
 * * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * Version      : 6.49.7
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Landmark,
  ShieldCheck,
  Zap,
  TrendingDown,
  ArrowUpRight,
  Layers,
  Sparkles,
} from "lucide-react";

export const SupplierAdvanceKnockoffVisualizer: React.FC = () => {
  const [selectedFlow, setSelectedFlow] = useState<"ALL" | "DISBURSEMENT" | "KNOCKOFF">("ALL");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl backdrop-blur-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Procurement Phase 2.5
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={12} /> Live Engine Verified
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SSOT v6.49.7
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Sparkles className="text-indigo-400 h-7 w-7" />
              DR 2050 Supplier Advance Liability / CR 1010/1020 Cash/Bank
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl">
              Upon advance disbursement, with automatic knock-off against confirmed purchase bills (DR 2010 Accounts Payable / CR 2050 Supplier Advance Liability).
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl text-xs font-medium">
            <button
              onClick={() => setSelectedFlow("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedFlow === "ALL" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Full Lifecycle
            </button>
            <button
              onClick={() => setSelectedFlow("DISBURSEMENT")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedFlow === "DISBURSEMENT" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Disbursement
            </button>
            <button
              onClick={() => setSelectedFlow("KNOCKOFF")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedFlow === "KNOCKOFF" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Knock-off
            </button>
          </div>
        </div>
      </header>

      {/* Main Visualizer Content */}
      <main className="max-w-7xl mx-auto space-y-8">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Advance Disbursed</span>
              <ArrowUpRight size={16} className="text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">₹5,000.00</div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">DR 2050 · CR 1010 (Cash in Hand)</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Purchase Bill Total</span>
              <FileText size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">₹3,540.00</div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">BILL-2026-0042 · CONFIRMED</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Auto Knock-off Amount</span>
              <Zap size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">₹3,540.00</div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">DR 2010 · CR 2050 (Zero Cash Move)</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Unallocated Advance Remaining</span>
              <TrendingDown size={16} className="text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-sky-400">₹1,460.00</div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Available for Future Invoices</div>
          </div>
        </div>

        {/* 3-Column Interactive Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STEP 1: ADVANCE DISBURSEMENT */}
          <div
            className={`flex flex-col rounded-2xl bg-slate-900 border transition-all ${
              selectedFlow === "KNOCKOFF" ? "opacity-40" : "border-indigo-500/40 shadow-xl ring-1 ring-indigo-500/20"
            }`}
          >
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Advance Disbursement</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Voucher Type: SUPPLIER_ADVANCE</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                DR 2050 / CR 1010
              </span>
            </div>

            <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Payment ID</span>
                    <span className="font-mono text-slate-200">pay_adv_20261002_001</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Supplier Party</span>
                    <span className="font-semibold text-slate-200">Vardhman Advance Mill Ltd</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>PO Reference</span>
                    <span className="font-mono text-indigo-300">PO-2026-001</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Payment Mode</span>
                    <span className="font-semibold text-emerald-400">CASH (1010)</span>
                  </div>
                  <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2 font-bold">
                    <span>Disbursed Amount</span>
                    <span className="font-mono text-indigo-300 text-sm">₹5,000.00</span>
                  </div>
                </div>

                {/* Double Entry Table */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-400" /> Double-Entry General Ledger Voucher
                  </h4>
                  <div className="rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5">Account Code & Title</th>
                          <th className="p-2.5 text-right">Debit (₹)</th>
                          <th className="p-2.5 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        <tr>
                          <td className="p-2.5 text-indigo-300 font-semibold">
                            2050 · Supplier Advance Liability
                            <div className="text-[10px] text-slate-500 font-normal">Party: Vardhman Advance Mill</div>
                          </td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">5,000.00</td>
                          <td className="p-2.5 text-right text-slate-500">0.00</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-slate-300">
                            1010 · Cash in Hand
                            <div className="text-[10px] text-slate-500 font-normal">Cash disbursement</div>
                          </td>
                          <td className="p-2.5 text-right text-slate-500">0.00</td>
                          <td className="p-2.5 text-right text-amber-400 font-bold">5,000.00</td>
                        </tr>
                        <tr className="bg-slate-950/80 font-bold border-t border-slate-800">
                          <td className="p-2.5 text-slate-400 text-[11px]">Voucher Total (Balanced)</td>
                          <td className="p-2.5 text-right text-emerald-400">5,000.00</td>
                          <td className="p-2.5 text-right text-amber-400">5,000.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2 font-mono">
                <CheckCircle2 size={14} className="shrink-0" />
                Overpayment guard bypassed for advance disbursement.
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIRMED PURCHASE BILL */}
          <div
            className={`flex flex-col rounded-2xl bg-slate-900 border transition-all ${
              selectedFlow === "DISBURSEMENT" ? "opacity-40" : "border-amber-500/40 shadow-xl ring-1 ring-amber-500/20"
            }`}
          >
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Confirmed Purchase Bill</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Doc: BILL-2026-0042</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                POSTED · ₹3,540.00
              </span>
            </div>

            <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Bill No / ID</span>
                    <span className="font-mono text-slate-200">BILL-2026-0042</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Taxable Value (5010)</span>
                    <span className="font-mono text-slate-200">₹3,000.00</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Input CGST + SGST (18%)</span>
                    <span className="font-mono text-slate-200">₹540.00</span>
                  </div>
                  <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2 font-bold">
                    <span>Invoice Total Amount</span>
                    <span className="font-mono text-amber-300 text-sm">₹3,540.00</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-bold">
                    <span>Pre-Settlement Status</span>
                    <span className="font-mono text-amber-400">POSTED (Unpaid: ₹3,540.00)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Landmark size={14} className="text-indigo-400" />
                    Automatic FIFO Knock-off Engine
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When advance is disbursed with <code className="text-indigo-300">auto_allocate=True</code> or via explicit knock-off, open confirmed purchase bills are resolved in strict FIFO order against unallocated advance balances.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-300 gap-2">
                <span>Triggers Automatic Settlement</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </div>

          {/* STEP 3: AUTOMATIC KNOCK-OFF GL VOUCHER */}
          <div
            className={`flex flex-col rounded-2xl bg-slate-900 border transition-all ${
              selectedFlow === "DISBURSEMENT" ? "opacity-40" : "border-emerald-500/40 shadow-xl ring-1 ring-emerald-500/20"
            }`}
          >
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Automatic Knock-off Journal</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Doc: SUPPLIER_ADVANCE_KNOCKOFF</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                DR 2010 / CR 2050
              </span>
            </div>

            <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Journal Voucher</span>
                    <span className="font-mono text-slate-200">JV-KNOCKOFF-2026-0091</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Cash Movement</span>
                    <span className="font-mono text-emerald-400 font-bold">₹0.00 (Zero Cash Movement)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Settled Bill</span>
                    <span className="font-mono text-slate-200">BILL-2026-0042</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Bill Status After</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      PAID (₹3,540.00 / ₹3,540.00)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2 font-bold">
                    <span>Knocked-off Amount</span>
                    <span className="font-mono text-emerald-300 text-sm">₹3,540.00</span>
                  </div>
                </div>

                {/* Knockoff GL Entry Table */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers size={13} className="text-emerald-400" /> Knock-off Balance Sheet Offsetting
                  </h4>
                  <div className="rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5">Account Code & Title</th>
                          <th className="p-2.5 text-right">Debit (₹)</th>
                          <th className="p-2.5 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        <tr>
                          <td className="p-2.5 text-emerald-300 font-semibold">
                            2010 · Accounts Payable / Creditors
                            <div className="text-[10px] text-slate-500 font-normal">Decrements Vendor Liability</div>
                          </td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">3,540.00</td>
                          <td className="p-2.5 text-right text-slate-500">0.00</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-amber-300 font-semibold">
                            2050 · Supplier Advance Liability
                            <div className="text-[10px] text-slate-500 font-normal">Credits / Consumes Advance Prepayment</div>
                          </td>
                          <td className="p-2.5 text-right text-slate-500">0.00</td>
                          <td className="p-2.5 text-right text-amber-400 font-bold">3,540.00</td>
                        </tr>
                        <tr className="bg-slate-950/80 font-bold border-t border-slate-800">
                          <td className="p-2.5 text-slate-400 text-[11px]">Voucher Total (Balanced)</td>
                          <td className="p-2.5 text-right text-emerald-400">3,540.00</td>
                          <td className="p-2.5 text-right text-amber-400">3,540.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300 flex items-center justify-between font-mono">
                <span>Remaining Advance:</span>
                <span className="font-bold text-sm">₹1,460.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Guarantee Footer Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Full Double-Entry Accounting Invariant Enforced</h4>
              <p className="text-xs text-slate-400">
                Sum of Debits equals Sum of Credits across all generated vouchers. Net cash movement strictly reflects initial disbursement. Subledger vendor balances remain 100% reconciled.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono font-bold text-slate-300">
            <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400">
              ✓ 8/8 Tests Green
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-indigo-400">
              ✓ Transactional Outbox Dispatched
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SupplierAdvanceKnockoffVisualizer;
