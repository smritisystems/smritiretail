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

import React, { useState } from "react";
import { PowerOff, X, AlertTriangle, Loader2, DollarSign, CheckCircle2 } from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { RetailCustomerRecord } from "../types";

interface CustomerDeactivateModalProps {
  isOpen: boolean;
  customer: RetailCustomerRecord;
  onClose: () => void;
  onDeactivated: (updated: RetailCustomerRecord) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const CustomerDeactivateModal: React.FC<CustomerDeactivateModalProps> = ({
  isOpen,
  customer,
  onClose,
  onDeactivated,
  onNotification
}) => {
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const outstanding = Number(customer.creditUsed || 0);

  const handleConfirmDeactivate = async () => {
    setIsSubmitting(true);
    try {
      let updatedRecord: RetailCustomerRecord = {
        ...customer,
        status: "Inactive",
        updatedAt: new Date().toISOString().split("T")[0]
      };

      if (!customer.id.startsWith("cust-draft-")) {
        const backendRes = await apiFetchV1<any>(`/crm/customers/${customer.id}/deactivate`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() || undefined })
        });
        if (backendRes) {
          updatedRecord = {
            ...updatedRecord,
            status: backendRes.status || "Inactive"
          };
        }
      }

      onNotification?.(
        "Account Deactivated",
        `Customer "${customer.name}" (${customer.code}) is now Inactive. New billing has been suspended.`,
        "warning"
      );
      onDeactivated(updatedRecord);
      onClose();
    } catch (err: any) {
      console.error("[Customer Master] Deactivation error:", err);
      const msg = err?.detail?.message || err?.message || "Failed to deactivate customer account.";
      onNotification?.("Deactivation Failed", String(msg), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-dialog-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <PowerOff size={18} />
            </div>
            <div>
              <h2 id="deactivate-dialog-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Deactivate Customer Account
              </h2>
              <p className="text-[11px] text-slate-500">
                Safely suspend transaction privileges while preserving history
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

        {/* Body */}
        <div className="p-6 space-y-4">
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Currently {customer.status || "Active"}
            </span>
          </div>

          {/* Operational Impact Notice */}
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
              <AlertTriangle size={15} />
              <span>Operational Impact of Deactivation</span>
            </div>
            <ul className="text-xs text-amber-900/90 dark:text-amber-200/90 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Billing Blocked:</strong> Suspends POS checkout, sales invoices, delivery challans, and new sales orders.
              </li>
              <li>
                <strong>Historical Integrity:</strong> All past invoices, credit ledgers, returns, and payment receipts are completely preserved.
              </li>
              <li>
                <strong>Reversible:</strong> You or an authorized manager may reactivate this customer at any time with a single click.
              </li>
            </ul>
          </div>

          {/* Outstanding Balance Warning if > 0 */}
          {outstanding > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between text-xs">
              <span className="font-medium text-red-800 dark:text-red-300 flex items-center gap-1.5">
                <DollarSign size={14} /> Outstanding Balance:
              </span>
              <span className="font-mono font-bold text-red-900 dark:text-red-200">
                ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Optional Reason Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Deactivation Reason (Optional):
            </label>
            <input
              type="text"
              data-field-key="deactivation_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inactive business, overdue balance, seasonal closure"
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDeactivate}
            disabled={isSubmitting}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />}
            <span>Confirm Deactivation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
