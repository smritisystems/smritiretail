/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §4, §22 — Vendor change guard with re-evaluation results.
 */

import React, { useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import type { POVendorChangeResult } from "./types";

interface PopulatedLine {
  stockNo: string;
  product: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called only after user confirms the change in Phase 2. */
  onConfirm: (result: POVendorChangeResult) => void;
  currentVendorId: string;
  currentVendorName: string;
  newVendorId: string;
  newVendorName: string;
  /** Current populated PO lines with product refs. */
  lines: PopulatedLine[];
  transactionDate?: string;
}

type Phase = "confirm" | "loading" | "results" | "error";

export const POVendorChangeDialog: React.FC<Props> = ({
  isOpen, onClose, onConfirm,
  currentVendorName, newVendorId, newVendorName, lines, transactionDate,
}) => {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [result, setResult] = useState<POVendorChangeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const populatedLines = lines.filter(l => l.stockNo?.trim());

  const handleContinue = async () => {
    setPhase("loading");
    try {
      const data = await apiFetchV1("/purchase/evaluate-vendor-change", {
        method: "POST",
        body: JSON.stringify({
          new_vendor_id: newVendorId,
          product_refs: populatedLines.map(l => l.stockNo),
          line_indices: populatedLines.map((_, i) => i),
          transaction_date: transactionDate,
        }),
      }) as POVendorChangeResult;
      setResult(data);
      setPhase("results");
    } catch (e: any) {
      setErrorMsg("Unable to evaluate vendor change. Please try again.");
      setPhase("error");
    }
  };

  const handleApply = () => {
    if (result) onConfirm(result);
  };

  const s = result?.summary;
  const blocked = s?.blocked ?? 0;

  const StatusRow = ({ icon, count, label, color }: { icon: string; count: number; label: string; color: string }) =>
    count > 0 ? (
      <div className={"flex items-center gap-2 text-xs px-3 py-1.5 rounded " + color}>
        <span>{icon}</span>
        <span className="font-bold">{count}</span>
        <span>{label}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="po-vcd-title">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-[#c4c6d4] overflow-hidden">

        <div className="bg-[#f4f3ff] border-b border-[#c4c6d4] px-5 py-3">
          <h2 id="po-vcd-title" className="text-sm font-bold text-[#00296d]">Change Vendor?</h2>
          <p className="text-[11px] text-[#5d6270] mt-0.5">
            {currentVendorName} → <strong className="text-[#00296d]">{newVendorName}</strong>
          </p>
        </div>

        <div className="px-5 py-4">

          {phase === "confirm" && (
            <p className="text-xs text-[#434652] leading-relaxed">
              Changing the vendor will re-check all{" "}
              <strong>{populatedLines.length}</strong> product
              {populatedLines.length !== 1 ? "s" : ""} against{" "}
              <strong>{newVendorName}</strong>&apos;s purchasing rules.
            </p>
          )}

          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00296d] border-t-transparent" />
              <p className="text-xs text-[#737685]">Re-evaluating {populatedLines.length} products…</p>
            </div>
          )}

          {phase === "results" && s && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-[#434652] mb-1">Re-evaluation complete:</p>
              <StatusRow icon="✓" count={s.assigned}     label="Assigned — Allowed"              color="bg-green-50 text-green-800" />
              <StatusRow icon="⚠" count={s.cross_vendor} label="Cross-Vendor — Approval Required" color="bg-amber-50 text-amber-800" />
              <StatusRow icon="○" count={s.unassigned}   label="Unassigned — Approval Required"  color="bg-blue-50 text-blue-800" />
              <StatusRow icon="✕" count={s.restricted}   label="Restricted — Blocked"            color="bg-red-50 text-red-800" />
              {blocked > 0 && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                  {blocked} product{blocked !== 1 ? "s are" : " is"} blocked and must be removed before submission.
                </div>
              )}
            </div>
          )}

          {phase === "error" && (
            <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
          )}
        </div>

        <div className="px-5 py-3 bg-[#f4f3ff] border-t border-[#c4c6d4] flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#c4c6d4] text-xs font-semibold text-[#434652] hover:bg-[#eeedf3] transition-colors">
            Cancel
          </button>
          {phase === "confirm" && (
            <button type="button" onClick={handleContinue}
              className="px-5 py-1.5 rounded-lg bg-[#00296d] text-white text-xs font-bold hover:bg-[#003d9e] transition-colors shadow">
              Continue
            </button>
          )}
          {phase === "results" && (
            <button type="button" onClick={handleApply}
              className="px-5 py-1.5 rounded-lg bg-[#00296d] text-white text-xs font-bold hover:bg-[#003d9e] transition-colors shadow">
              Apply Change
            </button>
          )}
          {phase === "error" && (
            <button type="button" onClick={handleContinue}
              className="px-5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow">
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default POVendorChangeDialog;
