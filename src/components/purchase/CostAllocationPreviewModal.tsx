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
 * Capability    : @SmritiCapability("PURCHASE", "COST_ALLOCATION_PREVIEW")
 */

import React from "react";
import { X, CheckCircle2, AlertCircle, Scale, DollarSign, Calculator } from "lucide-react";
import { AllocationPreviewResult } from "./types/inwardCost.ts";

interface CostAllocationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  previewData: AllocationPreviewResult | null;
}

export const CostAllocationPreviewModal: React.FC<CostAllocationPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  previewData,
}) => {
  if (!isOpen || !previewData) return null;

  const totalPurchaseValue = previewData.lines.reduce((s, l) => s + l.purchase_value, 0);
  const totalQuantity = previewData.lines.reduce((s, l) => s + l.quantity, 0);
  const totalAllocated = previewData.lines.reduce((s, l) => s + l.allocated_amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Allocate ₹{previewData.total_component_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {previewData.component_type}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  {previewData.allocation_method} BASED
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hamilton-Hare largest-remainder cent-balanced allocation preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">SKU & Item</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">PO Rate</th>
                  <th className="py-2.5 px-3 text-right">
                    {previewData.allocation_method === "QUANTITY" ? "Qty Share" : "Purchase Value"}
                  </th>
                  <th className="py-2.5 px-3 text-right">Share %</th>
                  <th className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">Allocated Addon</th>
                  <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">Addon / Pc</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">Landed / Pc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {previewData.lines.map((line) => (
                  <tr key={line.sku} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                        {line.sku}
                      </span>
                      <span className="text-[11px] text-slate-500 line-clamp-1">
                        {line.product_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{line.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono">₹{line.rate.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium">
                      ₹{line.purchase_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {line.share_percent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      ₹{line.allocated_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      +₹{line.allocated_per_unit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/30">
                      ₹{line.net_landed_cost_per_unit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="py-3 px-3">TOTAL RECONCILIATION</td>
                  <td className="py-3 px-3 text-right font-mono">{totalQuantity}</td>
                  <td className="py-3 px-3 text-right">--</td>
                  <td className="py-3 px-3 text-right font-mono">
                    ₹{totalPurchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">100.00%</td>
                  <td className="py-3 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                    ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right">--</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    ✓ Balanced
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cent-Balancing Audit Banner */}
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between ${
              previewData.is_balanced
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {previewData.is_balanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-semibold text-xs">
                {previewData.is_balanced
                  ? `Reconciliation Confirmed: Allocated ₹${totalAllocated.toFixed(2)} = ₹${previewData.total_component_amount.toFixed(2)} with 0 penny variance.`
                  : `Variance detected: ₹${previewData.variance.toFixed(2)}`}
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 font-bold">
              Cent Balancing: ACTIVE
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Back to Editor
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm Allocation
          </button>
        </div>
      </div>
    </div>
  );
};
