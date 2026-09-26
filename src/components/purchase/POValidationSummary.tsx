/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §18 — Submit validation gate modal.
 */

import React from "react";
import type { POSubmitValidationResult } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  result: POSubmitValidationResult | null;
  loading?: boolean;
}

export const POValidationSummary: React.FC<Props> = ({
  isOpen, onClose, onSubmit, result, loading = false,
}) => {
  if (!isOpen) return null;

  const canSubmit = result?.can_submit ?? false;
  const hasStale = (result?.stale_count ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="po-vs-title">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 border border-[#c4c6d4] overflow-hidden">

        <div className={(canSubmit ? "border-b border-[#c4c6d4] px-5 py-3 bg-white" : "border-b border-red-200 px-5 py-3 bg-red-50")}>
          <h2 id="po-vs-title" className={(canSubmit ? "text-sm font-bold text-[#00296d]" : "text-sm font-bold text-red-700")}>
            {loading ? "Validating Purchase Order…" : canSubmit ? "Purchase Order Validation" : "Cannot Submit"}
          </h2>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00296d] border-t-transparent" />
            <p className="text-xs text-[#737685]">Re-evaluating all product lines…</p>
          </div>
        )}

        {!loading && result && (
          <div className="px-5 py-4 flex flex-col gap-2">

            {hasStale && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium flex items-center gap-2">
                ⚠ {result.stale_count} product{result.stale_count !== 1 ? "s" : ""} changed since you last browsed. Decisions updated.
              </div>
            )}

            <CheckRow ok label="Vendor valid" />
            <CheckRow ok={result.allowed_count + result.approval_required_count > 0}
              label={(result.allowed_count + result.approval_required_count + result.blocked_count) + " products evaluated"} />
            <CheckRow ok label={result.allowed_count + " products allowed"} />

            {result.approval_required_count > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-800">
                <span className="font-bold text-amber-500">⚠</span>
                <span>{result.approval_required_count} product{result.approval_required_count !== 1 ? "s" : ""} require approval</span>
              </div>
            )}

            {result.blocked_count > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-red-700 font-semibold">
                  <span>✕</span>
                  <span>{result.blocked_count} product{result.blocked_count !== 1 ? "s are" : " is"} blocked by purchasing policy</span>
                </div>
                <div className="pl-4 text-xs text-red-600 space-y-0.5">
                  {result.line_results
                    .filter(l => l.action === "BLOCK")
                    .map(l => (
                      <div key={l.line_index} className="font-mono">
                        Line {l.line_index + 1}: {l.product_ref}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 bg-[#f4f3ff] border-t border-[#c4c6d4] flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#c4c6d4] text-xs font-semibold text-[#434652] hover:bg-[#eeedf3] transition-colors">
            {canSubmit ? "Review Lines" : "Close"}
          </button>
          {!loading && canSubmit && (
            <button type="button" onClick={onSubmit}
              className="px-5 py-1.5 rounded-lg bg-[#00296d] text-white text-xs font-bold hover:bg-[#003d9e] transition-colors shadow">
              {result && result.approval_required_count > 0 ? "Submit for Approval" : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const CheckRow: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className={"flex items-center gap-2 text-xs " + (ok ? "text-green-700" : "text-[#737685]")}>
    <span className="font-bold">{ok ? "✓" : "–"}</span>
    <span>{label}</span>
  </div>
);

export default POValidationSummary;
