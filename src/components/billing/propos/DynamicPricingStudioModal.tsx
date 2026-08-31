/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.86.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import {
  DynamicPricingEngine,
  DynamicPricingRule,
  PricingEvaluationItem,
} from "../../../utils/dynamicPricingEngine";

interface DynamicPricingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyRules?: (rules: DynamicPricingRule[]) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export const DynamicPricingStudioModal: React.FC<DynamicPricingStudioModalProps> = ({
  isOpen,
  onClose,
  onApplyRules,
  onNotification,
}) => {
  const [rules, setRules] = useState<DynamicPricingRule[]>([
    {
      id: "rule-hh-01",
      name: "Afternoon Happy Hours (20% Off)",
      code: "HAPPY-HOURS-20",
      type: "HAPPY_HOURS",
      startTime: "14:00",
      endTime: "17:00",
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      discountPct: 20,
      applicableCategories: ["Apparel", "Footwear"],
      isStackable: false,
      isActive: true,
    },
    {
      id: "rule-weekend-02",
      name: "Weekend Mega Saver (Flat â‚¹500 Off on â‚¹3000+)",
      code: "WEEKEND-500",
      type: "FLAT_DISCOUNT",
      startTime: "00:00",
      endTime: "23:59",
      daysOfWeek: [0, 6], // Sun, Sat
      flatDiscountAmt: 500,
      minBillAmount: 3000,
      isStackable: true,
      isActive: true,
    },
  ]);

  const [simulatedHour, setSimulatedHour] = useState<number>(15); // 15:00 (3 PM)
  const [simulatedDay, setSimulatedDay] = useState<number>(3); // Wednesday

  const sampleCart: PricingEvaluationItem[] = [
    {
      sku: "APP-POLO-NAVY-M",
      category: "Apparel",
      qty: 2,
      unitPrice: 1200,
      mrp: 1499,
      lineTotal: 2400,
      discountAmt: 0,
    },
    {
      sku: "FTW-SNEAKER-WHT-8",
      category: "Footwear",
      qty: 1,
      unitPrice: 2800,
      mrp: 3499,
      lineTotal: 2800,
      discountAmt: 0,
    },
  ];

  const simulationDate = useMemo(() => {
    const d = new Date(2026, 7, 26); // August 26, 2026 (Wednesday)
    d.setHours(simulatedHour, 30, 0, 0);
    return d;
  }, [simulatedHour, simulatedDay]);

  const evaluation = useMemo(() => {
    return DynamicPricingEngine.evaluateCart(sampleCart, rules, simulationDate);
  }, [sampleCart, rules, simulationDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <span className="material-symbols-outlined text-2xl">timer</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-3">
                Dynamic Pricing & Happy Hours Rules Engine
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {evaluation.appliedRules.length > 0 ? "PROMO ACTIVE" : "STANDARD PRICING"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Automated time-window and day-of-week promotional discounting</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Time Simulator HUD */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Simulate Time:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSimulatedHour(11)} // 11 AM (Off-peak)
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  simulatedHour === 11
                    ? "bg-slate-700 text-white border-slate-500"
                    : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                11:00 AM (Morning)
              </button>
              <button
                onClick={() => setSimulatedHour(15)} // 3 PM (Happy Hour)
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  simulatedHour === 15
                    ? "bg-amber-600/30 text-amber-300 border-amber-500/50"
                    : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                03:30 PM (Happy Hour)
              </button>
              <button
                onClick={() => setSimulatedHour(19)} // 7 PM (Evening)
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  simulatedHour === 19
                    ? "bg-slate-700 text-white border-slate-500"
                    : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                07:00 PM (Evening)
              </button>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Current Simulated State:{" "}
            <strong className="text-amber-400">
              {simulatedHour}:30 Hrs â€¢ {evaluation.appliedRules.join(", ") || "No Active Promos"}
            </strong>
          </div>
        </div>

        {/* Rules & Simulation View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Rules List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Configured Promotional Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rules.map((r) => {
                const isActiveNow = DynamicPricingEngine.isRuleActiveAt(r, simulationDate);
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActiveNow
                        ? "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
                        : "bg-slate-800/40 border-slate-700/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-200 text-xs block">{r.name}</span>
                        <span className="font-mono text-[10px] text-amber-400">{r.code}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          isActiveNow
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-700/50 text-slate-400 border border-slate-600/30"
                        }`}
                      >
                        {isActiveNow ? "TRIGGERED" : "INACTIVE"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400 font-mono">
                      <span>
                        Time: <strong className="text-slate-300">{r.startTime} - {r.endTime}</strong>
                      </span>
                      <span>
                        Discount: <strong className="text-emerald-400">{r.discountPct ? `${r.discountPct}%` : `â‚¹${r.flatDiscountAmt}`}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Cart Preview Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Simulated POS Cart Valuation
            </h3>
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] bg-slate-950/60">
                    <th className="py-2 px-3">Item Details</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Discount</th>
                    <th className="py-2 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {evaluation.evaluatedItems.map((item) => (
                    <tr key={item.sku}>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="text-slate-200 block font-medium">{item.sku}</span>
                        <span className="text-[10px] text-slate-400">{item.category} â€¢ Qty: {item.qty}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">â‚¹{item.unitPrice}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {item.discountAmt > 0 ? `-â‚¹${item.discountAmt}` : "â€”"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-100">â‚¹{item.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-4">
                  <span>Gross: <strong className="text-slate-300">â‚¹{evaluation.originalSubtotal}</strong></span>
                  <span>Total Discount: <strong className="text-emerald-400">-â‚¹{evaluation.totalDiscount}</strong></span>
                </div>
                <div className="text-sm font-bold text-slate-100">
                  Payable Subtotal: <span className="text-amber-400">â‚¹{evaluation.finalSubtotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
          <button
            onClick={() => {
              onApplyRules?.(rules);
              onNotification?.("Pricing Engine Synchronized", "Dynamic pricing rules updated for active registers.", "success");
              onClose();
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            <span>Apply Dynamic Pricing to Registers</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicPricingStudioModal;

