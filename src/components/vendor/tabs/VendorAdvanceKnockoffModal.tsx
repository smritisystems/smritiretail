/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.9
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Wallet, 
  FileText, 
  Sparkles,
  Loader2,
  Receipt,
  Layers,
  Zap,
  RotateCcw
} from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";

export interface AdvanceRecord {
  id: string;
  payment_reference?: string;
  amount: number;
  unallocated_amount: number;
  payment_date?: string;
  created_at?: string;
  purchase_order_id?: string;
}

export interface BillRecord {
  id: string;
  bill_no: string;
  bill_date?: string;
  due_date?: string;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  status: string;
}

interface VendorAdvanceKnockoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorDetail;
  advances: AdvanceRecord[];
  bills: BillRecord[];
  initialAdvanceId?: string;
  initialBillId?: string;
  initialMode?: "single" | "batch";
  onSuccess: () => void;
  onSimulate?: (amount: number, advanceId: string, billId: string) => void;
  onSimulateBatch?: (allocations: { billId: string; amount: number }[], advanceId: string) => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

export const VendorAdvanceKnockoffModal: React.FC<VendorAdvanceKnockoffModalProps> = ({
  isOpen,
  onClose,
  vendor,
  advances,
  bills,
  initialAdvanceId,
  initialBillId,
  initialMode,
  onSuccess,
  onSimulate,
  onSimulateBatch,
  onNotification,
}) => {
  const eligibleAdvances = useMemo(() => {
    return advances.filter((a) => Number(a.unallocated_amount || 0) > 0.001);
  }, [advances]);

  const eligibleBills = useMemo(() => {
    return bills.filter((b) => Number(b.unpaid_amount || 0) > 0.001 && !["CANCELLED", "DRAFT"].includes(b.status.toUpperCase()));
  }, [bills]);

  // Active Mode: Single Bill (1-to-1) vs Multi-Bill Batch (1-to-N & FIFO)
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>("");
  
  // Single Bill Mode State
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [knockoffAmount, setKnockoffAmount] = useState<string>("");

  // Batch Mode State: Record of billId -> allocated amount
  const [batchAllocations, setBatchAllocations] = useState<Record<string, number>>({});

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    // Set initial mode
    if (initialMode) {
      setMode(initialMode);
    } else if (initialBillId) {
      setMode("single");
    } else if (eligibleBills.length > 1) {
      setMode("batch");
    } else {
      setMode("single");
    }

    // Pick initial advance or first available
    if (initialAdvanceId && eligibleAdvances.some((a) => a.id === initialAdvanceId)) {
      setSelectedAdvanceId(initialAdvanceId);
    } else if (eligibleAdvances.length > 0) {
      setSelectedAdvanceId(eligibleAdvances[0].id);
    } else {
      setSelectedAdvanceId("");
    }

    // Pick initial bill or first available for single mode
    if (initialBillId && eligibleBills.some((b) => b.id === initialBillId)) {
      setSelectedBillId(initialBillId);
    } else if (eligibleBills.length > 0) {
      setSelectedBillId(eligibleBills[0].id);
    } else {
      setSelectedBillId("");
    }

    // Clear batch allocations on open
    setBatchAllocations({});
  }, [isOpen, initialAdvanceId, initialBillId, initialMode, eligibleAdvances, eligibleBills]);

  const selectedAdvance = useMemo(() => {
    return eligibleAdvances.find((a) => a.id === selectedAdvanceId);
  }, [eligibleAdvances, selectedAdvanceId]);

  const selectedBill = useMemo(() => {
    return eligibleBills.find((b) => b.id === selectedBillId);
  }, [eligibleBills, selectedBillId]);

  const maxAllowedKnockoff = useMemo(() => {
    if (!selectedAdvance || !selectedBill) return 0;
    const advBal = Number(selectedAdvance.unallocated_amount || 0);
    const billBal = Number(selectedBill.unpaid_amount || 0);
    return Math.max(0, Math.min(advBal, billBal));
  }, [selectedAdvance, selectedBill]);

  // Set default amount when single selections change
  useEffect(() => {
    if (mode === "single") {
      if (maxAllowedKnockoff > 0) {
        setKnockoffAmount(maxAllowedKnockoff.toFixed(2));
      } else {
        setKnockoffAmount("");
      }
    }
  }, [maxAllowedKnockoff, mode]);

  // Batch Computations
  const totalBatchAllocated = useMemo(() => {
    return Object.values(batchAllocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [batchAllocations]);

  const unallocatedAdvanceBalance = useMemo(() => {
    return Number(selectedAdvance?.unallocated_amount || 0);
  }, [selectedAdvance]);

  const remainingAdvanceInBatch = useMemo(() => {
    return Math.max(0, unallocatedAdvanceBalance - totalBatchAllocated);
  }, [unallocatedAdvanceBalance, totalBatchAllocated]);

  const isBatchOverAllocated = totalBatchAllocated > unallocatedAdvanceBalance + 0.001;

  // 1-Click Auto FIFO Allocation
  const handleAutoFifoAllocate = () => {
    if (!selectedAdvance) return;
    setErrorMsg(null);
    let remaining = Number(selectedAdvance.unallocated_amount || 0);
    const newAllocations: Record<string, number> = {};

    // Sort bills by bill_date ascending (oldest first)
    const sortedBills = [...eligibleBills].sort((a, b) => {
      const dateA = a.bill_date ? new Date(a.bill_date).getTime() : 0;
      const dateB = b.bill_date ? new Date(b.bill_date).getTime() : 0;
      return dateA - dateB;
    });

    for (const b of sortedBills) {
      if (remaining <= 0.001) break;
      const unpaid = Number(b.unpaid_amount || 0);
      if (unpaid <= 0.001) continue;

      const alloc = Math.min(remaining, unpaid);
      newAllocations[b.id] = Math.round(alloc * 100) / 100;
      remaining -= alloc;
    }

    setBatchAllocations(newAllocations);
  };

  const handleClearBatch = () => {
    setBatchAllocations({});
    setErrorMsg(null);
  };

  const handleBatchRowChange = (billId: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    setBatchAllocations((prev) => {
      const copy = { ...prev };
      if (isNaN(val) || val <= 0) {
        delete copy[billId];
      } else {
        copy[billId] = val;
      }
      return copy;
    });
  };

  const handleBatchRowMax = (b: BillRecord) => {
    const currentAlloc = batchAllocations[b.id] || 0;
    const currentOtherTotal = totalBatchAllocated - currentAlloc;
    const remainingAdvanceForThis = Math.max(0, unallocatedAdvanceBalance - currentOtherTotal);
    const maxForThisBill = Math.min(Number(b.unpaid_amount || 0), remainingAdvanceForThis);
    
    setBatchAllocations((prev) => ({
      ...prev,
      [b.id]: Math.round(maxForThisBill * 100) / 100,
    }));
  };

  if (!isOpen) return null;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const numSingleAmount = Number(knockoffAmount) || 0;
  const isSingleValid = numSingleAmount > 0.001 && numSingleAmount <= maxAllowedKnockoff + 0.0001;
  const isBatchValid = totalBatchAllocated > 0.001 && !isBatchOverAllocated;

  // Single Bill Submit
  const handleSingleSubmit = async () => {
    if (!selectedAdvanceId || !selectedBillId) {
      setErrorMsg("Please select both an advance payment and a confirmed purchase bill.");
      return;
    }
    if (!isSingleValid) {
      setErrorMsg(`Knock-off amount must be between ₹0.01 and max eligible ${fmt(maxAllowedKnockoff)}.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    if (onSimulate) {
      onSimulate(numSingleAmount, selectedAdvanceId, selectedBillId);
      onNotification?.(
        "Advance Knock-off Complete",
        `Successfully knocked off ${fmt(numSingleAmount)} against bill ${selectedBill?.bill_no}. General ledger journal voucher JV-${Date.now().toString().slice(-6)} posted with zero cash movement.`,
        "success"
      );
      onSuccess();
      onClose();
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        supplier_id: vendor.id,
        advance_payment_id: selectedAdvanceId,
        bill_id: selectedBillId,
        amount: numSingleAmount,
      };

      const res = await apiFetchV1("/supplier-payments/advance/knockoff", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Advance Knock-off Complete",
        `Successfully knocked off ${fmt(numSingleAmount)} against bill ${selectedBill?.bill_no}. General ledger journal voucher ${res?.voucher_id || "posted"} generated with zero cash movement.`,
        "success"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.detail || err?.message || "Failed to execute supplier advance knock-off.";
      setErrorMsg(detail);
      onNotification?.("Knock-off Error", detail, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Batch Multi-Bill Submit
  const handleBatchSubmit = async () => {
    if (!selectedAdvanceId) {
      setErrorMsg("Please select an active supplier advance payment.");
      return;
    }
    if (totalBatchAllocated <= 0.001) {
      setErrorMsg("Please allocate an amount to at least one purchase bill.");
      return;
    }
    if (isBatchOverAllocated) {
      setErrorMsg(`Total allocated ${fmt(totalBatchAllocated)} exceeds available advance balance ${fmt(unallocatedAdvanceBalance)}.`);
      return;
    }

    const allocationsList = Object.entries(batchAllocations)
      .filter(([_, amt]) => amt > 0.001)
      .map(([billId, amount]) => ({
        bill_id: billId,
        amount: Math.round(amount * 100) / 100,
      }));

    setSubmitting(true);
    setErrorMsg(null);

    if (onSimulateBatch) {
      onSimulateBatch(
        allocationsList.map((a) => ({ billId: a.bill_id, amount: a.amount })),
        selectedAdvanceId
      );
      onNotification?.(
        "Batch Advance Knock-off Complete",
        `Successfully settled ${allocationsList.length} bills totaling ${fmt(totalBatchAllocated)}! Compound Journal Voucher JV-${Date.now().toString().slice(-6)} posted (DR 2010 / CR 2050). Net cash movement: ₹0.00.`,
        "success"
      );
      onSuccess();
      onClose();
      setSubmitting(false);
      return;
    }

    // Fallback if only single simulation handler is provided in standalone
    if (onSimulate && allocationsList.length > 0) {
      for (const item of allocationsList) {
        onSimulate(item.amount, selectedAdvanceId, item.bill_id);
      }
      onNotification?.(
        "Batch Advance Knock-off Complete",
        `Successfully settled ${allocationsList.length} bills totaling ${fmt(totalBatchAllocated)}! Compound Journal Voucher posted (DR 2010 / CR 2050). Net cash movement: ₹0.00.`,
        "success"
      );
      onSuccess();
      onClose();
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        supplier_id: vendor.id,
        advance_payment_id: selectedAdvanceId,
        allocations: allocationsList,
      };

      const res = await apiFetchV1("/supplier-payments/advance/batch-knockoff", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Batch Advance Knock-off Complete",
        `Successfully settled ${allocationsList.length} bills totaling ${fmt(totalBatchAllocated)}! Compound Journal Voucher ${res?.journal_voucher_id || "posted"} generated with zero cash movement.`,
        "success"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.detail || err?.message || "Failed to execute batch advance knock-off.";
      setErrorMsg(detail);
      onNotification?.("Batch Knock-off Error", detail, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "single") {
      handleSingleSubmit();
    } else {
      handleBatchSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-600/30 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Supplier Advance Knock-Off Engine
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-600/30">
                  ADR-PROC-006
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Settle trade accounts payable against pre-disbursed supplier advances with zero cash movement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Workflow Mode Tabs */}
        <div className="px-6 pt-3 pb-0 bg-slate-50/30 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("batch")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all ${
                mode === "batch"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Layers size={14} />
              <span>Multi-Bill Batch & FIFO</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                Recommended
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all ${
                mode === "single"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Receipt size={14} />
              <span>Single Bill (1-to-1)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Vendor: <strong className="text-slate-700 dark:text-slate-200">{vendor.legalName || vendor.tradeName || vendor.code}</strong></span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-600/30 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Validation Error</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Advance Prepayment Selector Row */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wallet size={15} className="text-emerald-500" />
                <span>Source Advance Prepayment (Account 2050 Liability)</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {eligibleAdvances.length} active advance credit(s) available
              </span>
            </div>

            {eligibleAdvances.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-amber-200 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-950/20 text-center text-xs text-amber-700 dark:text-amber-400">
                No unallocated advance prepayments found for this supplier.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="sm:col-span-2">
                  <select
                    value={selectedAdvanceId}
                    onChange={(e) => setSelectedAdvanceId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {eligibleAdvances.map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.payment_reference || adv.id.slice(0, 12)} — Available: {fmt(adv.unallocated_amount)} (of {fmt(adv.amount)})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedAdvance && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-[11px] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">Credit Available</div>
                      <div className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-300">
                        {fmt(selectedAdvance.unallocated_amount)}
                      </div>
                    </div>
                    {selectedAdvance.purchase_order_id && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-600/30">
                        PO Linked
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* MODE 1: MULTI-BILL BATCH ALLOCATION & FIFO                */}
          {/* ========================================================= */}
          {mode === "batch" && (
            <div className="space-y-4">
              {/* Batch Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoFifoAllocate}
                    disabled={!selectedAdvance}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Zap size={13} />
                    <span>⚡ Auto FIFO Allocate</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBatch}
                    disabled={totalBatchAllocated === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                  >
                    <RotateCcw size={12} />
                    <span>Clear</span>
                  </button>
                </div>

                {/* Progress Strip */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Allocated:</span>{" "}
                    <span className={`font-mono font-bold ${isBatchOverAllocated ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {fmt(totalBatchAllocated)}
                    </span>
                    <span className="text-slate-400"> / {fmt(unallocatedAdvanceBalance)}</span>
                  </div>
                  <div className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Remaining: {fmt(remainingAdvanceInBatch)}
                  </div>
                </div>
              </div>

              {/* Bills Allocation Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Bill Details</th>
                        <th className="py-2.5 px-3 font-semibold">Bill Date / Due</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Total Bill</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Unpaid Balance</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-40">Knock-off Amount (₹)</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {eligibleBills.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                            No open confirmed purchase bills found for this supplier.
                          </td>
                        </tr>
                      ) : (
                        eligibleBills.map((b) => {
                          const currentVal = batchAllocations[b.id] ?? "";
                          const isAllocated = Number(currentVal) > 0;
                          const isOverThisBill = Number(currentVal) > Number(b.unpaid_amount || 0);

                          return (
                            <tr
                              key={b.id}
                              className={`transition-colors ${
                                isAllocated ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                              }`}
                            >
                              <td className="py-2 px-3">
                                <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <FileText size={13} className="text-indigo-500" />
                                  {b.bill_no}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">{b.status}</span>
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                <div>{b.bill_date || "—"}</div>
                                <div className="text-[10px] text-slate-400">Due: {b.due_date || "—"}</div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                {fmt(b.total_amount)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                {fmt(b.unpaid_amount)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={b.unpaid_amount}
                                  placeholder="0.00"
                                  value={currentVal}
                                  onChange={(e) => handleBatchRowChange(b.id, e.target.value)}
                                  className={`w-full px-2.5 py-1.5 text-right rounded-lg border text-xs font-mono font-semibold focus:outline-hidden ${
                                    isOverThisBill
                                      ? "border-rose-400 bg-rose-50 text-rose-800 focus:ring-2 focus:ring-rose-400"
                                      : isAllocated
                                      ? "border-emerald-300 bg-emerald-50/50 text-emerald-900 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500"
                                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                  }`}
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleBatchRowMax(b)}
                                  className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  Max
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compound Double-Entry General Ledger Live Preview */}
              {totalBatchAllocated > 0 && (
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-emerald-600" />
                      Compound Double-Entry General Ledger Preview
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                      sum(DR) == sum(CR) Balanced
                    </span>
                  </div>

                  <div className="text-[11px] font-mono space-y-1 divide-y divide-emerald-100 dark:divide-emerald-900/40">
                    {/* Debit lines for each allocated bill */}
                    {Object.entries(batchAllocations)
                      .filter(([_, amt]) => amt > 0.001)
                      .map(([bId, amt]) => {
                        const billObj = eligibleBills.find((b) => b.id === bId);
                        return (
                          <div key={bId} className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                            <span>DR 2010 Accounts Payable ({billObj?.bill_no || bId.slice(0, 8)})</span>
                            <span className="font-bold text-slate-900 dark:text-white">{fmt(amt)}</span>
                          </div>
                        );
                      })}

                    {/* Consolidated credit line for Advance Prepayment */}
                    <div className="flex justify-between pt-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                      <span>CR 2050 Supplier Advance Liability ({selectedAdvance?.payment_reference || "Advance"})</span>
                      <span>{fmt(totalBatchAllocated)}</span>
                    </div>

                    <div className="flex justify-between pt-1 text-[10px] text-slate-500 font-sans">
                      <span>Net Cash Movement</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹0.00 (Pure Ledger Settlement)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2: SINGLE BILL (1-TO-1) WORKFLOW                     */}
          {/* ========================================================= */}
          {mode === "single" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Target Bill */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} className="text-indigo-500" />
                      Target Purchase Bill (CR 2010 AP)
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                      {eligibleBills.length} unpaid
                    </span>
                  </label>

                  {eligibleBills.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      No unpaid confirmed purchase bills available.
                    </div>
                  ) : (
                    <select
                      value={selectedBillId}
                      onChange={(e) => setSelectedBillId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      {eligibleBills.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bill_no} — Unpaid: {fmt(b.unpaid_amount)} ({b.status})
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedBill && (
                    <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-800/30 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Total Bill Value:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">{fmt(selectedBill.total_amount)}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                        <span>Current Unpaid Balance:</span>
                        <span className="font-mono">{fmt(selectedBill.unpaid_amount)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount to Knock Off */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      Knock-Off Settlement Amount (₹)
                    </span>
                    {maxAllowedKnockoff > 0 && (
                      <button
                        type="button"
                        onClick={() => setKnockoffAmount(maxAllowedKnockoff.toFixed(2))}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                      >
                        Max: {fmt(maxAllowedKnockoff)}
                      </button>
                    )}
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={maxAllowedKnockoff}
                      value={knockoffAmount}
                      onChange={(e) => setKnockoffAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="text-[10px] text-slate-400">
                    Max allowed is the smaller of unallocated advance credit and unpaid invoice balance.
                  </div>
                </div>
              </div>

              {/* Single GL Entry Preview */}
              {isSingleValid && (
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-emerald-600" />
                      General Ledger Voucher Preview
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold">
                      DR == CR Balanced
                    </span>
                  </div>

                  <div className="text-[11px] font-mono space-y-1 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>DR 2010 Accounts Payable (Sundry Creditors)</span>
                      <span className="font-bold text-slate-900 dark:text-white">{fmt(numSingleAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CR 2050 Supplier Advance Liability ({selectedAdvance?.payment_reference || "Advance"})</span>
                      <span className="font-bold text-slate-900 dark:text-white">{fmt(numSingleAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-emerald-100 dark:border-emerald-900/40 text-[10px] text-slate-500 font-sans">
                      <span>Net Cash Movement</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹0.00 (Non-Cash Settlement)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (mode === "single" ? !isSingleValid : !isBatchValid)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Posting Journal Voucher...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>
                    {mode === "single"
                      ? `Confirm Knock-Off (${fmt(numSingleAmount)})`
                      : `Confirm Batch Settlement (${fmt(totalBatchAllocated)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
