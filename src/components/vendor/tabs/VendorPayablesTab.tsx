/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.1
 * Created      : 2026-09-11
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { DollarSign, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";

type AgingBucket = "CURRENT" | "OVERDUE_30" | "OVERDUE_60" | "OVERDUE_90" | "CRITICAL";

interface LiveInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmt: number;
  outstandingAmt: number;
  agingBucket: AgingBucket;
  daysOverdue: number;
}

interface VendorPayablesTabProps {
  vendor: VendorDetail;
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

const VendorPayablesTabBase: React.FC<VendorPayablesTabProps> = ({ vendor }) => {
  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayablesData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const termsDays = vendor.commercial?.paymentTermsDays || 30;

      // 1. Fetch purchase orders for this vendor (UUID first, then legacy ID fallback)
      let orders: any[] = [];
      try {
        const res = await apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(vendor.id)}`);
        orders = Array.isArray(res) ? res : res?.items || [];
        if (orders.length === 0) {
          const legacyId = `sup-${vendor.code.toLowerCase()}`;
          const res2 = await apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(legacyId)}`);
          orders = Array.isArray(res2) ? res2 : res2?.items || [];
        }
      } catch { orders = []; }

      // 2. Fetch supplier payments for this vendor
      let paysData: any[] = [];
      try {
        const pRes = await apiFetchV1(`/purchase/supplier-payments/?supplier_id=${encodeURIComponent(vendor.id)}`);
        paysData = Array.isArray(pRes) ? pRes : [];
      } catch { paysData = []; }
      setPayments(paysData);

      // 3. Build payable invoices from open POs only
      const liveOrders = orders.filter((o: any) =>
        !["CANCELLED", "RECEIVED"].includes((o.status || "").toUpperCase())
      );

      const built: LiveInvoice[] = liveOrders.map((po: any) => {
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
          outstandingAmt: Number(po.grand_total || 0),
          agingBucket: bucket,
          daysOverdue,
        };
      });

      // 4. Deduct recorded payments chronologically
      let remaining = paysData.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      for (const inv of built) {
        const deduct = Math.min(remaining, inv.outstandingAmt);
        inv.outstandingAmt = Math.max(0, inv.outstandingAmt - deduct);
        remaining -= deduct;
        if (remaining <= 0) break;
      }

      // 5. Fallback: use outstanding_liability from supplier profile if no POs exist
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
          outstandingAmt: vendor.commercial!.outstandingLiability,
          agingBucket: bucket,
          daysOverdue,
        });
      }

      setInvoices(built);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPayablesData(); }, [vendor.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const agingReport = useMemo(() => {
    const bucketTotals: Record<AgingBucket, number> = {
      CURRENT: 0, OVERDUE_30: 0, OVERDUE_60: 0, OVERDUE_90: 0, CRITICAL: 0,
    };
    let totalOutstanding = 0;
    for (const inv of invoices) {
      bucketTotals[inv.agingBucket] = (bucketTotals[inv.agingBucket] || 0) + inv.outstandingAmt;
      totalOutstanding += inv.outstandingAmt;
    }
    return { bucketTotals, totalOutstanding };
  }, [invoices]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accounts Payable Aging & Ledger</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live aging from purchase orders and payment records — Net {vendor.commercial?.paymentTermsDays || 30} days terms
          </p>
        </div>
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

      {/* Aging Bucket Strip */}
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

      {/* Total Outstanding */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <DollarSign size={14} className="text-rose-500" />
          <span>Total Outstanding Payable</span>
        </div>
        <span className={`font-black font-mono text-sm ${agingReport.totalOutstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {fmt(agingReport.totalOutstanding)}
        </span>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
          Loading payables from ledger...
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Outstanding Payables</div>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
            This vendor has no open purchase orders or outstanding liabilities on record.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Active Payable Invoices ({invoices.length})
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <th className="p-3">Invoice / PO No</th>
                  <th className="p-3">Invoice Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Aging Status</th>
                  <th className="p-3 text-right">Invoice Amount</th>
                  <th className="p-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{inv.invoiceNo}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{inv.invoiceDate}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{inv.dueDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${BUCKET_STYLES[inv.agingBucket].bg} ${BUCKET_STYLES[inv.agingBucket].text} ${BUCKET_STYLES[inv.agingBucket].border}`}>
                        {inv.agingBucket} ({inv.daysOverdue}d)
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">{fmt(inv.invoiceAmt)}</td>
                    <td className={`p-3 text-right font-bold ${inv.outstandingAmt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {fmt(inv.outstandingAmt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length > 0 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              <Clock size={11} className="inline mr-1" />
              {payments.length} payment(s) on record — {fmt(payments.reduce((s, p) => s + Number(p.amount || 0), 0))} deducted from outstanding.
            </p>
          )}
        </div>
      )}
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


