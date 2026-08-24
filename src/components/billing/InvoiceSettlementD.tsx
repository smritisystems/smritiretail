/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Distributor Invoice Settlement Studio
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  PauseCircle, 
  CreditCard,
  Banknote,
  Coins
} from "lucide-react";
import { Customer } from "../../types.ts";
import { SettlementPaymentRow, PaymentMode, CashDenominationState } from "./types.ts";

interface SmritiInvoiceSettlementModalProps {
  isOpen: boolean;
  billNo: string;
  billDate: string;
  customer: Customer | null;
  netAmount: number;
  onCompleteSettlement: (payments: SettlementPaymentRow[], totalTendered: number, changeDue: number) => void;
  onSuspendBill?: () => void;
  onClose: () => void;
}

export const SmritiInvoiceSettlementModal: React.FC<SmritiInvoiceSettlementModalProps> = ({
  isOpen,
  billNo,
  billDate,
  customer,
  netAmount,
  onCompleteSettlement,
  onSuspendBill,
  onClose
}) => {
  // Payment rows list
  const [payments, setPayments] = useState<SettlementPaymentRow[]>([]);
  
  // Denomination counters
  const [denominations, setDenominations] = useState<CashDenominationState>({
    d2000: 0,
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    coins: 0
  });

  // Initialize first row on modal open
  useEffect(() => {
    if (isOpen) {
      setPayments([
        {
          id: "pay-" + Date.now(),
          mode: "Cash",
          refNo: "",
          amount: netAmount,
          bankDetails: ""
        }
      ]);
      setDenominations({
        d2000: 0,
        d500: 0,
        d200: 0,
        d100: 0,
        d50: 0,
        d20: 0,
        d10: 0,
        coins: 0
      });
    }
  }, [isOpen, netAmount]);

  // Denominations sum calculation
  const totalDenominationAmount = useMemo(() => {
    return (
      denominations.d2000 * 2000 +
      denominations.d500 * 500 +
      denominations.d200 * 200 +
      denominations.d100 * 100 +
      denominations.d50 * 50 +
      denominations.d20 * 20 +
      denominations.d10 * 10 +
      denominations.coins
    );
  }, [denominations]);

  // Total tendered from payment rows
  const totalTendered = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  // Balance remaining or change due
  const balanceRemaining = useMemo(() => {
    return Math.max(0, netAmount - totalTendered);
  }, [netAmount, totalTendered]);

  const changeDue = useMemo(() => {
    return Math.max(0, totalTendered - netAmount);
  }, [netAmount, totalTendered]);

  // Keyboard shortcut listener (Esc, F8, F12, Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F8" || (e.key === "Enter" && e.ctrlKey)) {
        e.preventDefault();
        handleFinishSettlement();
      } else if (e.key === "F12") {
        e.preventDefault();
        if (onSuspendBill) {
          onSuspendBill();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, payments, totalTendered, netAmount]);

  if (!isOpen) return null;

  const handleAddPaymentRow = () => {
    setPayments(prev => [
      ...prev,
      {
        id: "pay-" + Date.now() + "-" + Math.random(),
        mode: "Credit Card",
        refNo: "",
        amount: balanceRemaining > 0 ? balanceRemaining : 0,
        bankDetails: ""
      }
    ]);
  };

  const handleRemovePaymentRow = (id: string) => {
    if (payments.length <= 1) return;
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const handlePaymentChange = (id: string, field: keyof SettlementPaymentRow, val: any) => {
    setPayments(prev =>
      prev.map(p => {
        if (p.id === id) {
          return { ...p, [field]: val };
        }
        return p;
      })
    );
  };

  const handleApplyDenominationsToCash = () => {
    if (totalDenominationAmount <= 0) return;
    setPayments(prev => {
      const cashIdx = prev.findIndex(p => p.mode === "Cash");
      if (cashIdx >= 0) {
        const updated = [...prev];
        updated[cashIdx] = { ...updated[cashIdx], amount: totalDenominationAmount };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: "pay-denom-" + Date.now(),
            mode: "Cash",
            refNo: "",
            amount: totalDenominationAmount,
            bankDetails: "Denomination Counted"
          }
        ];
      }
    });
  };

  const handleFinishSettlement = () => {
    if (totalTendered < netAmount) {
      alert(`Payment is incomplete. Remaining balance: ₹${(netAmount - totalTendered).toFixed(2)}`);
      return;
    }
    onCompleteSettlement(payments, totalTendered, changeDue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-5xl border border-outline-variant flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="bg-surface-container-lowest px-6 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-lg font-bold text-primary">Settlement / Payment</h1>
            <span className="px-2.5 py-0.5 bg-surface-container-highest text-primary font-bold rounded font-code-md text-xs border border-outline-variant">
              {billNo || "INV-NEW"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors rounded p-1.5 hover:bg-error-container"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Split View */}
        <div className="flex-1 flex flex-col md:flex-row gap-gutter p-margin-page overflow-y-auto bg-surface-container-low">
          
          {/* Left Column: Invoice Summary + Payment Entry Grid */}
          <div className="flex-1 flex flex-col gap-stack-gap min-w-0">
            
            {/* Invoice Summary Card */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded p-4 shadow-xs">
              <h2 className="font-title-sm text-xs font-bold text-primary uppercase border-b border-outline-variant pb-1.5 mb-3 tracking-wider">
                Invoice Summary
              </h2>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant mb-1 uppercase">Bill No.</label>
                  <div className="font-code-md text-xs text-on-surface bg-surface-container-low border border-outline-variant px-2.5 py-1.5 rounded font-bold truncate">
                    {billNo || "INV-NEW"}
                  </div>
                </div>
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant mb-1 uppercase">Date &amp; Time</label>
                  <div className="font-code-md text-xs text-on-surface bg-surface-container-low border border-outline-variant px-2.5 py-1.5 rounded truncate">
                    {billDate || new Date().toLocaleDateString("en-GB")}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant mb-1 uppercase">Customer Name</label>
                  <div className="font-body-md text-xs text-on-surface bg-surface-container-low border border-outline-variant px-2.5 py-1.5 rounded truncate font-medium">
                    {customer?.name || "Counter Cash Sale"}
                  </div>
                </div>
              </div>
            </section>

            {/* Payment Entry Grid */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded flex flex-col flex-1 shadow-xs overflow-hidden">
              <div className="bg-surface-container-low border-b border-outline-variant p-3 flex justify-between items-center shrink-0">
                <h2 className="font-title-sm text-xs font-bold text-primary uppercase tracking-wider">
                  Payment Entry Grid
                </h2>
                <button
                  type="button"
                  onClick={handleAddPaymentRow}
                  className="px-3 py-1 bg-primary text-on-primary border border-outline-variant rounded hover:bg-primary-container transition-colors font-body-sm text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Add Row</span>
                </button>
              </div>

              <div className="overflow-x-auto flex-1 p-2">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-high sticky top-0 z-10 border-b border-outline-variant font-label-caps text-[11px] text-on-surface-variant font-bold">
                    <tr>
                      <th className="py-2 px-3 w-1/4 border-r border-outline-variant">Mode</th>
                      <th className="py-2 px-3 w-1/4 border-r border-outline-variant">Reference No.</th>
                      <th className="py-2 px-3 w-1/4 text-right border-r border-outline-variant">Amount</th>
                      <th className="py-2 px-3 w-1/4 border-r border-outline-variant">Bank / Details</th>
                      <th className="py-2 px-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="font-body-sm text-xs divide-y divide-outline-variant/40">
                    {payments.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-1.5 border-r border-outline-variant">
                          <select
                            value={p.mode}
                            onChange={e => handlePaymentChange(p.id, "mode", e.target.value as PaymentMode)}
                            className="w-full border border-outline-variant rounded bg-surface px-2 py-1 text-xs font-medium focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Debit Card">Debit Card</option>
                            <option value="UPI">UPI</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Credit Note">Credit Note</option>
                          </select>
                        </td>
                        <td className="p-1.5 border-r border-outline-variant">
                          <input
                            type="text"
                            value={p.refNo}
                            onChange={e => handlePaymentChange(p.id, "refNo", e.target.value)}
                            placeholder="e.g. TXN99824"
                            className="w-full border border-outline-variant rounded bg-surface px-2 py-1 font-code-md text-xs focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                          />
                        </td>
                        <td className="p-1.5 border-r border-outline-variant">
                          <input
                            type="number"
                            step="0.01"
                            value={p.amount}
                            onChange={e => handlePaymentChange(p.id, "amount", parseFloat(e.target.value) || 0)}
                            className="w-full border border-outline-variant rounded bg-surface px-2 py-1 text-right font-code-md text-xs font-bold focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                          />
                        </td>
                        <td className="p-1.5 border-r border-outline-variant">
                          <input
                            type="text"
                            value={p.bankDetails}
                            onChange={e => handlePaymentChange(p.id, "bankDetails", e.target.value)}
                            placeholder="e.g. HDFC Pos 01"
                            className="w-full border border-outline-variant rounded bg-surface px-2 py-1 text-xs focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePaymentRow(p.id)}
                            disabled={payments.length <= 1}
                            className="text-on-surface-variant hover:text-error disabled:opacity-30 transition-colors p-1"
                            title="Remove Payment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>

          {/* Right Column: Calculation Breakdown & Denomination Counter */}
          <div className="w-full md:w-96 flex flex-col gap-stack-gap shrink-0">
            
            {/* Calculation Breakdown Card */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded p-4 shadow-xs">
              <h2 className="font-title-sm text-xs font-bold text-primary uppercase border-b border-outline-variant pb-1.5 mb-3 tracking-wider">
                Calculation Breakdown
              </h2>
              
              <div className="flex flex-col gap-2.5 font-body-sm text-xs">
                <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                  <span className="text-on-surface-variant font-medium">Bill Amount</span>
                  <span className="font-code-md text-sm font-bold text-primary">₹{netAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                  <span className="text-on-surface-variant font-medium">Total Tendered</span>
                  <span className="font-code-md text-sm font-bold text-secondary">₹{totalTendered.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                  <span className="text-on-surface-variant font-medium">
                    {totalTendered >= netAmount ? "Change Due" : "Balance Due"}
                  </span>
                  <span className={`font-code-md text-sm font-bold ${
                    totalTendered >= netAmount ? "text-green-600" : "text-error"
                  }`}>
                    ₹{(totalTendered >= netAmount ? changeDue : balanceRemaining).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-on-surface-variant font-medium">Round Off</span>
                  <span className="font-code-md text-xs text-on-surface">₹0.00</span>
                </div>
              </div>
            </section>

            {/* Denomination Counter Card */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded p-3.5 shadow-xs flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-outline-variant pb-1.5">
                <h2 className="font-title-sm text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote size={14} className="text-secondary" />
                  <span>Denomination Counter</span>
                </h2>
                <span className="font-code-md text-xs font-bold text-primary bg-secondary-fixed px-2 py-0.5 rounded">
                  ₹{totalDenominationAmount.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "2000", key: "d2000", val: 2000 },
                  { label: "500", key: "d500", val: 500 },
                  { label: "200", key: "d200", val: 200 },
                  { label: "100", key: "d100", val: 100 },
                  { label: "50", key: "d50", val: 50 },
                  { label: "20", key: "d20", val: 20 },
                  { label: "10", key: "d10", val: 10 },
                  { label: "Coins", key: "coins", val: 1 }
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded border border-outline-variant">
                    <span className="font-code-md text-[11px] font-bold text-on-surface w-10">₹{item.label}</span>
                    <span className="text-on-surface-variant text-[10px]">×</span>
                    <input
                      type="number"
                      min="0"
                      value={(denominations as any)[item.key] || ""}
                      placeholder="0"
                      onChange={e => {
                        const count = parseInt(e.target.value) || 0;
                        setDenominations(prev => ({ ...prev, [item.key]: count }));
                      }}
                      className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-right font-code-md text-xs font-bold focus:border-secondary outline-none"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleApplyDenominationsToCash}
                disabled={totalDenominationAmount <= 0}
                className="mt-1 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant py-1.5 px-3 rounded text-xs font-bold transition disabled:opacity-40"
              >
                Apply Cash Count (₹{totalDenominationAmount.toFixed(2)})
              </button>
            </section>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              <button
                type="button"
                onClick={handleFinishSettlement}
                className="w-full bg-primary hover:bg-primary-container text-on-primary font-title-sm text-sm font-bold py-2.5 px-4 rounded shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                <span>Complete Settlement (F8 / Enter)</span>
              </button>

              <div className="flex gap-2">
                {onSuspendBill && (
                  <button
                    type="button"
                    onClick={() => {
                      onSuspendBill();
                      onClose();
                    }}
                    className="flex-1 bg-surface-container hover:bg-surface-container-high text-primary border border-outline-variant font-title-sm text-xs font-semibold py-2 px-3 rounded transition flex items-center justify-center gap-1.5"
                  >
                    <PauseCircle size={15} />
                    <span>Hold / Suspend (F12)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-surface-container hover:bg-error-container hover:text-on-error-container text-error border border-error/50 font-title-sm text-xs font-semibold py-2 px-3 rounded transition"
                >
                  Cancel (Esc)
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default SmritiInvoiceSettlementModal;
