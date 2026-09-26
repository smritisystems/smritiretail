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
 * Capability    : @SmritiCapability("PURCHASE", "WHY_THIS_COST_MODAL")
 */

import React from "react";
import { X, HelpCircle, FileText, CheckCircle2, TrendingUp, Info } from "lucide-react";
import { WhyThisCostData } from "./types/inwardCost.ts";

interface WhyThisCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WhyThisCostData | null;
}

export const WhyThisCostModal: React.FC<WhyThisCostModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cost Breakdown — {data.sku}
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {data.product_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Breakdown Card */}
        <div className="p-5 space-y-4 text-xs font-mono">
          {/* Base Commercial Pricing */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>PO Contract Rate</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                ₹{data.po_rate.toFixed(2)}
              </span>
            </div>
            {data.trade_discount_per_unit > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Trade Discount</span>
                <span>-₹{data.trade_discount_per_unit.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
              <span>Net Purchase Rate</span>
              <span>₹{data.net_purchase_rate.toFixed(2)}</span>
            </div>
          </div>

          {/* Itemized Landed Cost Components */}
          <div className="space-y-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Allocated Inward Costs
            </span>
            {data.components && data.components.length > 0 ? (
              <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                {data.components.map((c, i) => (
                  <div key={i} className="pt-1.5 flex items-start justify-between">
                    <div>
                      <span className="font-sans font-semibold text-indigo-600 dark:text-indigo-400">
                        + {c.component_name || c.component_type}
                      </span>
                      <div className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        {c.allocation_method} BASED
                        {c.document_no && ` • Doc: ${c.document_no}`}
                        {c.transporter_name && ` • ${c.transporter_name}`}
                      </div>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ₹{c.allocated_per_unit.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 font-sans italic py-1">
                No freight or transport addons allocated to this GRN.
              </p>
            )}
          </div>

          {/* Final Landed Cost & Valuation Summary */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg">
            <div className="flex items-center justify-between text-sm font-bold text-emerald-900 dark:text-emerald-200">
              <span>FINAL LANDED COST</span>
              <span className="text-base font-bold">
                ₹{data.final_landed_cost.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] font-sans text-emerald-700 dark:text-emerald-400 mt-0.5">
              Capitalized Acquisition Cost for WAC & Batch COGS
            </div>

            {data.mrp && data.mrp > 0 && (
              <div className="pt-2 mt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs font-sans">
                <span className="text-slate-600 dark:text-slate-400">
                  MRP: <strong className="font-mono">₹{data.mrp.toFixed(2)}</strong>
                </span>
                {data.margin_percent !== undefined && (
                  <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Est. Margin: {data.margin_percent.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
