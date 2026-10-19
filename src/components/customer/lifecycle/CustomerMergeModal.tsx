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

import React, { useState, useEffect, useMemo } from "react";
import {
  GitMerge,
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
  Loader2,
  Building2,
  CheckCircle2,
  ArrowRight,
  FileText
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { RetailCustomerRecord } from "../types";
import { CustomerMergeResult } from "./types";

interface CustomerMergeModalProps {
  isOpen: boolean;
  targetCustomer: RetailCustomerRecord;
  onClose: () => void;
  onMerged: (result: CustomerMergeResult) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface CustomerSearchResult {
  id: string;
  code?: string;
  name: string;
  pan?: string;
  pan_number?: string;
  gstin?: string;
  gst_number?: string;
  mobile?: string;
  email?: string;
  city?: string;
  status?: string;
  outstanding?: number;
}

export const CustomerMergeModal: React.FC<CustomerMergeModalProps> = ({
  isOpen,
  targetCustomer,
  onClose,
  onMerged,
  onNotification
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<CustomerSearchResult | null>(null);
  const [mergeReason, setMergeReason] = useState<string>("Corporate account consolidation");
  const [confirmationKeyword, setConfirmationKeyword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedSource(null);
      setMergeReason("Corporate account consolidation");
      setConfirmationKeyword("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Debounced search for candidate source customers
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetchV1<CustomerSearchResult[]>(`/crm/customers/search?q=${encodeURIComponent(trimmed)}&limit=10&status=all`);
        // Filter out target customer
        const filtered = (res || []).filter((c: CustomerSearchResult) => c.id !== targetCustomer.id);
        setSearchResults(filtered);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, targetCustomer.id]);

  // PAN evaluation
  const targetPan = useMemo(() => {
    return (targetCustomer.panNumber || (targetCustomer as any).pan || "").trim().toUpperCase();
  }, [targetCustomer]);

  const sourcePan = useMemo(() => {
    if (!selectedSource) return "";
    return (selectedSource.pan_number || selectedSource.pan || "").trim().toUpperCase();
  }, [selectedSource]);

  const panEvaluation = useMemo(() => {
    if (!selectedSource) return null;
    if (targetPan && sourcePan) {
      if (targetPan === sourcePan) {
        return {
          valid: true,
          status: "MATCH",
          message: `BD-2 PAN Parity Verified: Target and Source hold matching PAN (${targetPan}). Safe to consolidate.`
        };
      } else {
        return {
          valid: false,
          status: "MISMATCH",
          message: `BD-2 PAN Parity Violation: Source PAN (${sourcePan}) does not match Target PAN (${targetPan}). Indian statutory governance prohibits merging entities across distinct legal PAN identities.`
        };
      }
    }
    if (!targetPan && sourcePan) {
      return {
        valid: true,
        status: "ADOPT_SOURCE",
        message: `Target PAN is unassigned. Master profile will adopt Source PAN (${sourcePan}).`
      };
    }
    if (targetPan && !sourcePan) {
      return {
        valid: true,
        status: "RETAIN_TARGET",
        message: `Source has no PAN on record. Master profile retains existing Target PAN (${targetPan}).`
      };
    }
    return {
      valid: true,
      status: "NO_PAN",
      message: `Neither account carries a registered PAN. Consolidation requires manual manager authorization.`
    };
  }, [selectedSource, targetPan, sourcePan]);

  const isMergeReady = Boolean(
    selectedSource &&
    panEvaluation?.valid &&
    confirmationKeyword.trim() === "MERGE" &&
    !isSubmitting
  );

  const handleExecuteMerge = async () => {
    if (!isMergeReady || !selectedSource) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await apiFetchV1<CustomerMergeResult>("/crm/customers/merge", {
        method: "POST",
        body: JSON.stringify({
          targetCustomerId: targetCustomer.id,
          sourceCustomerId: selectedSource.id,
          reason: mergeReason.trim() || "Corporate BD-2 Consolidation"
        })
      });

      onNotification?.(
        "Account Consolidated",
        response.message || `Customer '${selectedSource.name}' merged successfully into '${targetCustomer.name}'.`,
        "success"
      );
      onMerged(response);
      onClose();
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || "Failed to execute customer merge.";
      const errorStr = typeof detail === "object" ? JSON.stringify(detail) : String(detail);
      setErrorMessage(errorStr);
      onNotification?.("Merge Failed", errorStr, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        data-testid="customer-merge-modal"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <GitMerge size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Consolidate / Merge Corporate Customer Account
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                  BD-2
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Absorb a duplicate or subsidiary account into this authoritative master profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-xs">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Target Master Display */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Surviving Master Account (Target)
              </span>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                {targetCustomer.code}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {targetCustomer.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
                  <span>PAN: <strong className="font-mono text-slate-700 dark:text-slate-300">{targetPan || "Not on file"}</strong></span>
                  <span>GSTIN: <strong className="font-mono text-slate-700 dark:text-slate-300">{targetCustomer.gstin || "Multi-State"}</strong></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Outstanding Balance</div>
                <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                  ₹{Number(targetCustomer.creditUsed || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Source Customer Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Select Duplicate / Subsidiary Account to Absorb (Source)
            </label>

            {!selectedSource ? (
              <div className="relative">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate customer by Name, Code, PAN, or Mobile..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 divide-y divide-slate-100 dark:divide-slate-800">
                    {searchResults.map((cust) => {
                      const cPan = (cust.pan_number || cust.pan || "").toUpperCase();
                      const isMatch = targetPan && cPan && targetPan === cPan;
                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            setSelectedSource(cust);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              {cust.name}
                              {isMatch && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                                  PAN Match
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {cust.code || cust.id} • PAN: {cPan || "—"} • {cust.mobile || "No Mobile"}
                            </div>
                          </div>
                          <div className="text-right font-mono text-slate-600 dark:text-slate-300 text-xs">
                            ₹{Number(cust.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 relative">
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  className="absolute right-3 top-3 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
                  title="Choose different customer"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Building2 size={14} /> Account Being Absorbed & Retired (Source)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 pr-6">
                    {selectedSource.code || selectedSource.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {selectedSource.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
                      <span>PAN: <strong className="font-mono text-slate-700 dark:text-slate-300">{sourcePan || "Not on file"}</strong></span>
                      <span>City: <strong>{selectedSource.city || "—"}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Receivables Transfer</div>
                    <div className="text-sm font-extrabold font-mono text-amber-700 dark:text-amber-400">
                      +₹{Number(selectedSource.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* PAN Evaluation Banner */}
                {panEvaluation && (
                  <div
                    className={`mt-3 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      panEvaluation.valid
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {panEvaluation.valid ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    )}
                    <div className="flex-1 font-medium">{panEvaluation.message}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Merge Parameters */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Consolidation
              </label>
              <input
                type="text"
                value={mergeReason}
                onChange={(e) => setMergeReason(e.target.value)}
                placeholder="e.g. Reliance Retail corporate master deduplication"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Impact disclosure callout */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-500" /> Operational & Audit Impact
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Reassigns all historical Tax Invoices, Sales Orders, and Credit Ledgers to master account.</li>
                <li>Transfers multi-state delivery network and resolves store code collisions.</li>
                <li>Consolidates net outstanding balances into surviving master profile.</li>
                <li>Permanently soft-retires source account (<code className="font-mono">status = &quot;Merged&quot;</code>).</li>
                <li>Appends cryptographic SHA-256 audit block to regulatory immutable ledger.</li>
              </ul>
            </div>

            {/* Confirmation Keyword Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="font-mono text-red-600 dark:text-red-400 font-extrabold">MERGE</span> to confirm consolidation
              </label>
              <input
                type="text"
                value={confirmationKeyword}
                onChange={(e) => setConfirmationKeyword(e.target.value)}
                placeholder="Type MERGE"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold tracking-wider"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={!isMergeReady}
            data-testid="confirm-execute-merge-btn"
            className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Consolidating...</span>
              </>
            ) : (
              <>
                <GitMerge size={14} />
                <span>Confirm & Execute Merge</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
