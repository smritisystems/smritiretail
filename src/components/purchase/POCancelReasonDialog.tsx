/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Order Cancellation Reason Picker (Phase C)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-01
 * Modified     : 2026-10-01
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Phase C — Cancel Reason Policy Picker
 * ──────────────────────────────────────
 * Replaces the bare text-input CancelDialog from Phase B with a
 * structured policy-based cancel reason picker.
 * - Loads reasons from GET /purchase/cancel-reasons (PO_CANCEL_REASON master)
 * - Falls back to 8 static reasons if the endpoint is unavailable
 * - "Other" requires a free-text explanation (requires_note: true)
 * - Sends { reason_code, reason } to POST /orders/{id}/cancel
 *
 * UI design mirrors POApprovalReasonDialog for visual consistency.
 */

import React, { useEffect, useRef, useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POCancelReason {
  code: string;
  label: string;
  requires_note: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface POCancelReasonResult {
  reason_code: string;
  reason_label: string;
  reason_note: string;   // free-text (may be empty unless requires_note)
}

interface POCancelReasonDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** PO order number — displayed in header. */
  orderNo: string;
  /** PO supplier name — displayed in sub-header. */
  supplierName?: string;
  /** PO lifecycle status — shown in context badge. */
  status?: string;
  /** Called when user clicks "Confirm Cancel". */
  onConfirm: (result: POCancelReasonResult) => void;
  /** Called when user clicks "Keep PO" or presses Escape. */
  onCancel: () => void;
  /** True while the parent is posting the cancel request. */
  loading?: boolean;
}

// ─── Static fallback reasons (mirrors backend fallback exactly) ───────────────

const FALLBACK_REASONS: POCancelReason[] = [
  { code: "DUPLICATE_ORDER",       label: "Duplicate Purchase Order",            requires_note: false },
  { code: "BUDGET_CONSTRAINT",     label: "Budget Constraint / Funds Not Available", requires_note: false },
  { code: "VENDOR_UNAVAILABLE",    label: "Vendor Unavailable or Unresponsive",  requires_note: false },
  { code: "PRICE_CHANGED",         label: "Price Changed or Not Agreed",         requires_note: false },
  { code: "REQUIREMENT_CANCELLED", label: "Requirement Cancelled",               requires_note: false },
  { code: "WRONG_ITEMS",           label: "Wrong Items or Specification",        requires_note: false },
  { code: "MANAGEMENT_DECISION",   label: "Management Decision",                 requires_note: false },
  { code: "OTHER",                 label: "Other (please specify)",              requires_note: true  },
];

// ─── Status badge mini (reused from POWorkspaceTab color map) ─────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-amber-900/60 text-amber-300",
  SUBMITTED: "bg-blue-900/60 text-blue-300",
  CONFIRMED: "bg-emerald-900/60 text-emerald-300",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const POCancelReasonDialog: React.FC<POCancelReasonDialogProps> = ({
  isOpen,
  orderNo,
  supplierName,
  status,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [reasons, setReasons] = useState<POCancelReason[]>(FALLBACK_REASONS);
  const [selectedCode, setSelectedCode] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; note?: string }>({});
  const [loadingReasons, setLoadingReasons] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // ── Load cancel reasons from backend on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingReasons(true);
    apiFetchV1("/purchase/cancel-reasons")
      .then((d: unknown) => {
        if (!cancelled && Array.isArray(d) && d.length > 0) setReasons(d as POCancelReason[]);
      })
      .catch(() => {
        // fallback already set
      })
      .finally(() => { if (!cancelled) setLoadingReasons(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Reset form on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setSelectedCode("");
      setNote("");
      setErrors({});
      setTimeout(() => firstOptionRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ── Auto-focus note when OTHER selected ───────────────────────────────────
  const selectedReason = reasons.find((r) => r.code === selectedCode);
  useEffect(() => {
    if (selectedReason?.requires_note) {
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [selectedCode, selectedReason]);

  if (!isOpen) return null;

  // ── Validate and emit ──────────────────────────────────────────────────────
  const handleConfirm = () => {
    const errs: { reason?: string; note?: string } = {};
    if (!selectedCode) {
      errs.reason = "Please select a cancellation reason before proceeding.";
    }
    if (selectedReason?.requires_note && !note.trim()) {
      errs.note = "An explanation is required when selecting 'Other'.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onConfirm({
      reason_code: selectedCode,
      reason_label: selectedReason?.label ?? selectedCode,
      reason_note: note.trim(),
    });
  };

  const statusBadge = status ? STATUS_COLORS[status.toUpperCase()] ?? "bg-slate-700 text-slate-400" : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Cancel purchase order ${orderNo}`}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[500px] max-w-[96vw] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-red-950/40 border-b border-red-900/40 px-5 py-4 flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-full bg-red-900/60 border border-red-700/50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-red-400 text-lg">cancel</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">Cancel Purchase Order</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-red-300 text-xs">{orderNo}</span>
              {supplierName && (
                <span className="text-slate-400 text-xs truncate max-w-[220px]" title={supplierName}>
                  · {supplierName}
                </span>
              )}
              {status && statusBadge && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusBadge}`}>
                  {status}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-1.5">
              This action is permanent. Select a reason and confirm to proceed.
            </p>
          </div>
        </div>

        {/* ── Reason Picker ───────────────────────────────────────────────── */}
        <div className="px-5 py-4 flex-1 overflow-y-auto max-h-[55vh]">
          <p className="text-xs font-medium text-slate-400 mb-2.5">
            Reason for cancellation
            <span className="text-red-500 ml-0.5">*</span>
          </p>

          {loadingReasons ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-800/60" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5" role="radiogroup" aria-label="Cancellation reason">
              {reasons.map((reason, idx) => {
                const isSelected = selectedCode === reason.code;
                return (
                  <button
                    key={reason.code}
                    ref={idx === 0 ? firstOptionRef : undefined}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    id={`cancel-reason-${reason.code}`}
                    onClick={() => {
                      setSelectedCode(reason.code);
                      setErrors((prev) => ({ ...prev, reason: undefined }));
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-all
                      ${isSelected
                        ? "bg-red-900/30 border-red-700/60 text-white"
                        : "bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                      }
                    `}
                  >
                    {/* Radio indicator */}
                    <div className={`
                      shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all
                      ${isSelected ? "border-red-500 bg-red-500" : "border-slate-600 bg-transparent"}
                    `}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium leading-tight">{reason.label}</span>
                      {reason.requires_note && (
                        <span className="ml-2 inline-flex items-center text-[10px] text-amber-400 font-medium">
                          <span className="material-symbols-outlined text-[11px] mr-0.5">edit</span>
                          note required
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {errors.reason && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">error</span>
              {errors.reason}
            </p>
          )}

          {/* ── Free-text note (required for OTHER) ─────────────────────── */}
          {selectedReason && (
            <div className="mt-4">
              <label
                htmlFor="cancel-reason-note"
                className={`block text-xs font-medium mb-1.5 ${
                  selectedReason.requires_note ? "text-amber-400" : "text-slate-400"
                }`}
              >
                {selectedReason.requires_note
                  ? "Explanation (required)"
                  : "Additional notes (optional)"}
              </label>
              <textarea
                id="cancel-reason-note"
                ref={noteRef}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (errors.note) setErrors((prev) => ({ ...prev, note: undefined }));
                }}
                rows={3}
                placeholder={
                  selectedReason.requires_note
                    ? "Please explain the reason in detail..."
                    : "Add any additional context (optional)..."
                }
                className={`
                  w-full bg-slate-800 border rounded-lg px-3 py-2 text-xs text-white
                  placeholder-slate-500 focus:outline-none resize-none transition
                  ${errors.note ? "border-red-600 focus:border-red-500" : "border-slate-700 focus:border-blue-500"}
                `}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && selectedReason.requires_note) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
              {errors.note && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">error</span>
                  {errors.note}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-800 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 bg-slate-900/80">
          <p className="text-[11px] text-slate-500">
            <span className="material-symbols-outlined text-[12px] align-text-bottom mr-0.5">info</span>
            This action cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="po-cancel-dialog-keep-btn"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition font-medium disabled:opacity-50"
            >
              Keep PO
            </button>
            <button
              type="button"
              id="po-cancel-dialog-confirm-btn"
              onClick={handleConfirm}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-[13px]">progress_activity</span>
                  Cancelling…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[13px]">cancel</span>
                  Confirm Cancel
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
