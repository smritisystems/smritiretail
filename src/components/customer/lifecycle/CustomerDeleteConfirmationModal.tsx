/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  PowerOff,
  X,
  Loader2,
  FileText,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { RetailCustomerRecord } from "../types";
import { CustomerDeleteEligibility } from "./types";

interface CustomerDeleteConfirmationModalProps {
  isOpen: boolean;
  customer: RetailCustomerRecord;
  onClose: () => void;
  onDeleted: (customerId: string) => void;
  onDeactivateInstead?: () => void;
  onSwitchToDeactivate?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const CustomerDeleteConfirmationModal: React.FC<CustomerDeleteConfirmationModalProps> = ({
  isOpen,
  customer,
  onClose,
  onDeleted,
  onDeactivateInstead,
  onSwitchToDeactivate,
  onNotification
}) => {
  const handleSwitchToDeactivate = onDeactivateInstead || onSwitchToDeactivate || (() => {});
  const isDraftCustomer = Boolean(customer?.id?.startsWith("cust-draft-"));
  const [eligibility, setEligibility] = useState<CustomerDeleteEligibility | null>(() => {
    if (isDraftCustomer) {
      return {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name || "Draft Account",
        status: "Draft",
        eligible: true,
        blockers: [],
        warnings: ["This customer record is a local draft and has never been saved to the database."],
        recommendation: "PERMANENT_DELETE",
        reason: "Unsaved local draft record. Safe to discard.",
        metrics: {}
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!isDraftCustomer);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmationCode, setConfirmationCode] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !customer) return;

    let isMounted = true;
    setFetchError(null);
    setConfirmationCode("");

    // If it's an unpersisted draft, it's immediately eligible
    if (customer.id.startsWith("cust-draft-")) {
      setEligibility({
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name || "Draft Account",
        status: "Draft",
        eligible: true,
        blockers: [],
        warnings: ["This customer record is a local draft and has never been saved to the database."],
        recommendation: "PERMANENT_DELETE",
        reason: "Unsaved local draft record. Safe to discard.",
        metrics: {}
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const checkEligibility = async () => {
      try {
        const res = await apiFetchV1<any>(`/crm/customers/${customer.id}/delete-eligibility`);
        if (!isMounted) return;
        setEligibility({
          customerId: res.customerId || res.customer_id || customer.id,
          customerCode: res.customerCode || res.customer_code || customer.code,
          customerName: res.customerName || res.customer_name || customer.name,
          status: res.status || customer.status || "Active",
          eligible: Boolean(res.eligible ?? res.can_delete),
          blockers: res.blockers || res.reasons || [],
          warnings: res.warnings || [],
          recommendation: res.recommendation || (res.eligible ? "PERMANENT_DELETE" : "DEACTIVATE"),
          reason: res.reason || "",
          metrics: res.metrics || res.active_dependencies || {}
        });
      } catch (err: any) {
        if (!isMounted) return;
        console.warn("[Customer Master] Delete eligibility check error:", err);
        setFetchError("Unable to verify database constraints. Hard deletion is locked as a safety precaution.");
        setEligibility({
          customerId: customer.id,
          customerCode: customer.code,
          customerName: customer.name,
          status: customer.status || "Active",
          eligible: false,
          blockers: ["Pre-flight check could not confirm zero foreign key references. Hard delete blocked."],
          warnings: [],
          recommendation: "DEACTIVATE",
          reason: "Database foreign key validation could not complete.",
          metrics: {}
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkEligibility();

    return () => {
      isMounted = false;
    };
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const targetCode = (customer.code || customer.id).trim().toUpperCase();
  const isCodeConfirmed =
    confirmationCode.trim().toUpperCase() === targetCode ||
    confirmationCode.trim().toUpperCase() === "DELETE";

  const handleExecutePermanentDelete = async () => {
    if (!eligibility?.eligible) {
      onNotification?.("Action Prohibited", "This customer cannot be permanently deleted due to active dependencies.", "error");
      return;
    }

    if (!isCodeConfirmed && !customer.id.startsWith("cust-draft-")) {
      onNotification?.("Verification Required", `Please type "${targetCode}" to confirm deletion.`, "warning");
      return;
    }

    setIsDeleting(true);
    try {
      if (!customer.id.startsWith("cust-draft-")) {
        await apiFetchV1(`/crm/customers/${customer.id}/permanent`, {
          method: "DELETE"
        });
      }
      onNotification?.("Customer Permanently Deleted", `Account "${customer.name}" (${customer.code}) was deleted from the database.`, "success");
      onDeleted(customer.id);
      onClose();
    } catch (err: any) {
      console.error("[Customer Master] Permanent delete failed:", err);
      const msg = err?.detail?.message || err?.message || "Permanent deletion was rejected by the database.";
      onNotification?.("Deletion Blocked", String(msg), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* Dialog Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${eligibility?.eligible ? "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400" : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"}`}>
              {eligibility?.eligible ? <Trash2 size={18} /> : <ShieldAlert size={18} />}
            </div>
            <div>
              <h2 id="delete-dialog-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Customer Deletion Safety Verification
              </h2>
              <p className="text-[11px] text-slate-500">
                Evaluating foreign-key constraints & statutory audit requirements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[70vh]">
          {/* Target Customer Info */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                {customer.name || "Untitled Customer"}
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Code: {customer.code || "—"} | Type: {customer.customerType || "Retail"}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              customer.status === "Active"
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}>
              {customer.status || "Active"}
            </span>
          </div>

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <Loader2 size={28} className="animate-spin text-[#00355f] dark:text-[#8ebdf9]" />
              <span className="text-xs font-medium text-slate-500">
                Checking tax invoices, sales orders, returns, and ledger balances...
              </span>
            </div>
          ) : eligibility?.eligible ? (
            /* Scenario A: Eligible for Permanent Deletion */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <ShieldCheck size={16} />
                  <span>Eligible for Permanent Deletion</span>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                  {eligibility.reason}
                </p>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Zero sales invoices • Zero purchase orders • Zero ledger transactions • Zero balances
                </div>
              </div>

              {!customer.id.startsWith("cust-draft-") && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Type customer code <span className="font-mono font-bold text-red-600">{targetCode}</span> to confirm permanent deletion:
                  </label>
                  <input
                    type="text"
                    data-field-key="delete_confirmation_code"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    placeholder={`Type ${targetCode}`}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Scenario B: Permanent Deletion Prohibited */
            <div className="space-y-4">
              <div className="p-4 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs">
                  <AlertTriangle size={16} />
                  <span>Permanent Deletion Prohibited by Governance Rules</span>
                </div>
                <p className="text-xs text-red-900/80 dark:text-red-200/80 leading-relaxed">
                  {eligibility?.reason}
                </p>

                {/* Blockers List */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-red-800 dark:text-red-300 block uppercase tracking-wider">
                    Identified Active Dependencies:
                  </span>
                  <ul className="space-y-1">
                    {eligibility?.blockers.map((blocker, idx) => (
                      <li key={idx} className="text-xs text-red-900 dark:text-red-200 flex items-start gap-1.5">
                        <span className="text-red-500 font-bold">•</span>
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Outstanding Balance Notice */}
              {eligibility?.metrics?.outstanding_balance !== undefined && Math.abs(eligibility.metrics.outstanding_balance) > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <DollarSign size={14} /> Outstanding Balance:
                  </span>
                  <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                    ₹{eligibility.metrics.outstanding_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Recommendation Callout */}
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs space-y-1">
                <span className="font-bold text-[#00355f] dark:text-[#8ebdf9] block">
                  Recommended Alternative: Deactivate Account
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Deactivation safely halts all POS billing, new sales, and credit dispatch while preserving complete historical accounting and tax reporting integrity.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Actions Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!eligibility?.eligible && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  handleSwitchToDeactivate();
                }}
                data-testid="deactivate-instead-btn"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <PowerOff size={14} />
                <span>Deactivate Customer Instead</span>
              </button>
            )}

            {eligibility?.eligible && (
              <button
                type="button"
                onClick={handleExecutePermanentDelete}
                disabled={isDeleting || (!isCodeConfirmed && !customer.id.startsWith("cust-draft-"))}
                data-testid="confirm-permanent-delete-btn"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Permanently Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
