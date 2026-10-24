/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-21
 * Modified     : 2026-09-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "CONFIRM_GRN_POST_MODAL")
 * Target UI    : SMRITI GRN Studio — Final Post Verification and Confirmation Gate
 */

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  X,
  FileText,
  Truck,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface GrnPostConfirmationDetails {
  grnNumber: string;
  inwardDate: string;
  supplierId: string;
  supplierName: string;
  referencePo: string;
  itemsCount: number;
  totalAcceptedQty: number;
  totalDamagedQty: number;
  purchaseValue: number;
  totalAddonCost: number;
  totalGst: number;
  finalInventoryCost: number;
  allocationMethod: string;
  isManualAllocation: boolean;
  manualAllocationBalanced: boolean;
  manualAllocationVariance: number;
  validationErrors: string[];
}

interface ConfirmGrnPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  details: GrnPostConfirmationDetails | null;
  isPosting: boolean;
}

export const ConfirmGrnPostModal: React.FC<ConfirmGrnPostModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  details,
  isPosting,
}) => {
  if (!isOpen || !details) return null;

  const hasErrors = details.validationErrors.length > 0;
  const isBlockedByManual =
    details.isManualAllocation && !details.manualAllocationBalanced;
  const canPost = !hasErrors && !isBlockedByManual && !isPosting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      data-testid="confirm-grn-post-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 text-white flex items-center justify-between border-b border-indigo-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300 border border-white/15">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                Confirm GRN Posting
              </h3>
              <p className="text-xs text-indigo-200 font-mono">
                {details.grnNumber} • Irreversible Inventory &amp; Ledger Commitment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPosting}
            aria-label="Close"
            className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 text-xs">
            You are about to finalize this Goods Receipt Note. Posting updates inventory levels across warehouse bins, commits landed cost valuation adjustments, and posts supplier ledger obligations.
          </p>

          {/* Key Transaction Metadata Grid */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">GRN Reference</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {details.grnNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Inward Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {details.inwardDate}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Supplier</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {details.supplierName || details.supplierId}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Source Contract</span>
                <span className="font-mono text-slate-800 dark:text-slate-100">
                  {details.referencePo || "Direct Inward (No PO)"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Inward Items</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {details.itemsCount}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Accepted Qty</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {details.totalAcceptedQty}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Damaged Qty</span>
                <span className="text-sm font-bold text-rose-500 font-mono">
                  {details.totalDamagedQty}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 font-mono space-y-1.5">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span>Purchase Value (Accepted):</span>
              <span className="font-bold">
                ₹{details.purchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400">
              <span>Landed Cost Add-ons ({details.allocationMethod}):</span>
              <span className="font-bold">
                +₹{details.totalAddonCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {details.totalGst > 0 && (
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Applicable GST (ITC Eligible):</span>
                <span>₹{details.totalGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-extrabold text-slate-900 dark:text-white">
              <span>Final Inventory Cost:</span>
              <span className="text-indigo-600 dark:text-indigo-300">
                ₹{details.finalInventoryCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Verification Guard Checklist */}
          <div className="space-y-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Pre-Flight Validation Gate</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Supplier identity &amp; PO contract verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Quantities validated (zero negative accepted quantities)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cost components &amp; landed freight verified</span>
              </div>
              {details.isManualAllocation && (
                <div className="flex items-center gap-1.5">
                  {details.manualAllocationBalanced ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span
                    className={
                      details.manualAllocationBalanced
                        ? "text-slate-600 dark:text-slate-300"
                        : "text-rose-600 dark:text-rose-400 font-bold"
                    }
                  >
                    Manual landed-cost components:{" "}
                    {details.manualAllocationBalanced
                      ? "Reconciled (Variance ₹0.00)"
                      : `Unbalanced (Variance: ₹${details.manualAllocationVariance.toFixed(2)})`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Blocker Alert If Any Validation Failed */}
          {(!canPost && (hasErrors || isBlockedByManual)) && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Posting Blocked by Validation Rules</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {details.validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {isBlockedByManual && (
                  <li>
                    Manual allocation has a variance of ₹{details.manualAllocationVariance.toFixed(2)}. Correct the allocation table in Step 4 before posting.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPosting}
            data-testid="cancel-confirm-post-btn"
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canPost}
            data-testid="confirm-post-grn-btn"
            className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-sm ${
              canPost
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                : "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
            }`}
          >
            {isPosting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Posting GRN to Ledger...</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" />
                <span>Confirm &amp; Post GRN</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
