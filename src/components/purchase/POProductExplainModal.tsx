/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import type { POProductDecision, POVendorDecisionStatus, POVendorDecisionAction } from "./POProductStatusBadge.tsx";

interface POProductExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  decision: POProductDecision | null;
  productName?: string;
  vendorName?: string;
}

const STATUS_LABELS: Record<POVendorDecisionStatus, string> = {
  ASSIGNED:     "🟢 Assigned — this product is registered to this vendor",
  CROSS_VENDOR: "🟡 Cross-Vendor — this product is registered to a different vendor",
  UNASSIGNED:   "🔵 Unassigned — this product has no vendor assignment",
  RESTRICTED:   "🔴 Restricted — this product is explicitly blocked for this vendor",
};

const ACTION_LABELS: Record<POVendorDecisionAction, string> = {
  ALLOW:             "✅ Allowed without restriction",
  READ_ONLY:         "👁 View only — quantity and rate cannot be changed",
  APPROVAL_REQUIRED: "📋 Manager approval is required before this can be saved",
  BLOCK:             "🚫 Blocked — this product cannot be added to the order",
};

export const POProductExplainModal: React.FC<POProductExplainModalProps> = ({
  isOpen,
  onClose,
  decision,
  productName,
  vendorName,
}) => {
  if (!isOpen || !decision) return null;

  const isBlock = decision.action === "BLOCK";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#00296d] text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span className="font-bold text-sm">Purchase Authorization Details</span>
          </div>
          <button type="button" onClick={onClose} className="text-white hover:opacity-70 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Product + Vendor context */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {productName && (
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <div className="text-slate-500 font-medium uppercase text-[10px] tracking-wider mb-1">Product</div>
                <div className="font-bold text-slate-800">{productName}</div>
              </div>
            )}
            {vendorName && (
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <div className="text-slate-500 font-medium uppercase text-[10px] tracking-wider mb-1">Vendor</div>
                <div className="font-bold text-slate-800">{vendorName}</div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Vendor Assignment Status
            </div>
            <div className="text-sm font-medium text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              {STATUS_LABELS[decision.status]}
            </div>
          </div>

          {/* Assignment source */}
          {decision.assignment_vendor_name && decision.status !== "ASSIGNED" && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Registered Vendor
              </div>
              <div className="text-sm font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                {decision.assignment_vendor_name}
                {decision.assignment_level && (
                  <span className="ml-2 text-[10px] text-amber-600 font-mono">
                    ({decision.assignment_level} level)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Decision/Action */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              System Decision
            </div>
            <div
              className={`text-sm font-medium rounded-lg px-3 py-2 border ${
                isBlock
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : decision.action === "APPROVAL_REQUIRED"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {ACTION_LABELS[decision.action]}
            </div>
          </div>

          {/* Explanation */}
          {decision.explanation && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Explanation
              </div>
              <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200 leading-relaxed">
                {decision.explanation}
              </div>
            </div>
          )}

          {/* Approval reasons hint */}
          {decision.approval_reason_required && decision.approval_reasons.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Approval Reasons Available
              </div>
              <div className="flex flex-wrap gap-1.5">
                {decision.approval_reasons.slice(0, 5).map((r) => (
                  <span
                    key={r.code}
                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200"
                  >
                    {r.label}
                  </span>
                ))}
                {decision.approval_reasons.length > 5 && (
                  <span className="text-[10px] text-slate-400">
                    +{decision.approval_reasons.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Policy info */}
          {decision.policy_version && (
            <div className="text-[10px] text-slate-400 font-mono text-right">
              Policy version: {decision.policy_version}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#00296d] text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-[#003d9e] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
