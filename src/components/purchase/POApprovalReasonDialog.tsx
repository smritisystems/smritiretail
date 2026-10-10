/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §11, §12 — Approval reason dialog with 10 business-language reasons.
 */

import React, { useEffect, useRef, useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import type { POProductDecision } from "./POProductStatusBadge";
import type { POApprovalReason } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, reasonLabel: string, note: string) => void;
  decision: POProductDecision | null;
  productName: string;
  vendorName?: string;
}

const FALLBACK_REASONS: POApprovalReason[] = [
  { code: "BETTER_PRICE",            label: "Better Price",                   requires_note: false },
  { code: "STOCK_AVAILABILITY",      label: "Stock Availability",             requires_note: false },
  { code: "REGISTERED_OUT_OF_STOCK", label: "Registered Vendor Out of Stock", requires_note: false },
  { code: "URGENT",                  label: "Urgent Requirement",             requires_note: false },
  { code: "CREDIT_TERMS",            label: "Better Credit Terms",            requires_note: false },
  { code: "DELIVERY",                label: "Delivery Requirement",           requires_note: false },
  { code: "TERRITORY",               label: "Territory Requirement",          requires_note: false },
  { code: "NEW_VENDOR_TRIAL",        label: "New Vendor Trial",               requires_note: false },
  { code: "MANAGEMENT_INSTRUCTION",  label: "Management Instruction",         requires_note: false },
  { code: "OTHER",                   label: "Other — please explain",         requires_note: true  },
];

export const POApprovalReasonDialog: React.FC<Props> = ({
  isOpen, onClose, onConfirm, decision, productName, vendorName,
}) => {
  const [reasons, setReasons] = useState<POApprovalReason[]>(FALLBACK_REASONS);
  const [selectedCode, setSelectedCode] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; note?: string }>({});
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchV1("/purchase/approval-reasons")
      .then((d: any) => { if (!cancelled && Array.isArray(d) && d.length > 0) setReasons(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isOpen) { setSelectedCode(""); setNote(""); setErrors({}); }
  }, [isOpen]);

  useEffect(() => {
    if (reasons.find(r => r.code === selectedCode)?.requires_note)
      setTimeout(() => noteRef.current?.focus(), 50);
  }, [selectedCode, reasons]);

  if (!isOpen) return null;

  const selectedReason = reasons.find(r => r.code === selectedCode);

  const handleConfirm = () => {
    const errs: { reason?: string; note?: string } = {};
    if (!selectedCode) errs.reason = "Please select a reason before continuing.";
    if (selectedReason?.requires_note && !note.trim())
      errs.note = "An explanation is required when selecting 'Other'.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onConfirm(selectedCode, selectedReason?.label ?? selectedCode, note.trim());
  };

  const statusLabel =
    decision?.status === "CROSS_VENDOR" ? "Cross-Vendor Product" :
    decision?.status === "UNASSIGNED"   ? "Unassigned Product"   : "Approval Required";

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="po-ar-title"
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 border border-[#c4c6d4] overflow-hidden">

        <div className="bg-[#f4f3ff] border-b border-[#c4c6d4] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 id="po-ar-title" className="text-sm font-bold text-[#00296d]">Approval Required</h2>
            <p className="text-[11px] text-[#5d6270] mt-0.5">
              {productName}{vendorName && <span className="ml-1 text-[#737685]">· {vendorName}</span>}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            ⚠ {statusLabel}
          </span>
        </div>

        {decision?.explanation && (
          <div className="mx-5 mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            {decision.explanation}
          </div>
        )}

        <div className="px-5 pt-3 pb-1">
          <label className="block text-xs font-semibold text-[#434652] mb-2">
            Why do you need this product from another vendor?
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="border border-[#c4c6d4] rounded-lg overflow-hidden divide-y divide-[#eeedf3] max-h-56 overflow-y-auto">
            {reasons.map(r => (
              <label key={r.code}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-xs
                  ${selectedCode === r.code ? "bg-[#e8eeff] text-[#00296d] font-semibold" : "hover:bg-[#faf9ff] text-[#434652]"}`}>
                <input type="radio" name="po-approval-reason" value={r.code}
                  checked={selectedCode === r.code}
                  onChange={() => { setSelectedCode(r.code); setErrors(p => ({ ...p, reason: undefined })); }}
                  className="accent-[#00296d]" />
                {r.label}
              </label>
            ))}
          </div>
          {errors.reason && <p className="mt-1 text-xs text-red-600 font-medium">{errors.reason}</p>}
        </div>

        {selectedReason?.requires_note && (
          <div className="px-5 pb-2">
            <label className="block text-xs font-semibold text-[#434652] mb-1 mt-2">
              Please explain <span className="text-red-500">*</span>
            </label>
            <textarea ref={noteRef} value={note}
              onChange={e => { setNote(e.target.value); setErrors(p => ({ ...p, note: undefined })); }}
              rows={3} placeholder="Describe why this purchase is necessary…"
              className={`w-full border rounded-lg px-3 py-2 text-xs resize-none outline-none focus:ring-2 focus:ring-[#00296d] ${errors.note ? "border-red-400" : "border-[#c4c6d4]"}`} />
            {errors.note && <p className="mt-1 text-xs text-red-600 font-medium">{errors.note}</p>}
          </div>
        )}

        <div className="px-5 py-3 bg-[#f4f3ff] border-t border-[#c4c6d4] flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#c4c6d4] text-xs font-semibold text-[#434652] hover:bg-[#eeedf3] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm}
            className="px-5 py-1.5 rounded-lg bg-[#00296d] text-white text-xs font-bold hover:bg-[#003d9e] transition-colors shadow">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default POApprovalReasonDialog;
