/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.21
 * Created      : 2026-10-27
 * Modified     : 2026-10-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Vendor Sub-Entity Double-Confirmation Deletion Protection Modal
 */

import React, { useState } from "react";
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  ShieldAlert, 
  Loader2, 
  MapPin, 
  Users, 
  CreditCard,
  Tag
} from "lucide-react";

export type DeletableEntityType = "ADDRESS" | "CONTACT" | "BANK_ACCOUNT" | "ARTICLE_ASSIGNMENT";

export interface DeleteItemPayload {
  entityType: DeletableEntityType;
  id: string;
  title: string;
  subtitle?: string;
  details: { label: string; value: string | boolean | undefined | null }[];
}

interface VendorDeleteConfirmationModalProps {
  isOpen: boolean;
  vendorName: string;
  vendorCode: string;
  item: DeleteItemPayload | null;
  onClose: () => void;
  onConfirmDelete: (item: DeleteItemPayload) => Promise<void>;
}

export const VendorDeleteConfirmationModal: React.FC<VendorDeleteConfirmationModalProps> = ({
  isOpen,
  vendorName,
  vendorCode,
  item,
  onClose,
  onConfirmDelete,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMsg(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const getEntityIcon = (type: DeletableEntityType) => {
    switch (type) {
      case "ADDRESS":
        return <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "CONTACT":
        return <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "BANK_ACCOUNT":
        return <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "ARTICLE_ASSIGNMENT":
        return <Tag className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getEntityLabel = (type: DeletableEntityType) => {
    switch (type) {
      case "ADDRESS":
        return "Dispatch / Warehouse Address";
      case "CONTACT":
        return "Key Contact Representative";
      case "BANK_ACCOUNT":
        return "Bank Payout Coordinates";
      case "ARTICLE_ASSIGNMENT":
        return "Article / Style Assignment";
    }
  };

  const handleProceedToStep2 = () => {
    setErrorMsg(null);
    setStep(2);
  };

  const handleExecuteDelete = async () => {
    setErrorMsg(null);
    setIsDeleting(true);
    try {
      await onConfirmDelete(item);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete sub-entity. Existing data has been preserved.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Step Progress Tracker Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${step === 1 ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"}`}>
              {step === 1 ? getEntityIcon(item.entityType) : <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Deletion Protection Guard
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  step === 1 
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30" 
                    : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                }`}>
                  Step {step} of 2
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {step === 1 ? `Confirm Removal of ${getEntityLabel(item.entityType)}` : "Final Confirmation: Irreversible Deletion"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <strong>Deletion Error:</strong> {errorMsg}
                <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                  Existing records in PostgreSQL were preserved and remain unmodified.
                </div>
              </div>
            </div>
          )}

          {step === 1 ? (
            <>
              {/* Step 1: Exact Detail Verification */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  Please review the exact detail below. Accidental deletions are prohibited. No changes will take effect until you complete the final confirmation in Step 2.
                </div>
              </div>

              {/* Exact Item Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      Target Entity
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    Vendor: {vendorCode}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {item.details.map((d, idx) => (
                    d.value !== undefined && d.value !== null && d.value !== "" && (
                      <div key={idx} className="flex flex-col">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {d.label}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {typeof d.value === "boolean" ? (d.value ? "Yes (Primary)" : "No") : String(d.value)}
                        </span>
                      </div>
                    )
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belongs to vendor <strong>{vendorName}</strong>. If you did not intend to delete this record, click Cancel now.
              </p>
            </>
          ) : (
            <>
              {/* Step 2: Irreversible Action Warning */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400 text-sm">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Mandatory Statutory Audit Warning</span>
                </div>
                <p>
                  You are about to permanently delete <strong>{item.title}</strong> from vendor <strong>{vendorName} ({vendorCode})</strong>.
                </p>
                <div className="rounded-lg bg-white/70 dark:bg-slate-900/60 p-2.5 border border-rose-200 dark:border-rose-900/40 text-[11px] space-y-1">
                  <div>• <strong>Compliance Audit Log:</strong> Recorded in <code>ComplianceImmutableAuditLog</code> with cryptographic SHA-256 hash chaining.</div>
                  <div>• <strong>Platform Outbox Event:</strong> Broadcast to integration consumers as a permanent removal event.</div>
                  <div>• <strong>Zero Data Loss Guarantee:</strong> If the database operation fails, the transaction is rolled back and existing data remains preserved.</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-6 py-3.5 flex items-center justify-between">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel (Keep Detail)
              </button>
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition active:scale-95"
              >
                <span>Proceed to Step 2</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Step 1</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="px-3 py-2 rounded-xl border border-transparent text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Executing Deletion...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm & Delete Permanently</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
