/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-06
 * Modified     : 2026-10-06
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — DataBridge Commit Confirmation Component
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import React from "react";
import { DataBridgeSummary } from "./databridgeTypes.ts";

interface CommitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  summary: DataBridgeSummary;
  canCommit: boolean;
  blockingReasons: string[];
  isSubmitting?: boolean;
}

export const CommitConfirmationModal: React.FC<CommitConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  summary,
  canCommit,
  blockingReasons,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  const totalBlockingIssues =
    summary.conflict_count + summary.validation_error_count + summary.dependency_error_count;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-3 bg-slate-50">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              canCommit ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {canCommit ? "warning" : "block"}
            </span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {canCommit ? "Ready to Import" : "Import Blocked"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {canCommit
                ? "Please review the summary carefully before confirming changes."
                : "Resolve blocking conflicts and errors before importing."}
            </p>
          </div>
        </div>

        {/* Breakdown Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-lg font-black text-emerald-700 block">
                {summary.create_count.toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block mt-0.5">
                New Records
              </span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-lg font-black text-blue-700 block">
                {summary.update_count.toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider block mt-0.5">
                Existing to Update
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-lg font-black text-slate-700 block">
                {summary.no_change_count.toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mt-0.5">
                Unchanged
              </span>
            </div>
          </div>

          {canCommit ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                  check_circle
                </span>
                <span className="font-semibold">No blocking issues found.</span>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                <span className="font-bold block mb-0.5">⚠️ Final Confirmation Warning:</span>
                This action will modify your live catalog data. Changes will be audited in compliance logs.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
                <span>
                  {totalBlockingIssues} issue{totalBlockingIssues !== 1 ? "s" : ""} must be resolved before import.
                </span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-rose-700 pl-1">
                {blockingReasons.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="text-[11px] text-rose-600 italic">
                SMRITI Commit Guard blocks execution to protect catalog consistency.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canCommit || isSubmitting}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              canCommit && !isSubmitting
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span>Processing Import...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">publish</span>
                <span>Confirm Import</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
