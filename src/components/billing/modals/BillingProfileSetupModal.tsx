/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.91.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Initial Company Billing Profile Setup Modal Component
 */

import React, { useState } from "react";
import {
  ShoppingBag,
  Building2,
  CheckCircle2,
  ShieldAlert,
  Zap,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

export interface BillingProfileSetupModalProps {
  isOpen: boolean;
  canConfigure: boolean;
  onProfileActivated: (profile: "B2C_ONLY" | "B2B_ONLY", effectiveConfig: any) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const BillingProfileSetupModal: React.FC<BillingProfileSetupModalProps> = ({
  isOpen,
  canConfigure,
  onProfileActivated,
  onNotification,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<"B2C_ONLY" | "B2B_ONLY">("B2C_ONLY");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleActivateProfile = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiFetchV1("/billing/profile/setup", {
        method: "POST",
        body: JSON.stringify({ profile: selectedProfile }),
      });
      if (res && res.configured) {
        onNotification?.(
          "Profile Activated",
          `Company billing profile successfully configured as ${selectedProfile}.`,
          "success"
        );
        onProfileActivated(res.billing_profile, res.effective_configuration);
      }
    } catch (err: any) {
      const errMsg = err?.message || "Failed to activate billing profile.";
      onNotification?.("Configuration Error", errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-3xl w-full p-6 sm:p-8 relative">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-6">
          <div className="inline-flex p-3 bg-[#00288e]/10 dark:bg-[#a8b8ff]/20 text-[#00288e] dark:text-[#a8b8ff] rounded-2xl mb-3">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1 text-slate-900 dark:text-white">
            SMRITI Billing Studio — Initial Profile Setup
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select your company's core billing profile. SMRITI automatically configures the workflow, visible fields, and cashier experience.
          </p>
        </div>

        {!canConfigure ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-center text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert size={20} className="mx-auto mb-1 text-amber-600 dark:text-amber-400" />
            <p className="font-bold">Administrator Setup Required</p>
            <p className="mt-1">
              Billing Studio has not yet been initialized for this company. Please ask an authorized Store Manager or System Administrator to select the initial billing profile.
            </p>
          </div>
        ) : (
          <div>
            {/* Profile Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Option 1: B2C_ONLY */}
              <div
                id="profile-card-b2c"
                onClick={() => setSelectedProfile("B2C_ONLY")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedProfile === "B2C_ONLY"
                    ? "border-[#00288e] bg-blue-50/40 dark:bg-blue-950/20 shadow-md ring-2 ring-[#00288e]/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#131b2e]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-xl">
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Retail / POS Billing</h3>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        B2C_ONLY
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    selectedProfile === "B2C_ONLY"
                      ? "bg-[#00288e] border-[#00288e] text-white"
                      : "border-slate-300 dark:border-slate-700"
                  }`}>
                    {selectedProfile === "B2C_ONLY" && <Check size={12} />}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Optimized for fast retail checkout counters, walk-in customers, rapid scanning, cash/UPI tender, and daily shift reconciliation.
                </p>

                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>Walk-in Customer default</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>Barcode scanner fast checkout</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>Shift Management enabled by default</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>Thermal 80mm receipt output</span>
                  </div>
                </div>
              </div>

              {/* Option 2: B2B_ONLY */}
              <div
                id="profile-card-b2b"
                onClick={() => setSelectedProfile("B2B_ONLY")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedProfile === "B2B_ONLY"
                    ? "border-[#00288e] bg-blue-50/40 dark:bg-blue-950/20 shadow-md ring-2 ring-[#00288e]/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#131b2e]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 rounded-xl">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Business / Wholesale Invoicing</h3>
                      <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                        B2B_ONLY
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    selectedProfile === "B2B_ONLY"
                      ? "bg-[#00288e] border-[#00288e] text-white"
                      : "border-slate-300 dark:border-slate-700"
                  }`}>
                    {selectedProfile === "B2B_ONLY" && <Check size={12} />}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Tailored for wholesale distribution, corporate clients, customer GSTIN verification, customer PO tracking, credit terms, and A4 tax invoices.
                </p>

                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                    <span>Registered Business Customer required</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                    <span>Customer PO Reference &amp; Credit Terms</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                    <span>Shift Management disabled by default</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                    <span>A4 Statutory Tax Invoice output</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Authorized Administrator Setup
              </span>
              <button
                type="button"
                id="activate-billing-profile-btn"
                onClick={handleActivateProfile}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-[#00288e] hover:bg-[#001f70] text-white text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <span>Activate {selectedProfile === "B2C_ONLY" ? "Retail POS (B2C)" : "Wholesale (B2B)"} Profile</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
