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

import React, { useState, useEffect } from "react";
import { Award, Clock, CheckCircle2, AlertTriangle, TrendingUp, Percent } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";
import SupplierScorecardEngine, {
  SupplierProfile as ScorecardProfile,
  PurchaseOrderRecord,
  SupplierSLAStatus,
} from "../../../utils/supplierScorecardEngine";

interface VendorScorecardTabProps {
  vendor: VendorDetail;
}

const SLA_STYLES: Record<SupplierSLAStatus, { bg: string; border: string; text: string; label: string }> = {
  GREEN:    { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-600/30", text: "text-emerald-700 dark:text-emerald-400", label: "GREEN — High SLA Compliance" },
  AMBER:    { bg: "bg-amber-50 dark:bg-amber-950/20",   border: "border-amber-200 dark:border-amber-600/30",   text: "text-amber-800 dark:text-amber-400",   label: "AMBER — Minor Delays Observed" },
  RED:      { bg: "bg-rose-50 dark:bg-rose-950/20",    border: "border-rose-200 dark:border-rose-600/30",    text: "text-rose-800 dark:text-rose-400",    label: "RED — High Rejection / Delay" },
  CRITICAL: { bg: "bg-red-50 dark:bg-red-950/30",     border: "border-red-200 dark:border-red-600/50",     text: "text-red-700 dark:text-red-400",     label: "CRITICAL — Breach of SLA" },
};

const VendorScorecardTabBase: React.FC<VendorScorecardTabProps> = ({ vendor }) => {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScoreData = async () => {
      setLoading(true);
      try {
        // Fetch closed (RECEIVED) POs for SLA analysis — server-side filtered
        let raw: any[] = [];
        try {
          const res = await apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(vendor.id)}`);
          raw = Array.isArray(res) ? res : res?.items || [];
          if (raw.length === 0) {
            const legacyId = `sup-${vendor.code.toLowerCase()}`;
            const res2 = await apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(legacyId)}`);
            raw = Array.isArray(res2) ? res2 : res2?.items || [];
          }
        } catch { raw = []; }

        const contractedLeadDays = vendor.commercial?.paymentTermsDays ?? 7;
        const mapped: PurchaseOrderRecord[] = raw.map((po: any) => {
          const orderedQty = (po.items || []).reduce((s: number, i: any) => s + Number(i.quantity || i.ordered_qty || 0), 0);
          const receivedQty = (po.items || []).reduce((s: number, i: any) => s + Number(i.received_qty || i.quantity || 0), 0);
          const due = new Date(po.created_at || Date.now());
          due.setDate(due.getDate() + contractedLeadDays);
          return {
            poNumber: po.order_no || po.id,
            supplierId: vendor.id,
            orderedQty: orderedQty || 1,
            orderedValue: Number(po.grand_total || 0),
            poDate: po.created_at || new Date().toISOString(),
            expectedDeliveryDate: due.toISOString(),
            actualDeliveryDate: po.updated_at || due.toISOString(),
            receivedQty: receivedQty || orderedQty || 1,
            acceptedQty: receivedQty || orderedQty || 1,
            rejectedQty: 0,
            qualityVerdict: (po.status || "").toUpperCase() === "RECEIVED" ? "ACCEPTED" : undefined,
          };
        });
        setOrders(mapped);
      } finally {
        setLoading(false);
      }
    };
    fetchScoreData();
  }, [vendor.id, vendor.code, vendor.commercial?.paymentTermsDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const scorecard = (() => {
    if (orders.length === 0) return null;
    const profile: ScorecardProfile = {
      supplierId: vendor.id,
      supplierName: vendor.legalName,
      gstIn: vendor.gstin,
      category: vendor.commercial?.supplierType || "General",
      contractedLeadTimeDays: 7,
      contractedFillRatePct: 95,
      penaltyPerDayDelay: 500,
    };
    const report = SupplierScorecardEngine.generateReport([profile], orders);
    return report.entries[0] ?? null;
  })();

  const style = SLA_STYLES[scorecard?.slaStatus || "GREEN"];

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-500">
        Loading SLA & quality scorecard from purchase history...
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="py-16 text-center space-y-2">
        <Award size={30} className="mx-auto text-slate-300 dark:text-slate-600" />
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">No Purchase History Available</div>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
          SLA scorecard requires at least one purchase order. Create and receive a PO to generate quality metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vendor SLA Compliance & Quality Scorecard</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">On-time delivery performance, fill rate percentages, and quality rejection metrics</p>
      </div>

      {/* SLA Badge Banner */}
      <div className={`p-4 rounded-xl border shadow-xs ${style.bg} ${style.border} flex items-center justify-between`}>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Composite SLA Health Status</div>
          <div className={`text-lg font-black mt-0.5 ${style.text}`}>{style.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400">Scorecard Rating</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{scorecard.scorecard} / 100</div>
        </div>
      </div>

      {/* 4 Scorecard Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">On-Time Delivery</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {scorecard.onTimeDeliveryPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Contracted Lead Time: 7 Days</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Order Fill Rate</div>
          <div className="text-xl font-black text-indigo-700 dark:text-indigo-400 font-mono mt-1">
            {scorecard.fillRatePct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Target: 95.0%</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Quality Rejection</div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono mt-1">
            {scorecard.qualityRejectionPct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Defect / RMA Rate</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Accrued Delay Penalties</div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-300 font-mono mt-1">
            ₹{scorecard.totalPenaltyAccrued.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">₹500 / Overdue Day</div>
        </div>
      </div>
    </div>
  );
};

export const VendorScorecardTab = withCapability(VendorScorecardTabBase, {
  entity: "vendor",
  capability: "vendor.scorecard",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorScorecardTab;

