/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_POSTED_MODAL")
 */

import React from "react";
import { CheckCircle2, Printer, Tag, FileText, ArrowRight } from "lucide-react";
import { GrnPostedSummary } from "./types/inwardCost.ts";

interface GrnPostedSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: GrnPostedSummary | null;
  onViewGrn?: () => void;
}

export const GrnPostedSuccessModal: React.FC<GrnPostedSuccessModalProps> = ({
  isOpen,
  onClose,
  summary,
  onViewGrn,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col p-6 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50 dark:ring-emerald-950/30">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
          GRN Posted Successfully
        </h3>
        <p className="text-xs text-slate-500 font-mono mt-1">
          {summary.grn_no} • {summary.supplier_name}
        </p>

        {/* Accepted Badge */}
        <div className="my-4 inline-block px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs mx-auto">
          {summary.total_units} Units Accepted into Stock
        </div>

        {/* Cost Summary Box */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-left text-xs font-mono space-y-2 mb-4">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Purchase Cost</span>
            <span>₹{summary.purchase_cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
            <span>+ Additional Landed Costs ({summary.cost_components_count} Items)</span>
            <span>₹{summary.additional_landed_costs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
            <span>Inventory Acquisition Cost</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              ₹{summary.total_inventory_cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Ledger & WAC Post Verification Checklist */}
        <div className="space-y-1.5 text-xs text-left mb-6 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>WAC (Weighted Average Cost) Updated</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Stock Ledger & WMS Batches Inwarded</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Landed Cost Ledger Allocation Settled</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => {
              onClose();
              onViewGrn?.();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <span>View GRN History</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Done & Create Next GRN
          </button>
        </div>
      </div>
    </div>
  );
};
