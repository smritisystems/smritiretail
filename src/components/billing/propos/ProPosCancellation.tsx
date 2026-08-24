/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { CancelledBillRecord, ProPosCartItem } from "./types.ts";
import { X, AlertTriangle, Search, ShieldAlert, CheckCircle } from "lucide-react";

interface SmritiProPosCancelDlgProps {
  onCancelBill: (record: CancelledBillRecord) => void;
  onClose: () => void;
}

const CANCELLATION_REASONS = [
  "Incorrect Item / SKU Scanned",
  "Customer Changed Mind / Refused Payment",
  "Pricing / Rate Master Error",
  "Duplicate Bill Issued in Error",
  "Payment Terminal Timeout / Failure",
  "Product Damaged at Checkout",
  "Manager Override / Return Exchange",
  "Other Operational Reason"
];

export const SmritiProPosCancelDlg: React.FC<SmritiProPosCancelDlgProps> = ({
  onCancelBill,
  onClose
}) => {
  const [billNumberInput, setBillNumberInput] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [reasonNotes, setReasonNotes] = useState<string>("");
  const [managerPin, setManagerPin] = useState<string>("");
  const [foundBill, setFoundBill] = useState<{
    billNo: string;
    customerName: string;
    amount: number;
    items: ProPosCartItem[];
    date: string;
  } | null>(null);

  const handleSearchBill = () => {
    if (!billNumberInput.trim()) return;

    // Simulate invoice lookup
    setFoundBill({
      billNo: billNumberInput.toUpperCase(),
      customerName: "Walk-in Retail Customer",
      amount: 1855.84,
      date: new Date().toLocaleDateString(),
      items: [
        {
          id: "item-1",
          itemNo: 1,
          sku: "SMRT-101",
          barcode: "8901234567890",
          name: "Classic Leather Shoe",
          size: "8",
          color: "Black",
          brand: "SMRITI",
          salesStaff: "SM1",
          qty: 1,
          mrp: 2999,
          unitPrice: 2499,
          discountPct: 0,
          discountAmt: 0,
          taxPct: 18,
          taxAmt: 381.20,
          lineTotal: 2499
        }
      ]
    });
  };

  const handleConfirmCancellation = () => {
    if (!foundBill) return;

    onCancelBill({
      id: `cancel-${Date.now()}`,
      billNo: foundBill.billNo,
      originalDate: foundBill.date,
      customerName: foundBill.customerName,
      amount: foundBill.amount,
      reasonCode: selectedReason,
      reasonNotes,
      authorizedBy: managerPin ? "Store Manager (PIN Verified)" : "Cashier Authorized",
      cancelledAt: new Date().toLocaleTimeString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#ba1a1a]/40 max-h-[88vh]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#ffdad6] dark:bg-[#93000a]/30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#ba1a1a] text-white rounded-xl shadow-xs">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#93000a] dark:text-[#ffdad6]">Void / Cancel Issued Invoice</h3>
                <span className="px-2 py-0.5 bg-[#ba1a1a] text-white rounded text-[10px] font-bold uppercase tracking-wider">
                  Audit Logged
                </span>
              </div>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">
                Cancelling an invoice reverses inventory movements and creates a void audit record.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-white/40 p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          
          {/* Invoice Search & Reason Selector */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#f8f9fa] dark:bg-[#131b2e] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653]">
            
            <div className="md:col-span-6 flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Enter Bill / Invoice Number to Cancel
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757684]" size={15} />
                  <input
                    type="text"
                    value={billNumberInput}
                    onChange={e => setBillNumberInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearchBill()}
                    placeholder="e.g. INV-2024-001 or Bill No..."
                    className="w-full pl-9 pr-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#191c1e] text-xs font-mono font-bold outline-none focus:border-[#ba1a1a]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchBill}
                  className="px-4 py-2 bg-[#ba1a1a] text-white rounded-lg text-xs font-bold hover:bg-[#93000a] transition shrink-0"
                >
                  Lookup Bill
                </button>
              </div>
            </div>

            <div className="md:col-span-6 flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Reason for Cancellation (Mandatory)
              </label>
              <select
                value={selectedReason}
                onChange={e => setSelectedReason(e.target.value)}
                className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#191c1e] text-xs font-semibold outline-none focus:border-[#ba1a1a]"
              >
                {CANCELLATION_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-8 flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Detailed Operational Notes / Customer Remark
              </label>
              <input
                type="text"
                value={reasonNotes}
                onChange={e => setReasonNotes(e.target.value)}
                placeholder="Enter remarks for audit trail..."
                className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#191c1e] text-xs outline-none focus:border-[#ba1a1a]"
              />
            </div>

            <div className="md:col-span-4 flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Manager Override PIN
              </label>
              <input
                type="password"
                value={managerPin}
                onChange={e => setManagerPin(e.target.value)}
                placeholder="4-digit PIN..."
                maxLength={6}
                className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#191c1e] text-xs font-mono text-center outline-none focus:border-[#ba1a1a]"
              />
            </div>

          </div>

          {/* Bill Preview Area */}
          {foundBill ? (
            <div className="border border-[#ba1a1a]/30 rounded-xl overflow-hidden flex flex-col flex-1 bg-white dark:bg-[#191c1e]">
              <div className="px-4 py-2 bg-[#ffdad6]/40 dark:bg-[#93000a]/20 border-b border-[#ba1a1a]/30 flex justify-between items-center text-xs">
                <span className="font-bold text-[#93000a] dark:text-[#ffdad6] font-mono">
                  PREVIEWING INVOICE: {foundBill.billNo}
                </span>
                <span className="font-mono font-bold text-sm text-[#93000a] dark:text-[#ffdad6]">
                  Total Value: ₹{foundBill.amount.toFixed(2)}
                </span>
              </div>

              <div className="overflow-y-auto max-h-44 p-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold text-[#565e74] uppercase">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Item Name</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                    {foundBill.items.map((item, idx) => (
                      <tr key={item.id} className="opacity-75">
                        <td className="p-2 font-mono text-[#757684]">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold">{item.sku}</td>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-center font-mono">{item.qty}</td>
                        <td className="p-2 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-bold">₹{item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-[#c4c5d5] rounded-xl text-[#757684] text-center">
              <Search size={32} className="opacity-30 mb-2" />
              <p className="text-xs font-semibold">Enter a Bill Number and click "Lookup Bill" to preview before voiding.</p>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#f8f9fa] dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#565e74] hover:bg-[#e7e8e9] rounded-xl transition"
          >
            Abort / Cancel
          </button>
          <button
            type="button"
            disabled={!foundBill}
            onClick={handleConfirmCancellation}
            className="px-6 py-2.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white font-bold rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-40 shadow-sm"
          >
            <AlertTriangle size={15} />
            <span>Confirm Void / Cancel Bill</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosCancelDlg;
