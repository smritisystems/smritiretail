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

import React, { useState, useMemo, useEffect } from "react";
import { ProPosCustomer, ProPosTenderSplit } from "./types.ts";
import { 
  X, 
  Printer, 
  CreditCard, 
  QrCode, 
  Banknote, 
  Gift, 
  Award, 
  FileText, 
  Delete,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface SmritiProPosSettlementModalProps {
  netAmount: number;
  customer?: ProPosCustomer;
  onSettle: (tenders: ProPosTenderSplit, changeDue: number) => void;
  onClose: () => void;
}

type TenderMode = "CASH" | "CARD" | "UPI" | "GIFT_VOUCHER" | "LOYALTY" | "CREDIT_NOTE";

interface AppliedPayment {
  id: string;
  mode: TenderMode;
  label: string;
  subLabel: string;
  amount: number;
  reference?: string;
}

export const SmritiProPosSettlementModal: React.FC<SmritiProPosSettlementModalProps> = ({
  netAmount,
  customer,
  onSettle,
  onClose
}) => {
  const [selectedMode, setSelectedMode] = useState<TenderMode>("CASH");
  const [keypadInput, setKeypadInput] = useState<string>("");
  const [appliedPayments, setAppliedPayments] = useState<AppliedPayment[]>([]);
  const [cardAuthCode, setCardAuthCode] = useState<string>("");
  const [upiRefNo, setUpiRefNo] = useState<string>("");
  const [voucherCode, setVoucherCode] = useState<string>("");

  const totalPaid = useMemo(() => {
    return appliedPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [appliedPayments]);

  const balanceRemaining = useMemo(() => {
    return Math.max(0, netAmount - totalPaid);
  }, [netAmount, totalPaid]);

  const changeDue = useMemo(() => {
    return Math.max(0, totalPaid - netAmount);
  }, [totalPaid, netAmount]);

  // Set default keypad input to remaining balance when mode changes
  useEffect(() => {
    if (balanceRemaining > 0) {
      setKeypadInput(balanceRemaining.toFixed(2));
    } else {
      setKeypadInput("");
    }
  }, [selectedMode, balanceRemaining]);

  const handleKeypadDigit = (digit: string) => {
    setKeypadInput(prev => {
      if (digit === "." && prev.includes(".")) return prev;
      if (prev === "0" && digit !== ".") return digit;
      return prev + digit;
    });
  };

  const handleKeypadBackspace = () => {
    setKeypadInput(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setKeypadInput("");
  };

  const handleAddPayment = () => {
    const amt = parseFloat(keypadInput);
    if (isNaN(amt) || amt <= 0) return;

    let subLabel = "Standard";
    let ref = "";

    if (selectedMode === "CARD") {
      subLabel = cardAuthCode ? `Auth: ${cardAuthCode}` : "Card Swiped";
      ref = cardAuthCode;
    } else if (selectedMode === "UPI") {
      subLabel = upiRefNo ? `Ref: ${upiRefNo}` : "Dynamic QR Paid";
      ref = upiRefNo;
    } else if (selectedMode === "GIFT_VOUCHER") {
      subLabel = voucherCode ? `Code: ${voucherCode}` : "Voucher Applied";
      ref = voucherCode;
    } else if (selectedMode === "LOYALTY") {
      subLabel = `${customer?.loyaltyPoints || 0} pts available`;
    }

    const newPayment: AppliedPayment = {
      id: `pay-${Date.now()}`,
      mode: selectedMode,
      label: selectedMode === "CASH" ? "Cash" : selectedMode === "CARD" ? "Credit/Debit Card" : selectedMode === "UPI" ? "UPI / Instant QR" : selectedMode === "GIFT_VOUCHER" ? "Gift Voucher" : selectedMode === "LOYALTY" ? "Loyalty Redemption" : "Credit Note",
      subLabel,
      amount: amt,
      reference: ref
    };

    setAppliedPayments(prev => [...prev, newPayment]);
    setKeypadInput("");
    setCardAuthCode("");
    setUpiRefNo("");
    setVoucherCode("");
  };

  const handleRemovePayment = (id: string) => {
    setAppliedPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleFinalSettle = () => {
    if (totalPaid < netAmount && selectedMode === "CASH") {
      // Auto-fill cash if full amount tendered
      const diff = netAmount - totalPaid;
      const cashTotal = appliedPayments.filter(p => p.mode === "CASH").reduce((a, b) => a + b.amount, 0) + diff;
      const cardTotal = appliedPayments.filter(p => p.mode === "CARD").reduce((a, b) => a + b.amount, 0);
      const upiTotal = appliedPayments.filter(p => p.mode === "UPI").reduce((a, b) => a + b.amount, 0);
      const voucherTotal = appliedPayments.filter(p => p.mode === "GIFT_VOUCHER").reduce((a, b) => a + b.amount, 0);
      const loyaltyTotal = appliedPayments.filter(p => p.mode === "LOYALTY").reduce((a, b) => a + b.amount, 0);
      const creditNoteTotal = appliedPayments.filter(p => p.mode === "CREDIT_NOTE").reduce((a, b) => a + b.amount, 0);

      onSettle({
        cash: cashTotal,
        card: cardTotal,
        upi: upiTotal,
        giftVoucher: voucherTotal,
        loyaltyPointsRedeemed: 0,
        loyaltyAmount: loyaltyTotal,
        creditNote: creditNoteTotal
      }, 0);
      return;
    }

    const cashTotal = appliedPayments.filter(p => p.mode === "CASH").reduce((a, b) => a + b.amount, 0);
    const cardTotal = appliedPayments.filter(p => p.mode === "CARD").reduce((a, b) => a + b.amount, 0);
    const upiTotal = appliedPayments.filter(p => p.mode === "UPI").reduce((a, b) => a + b.amount, 0);
    const voucherTotal = appliedPayments.filter(p => p.mode === "GIFT_VOUCHER").reduce((a, b) => a + b.amount, 0);
    const loyaltyTotal = appliedPayments.filter(p => p.mode === "LOYALTY").reduce((a, b) => a + b.amount, 0);
    const creditNoteTotal = appliedPayments.filter(p => p.mode === "CREDIT_NOTE").reduce((a, b) => a + b.amount, 0);

    onSettle({
      cash: cashTotal,
      card: cardTotal,
      upi: upiTotal,
      giftVoucher: voucherTotal,
      loyaltyPointsRedeemed: 0,
      loyaltyAmount: loyaltyTotal,
      creditNote: creditNoteTotal
    }, changeDue);
  };

  // Keyboard shortcut listener for F10 (Settle & Print) and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        handleFinalSettle();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appliedPayments, netAmount, totalPaid, selectedMode, keypadInput]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#c4c5d5] dark:border-[#444653] max-h-[92vh]">
        
        {/* Header */}
        <header className="flex justify-between items-center px-6 py-3 border-b border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#131b2e] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[#00288e] dark:text-[#a8b8ff] tracking-tight">ProPOS Billing</span>
            <div className="h-4 w-px bg-[#c4c5d5] dark:bg-[#444653]"></div>
            <h1 className="text-base font-semibold">Bill Settlement &amp; Multi-Tender</h1>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] rounded-lg transition"
          >
            <X size={18} />
          </button>
        </header>

        {/* Amount KPI Header Bar */}
        <div className="bg-[#f3f4f5] dark:bg-[#1d222e] px-6 py-3 border-b border-[#c4c5d5] dark:border-[#444653] grid grid-cols-3 gap-4 shrink-0 text-center">
          <div className="bg-white dark:bg-[#131b2e] p-3 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Net Payable</span>
            <div className="text-2xl font-bold font-mono text-[#00288e] dark:text-[#a8b8ff] mt-0.5">
              ₹{netAmount.toFixed(2)}
            </div>
          </div>
          <div className="bg-white dark:bg-[#131b2e] p-3 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Total Tendered</span>
            <div className="text-2xl font-bold font-mono text-[#0c9488] mt-0.5">
              ₹{totalPaid.toFixed(2)}
            </div>
          </div>
          <div className={`p-3 rounded-xl border shadow-xs ${
            balanceRemaining > 0 
              ? "bg-[#ffdad6]/40 dark:bg-[#93000a]/20 border-[#ba1a1a]" 
              : "bg-[#dcfce7] dark:bg-[#166534]/30 border-[#16a34a]"
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
              {balanceRemaining > 0 ? "Balance Remaining" : "Change to Return"}
            </span>
            <div className={`text-2xl font-bold font-mono mt-0.5 ${
              balanceRemaining > 0 ? "text-[#ba1a1a]" : "text-[#16a34a]"
            }`}>
              ₹{(balanceRemaining > 0 ? balanceRemaining : changeDue).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden min-h-[380px]">
          
          {/* Left Column: Payment Modes */}
          <div className="w-56 p-3 border-r border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex flex-col gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] px-1 mb-1">
              Select Tender Mode
            </span>

            <button
              type="button"
              onClick={() => setSelectedMode("CASH")}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition ${
                selectedMode === "CASH"
                  ? "bg-[#00288e] text-white shadow-md"
                  : "bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653]"
              }`}
            >
              <Banknote size={18} />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode("CARD")}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition ${
                selectedMode === "CARD"
                  ? "bg-[#00288e] text-white shadow-md"
                  : "bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653]"
              }`}
            >
              <CreditCard size={18} />
              <span>Credit / Debit Card</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode("UPI")}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition ${
                selectedMode === "UPI"
                  ? "bg-[#00288e] text-white shadow-md"
                  : "bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653]"
              }`}
            >
              <QrCode size={18} />
              <span>UPI / QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode("GIFT_VOUCHER")}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition ${
                selectedMode === "GIFT_VOUCHER"
                  ? "bg-[#00288e] text-white shadow-md"
                  : "bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653]"
              }`}
            >
              <Gift size={18} />
              <span>Gift Voucher</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode("LOYALTY")}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition ${
                selectedMode === "LOYALTY"
                  ? "bg-[#00288e] text-white shadow-md"
                  : "bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653]"
              }`}
            >
              <Award size={18} />
              <span>Loyalty Points</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode("CREDIT_NOTE")}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition ${
                selectedMode === "CREDIT_NOTE"
                  ? "bg-[#00288e] text-white shadow-md"
                  : "bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653]"
              }`}
            >
              <FileText size={18} />
              <span>Credit Note</span>
            </button>
          </div>

          {/* Middle Column: Keypad & Input */}
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                  Tender Amount for {selectedMode}
                </span>
                <span className="text-xs font-mono text-[#00288e] dark:text-[#a8b8ff]">
                  Auto-Balance: ₹{balanceRemaining.toFixed(2)}
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={keypadInput}
                  onChange={e => setKeypadInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-3xl font-mono font-bold text-right px-4 py-3 bg-white dark:bg-[#131b2e] border-2 border-[#00288e] dark:border-[#a8b8ff] rounded-xl outline-none shadow-inner"
                />
              </div>

              {/* Extra Tender Inputs */}
              {selectedMode === "CARD" && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={cardAuthCode}
                    onChange={e => setCardAuthCode(e.target.value)}
                    placeholder="Enter Card Auth Code / Last 4 Digits..."
                    className="w-full text-xs px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg outline-none bg-white dark:bg-[#131b2e]"
                  />
                </div>
              )}

              {selectedMode === "UPI" && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={upiRefNo}
                    onChange={e => setUpiRefNo(e.target.value)}
                    placeholder="Enter UPI Transaction Reference (UTR)..."
                    className="flex-1 text-xs px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg outline-none bg-white dark:bg-[#131b2e]"
                  />
                  <span className="px-3 py-2 bg-[#dcfce7] text-[#166534] rounded-lg text-xs font-bold">
                    Scan Verified
                  </span>
                </div>
              )}

              {selectedMode === "GIFT_VOUCHER" && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={e => setVoucherCode(e.target.value)}
                    placeholder="Scan / Enter 16-digit Voucher Code..."
                    className="w-full text-xs px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-lg outline-none bg-white dark:bg-[#131b2e]"
                  />
                </div>
              )}

              {/* 3x4 Virtual POS Keypad */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "."].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadDigit(num)}
                    className="py-3 bg-white dark:bg-[#2d3133] hover:bg-[#f3f4f5] dark:hover:bg-[#3f465c] border border-[#c4c5d5] dark:border-[#444653] rounded-xl font-bold font-mono text-lg shadow-xs transition active:scale-95"
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="py-2.5 bg-[#e7e8e9] dark:bg-[#3f465c] font-bold text-xs rounded-xl hover:bg-[#d9dadb] transition"
                >
                  Clear Keypad
                </button>
                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={!keypadInput || parseFloat(keypadInput) <= 0}
                  className="py-2.5 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition shadow-xs disabled:opacity-40"
                >
                  + Add Payment ({selectedMode})
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Applied Payments Drawer */}
          <div className="w-80 p-4 border-l border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex flex-col shrink-0">
            <div className="flex justify-between items-center pb-2 border-b border-[#c4c5d5] dark:border-[#444653] mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Applied Tenders ({appliedPayments.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {appliedPayments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#757684] text-center p-4">
                  <Banknote size={32} className="opacity-30 mb-2" />
                  <p className="text-xs font-semibold">No payments added yet.</p>
                  <p className="text-[11px] mt-0.5">Select a tender mode and click Add Payment or press F10 to pay in full.</p>
                </div>
              ) : (
                appliedPayments.map(p => (
                  <div
                    key={p.id}
                    className="p-3 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded-xl shadow-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#191c1d] dark:text-white flex items-center gap-1.5">
                        {p.mode === "CASH" && <Banknote size={14} className="text-[#00288e]" />}
                        {p.mode === "CARD" && <CreditCard size={14} className="text-[#00288e]" />}
                        {p.mode === "UPI" && <QrCode size={14} className="text-[#00288e]" />}
                        {p.label}
                      </div>
                      <div className="text-[10px] text-[#565e74] dark:text-[#bec6e0]">{p.subLabel}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#00288e] dark:text-[#a8b8ff]">
                        ₹{p.amount.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePayment(p.id)}
                        className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1 rounded transition"
                        title="Remove Payment"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Balance Tender Button */}
            {balanceRemaining > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAppliedPayments(prev => [
                    ...prev,
                    {
                      id: `pay-${Date.now()}`,
                      mode: "CASH",
                      label: "Cash",
                      subLabel: "Exact Balance Tendered",
                      amount: balanceRemaining
                    }
                  ]);
                }}
                className="mt-3 py-2 bg-[#dcfce7] text-[#166534] rounded-xl text-xs font-bold border border-[#16a34a]/30 hover:bg-[#bbf7d0] transition"
              >
                + Tender Full Balance in Cash (₹{balanceRemaining.toFixed(2)})
              </button>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <footer className="flex justify-between items-center px-6 py-4 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#f3f4f5] dark:bg-[#131b2e] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] hover:bg-[#e7e8e9] font-bold text-xs transition"
          >
            ← Back to Bill (Esc)
          </button>

          <button
            type="button"
            onClick={handleFinalSettle}
            className="px-8 py-3 rounded-xl bg-[#00288e] hover:bg-[#1e40af] text-white font-bold text-sm shadow-lg flex items-center gap-2 transition active:scale-95"
          >
            <Printer size={16} />
            <span>Settle &amp; Print [F10]</span>
          </button>
        </footer>

      </div>
    </div>
  );
};

export default SmritiProPosSettlementModal;
