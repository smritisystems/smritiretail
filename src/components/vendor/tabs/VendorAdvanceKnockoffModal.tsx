/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.8
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
  Receipt
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
  onSuccess: () => void;
  onSimulate?: (amount: number, advanceId: string, billId: string) => void;
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
  onSuccess,
  onSimulate,
  onNotification,
}) => {
  const eligibleAdvances = useMemo(() => {
    return advances.filter((a) => Number(a.unallocated_amount || 0) > 0.001);
  }, [advances]);

  const eligibleBills = useMemo(() => {
    return bills.filter((b) => Number(b.unpaid_amount || 0) > 0.001 && !["CANCELLED", "DRAFT"].includes(b.status.toUpperCase()));
  }, [bills]);

  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>("");
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [knockoffAmount, setKnockoffAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    // Pick initial advance or first available
    if (initialAdvanceId && eligibleAdvances.some((a) => a.id === initialAdvanceId)) {
      setSelectedAdvanceId(initialAdvanceId);
    } else if (eligibleAdvances.length > 0) {
      setSelectedAdvanceId(eligibleAdvances[0].id);
    } else {
      setSelectedAdvanceId("");
    }

    // Pick initial bill or first available
    if (initialBillId && eligibleBills.some((b) => b.id === initialBillId)) {
      setSelectedBillId(initialBillId);
    } else if (eligibleBills.length > 0) {
      setSelectedBillId(eligibleBills[0].id);
    } else {
      setSelectedBillId("");
    }
  }, [isOpen, initialAdvanceId, initialBillId, eligibleAdvances, eligibleBills]);

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

  // Set default amount when selections change
  useEffect(() => {
    if (maxAllowedKnockoff > 0) {
      setKnockoffAmount(maxAllowedKnockoff.toFixed(2));
    } else {
      setKnockoffAmount("");
    }
  }, [maxAllowedKnockoff]);

  if (!isOpen) return null;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const numAmount = Number(knockoffAmount) || 0;
  const isAmountValid = numAmount > 0.001 && numAmount <= maxAllowedKnockoff + 0.0001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvanceId || !selectedBillId) {
      setErrorMsg("Please select both an advance payment and a confirmed purchase bill.");
      return;
    }
    if (!isAmountValid) {
      setErrorMsg(`Knock-off amount must be between ₹0.01 and max eligible ${fmt(maxAllowedKnockoff)}.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    if (onSimulate) {
      onSimulate(numAmount, selectedAdvanceId, selectedBillId);
      onNotification?.(
        "Advance Knock-off Complete",
        `Successfully knocked off ${fmt(numAmount)} against bill ${selectedBill?.bill_no}. General ledger journal voucher JV-${Date.now().toString().slice(-6)} posted with zero cash movement.`,
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
        amount: numAmount,
      };

      const res = await apiFetchV1("/supplier-payments/advance/knockoff", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Advance Knock-off Complete",
        `Successfully knocked off ${fmt(numAmount)} against bill ${selectedBill?.bill_no}. General ledger journal voucher ${res?.voucher_id || "posted"} generated with zero cash movement.`,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-600/30 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                1-Click Supplier Advance Knock-Off
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-600/30">
                  ADR-PROC-005
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-600/30 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Knock-off Validation Error</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Vendor Summary Banner */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Vendor:</span>{" "}
              <span className="font-bold text-slate-900 dark:text-white">{vendor.legalName || vendor.tradeName || vendor.code}</span>{" "}
              <span className="text-slate-400 font-mono">({vendor.code})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">Trade AP Outstanding:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {fmt(vendor.commercial?.outstandingLiability ?? 0)}
              </span>
            </div>
          </div>

          {/* Selections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Select Advance */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Wallet size={14} className="text-emerald-500" />
                  1. Source Advance Prepayment (DR 2050)
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                  {eligibleAdvances.length} available
                </span>
              </label>

              {eligibleAdvances.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-950/20 text-center text-xs text-amber-700 dark:text-amber-400">
                  No unallocated advance payments found for this supplier.
                </div>
              ) : (
                <select
                  value={selectedAdvanceId}
                  onChange={(e) => setSelectedAdvanceId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {eligibleAdvances.map((adv) => (
                    <option key={adv.id} value={adv.id}>
                      {adv.payment_reference || adv.id.slice(0, 12)} — Avail: {fmt(adv.unallocated_amount)} (of {fmt(adv.amount)})
                    </option>
                  ))}
                </select>
              )}

              {selectedAdvance && (
                <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-800/30 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Disbursed Advance:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{fmt(selectedAdvance.amount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                    <span>Unallocated Credit Available:</span>
                    <span className="font-mono">{fmt(selectedAdvance.unallocated_amount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select Purchase Bill */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-rose-500" />
                  2. Target Confirmed Bill (DR 2010 AP)
                </span>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-normal">
                  {eligibleBills.length} unpaid
                </span>
              </label>

              {eligibleBills.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-center text-xs text-slate-500 dark:text-slate-400">
                  No open unpaid purchase bills found for this supplier.
                </div>
              ) : (
                <select
                  value={selectedBillId}
                  onChange={(e) => setSelectedBillId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {eligibleBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bill_no} — Due: {fmt(b.unpaid_amount)} (Total: {fmt(b.total_amount)})
                    </option>
                  ))}
                </select>
              )}

              {selectedBill && (
                <div className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-800/30 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Total Bill Amount:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{fmt(selectedBill.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 dark:text-rose-400 font-bold">
                    <span>Unpaid Bill Balance:</span>
                    <span className="font-mono">{fmt(selectedBill.unpaid_amount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Knock-off Amount */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                3. Knock-Off Amount to Settle
              </label>
              <button
                type="button"
                onClick={() => setKnockoffAmount(maxAllowedKnockoff.toFixed(2))}
                disabled={maxAllowedKnockoff <= 0}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
              >
                Max Eligible ({fmt(maxAllowedKnockoff)})
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAllowedKnockoff}
                value={knockoffAmount}
                onChange={(e) => setKnockoffAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Allowed limit: ₹0.01 to {fmt(maxAllowedKnockoff)}</span>
              {numAmount > 0 && selectedBill && (
                <span>
                  Remaining Bill Balance:{" "}
                  <strong className="font-mono text-slate-700 dark:text-slate-300">
                    {fmt(Math.max(0, Number(selectedBill.unpaid_amount) - numAmount))}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* Step 4: Authoritative General Ledger Preview */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-linear-to-br from-slate-50 to-white dark:from-slate-900/60 dark:to-slate-800/40 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-500" />
                Double-Entry General Ledger Impact (ADR-PROC-005)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40">
                Voucher Type: JOURNAL
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DEBIT (Dr)</div>
                <div className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {fmt(numAmount)}
                </div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                  2010 - Accounts Payable (AP)
                </div>
                <div className="text-[10px] text-slate-400">Reduces trade liability owed to vendor</div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CREDIT (Cr)</div>
                <div className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {fmt(numAmount)}
                </div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                  2050 - Supplier Advance Liability
                </div>
                <div className="text-[10px] text-slate-400">Consumes pre-disbursed prepayment</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={13} />
                Double-Entry Balance: sum(DR) == sum(CR)
              </span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                Net Cash Movement: ₹0.00 (Pure Ledger Knock-off)
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isAmountValid || !selectedAdvanceId || !selectedBillId}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Posting Journal Knock-off...</span>
                </>
              ) : (
                <>
                  <span>Post Knock-off Voucher ({fmt(numAmount)})</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorAdvanceKnockoffModal;
