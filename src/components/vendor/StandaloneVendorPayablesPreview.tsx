/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.51.0
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { 
  Building2, 
  Sparkles, 
  ShieldCheck, 
  Wallet, 
  FileText, 
  DollarSign, 
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingDown,
  Receipt,
  RotateCcw,
  Zap,
  Layers,
  Landmark
} from "lucide-react";
import { VendorDetail } from "../../types/vendor";
import { VendorAdvanceKnockoffModal, AdvanceRecord, BillRecord } from "./tabs/VendorAdvanceKnockoffModal";
import { VendorStatementOfAccountModal } from "./tabs/VendorStatementOfAccountModal";
import { VendorChallan281Modal } from "./tabs/VendorChallan281Modal";

const MOCK_VENDOR: VendorDetail = {
  id: "sup-vardhman-adv-001",
  code: "SUP-VARD-001",
  legalName: "Vardhman Textiles & Fabrics Ltd.",
  tradeName: "Vardhman Mills",
  partyType: "SUPPLIER",
  gstin: "07AAAAA1234A1Z5",
  pan: "AAAAA1234A",
  status: "ACTIVE",
  addresses: [],
  contacts: [],
  bankAccounts: [],
  roles: ["SUPPLIER"],
  tags: ["TEXTILES", "ADVANCE_ELIGIBLE"],
  commercial: {
    supplierType: "MANUFACTURER",
    paymentTermsDays: 30,
    msmeCategory: "MEDIUM",
    commercialClassification: "PREFERRED",
    tdsRate: 0.1,
    taxTreatment: "REGULAR",
    outstandingLiability: 92500,
  },
  compliance: {
    msmeCategory: "MEDIUM",
    verificationFlags: {},
  },
};

const INITIAL_ADVANCES: AdvanceRecord[] = [
  {
    id: "adv-pay-2026-0089",
    payment_reference: "ADV-2026-0089",
    amount: 50000,
    unallocated_amount: 50000,
    payment_date: "2026-09-25",
    purchase_order_id: "PO-2026-0881",
  },
  {
    id: "adv-pay-2026-0042",
    payment_reference: "ADV-2026-0042",
    amount: 25000,
    unallocated_amount: 10000,
    payment_date: "2026-09-18",
    purchase_order_id: "PO-2026-0790",
  },
];

const INITIAL_BILLS: BillRecord[] = [
  {
    id: "bill-2026-0101",
    bill_no: "BILL-VARD-2026-001",
    bill_date: "2026-09-22",
    due_date: "2026-10-22",
    total_amount: 42500,
    paid_amount: 0,
    unpaid_amount: 42500,
    status: "POSTED",
  },
  {
    id: "bill-2026-0102",
    bill_no: "BILL-VARD-2026-002",
    bill_date: "2026-09-27",
    due_date: "2026-10-27",
    total_amount: 78000,
    paid_amount: 28000,
    unpaid_amount: 50000,
    status: "PARTIALLY_PAID",
  },
  {
    id: "bill-2026-0095",
    bill_no: "BILL-VARD-2026-003",
    bill_date: "2026-09-10",
    due_date: "2026-10-10",
    total_amount: 20000,
    paid_amount: 20000,
    unpaid_amount: 0,
    status: "PAID",
  },
];

