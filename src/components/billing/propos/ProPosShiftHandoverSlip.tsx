/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.31.0
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Shift-End Cashier Handover Thermal Balance Sheet (80mm / 40-Column ESC/POS)
 */

import React from "react";
import { POSZReportData, CashDenominations } from "./types.ts";
import { Printer, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface ProPosShiftHandoverSlipProps {
  data: POSZReportData;
  storeName?: string;
  storeAddress?: string;
  onClose?: () => void;
}

export const ProPosShiftHandoverSlip: React.FC<ProPosShiftHandoverSlipProps> = ({
  data,
  storeName = "SMRITI FLAGSHIP STORE",
  storeAddress = "Express Retail Ave, Metro Hub, Mumbai 400001",
  onClose,
}) => {
  const denoms: CashDenominations = data.denominations || {};

  const denomRows = [
    { label: "₹2,000 Note", count: denoms.notes_2000 || 0, mult: 2000 },
    { label: "₹500 Note", count: denoms.notes_500 || 0, mult: 500 },
    { label: "₹200 Note", count: denoms.notes_200 || 0, mult: 200 },
    { label: "₹100 Note", count: denoms.notes_100 || 0, mult: 100 },
    { label: "₹50 Note", count: denoms.notes_50 || 0, mult: 50 },
    { label: "₹20 Note", count: denoms.notes_20 || 0, mult: 20 },
    { label: "₹10 Note", count: denoms.notes_10 || 0, mult: 10 },
    { label: "₹5 Note/Coin", count: denoms.notes_5 || 0, mult: 5 },
    { label: "₹2 Note/Coin", count: denoms.notes_2 || 0, mult: 2 },
    { label: "₹1 Note/Coin", count: denoms.notes_1 || 0, mult: 1 },
    { label: "Coins Value", count: denoms.coins || 0, mult: 1, isCoin: true },
  ].filter((r) => r.count > 0);

  const countedCash =
    data.actual_cash_counted !== undefined
      ? data.actual_cash_counted
      : denomRows.reduce((sum, r) => sum + (r.isCoin ? r.count : r.count * r.mult), 0);

  const variance =
    data.cash_variance !== undefined ? data.cash_variance : countedCash - (data.net_expected_cash || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 dark:bg-[#121517] rounded-2xl max-w-md mx-auto">
      {/* Action Bar (Hidden on Print) */}
      <div className="flex justify-between w-full mb-3 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-[#00288e] hover:bg-[#1b44b8] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
        >
          <Printer size={15} />
          <span>Print Handover Slip (80mm)</span>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white rounded-lg transition"
          >
            Close
          </button>
        )}
      </div>

      {/* Printable Thermal Receipt (80mm Width) */}
      <div
        id="thermal-handover-slip"
        className="w-[300px] bg-white text-black p-4 font-mono text-[11px] shadow-md border border-gray-300 rounded-lg print:border-none print:shadow-none print:w-full print:p-0 print:m-0"
      >
        {/* Store Title */}
        <div className="text-center pb-2 border-b border-dashed border-gray-400">
          <div className="font-bold text-sm tracking-wider uppercase">{storeName}</div>
          <div className="text-[9px] text-gray-600 leading-tight mt-0.5">{storeAddress}</div>
          <div className="font-bold text-[10px] mt-2 uppercase border border-black px-1.5 py-0.5 inline-block">
            CASHIER SHIFT HANDOVER REPORT
          </div>
        </div>

        {/* Metadata */}
        <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span>Shift Code:</span>
            <span className="font-bold">{data.shift_code || data.shift_id}</span>
          </div>
          <div className="flex justify-between">
            <span>Register / POS:</span>
            <span>{data.register_id}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span className="font-bold">{data.cashier_name || data.cashier_id}</span>
          </div>
          <div className="flex justify-between">
            <span>Opened At:</span>
            <span>{data.start_time ? new Date(data.start_time).toLocaleString() : "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span>Closed At:</span>
            <span>{data.end_time ? new Date(data.end_time).toLocaleString() : new Date().toLocaleString()}</span>
          </div>
        </div>

        {/* Tender Sales Summary */}
        <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
          <div className="font-bold uppercase tracking-wide text-[9px] text-gray-700">Tender Sales Summary</div>
          <div className="flex justify-between">
            <span>Cash Sales:</span>
            <span className="font-bold">₹{Number(data.cash_sales || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Card Sales:</span>
            <span>₹{Number(data.card_sales || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>UPI / Digital:</span>
            <span>₹{Number(data.upi_sales || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-300">
            <span>Total Gross Sales:</span>
            <span>₹{Number(data.total_sales || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-600">
            <span>Total Invoices Tendered:</span>
            <span>{data.total_bills || 0}</span>
          </div>
        </div>

        {/* Cash Drawer Float Movements */}
        <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
          <div className="font-bold uppercase tracking-wide text-[9px] text-gray-700">Cash Drawer Reconciliation</div>
          <div className="flex justify-between">
            <span>Opening Float:</span>
            <span>₹{Number(data.opening_float || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>(+) Cash Sales:</span>
            <span>₹{Number(data.cash_sales || 0).toFixed(2)}</span>
          </div>
          {Number(data.cash_in_total || 0) > 0 && (
            <div className="flex justify-between">
              <span>(+) Till Float In:</span>
              <span>₹{Number(data.cash_in_total).toFixed(2)}</span>
            </div>
          )}
          {Number(data.cash_drops_total || 0) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>(-) Cash Drops (Safe):</span>
              <span>-₹{Number(data.cash_drops_total).toFixed(2)}</span>
            </div>
          )}
          {Number(data.till_expenses_total || 0) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>(-) Petty Expenses:</span>
              <span>-₹{Number(data.till_expenses_total).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-300">
            <span>System Expected Cash:</span>
            <span>₹{Number(data.net_expected_cash || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Physical Denomination Breakdown */}
        <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
          <div className="font-bold uppercase tracking-wide text-[9px] text-gray-700">Denomination Counted</div>
          {denomRows.length > 0 ? (
            denomRows.map((r, idx) => (
              <div key={idx} className="flex justify-between text-[10px]">
                <span>
                  {r.label} {r.isCoin ? "" : `× ${r.count}`}
                </span>
                <span className="font-mono">
                  ₹{(r.isCoin ? r.count : r.count * r.mult).toFixed(2)}
                </span>
              </div>
            ))
          ) : (
            <div className="italic text-gray-500 text-[9px]">No denomination breakdown entered.</div>
          )}
          <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-300">
            <span>Total Counted Cash:</span>
            <span className="font-bold">₹{countedCash.toFixed(2)}</span>
          </div>
        </div>

        {/* Reconciliation Variance */}
        <div className="py-2 border-b border-dashed border-gray-400 text-[11px]">
          <div className="flex justify-between items-center font-bold">
            <span>VARIANCE:</span>
            <span className={Math.abs(variance) < 0.01 ? "text-green-700" : variance < 0 ? "text-red-700" : "text-amber-700"}>
              {Math.abs(variance) < 0.01
                ? "₹0.00 (BALANCED)"
                : `${variance < 0 ? "-" : "+"}₹${Math.abs(variance).toFixed(2)} (${variance < 0 ? "SHORTAGE" : "OVERAGE"})`}
            </span>
          </div>
        </div>

        {/* Dual Signatures */}
        <div className="pt-8 pb-2 text-[9px] space-y-6">
          <div className="flex justify-between">
            <div className="text-center">
              <div className="border-t border-black w-24 pt-0.5">Cashier Sign</div>
              <div className="text-[8px] text-gray-500">Handover Complete</div>
            </div>
            <div className="text-center">
              <div className="border-t border-black w-24 pt-0.5">Manager Sign</div>
              <div className="text-[8px] text-gray-500">Vault Verified</div>
            </div>
          </div>
          <div className="text-center text-[8px] text-gray-500 uppercase tracking-widest pt-2">
            *** SMRITI RETAIL OS — COMPLIANCE VERIFIED ***
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProPosShiftHandoverSlip;
