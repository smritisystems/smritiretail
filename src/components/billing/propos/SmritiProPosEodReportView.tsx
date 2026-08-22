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
import { EodRegisterCloseout } from "./types.ts";
import { 
  FileSpreadsheet, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Clock, 
  User, 
  Banknote, 
  CreditCard, 
  QrCode, 
  RotateCcw,
  ArrowRight
} from "lucide-react";

interface SmritiProPosEodReportViewProps {
  initialEod?: EodRegisterCloseout;
  onCommitCloseout: (eod: EodRegisterCloseout) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
}

export const SmritiProPosEodReportView: React.FC<SmritiProPosEodReportViewProps> = ({
  initialEod,
  onCommitCloseout,
  onNotification
}) => {
  const [actualCashInput, setActualCashInput] = useState<string>("48250.00");
  const [actualCardInput, setActualCardInput] = useState<string>("34200.00");
  const [actualUpiInput, setActualUpiInput] = useState<string>("21540.00");
  const [remarks, setRemarks] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const systemCash = 48250.00;
  const systemCard = 34200.00;
  const systemUpi = 21540.00;
  const grossSales = 104590.00;
  const discountsTotal = 5400.00;
  const returnsTotal = 2499.00;
  const netSales = grossSales - discountsTotal - returnsTotal;

  const actualCash = parseFloat(actualCashInput) || 0;
  const cashVariance = actualCash - systemCash;

  const handleCloseRegister = () => {
    const eodRecord: EodRegisterCloseout = {
      registerId: "REG-01",
      shiftId: "SHIFT-MORNING",
      openedAt: "09:00 AM",
      closedAt: new Date().toLocaleTimeString(),
      cashierName: "Store Operator (ERP-001)",
      openingFloat: 5000,
      systemCash,
      actualCash,
      systemCard,
      actualCard: parseFloat(actualCardInput) || 0,
      systemUpi,
      actualUpi: parseFloat(actualUpiInput) || 0,
      totalBills: 48,
      totalItemsSold: 112,
      grossSales,
      discountsTotal,
      netSales,
      returnsTotal,
      cashVariance,
      status: Math.abs(cashVariance) === 0 ? "Balanced" : "Variance_Detected",
      remarks
    };

    setIsLocked(true);
    onCommitCloseout(eodRecord);
    onNotification?.("Z-Report Finalized", "Day-end register closeout and audit logs generated successfully.", "success");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-y-auto p-6 font-sans">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c4c5d5] dark:border-[#444653]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#00288e] text-white font-mono text-[11px] font-bold rounded">
                Z-REPORT #ZR-{new Date().toISOString().slice(0, 10)}
              </span>
              <h1 className="text-xl font-bold text-[#00288e] dark:text-[#a8b8ff]">
                End of Day (EOD) Register Closeout
              </h1>
            </div>
            <p className="text-xs text-[#565e74] dark:text-[#bec6e0] mt-0.5">
              Daily sales settlement, tender breakdown, drawer count audit, and register locking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer size={14} />
              Print Z-Report
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={handleCloseRegister}
              className="px-6 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-40"
            >
              <Lock size={14} />
              <span>{isLocked ? "Register Locked" : "Finalize & Close Register"}</span>
            </button>
          </div>
        </div>

        {/* Register Overview KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Gross Turnover</span>
            <div className="text-xl font-bold font-mono text-[#00288e] dark:text-[#a8b8ff] mt-1">₹{grossSales.toFixed(2)}</div>
            <span className="text-[10px] text-[#565e74]">48 Transactions</span>
          </div>

          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Discounts &amp; Promos</span>
            <div className="text-xl font-bold font-mono text-[#ba1a1a] mt-1">-₹{discountsTotal.toFixed(2)}</div>
            <span className="text-[10px] text-[#565e74]">Scheme Benefits</span>
          </div>

          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Sales Returns</span>
            <div className="text-xl font-bold font-mono text-[#ba1a1a] mt-1">-₹{returnsTotal.toFixed(2)}</div>
            <span className="text-[10px] text-[#565e74]">1 Credit Note Issued</span>
          </div>

          <div className="bg-[#dde1ff] dark:bg-[#1e40af]/30 p-4 rounded-xl border border-[#00288e]/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00288e] dark:text-[#a8b8ff]">Net Collected Sales</span>
            <div className="text-2xl font-bold font-mono text-[#00288e] dark:text-white mt-1">₹{netSales.toFixed(2)}</div>
            <span className="text-[10px] text-[#00288e] dark:text-[#a8b8ff] font-semibold">Ready for Bank Deposit</span>
          </div>
        </div>

        {/* Tender Audit & Physical Count Matrix */}
        <div className="bg-white dark:bg-[#2d3133] rounded-2xl border border-[#c4c5d5] dark:border-[#444653] p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#eceef0] dark:border-[#444653]">
            <h3 className="text-sm font-bold text-[#191c1d] dark:text-white uppercase tracking-wider">
              Tender Reconciliation &amp; Physical Drawer Count
            </h3>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
              cashVariance === 0 ? "bg-[#dcfce7] text-[#166534]" : "bg-[#ffdad6] text-[#93000a]"
            }`}>
              {cashVariance === 0 ? "✓ Perfectly Balanced" : `⚠️ Variance: ₹${cashVariance.toFixed(2)}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
                <tr>
                  <th className="px-4 py-3">Tender Mode</th>
                  <th className="px-4 py-3 text-right">System Expected</th>
                  <th className="px-4 py-3 text-right">Physical Count / Terminal Total</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                {/* Cash Row */}
                <tr>
                  <td className="px-4 py-3 font-bold flex items-center gap-2">
                    <Banknote size={16} className="text-[#00288e]" />
                    <span>Cash in Drawer (Inc. Float)</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">₹{systemCash.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={actualCashInput}
                      onChange={e => setActualCashInput(e.target.value)}
                      className="w-32 px-2 py-1 text-right font-mono font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
                    />
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    cashVariance === 0 ? "text-[#16a34a]" : "text-[#ba1a1a]"
                  }`}>
                    ₹{cashVariance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cashVariance === 0 ? (
                      <span className="text-[#16a34a] font-bold">Matched</span>
                    ) : (
                      <span className="text-[#ba1a1a] font-bold">Audit Flag</span>
                    )}
                  </td>
                </tr>

                {/* Card Row */}
                <tr>
                  <td className="px-4 py-3 font-bold flex items-center gap-2">
                    <CreditCard size={16} className="text-[#00288e]" />
                    <span>Credit / Debit Card (EDC Batch)</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">₹{systemCard.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={actualCardInput}
                      onChange={e => setActualCardInput(e.target.value)}
                      className="w-32 px-2 py-1 text-right font-mono font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#16a34a]">₹0.00</td>
                  <td className="px-4 py-3 text-center text-[#16a34a] font-bold">Settled</td>
                </tr>

                {/* UPI Row */}
                <tr>
                  <td className="px-4 py-3 font-bold flex items-center gap-2">
                    <QrCode size={16} className="text-[#00288e]" />
                    <span>UPI / Dynamic QR Payments</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">₹{systemUpi.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={actualUpiInput}
                      onChange={e => setActualUpiInput(e.target.value)}
                      className="w-32 px-2 py-1 text-right font-mono font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#16a34a]">₹0.00</td>
                  <td className="px-4 py-3 text-center text-[#16a34a] font-bold">Settled</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks input */}
          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
              Cashier Closeout Notes / Shift Remarks
            </label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Enter any variance notes, pet cash drops, or shift handover remarks..."
              className="w-full p-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosEodReportView;