export const StandaloneVendorPayablesPreview: React.FC = () => {
  const [advances, setAdvances] = useState<AdvanceRecord[]>(INITIAL_ADVANCES);
  const [bills, setBills] = useState<BillRecord[]>(INITIAL_BILLS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isChallanOpen, setIsChallanOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<"single" | "batch">("batch");
  const [initialAdvId, setInitialAdvId] = useState<string | undefined>();
  const [initialBillId, setInitialBillId] = useState<string | undefined>();
  const [notification, setNotification] = useState<{ title: string; message: string; type: string } | null>({
    title: "Vendor 360 Advance Engine Live",
    message: "Ready to test Multi-Bill Batch & FIFO advance knock-offs (Account 2050 -> 2010 AP).",
    type: "info",
  });

  const totalAP = bills.reduce((s, b) => s + (b.unpaid_amount || 0), 0);
  const totalAdvance = advances.reduce((s, a) => s + (a.unallocated_amount || 0), 0);
  const netPosition = Math.max(0, totalAP - totalAdvance);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSimulateKnockoff = (amount: number, advId: string, bId: string) => {
    setAdvances((prev) =>
      prev.map((a) => (a.id === advId ? { ...a, unallocated_amount: Math.max(0, a.unallocated_amount - amount) } : a))
    );
    setBills((prev) =>
      prev.map((b) => {
        if (b.id === bId) {
          const newPaid = b.paid_amount + amount;
          const newUnpaid = Math.max(0, b.total_amount - newPaid);
          return {
            ...b,
            paid_amount: newPaid,
            unpaid_amount: newUnpaid,
            status: newUnpaid <= 0 ? "PAID" : "PARTIALLY_PAID",
          };
        }
        return b;
      })
    );
    setNotification({
      title: "Knock-off Journal Posted",
      message: `Successfully knocked off ${fmt(amount)}! General Ledger Journal Voucher JV-${Date.now().toString().slice(-6)} posted (DR 2010 / CR 2050). Net cash movement: ₹0.00.`,
      type: "success",
    });
  };

  const handleSimulateBatchKnockoff = (allocations: { billId: string; amount: number }[], advId: string) => {
    const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
    setAdvances((prev) =>
      prev.map((a) => (a.id === advId ? { ...a, unallocated_amount: Math.max(0, a.unallocated_amount - totalAmount) } : a))
    );
    setBills((prev) =>
      prev.map((b) => {
        const match = allocations.find((a) => a.billId === b.id);
        if (match) {
          const newPaid = b.paid_amount + match.amount;
          const newUnpaid = Math.max(0, b.total_amount - newPaid);
          return {
            ...b,
            paid_amount: newPaid,
            unpaid_amount: newUnpaid,
            status: newUnpaid <= 0 ? "PAID" : "PARTIALLY_PAID",
          };
        }
        return b;
      })
    );
    setNotification({
      title: "Batch Advance Knock-Off Complete",
      message: `Successfully settled ${allocations.length} purchase bill(s) totaling ${fmt(totalAmount)}! Compound General Ledger Journal Voucher JV-${Date.now().toString().slice(-6)} posted (DR 2010 / CR 2050). Net cash movement: ₹0.00.`,
      type: "success",
    });
  };

  const resetSimulation = () => {
    setAdvances(INITIAL_ADVANCES);
    setBills(INITIAL_BILLS);
    setNotification({
      title: "State Reset",
      message: "Restored baseline supplier advances and active purchase bills.",
      type: "info",
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workspace Navigation Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl backdrop-blur-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Procurement Phase 2.10 (Challan 281 &amp; Form 26Q)
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={12} /> Live Vendor 360 Integration
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SSOT v6.52.0
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Building2 className="text-indigo-400 h-7 w-7" />
              Vendor 360 Payables & Advance Knock-off Studio
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl">
              Multi-Bill Batch &amp; FIFO supplier advance knock-offs (Account 2050 Liability &rarr; 2010 AP) with compound double-entry GL journal vouchers.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={resetSimulation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reset State</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInitialAdvId(undefined);
                setInitialBillId(undefined);
                setInitialMode("batch");
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Zap size={14} />
              <span>⚡ Batch FIFO Knock-Off</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInitialAdvId(undefined);
                setInitialBillId(undefined);
                setInitialMode("single");
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Sparkles size={14} />
              <span>1-Click</span>
            </button>
            <button
              type="button"
              onClick={() => setIsChallanOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-500/40 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60 text-xs font-bold shadow-lg transition-all cursor-pointer"
              title="Open Government Challan 281 & Form 26Q Compliance Studio"
            >
              <Landmark size={14} />
              <span>🏛️ Challan 281 &amp; Form 26Q</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStatementOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              <FileText size={14} />
              <span>📄 Statement of Account</span>
            </button>
          </div>
        </div>

        {/* Notification Toast Banner */}
        {notification && (
          <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            notification.type === "success" 
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-indigo-950/40 border-indigo-500/40 text-indigo-300"
          }`}>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">{notification.title}</strong>
                <span>{notification.message}</span>
              </div>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Vendor Header Strip */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{MOCK_VENDOR.legalName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {MOCK_VENDOR.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  {MOCK_VENDOR.commercial?.commercialClassification}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Code: {MOCK_VENDOR.code} • GSTIN: {MOCK_VENDOR.gstin} • Terms: Net {MOCK_VENDOR.commercial?.paymentTermsDays} Days
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              Overview
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
              Payables & Advances
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
              Scorecard
            </span>
          </div>
        </div>

        {/* Financial Health Summary Cards Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Gross Outstanding AP (2010) */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <DollarSign size={16} className="text-rose-400" />
                Gross Accounts Payable (Account 2010)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                AP Liability
              </span>
            </div>
            <div className={`text-2xl font-black font-mono ${totalAP > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {fmt(totalAP)}
            </div>
            <p className="text-xs text-slate-400">
              Confirmed bill liabilities owed to supplier before applying advance prepayments.
            </p>
          </div>

          {/* Card 2: Available Advance Prepayments (2050) */}
          <div className="p-5 rounded-2xl border border-emerald-500/40 bg-linear-to-br from-slate-900 to-emerald-950/30 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Wallet size={16} className="text-emerald-400" />
                Supplier Advances (Account 2050)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                Prepayment Credit
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {fmt(totalAdvance)}
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-300/80">
              <span>{advances.filter((a) => a.unallocated_amount > 0).length} active advance deposit(s) available</span>
              {totalAdvance > 0 && totalAP > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInitialAdvId(undefined);
                    setInitialBillId(undefined);
                    setInitialMode("batch");
                    setIsModalOpen(true);
                  }}
                  className="font-bold underline text-emerald-400 hover:text-white"
                >
                  ⚡ Batch Settle (FIFO) →
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Net Payable Exposure */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <TrendingDown size={16} className="text-indigo-400" />
                Net Settlement Position
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Net Cash Risk
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {fmt(netPosition)}
            </div>
            <p className="text-xs text-slate-400">
              Net balance required to settle all bills after consuming available advance deposits.
            </p>
          </div>

          {/* Card 4: Statutory TDS Withheld (Account 2030) */}
          <div
            onClick={() => setIsChallanOpen(true)}
            className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg space-y-2 cursor-pointer hover:border-indigo-500/60 transition-all hover:scale-[1.01]"
            title="Click to open Government Challan 281 & Form 26Q Compliance Studio"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <Receipt size={16} className="text-indigo-400" />
                Statutory TDS (Account 2030)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Sec 194Q (0.10%)
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-indigo-400">
              {fmt(140.50)}
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-between">
              <span className="font-bold underline text-indigo-400 hover:text-white">
                Challan 281 Studio →
              </span>
              <span className="text-emerald-400 font-mono text-[10px]">PAN: {MOCK_VENDOR.pan} [Valid]</span>
            </p>
          </div>
        </div>

        {/* Section 1: Active Purchase Bills Table */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-rose-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Active Purchase Bills & Commercial Invoices ({bills.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              General Ledger Subledger 2010
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3.5">Bill Number</th>
                  <th className="p-3.5">Bill Date</th>
                  <th className="p-3.5">Due Date</th>
                  <th className="p-3.5 text-right">Bill Total</th>
                  <th className="p-3.5 text-right">Paid Amount</th>
                  <th className="p-3.5 text-right">Unpaid Outstanding</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">1-Click Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {bills.map((b) => {
                  const isUnpaid = b.unpaid_amount > 0.001;
                  return (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-white flex items-center gap-2">
                        <span>{b.bill_no}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          POSTED
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">{b.bill_date}</td>
                      <td className="p-3.5 text-slate-400">{b.due_date}</td>
                      <td className="p-3.5 text-right text-slate-300">{fmt(b.total_amount)}</td>
                      <td className="p-3.5 text-right text-emerald-400 font-semibold">{fmt(b.paid_amount)}</td>
                      <td className={`p-3.5 text-right font-black ${isUnpaid ? "text-rose-400" : "text-emerald-400"}`}>
                        {fmt(b.unpaid_amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          b.status === "PAID" 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                            : b.status === "PARTIALLY_PAID"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {isUnpaid && totalAdvance > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setInitialBillId(b.id);
                              setInitialAdvId(undefined);
                              setIsModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <Sparkles size={12} />
                            Knock Off
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {b.status === "PAID" ? "Settled" : "No Advance"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Supplier Advance Deposits Table */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Supplier Advance Prepayments (Account 2050) ({advances.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Prepayment Liability Available for Non-Cash Settle
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3.5">Advance Payment Ref</th>
                  <th className="p-3.5">Disbursed Date</th>
                  <th className="p-3.5">Linked PO</th>
                  <th className="p-3.5 text-right">Disbursed Amount</th>
                  <th className="p-3.5 text-right">Allocated / Settled</th>
                  <th className="p-3.5 text-right">Available Unallocated Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">1-Click Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {advances.map((adv) => {
                  const isAvailable = adv.unallocated_amount > 0.001;
                  return (
                    <tr key={adv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-white">{adv.payment_reference}</td>
                      <td className="p-3.5 text-slate-400">{adv.payment_date}</td>
                      <td className="p-3.5 text-slate-400">{adv.purchase_order_id}</td>
                      <td className="p-3.5 text-right text-slate-300">{fmt(adv.amount)}</td>
                      <td className="p-3.5 text-right text-slate-400">{fmt(adv.amount - adv.unallocated_amount)}</td>
                      <td className={`p-3.5 text-right font-black ${isAvailable ? "text-emerald-400" : "text-slate-500"}`}>
                        {fmt(adv.unallocated_amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isAvailable 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}>
                          {isAvailable ? "AVAILABLE" : "FULLY APPLIED"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {isAvailable && totalAP > 0 ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setInitialAdvId(adv.id);
                                setInitialBillId(undefined);
                                setInitialMode("batch");
                                setIsModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Zap size={11} />
                              Batch FIFO
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setInitialAdvId(adv.id);
                                setInitialBillId(undefined);
                                setInitialMode("single");
                                setIsModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Sparkles size={11} />
                              1-Click
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Advance Knock-off Modal */}
        <VendorAdvanceKnockoffModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          vendor={MOCK_VENDOR}
          advances={advances}
          bills={bills}
          initialAdvanceId={initialAdvId}
          initialBillId={initialBillId}
          initialMode={initialMode}
          onSuccess={() => {}}
          onSimulate={handleSimulateKnockoff}
          onSimulateBatch={handleSimulateBatchKnockoff}
          onNotification={(title, msg, type) => {
            setNotification({ title, message: msg, type });
          }}
        />

        {/* Vendor Statement of Account (SOA) Modal */}
        <VendorStatementOfAccountModal
          isOpen={isStatementOpen}
          onClose={() => setIsStatementOpen(false)}
          vendor={MOCK_VENDOR}
          onNotification={(title, msg, type) => {
            setNotification({ title, message: msg, type });
          }}
        />

        {/* Government Challan 281 & Form 26Q Compliance Studio Modal */}
        <VendorChallan281Modal
          isOpen={isChallanOpen}
          onClose={() => setIsChallanOpen(false)}
          vendor={MOCK_VENDOR}
        />
      </div>
    </div>
  );
};

export default StandaloneVendorPayablesPreview;
