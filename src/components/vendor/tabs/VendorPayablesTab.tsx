/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.8
 * Created      : 2026-09-11
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  Wallet, 
  Sparkles, 
  FileText, 
  ArrowRight,
  TrendingDown,
  Layers,
  Receipt,
  AlertTriangle
} from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";
import { VendorAdvanceKnockoffModal, AdvanceRecord, BillRecord } from "./VendorAdvanceKnockoffModal";

type AgingBucket = "CURRENT" | "OVERDUE_30" | "OVERDUE_60" | "OVERDUE_90" | "CRITICAL";

interface LiveInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmt: number;
  paidAmt: number;
  outstandingAmt: number;
  agingBucket: AgingBucket;
  daysOverdue: number;
  status: string;
  isPurchaseBill: boolean;
}

interface VendorPayablesTabProps {
  vendor: VendorDetail;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

const BUCKET_STYLES: Record<AgingBucket, { bg: string; border: string; text: string }> = {
  CURRENT:    { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-600/30", text: "text-emerald-700 dark:text-emerald-400" },
  OVERDUE_30: { bg: "bg-amber-50 dark:bg-amber-950/20",   border: "border-amber-200 dark:border-amber-600/30",   text: "text-amber-800 dark:text-amber-400" },
  OVERDUE_60: { bg: "bg-orange-50 dark:bg-orange-950/20",  border: "border-orange-200 dark:border-orange-600/30",  text: "text-orange-800 dark:text-orange-400" },
  OVERDUE_90: { bg: "bg-red-50 dark:bg-red-950/20",       border: "border-red-200 dark:border-red-600/30",       text: "text-red-700 dark:text-red-400" },
  CRITICAL:   { bg: "bg-rose-50 dark:bg-rose-950/30",     border: "border-rose-200 dark:border-rose-600/40",     text: "text-rose-800 dark:text-rose-400" },
};

function classifyAging(dueDateStr: string, today: Date): { bucket: AgingBucket; daysOverdue: number } {
  const due = new Date(dueDateStr);
  const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
  if (days <= 0) return { bucket: "CURRENT", daysOverdue: 0 };
  if (days <= 30) return { bucket: "OVERDUE_30", daysOverdue: days };
  if (days <= 60) return { bucket: "OVERDUE_60", daysOverdue: days };
  if (days <= 90) return { bucket: "OVERDUE_90", daysOverdue: days };
  return { bucket: "CRITICAL", daysOverdue: days };
}

const VendorPayablesTabBase: React.FC<VendorPayablesTabProps> = ({ vendor, onNotification }) => {
  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isKnockoffModalOpen, setIsKnockoffModalOpen] = useState(false);
  const [selectedInitialAdvanceId, setSelectedInitialAdvanceId] = useState<string | undefined>();
  const [selectedInitialBillId, setSelectedInitialBillId] = useState<string | undefined>();

  const loadPayablesData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const termsDays = vendor.commercial?.paymentTermsDays || 30;

      // 1. Fetch real Purchase Bills for this vendor
      let rawBills: any[] = [];
      try {
        const bRes = await apiFetchV1(`/purchase/bills/?supplier_id=${encodeURIComponent(vendor.id)}`);
        rawBills = Array.isArray(bRes) ? bRes : bRes?.items || [];
      } catch {
        rawBills = [];
      }

      // 2. Fetch Supplier Payments (standard & advances)
      let paysData: any[] = [];
      try {
        const pRes = await apiFetchV1(`/purchase/supplier-payments/?supplier_id=${encodeURIComponent(vendor.id)}`);
        paysData = Array.isArray(pRes) ? pRes : [];
      } catch {
        try {
          const pRes2 = await apiFetchV1(`/supplier-payments/?supplier_id=${encodeURIComponent(vendor.id)}`);
          paysData = Array.isArray(pRes2) ? pRes2 : [];
        } catch {
          paysData = [];
        }
      }
      setPayments(paysData);

      // Extract and format advances
      const advRecords: AdvanceRecord[] = paysData
        .filter((p: any) => p.payment_type === "ADVANCE" || p.is_advance === true)
        .map((p: any) => ({
          id: p.id,
          payment_reference: p.payment_reference || `ADV-${p.id.slice(0, 8).toUpperCase()}`,
          amount: Number(p.amount || 0),
          unallocated_amount: Number(p.unallocated_amount ?? p.amount ?? 0),
          payment_date: p.payment_date || p.created_at?.slice(0, 10),
          created_at: p.created_at,
          purchase_order_id: p.purchase_order_id,
        }));
      setAdvances(advRecords);

      // 3. Transform Purchase Bills into LiveInvoice model
      let built: LiveInvoice[] = [];
      if (rawBills.length > 0) {
        built = rawBills.map((b: any) => {
          const billDateStr = b.bill_date || b.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
          let dueDateStr = b.due_date;
          if (!dueDateStr) {
            const d = new Date(billDateStr);
            d.setDate(d.getDate() + termsDays);
            dueDateStr = d.toISOString().slice(0, 10);
          }
          const { bucket, daysOverdue } = classifyAging(dueDateStr, today);
          const totalAmt = Number(b.total_amount || 0);
          const paidAmt = Number(b.paid_amount || 0);
          const unpaid = Math.max(0, totalAmt - paidAmt);
          return {
            id: b.id,
            invoiceNo: b.bill_no || b.id,
            invoiceDate: billDateStr,
            dueDate: dueDateStr,
            invoiceAmt: totalAmt,
            paidAmt,
            outstandingAmt: unpaid,
            agingBucket: bucket,
            daysOverdue,
            status: b.status || (unpaid <= 0 ? "PAID" : "POSTED"),
            isPurchaseBill: true,
          };
        });
      } else {
        // Fallback to purchase orders if no purchase bills exist yet
        let orders: any[] = [];
        try {
          const res = await apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(vendor.id)}`);
          orders = Array.isArray(res) ? res : res?.items || [];
          if (orders.length === 0) {
            const legacyId = `sup-${vendor.code.toLowerCase()}`;
            const res2 = await apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(legacyId)}`);
            orders = Array.isArray(res2) ? res2 : res2?.items || [];
          }
        } catch {
          orders = [];
        }

        const liveOrders = orders.filter((o: any) =>
          !["CANCELLED", "RECEIVED"].includes((o.status || "").toUpperCase())
        );

        built = liveOrders.map((po: any) => {
          const orderDate = po.created_at
            ? new Date(po.created_at).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          const due = new Date(po.created_at || Date.now());
          due.setDate(due.getDate() + termsDays);
          const dueDateStr = due.toISOString().slice(0, 10);
          const { bucket, daysOverdue } = classifyAging(dueDateStr, today);
          return {
            id: po.id,
            invoiceNo: po.order_no || po.id,
            invoiceDate: orderDate,
            dueDate: dueDateStr,
            invoiceAmt: Number(po.grand_total || 0),
            paidAmt: 0,
            outstandingAmt: Number(po.grand_total || 0),
            agingBucket: bucket,
            daysOverdue,
            status: po.status || "CONFIRMED",
            isPurchaseBill: false,
          };
        });

        // Deduct recorded standard payments chronologically for orders fallback
        const standardPayments = paysData.filter((p) => p.payment_type !== "ADVANCE");
        let remaining = standardPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        for (const inv of built) {
          const deduct = Math.min(remaining, inv.outstandingAmt);
          inv.paidAmt += deduct;
          inv.outstandingAmt = Math.max(0, inv.outstandingAmt - deduct);
          remaining -= deduct;
          if (remaining <= 0) break;
        }
      }

      // Fallback: use outstanding_liability from supplier profile if no records exist
      if (built.length === 0 && (vendor.commercial?.outstandingLiability ?? 0) > 0) {
        const due = new Date();
        due.setDate(due.getDate() - Math.max(0, termsDays - 5));
        const dueDateStr = due.toISOString().slice(0, 10);
        const { bucket, daysOverdue } = classifyAging(dueDateStr, today);
        built.push({
          id: `ledger-${vendor.id}`,
          invoiceNo: `LEDGER-${vendor.code}`,
          invoiceDate: new Date(Date.now() - termsDays * 86400000).toISOString().slice(0, 10),
          dueDate: dueDateStr,
          invoiceAmt: vendor.commercial!.outstandingLiability,
          paidAmt: 0,
          outstandingAmt: vendor.commercial!.outstandingLiability,
          agingBucket: bucket,
          daysOverdue,
          status: "POSTED",
          isPurchaseBill: false,
        });
      }

      setInvoices(built);
    } finally {
      setLoading(false);
    }
  }, [vendor.id, vendor.code, vendor.commercial]);

  useEffect(() => {
    loadPayablesData();
  }, [loadPayablesData]);

  // Aggregations
  const agingReport = useMemo(() => {
    const bucketTotals: Record<AgingBucket, number> = {
      CURRENT: 0, OVERDUE_30: 0, OVERDUE_60: 0, OVERDUE_90: 0, CRITICAL: 0,
    };
    let totalOutstanding = 0;
    for (const inv of invoices) {
      if (inv.status !== "CANCELLED") {
        bucketTotals[inv.agingBucket] = (bucketTotals[inv.agingBucket] || 0) + inv.outstandingAmt;
        totalOutstanding += inv.outstandingAmt;
      }
    }
    return { bucketTotals, totalOutstanding };
  }, [invoices]);

  const totalUnallocatedAdvance = useMemo(() => {
    return advances.reduce((s, a) => s + Number(a.unallocated_amount || 0), 0);
  }, [advances]);

  const billRecordsForModal: BillRecord[] = useMemo(() => {
    return invoices.map((inv) => ({
      id: inv.id,
      bill_no: inv.invoiceNo,
      bill_date: inv.invoiceDate,
      due_date: inv.dueDate,
      total_amount: inv.invoiceAmt,
      paid_amount: inv.paidAmt,
      unpaid_amount: inv.outstandingAmt,
      status: inv.status,
    }));
  }, [invoices]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const openKnockoffForBill = (billId: string) => {
    setSelectedInitialBillId(billId);
    setSelectedInitialAdvanceId(undefined);
    setIsKnockoffModalOpen(true);
  };

  const openKnockoffForAdvance = (advanceId: string) => {
    setSelectedInitialAdvanceId(advanceId);
    setSelectedInitialBillId(undefined);
    setIsKnockoffModalOpen(true);
  };

  const canExecuteKnockoff = totalUnallocatedAdvance > 0 && agingReport.totalOutstanding > 0;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Accounts Payable Aging & Supplier Advances
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-600/30">
              GL 2010 / 2050
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Authoritative double-entry payables from confirmed purchase bills, advances, and payment records — Net {vendor.commercial?.paymentTermsDays || 30} days terms
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {canExecuteKnockoff && (
            <button
              type="button"
              onClick={() => {
                setSelectedInitialAdvanceId(undefined);
                setSelectedInitialBillId(undefined);
                setIsKnockoffModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Sparkles size={13} />
              <span>Knock Off Advance</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadPayablesData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Financial Health Summary Cards Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Gross Outstanding AP (2010) */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-rose-500" />
              Accounts Payable (Account 2010)
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Gross AP</span>
          </div>
          <div className={`text-lg font-black font-mono ${agingReport.totalOutstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {fmt(agingReport.totalOutstanding)}
          </div>
          <div className="text-[10px] text-slate-400">
            Trade credit owed across {invoices.filter((i) => i.outstandingAmt > 0).length} unpaid bills
          </div>
        </div>

        {/* Card 2: Available Advance Prepayments (2050) */}
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Wallet size={14} className="text-emerald-600 dark:text-emerald-400" />
              Supplier Advances (Account 2050)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
              Prepayment Credit
            </span>
          </div>
          <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
            {fmt(totalUnallocatedAdvance)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
            <span>{advances.filter((a) => a.unallocated_amount > 0).length} active advance deposit(s)</span>
            {canExecuteKnockoff && (
              <button
                type="button"
                onClick={() => setIsKnockoffModalOpen(true)}
                className="font-bold underline hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                Settle Now →
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Net Payable Exposure */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <TrendingDown size={14} className="text-indigo-500" />
              Net Settlement Position
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Net Risk</span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
            {fmt(Math.max(0, agingReport.totalOutstanding - totalUnallocatedAdvance))}
          </div>
          <div className="text-[10px] text-slate-400">
            Net liability after applying unallocated advance deposits
          </div>
        </div>
      </div>

      {/* Aging Bucket Strip */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Payables Aging Schedule</span>
          <span className="text-[10px] font-normal text-slate-400">Calculated against invoice due dates</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["CURRENT", "OVERDUE_30", "OVERDUE_60", "OVERDUE_90", "CRITICAL"] as AgingBucket[]).map((bucket) => {
            const style = BUCKET_STYLES[bucket];
            const amt = agingReport.bucketTotals[bucket] || 0;
            return (
              <div key={bucket} className={`p-3 rounded-xl border shadow-xs ${style.bg} ${style.border}`}>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  {bucket.replace("_", " ")}
                </div>
                <div className={`text-base font-black font-mono mt-1 ${style.text}`}>{fmt(amt)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 1: Active Purchase Bills Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText size={14} className="text-rose-500" />
            Active Purchase Bills & Liabilities ({invoices.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Subledger Account 2010 (Accounts Payable)
          </span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading purchase bills from general ledger...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-10 text-center space-y-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Outstanding Payables</div>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
              This vendor has no open purchase bills or outstanding liabilities on record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <th className="p-3">Bill / Invoice No</th>
                  <th className="p-3">Bill Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Aging Status</th>
                  <th className="p-3 text-right">Bill Total</th>
                  <th className="p-3 text-right">Paid Amt</th>
                  <th className="p-3 text-right">Unpaid Balance</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{inv.invoiceNo}</span>
                      {inv.isPurchaseBill && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          BILL
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{inv.invoiceDate}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{inv.dueDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${BUCKET_STYLES[inv.agingBucket].bg} ${BUCKET_STYLES[inv.agingBucket].text} ${BUCKET_STYLES[inv.agingBucket].border}`}>
                        {inv.agingBucket} ({inv.daysOverdue}d)
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">{fmt(inv.invoiceAmt)}</td>
                    <td className="p-3 text-right text-slate-500 dark:text-slate-400">{fmt(inv.paidAmt)}</td>
                    <td className={`p-3 text-right font-bold ${inv.outstandingAmt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {fmt(inv.outstandingAmt)}
                    </td>
                    <td className="p-3 text-center">
                      {inv.outstandingAmt > 0 && totalUnallocatedAdvance > 0 ? (
                        <button
                          type="button"
                          onClick={() => openKnockoffForBill(inv.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/40 text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Sparkles size={11} />
                          Knock Off
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          {inv.outstandingAmt <= 0 ? "Settled" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Supplier Advance Prepayments (Account 2050) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Wallet size={14} className="text-emerald-500" />
            Supplier Advance Deposits (Account 2050) ({advances.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Prepayment Liabilities Available for Non-Cash Settle
          </span>
        </div>

        {advances.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 text-center text-xs text-slate-400 dark:text-slate-500">
            No supplier advance disbursements recorded for this vendor.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <th className="p-3">Advance Ref / Payment ID</th>
                  <th className="p-3">Disbursed Date</th>
                  <th className="p-3">Linked PO</th>
                  <th className="p-3 text-right">Disbursed Amount</th>
                  <th className="p-3 text-right">Allocated / Settled</th>
                  <th className="p-3 text-right">Unallocated Credit</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {advances.map((adv) => {
                  const isAvailable = adv.unallocated_amount > 0.001;
                  return (
                    <tr key={adv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{adv.payment_reference}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{adv.payment_date || "—"}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{adv.purchase_order_id || "Direct"}</td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">{fmt(adv.amount)}</td>
                      <td className="p-3 text-right text-slate-500 dark:text-slate-400">
                        {fmt(adv.amount - adv.unallocated_amount)}
                      </td>
                      <td className={`p-3 text-right font-black ${isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                        {fmt(adv.unallocated_amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isAvailable ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-500"}`}>
                          {isAvailable ? "AVAILABLE" : "FULLY APPLIED"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isAvailable && agingReport.totalOutstanding > 0 ? (
                          <button
                            type="button"
                            onClick={() => openKnockoffForAdvance(adv.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-colors inline-flex items-center gap-1 shadow-xs"
                          >
                            <Sparkles size={11} />
                            Knock Off Bill
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History Footnote */}
      {payments.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            {payments.length} total payment transaction(s) on record for this vendor.
          </span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
            Total Disbursed: {fmt(payments.reduce((s, p) => s + Number(p.amount || 0), 0))}
          </span>
        </div>
      )}

      {/* 1-Click Advance Knock-off Modal */}
      <VendorAdvanceKnockoffModal
        isOpen={isKnockoffModalOpen}
        onClose={() => setIsKnockoffModalOpen(false)}
        vendor={vendor}
        advances={advances}
        bills={billRecordsForModal}
        initialAdvanceId={selectedInitialAdvanceId}
        initialBillId={selectedInitialBillId}
        onSuccess={loadPayablesData}
        onNotification={onNotification}
      />
    </div>
  );
};

export const VendorPayablesTab = withCapability(VendorPayablesTabBase, {
  entity: "vendor",
  capability: "vendor.payables",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorPayablesTab;
