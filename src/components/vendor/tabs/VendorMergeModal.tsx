/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { GitMerge, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { VendorSummary } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";

interface VendorMergeModalProps {
  currentVendorId: string;
  vendorsList: VendorSummary[];
  isOpen: boolean;
  onClose: () => void;
  onMergedSuccess: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

const VendorMergeModalBase: React.FC<VendorMergeModalProps> = ({
  currentVendorId,
  vendorsList,
  isOpen,
  onClose,
  onMergedSuccess,
  onNotification,
}) => {
  const [secondaryId, setSecondaryId] = useState("");
  const [reason, setReason] = useState("DUPLICATE_CONVERGENCE");
  const [merging, setMerging] = useState(false);

  if (!isOpen) return null;

  const currentVendor = vendorsList.find((v) => v.id === currentVendorId);
  const candidateVendors = vendorsList.filter((v) => v.id !== currentVendorId);

  const handleExecuteMerge = async () => {
    if (!secondaryId) {
      onNotification?.("Validation Error", "Please select a secondary duplicate vendor to merge.", "error");
      return;
    }

    setMerging(true);
    try {
      const res = await apiFetchV1("/purchase/vendors/merge", {
        method: "POST",
        body: JSON.stringify({
          primary_vendor_id: currentVendorId,
          secondary_vendor_id: secondaryId,
          merge_reason: reason,
        }),
      });

      onNotification?.(
        "Vendor Merged",
        res?.message || "Secondary vendor successfully converged into primary vendor.",
        "success"
      );
      onMergedSuccess();
      onClose();
    } catch (err: any) {
      onNotification?.("Merge Failed", err?.message || "Failed to merge vendors.", "error");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-base">
          <GitMerge className="text-indigo-600 dark:text-indigo-400" size={20} />
          <span>Vendor Deduplication & Entity Merge</span>
        </div>

        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2.5">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-800 dark:text-amber-300">Permanent Audit Trail Notice:</span> All addresses, contacts, and bank accounts of the duplicate vendor will be linked to the surviving primary vendor. The duplicate will be marked as <span className="font-mono font-bold">MERGED</span> and retained for historical reporting.
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-400 mb-1">Surviving Primary Vendor (Retained)</label>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 font-semibold flex justify-between items-center">
              <span>{currentVendor?.legalName}</span>
              <span className="font-mono text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20 font-bold">
                {currentVendor?.code}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-400 mb-1">Duplicate Secondary Vendor to Merge (Will be marked MERGED) *</label>
            <select
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
            >
              <option value="">-- Select duplicate vendor --</option>
              {candidateVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.legalName} ({v.code}) — GSTIN: {v.gstin || "Unregistered"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-400 mb-1">Audit Justification / Merge Reason</label>
            <input
              type="text"
              data-field-key="vendor_merge_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inadvertent duplicate created during manual PO entry"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={merging}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteMerge}
            disabled={merging || !secondaryId}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow disabled:opacity-50 flex items-center space-x-1.5"
          >
            <GitMerge size={14} />
            <span>{merging ? "Merging..." : "Confirm & Execute Merge"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const VendorMergeModal = withCapability(VendorMergeModalBase, {
  entity: "vendor",
  capability: "vendor.merge",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorMergeModal;

