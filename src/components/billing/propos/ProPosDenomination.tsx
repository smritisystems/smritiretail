/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-23
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { CashDenominations } from "./types.ts";
import { Banknote, Coins, RotateCcw, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface SmritiProPosDenominationInputProps {
  denominations: CashDenominations;
  onChange: (denominations: CashDenominations, totalAmount: number) => void;
  expectedCash?: number;
  readOnly?: boolean;
  compact?: boolean;
}

interface DenominationSpec {
  key: keyof CashDenominations;
  label: string;
  multiplier: number;
  isCoin?: boolean;
  colorClass: string;
  badgeBg: string;
}

const DENOMINATIONS: DenominationSpec[] = [
  { key: "notes_2000", label: "₹2,000 Note", multiplier: 2000, colorClass: "text-[#d946ef]", badgeBg: "bg-[#fae8ff] dark:bg-[#701a75]/30 border-[#f0abfc]" },
  { key: "notes_500", label: "₹500 Note", multiplier: 500, colorClass: "text-[#ca8a04]", badgeBg: "bg-[#fef9c3] dark:bg-[#713f12]/30 border-[#fde047]" },
  { key: "notes_200", label: "₹200 Note", multiplier: 200, colorClass: "text-[#ea580c]", badgeBg: "bg-[#ffedd5] dark:bg-[#7c2d12]/30 border-[#fdba74]" },
  { key: "notes_100", label: "₹100 Note", multiplier: 100, colorClass: "text-[#9333ea]", badgeBg: "bg-[#f3e8ff] dark:bg-[#581c87]/30 border-[#d8b4fe]" },
  { key: "notes_50", label: "₹50 Note", multiplier: 50, colorClass: "text-[#0284c7]", badgeBg: "bg-[#e0f2fe] dark:bg-[#0c4a6e]/30 border-[#7dd3fc]" },
  { key: "notes_20", label: "₹20 Note", multiplier: 20, colorClass: "text-[#16a34a]", badgeBg: "bg-[#dcfce7] dark:bg-[#14532d]/30 border-[#86efac]" },
  { key: "notes_10", label: "₹10 Note", multiplier: 10, colorClass: "text-[#b45309]", badgeBg: "bg-[#fef3c7] dark:bg-[#78350f]/30 border-[#fcd34d]" },
  { key: "notes_5", label: "₹5 Note / Coin", multiplier: 5, colorClass: "text-[#475569]", badgeBg: "bg-[#f1f5f9] dark:bg-[#1e293b]/50 border-[#cbd5e1]" },
  { key: "notes_2", label: "₹2 Note / Coin", multiplier: 2, colorClass: "text-[#475569]", badgeBg: "bg-[#f1f5f9] dark:bg-[#1e293b]/50 border-[#cbd5e1]" },
  { key: "notes_1", label: "₹1 Note / Coin", multiplier: 1, colorClass: "text-[#475569]", badgeBg: "bg-[#f1f5f9] dark:bg-[#1e293b]/50 border-[#cbd5e1]" },
  { key: "coins", label: "Mixed Coins Value (₹)", multiplier: 1, isCoin: true, colorClass: "text-[#0d9488]", badgeBg: "bg-[#ccfbf1] dark:bg-[#134e4a]/30 border-[#5eead4]" },
];

export const calculateDenominationTotal = (denoms: CashDenominations): number => {
  return (
    (denoms.notes_2000 || 0) * 2000 +
    (denoms.notes_500 || 0) * 500 +
    (denoms.notes_200 || 0) * 200 +
    (denoms.notes_100 || 0) * 100 +
    (denoms.notes_50 || 0) * 50 +
    (denoms.notes_20 || 0) * 20 +
    (denoms.notes_10 || 0) * 10 +
    (denoms.notes_5 || 0) * 5 +
    (denoms.notes_2 || 0) * 2 +
    (denoms.notes_1 || 0) * 1 +
    (denoms.coins || 0)
  );
};

export const SmritiProPosDenominationInput: React.FC<SmritiProPosDenominationInputProps> = ({
  denominations,
  onChange,
  expectedCash,
  readOnly = false,
  compact = false,
}) => {
  const totalCounted = calculateDenominationTotal(denominations);
  const variance = expectedCash !== undefined ? totalCounted - expectedCash : 0;

  const handleFieldChange = (key: keyof CashDenominations, rawVal: string) => {
    const parsed = parseInt(rawVal.replace(/[^\d]/g, ""), 10);
    const count = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const updated = {
      ...denominations,
      [key]: count,
    };
    const newTotal = calculateDenominationTotal(updated);
    onChange(updated, newTotal);
  };

  const handleClearAll = () => {
    if (readOnly) return;
    const cleared: CashDenominations = {
      notes_2000: 0,
      notes_500: 0,
      notes_200: 0,
      notes_100: 0,
      notes_50: 0,
      notes_20: 0,
      notes_10: 0,
      notes_5: 0,
      notes_2: 0,
      notes_1: 0,
      coins: 0,
    };
    onChange(cleared, 0);
  };

  return (
    <div className="flex flex-col bg-white dark:bg-[#202427] border border-[#c4c5d5] dark:border-[#444653] rounded-2xl p-4 shadow-sm space-y-4">
      {/* Header with Title & Reset Button */}
      <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0] dark:border-[#334155]">
        <div className="flex items-center gap-2">
          <Banknote className="text-[#00288e] dark:text-[#a8b8ff]" size={18} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#191c1d] dark:text-white">
            Physical Cash Denomination Breakdown
          </h4>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#565e74] dark:text-[#bec6e0] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-lg transition flex items-center gap-1"
          >
            <RotateCcw size={12} />
            <span>Reset Counts</span>
          </button>
        )}
      </div>

      {/* Grid of Denominations */}
      <div className={`grid ${compact ? "grid-cols-1 md:grid-cols-2 gap-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5"}`}>
        {DENOMINATIONS.map((d) => {
          const count = denominations[d.key] || 0;
          const subtotal = d.isCoin ? count : count * d.multiplier;

          return (
            <div
              key={d.key}
              className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                count > 0
                  ? "bg-[#f8faff] dark:bg-[#1a233b] border-[#00288e]/40 dark:border-[#a8b8ff]/40 shadow-xs"
                  : "bg-[#fbfcfd] dark:bg-[#191c1e] border-[#e2e8f0] dark:border-[#334155]"
              }`}
            >
              {/* Badge & Label */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${d.badgeBg} ${d.colorClass}`}
                >
                  {d.isCoin ? <Coins size={12} className="inline mr-1" /> : null}
                  {d.multiplier >= 1 && !d.isCoin ? `₹${d.multiplier}` : "Coins"}
                </span>
                <span className="text-[11px] font-medium text-[#475569] dark:text-[#cbd5e1] truncate">
                  {d.label}
                </span>
              </div>

              {/* Count Input & Subtotal */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-[#94a3b8] font-mono">×</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  disabled={readOnly}
                  value={count === 0 ? "" : count}
                  placeholder="0"
                  onChange={(e) => handleFieldChange(d.key, e.target.value)}
                  className="w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border border-[#cbd5e1] dark:border-[#475569] bg-white dark:bg-[#0f172a] text-[#1e293b] dark:text-[#f8fafc] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none transition disabled:opacity-50"
                />
                <span className="text-[10px] text-[#94a3b8] font-mono">=</span>
                <span className="w-20 text-right font-mono font-bold text-xs text-[#0f172a] dark:text-[#f8fafc]">
                  ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer Matrix */}
      <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#334155] grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        {/* Counted Total */}
        <div className="bg-[#f1f5f9] dark:bg-[#1e293b] p-3 rounded-xl border border-[#cbd5e1] dark:border-[#334155] flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              Physical Count Total
            </span>
            <div className="text-lg font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
              ₹{totalCounted.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <Banknote className="text-[#00288e] dark:text-[#a8b8ff] opacity-60" size={24} />
        </div>

        {/* Expected Cash in Register (if provided) */}
        {expectedCash !== undefined && (
          <div className="bg-[#f1f5f9] dark:bg-[#1e293b] p-3 rounded-xl border border-[#cbd5e1] dark:border-[#334155] flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
                System Expected Cash
              </span>
              <div className="text-lg font-mono font-bold text-[#1e293b] dark:text-[#f8fafc]">
                ₹{expectedCash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <ArrowRight className="text-[#64748b] opacity-60" size={20} />
          </div>
        )}

        {/* Live Variance Calculation */}
        {expectedCash !== undefined && (
          <div
            className={`p-3 rounded-xl border flex justify-between items-center ${
              Math.abs(variance) < 0.01
                ? "bg-[#dcfce7] dark:bg-[#14532d]/40 border-[#86efac] text-[#166534] dark:text-[#86efac]"
                : variance < 0
                ? "bg-[#fee2e2] dark:bg-[#7f1d1d]/40 border-[#fca5a5] text-[#991b1b] dark:text-[#fca5a5]"
                : "bg-[#fef3c7] dark:bg-[#78350f]/40 border-[#fcd34d] text-[#92400e] dark:text-[#fcd34d]"
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {Math.abs(variance) < 0.01
                  ? "Reconciliation Status"
                  : variance < 0
                  ? "Cash Shortage"
                  : "Cash Overage"}
              </span>
              <div className="text-lg font-mono font-bold">
                {Math.abs(variance) < 0.01
                  ? "Balanced (₹0.00)"
                  : `${variance < 0 ? "-" : "+"}₹${Math.abs(variance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
            {Math.abs(variance) < 0.01 ? (
              <CheckCircle2 size={24} className="text-[#16a34a]" />
            ) : (
              <AlertTriangle size={24} className={variance < 0 ? "text-[#dc2626]" : "text-[#d97706]"} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmritiProPosDenominationInput;
