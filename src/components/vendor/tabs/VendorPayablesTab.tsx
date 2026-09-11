/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { DollarSign, Clock, AlertTriangle, CheckCircle2, CreditCard, ChevronRight } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";
import SupplierPaymentEngine, { SupplierInvoice, AgingBucket } from "../../../utils/supplierPaymentEngine";

interface VendorPayablesTabProps {
  vendor: VendorDetail;
}

const BUCKET_STYLES: Record<AgingBucket, { bg: string; border: string; text: string }> = {
  CURRENT:    { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-600/30", text: "text-emerald-700 dark:text-emerald-400" },
  OVERDUE_30: { bg: "bg-amber-50 dark:bg-amber-950/20",   border: "border-amber-200 dark:border-amber-600/30",   text: "text-amber-800 dark:text-amber-400" },
  OVERDUE_60: { bg: "bg-orange-50 dark:bg-orange-950/20",  border: "border-orange-200 dark:border-orange-600/30",  text: "text-orange-800 dark:text-orange-400" },
  OVERDUE_90: { bg: "bg-red-50 dark:bg-red-950/20",     border: "border-red-200 dark:border-red-600/30",     text: "text-red-700 dark:text-red-400" },
  CRITICAL:   { bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-600/40",    text: "text-rose-800 dark:text-rose-400" },
};

const VendorPayablesTabBase: React.FC<VendorPayablesTabProps> = ({ vendor }) => {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(() => {
    const now = new Date();
    const inv1 = SupplierPaymentEngine.createInvoice({
      vendorId: vendor.id,
      vendorName: vendor.legalName,
      branchCode: "BR-001",
      invoiceNo: `INV-${vendor.code}-001`,
      invoiceAmt: vendor.commercial?.outstandingLiability || 25000,
      invoiceDate: new Date(now.getTime() - 20 * 86400000).toISOString().slice(0, 10),
      terms: "NET_30",
      earlyPayCutoffDays: 10,
      earlyPayDiscountPct: 2,
    }, now);
    return [inv1];
  });

  const agingReport = useMemo(() => {
    const reports = SupplierPaymentEngine.vendorAgingReport(invoices, new Date());
    const vendorRep = reports.find(r => r.vendorId === vendor.id);
    const bucketTotals: Record<AgingBucket, number> = {
      CURRENT: 0,
      OVERDUE_30: 0,
      OVERDUE_60: 0,
      OVERDUE_90: 0,
      CRITICAL: 0,
    };
    if (vendorRep) {
      vendorRep.buckets.forEach(b => {
        bucketTotals[b.bucket] = b.totalAmt;
      });
    }
    return {
      bucketTotals,
      totalOutstanding: vendorRep?.totalOutstanding ?? 0,
      criticalAmt: vendorRep?.criticalAmt ?? 0,
      oldestDueDays: vendorRep?.oldestDueDays ?? 0,
    };
  }, [invoices, vendor.id]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accounts Payable Aging & Ledger</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Chronological liability buckets, payment schedule, and early payment cash discounts</p>
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
              <div className={`text-base font-black font-mono mt-1 ${style.text}`}>
                {fmt(amt)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Active Payable Invoices</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-bold">
              <tr>
                <th className="p-3">Invoice No</th>
                <th className="p-3">Invoice Date</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Aging Status</th>
                <th className="p-3 text-right">Invoice Amount</th>
                <th className="p-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {invoices.map((inv) => (
                <tr key={inv.invoiceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">{inv.invoiceNo}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{inv.invoiceDate}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{inv.dueDate}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${BUCKET_STYLES[inv.agingBucket].bg} ${BUCKET_STYLES[inv.agingBucket].text} ${BUCKET_STYLES[inv.agingBucket].border}`}>
                      {inv.agingBucket} ({inv.daysOverdue}d)
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{fmt(inv.invoiceAmt)}</td>
                  <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">{fmt(inv.outstandingAmt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

