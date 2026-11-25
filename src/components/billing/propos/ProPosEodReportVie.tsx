/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.17
 * Created      : 2026-08-21
 * Modified     : 2026-10-29 (v6.99.17 — Z-Report EOD closeout body portal & #root suppression)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { EodRegisterCloseout, POSZReportData, CashDenominations, ShiftCashMovementRecord } from "./types.ts";
import ProPosDenomination, { calculateDenominationTotal } from "./ProPosDenomination.tsx";
import { ProPosStoreDayPanel } from "./ProPosStoreDayPanel.tsx";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { getRetailBusinessDate } from "../../../utils/formatters.ts";
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
  ArrowRight,
  ShieldCheck,
  TrendingDown,
  Vault,
  Receipt,
  RefreshCw
} from "lucide-react";

interface SmritiProPosEodReportProps {
  initialEod?: EodRegisterCloseout;
  onCommitCloseout: (eod: EodRegisterCloseout) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

interface ShiftListItem {
  id: string;
  status: string;
}

type DecimalValue = number | string;

interface PosZReportApiResponse {
  shift_id: string;
  register_id: string;
  cashier_id: string;
  status: "OPEN" | "CLOSED";
  opened_at: string;
  closed_at?: string | null;
  opening_balance: DecimalValue;
  cash_sales_total: DecimalValue;
  card_sales_total: DecimalValue;
  upi_sales_total: DecimalValue;
  actual_card_counted?: DecimalValue | null;
  card_variance?: DecimalValue | null;
  actual_upi_counted?: DecimalValue | null;
  upi_variance?: DecimalValue | null;
  total_sales: DecimalValue;
  total_invoices: number | string;
  tax_total: DecimalValue;
  discount_total: DecimalValue;
  cash_drops_total: DecimalValue;
  till_expenses_total: DecimalValue;
  cash_in_total: DecimalValue;
  expected_cash: DecimalValue;
  closing_balance: DecimalValue;
  variance: DecimalValue;
  denominations?: (CashDenominations & { coins_total?: DecimalValue }) | null;
  closing_notes?: string | null;
  gl_voucher_id?: string | null;
  gl_voucher_no?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  cash_movements?: Array<{
    id: string;
    shift_id: string;
    transaction_type: ShiftCashMovementRecord["type"];
    amount: DecimalValue;
    reason: string;
    performed_by: string;
    gl_voucher_id?: string | null;
    gl_voucher_no?: string | null;
    receipt_ref?: string | null;
    created_at?: string;
  }> | null;
}

const parseReportAmount = (value: DecimalValue, field: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`The shift report contains an invalid ${field} amount.`);
  }
  return parsed;
};

export const normalizeZReport = (data: PosZReportApiResponse): POSZReportData => ({
  shift_id: data.shift_id,
  shift_code: data.shift_id,
  cashier_id: data.cashier_id,
  cashier_name: data.cashier_id,
  register_id: data.register_id,
  branch_id: data.branch_id || "",
  company_id: data.company_id || "",
  start_time: data.opened_at,
  end_time: data.closed_at || undefined,
  status: data.status,
  opening_float: parseReportAmount(data.opening_balance, "opening balance"),
  cash_sales: parseReportAmount(data.cash_sales_total, "cash sales"),
  card_sales: parseReportAmount(data.card_sales_total, "card sales"),
  upi_sales: parseReportAmount(data.upi_sales_total, "UPI sales"),
  actual_card_counted: data.actual_card_counted == null
    ? undefined
    : parseReportAmount(data.actual_card_counted, "counted card total"),
  card_variance: data.card_variance == null
    ? undefined
    : parseReportAmount(data.card_variance, "card variance"),
  actual_upi_counted: data.actual_upi_counted == null
    ? undefined
    : parseReportAmount(data.actual_upi_counted, "counted UPI total"),
  upi_variance: data.upi_variance == null
    ? undefined
    : parseReportAmount(data.upi_variance, "UPI variance"),
  total_sales: parseReportAmount(data.total_sales, "total sales"),
  tax_total: parseReportAmount(data.tax_total, "tax"),
  discount_total: parseReportAmount(data.discount_total, "discount"),
  total_bills: parseReportAmount(data.total_invoices, "invoice count"),
  cash_drops_total: parseReportAmount(data.cash_drops_total, "cash drops"),
  till_expenses_total: parseReportAmount(data.till_expenses_total, "till expenses"),
  cash_in_total: parseReportAmount(data.cash_in_total, "cash in"),
  net_expected_cash: parseReportAmount(data.expected_cash, "expected cash"),
  actual_cash_counted: data.status === "CLOSED"
    ? parseReportAmount(data.closing_balance, "counted cash")
    : undefined,
  cash_variance: data.status === "CLOSED"
    ? parseReportAmount(data.variance, "cash variance")
    : undefined,
  denominations: data.denominations
    ? {
        ...data.denominations,
        coins: data.denominations.coins ?? parseReportAmount(
          data.denominations.coins_total ?? 0,
          "counted coins",
        ),
      }
    : undefined,
  cash_movements: data.cash_movements?.map((movement) => ({
    id: movement.id,
    shiftId: movement.shift_id,
    type: movement.transaction_type,
    amount: parseReportAmount(movement.amount, "cash movement"),
    reason: movement.reason,
    reference: movement.receipt_ref || undefined,
    performedBy: movement.performed_by,
    journalVoucherId: movement.gl_voucher_no || movement.gl_voucher_id || undefined,
    createdAt: movement.created_at,
  })),
  closing_notes: data.closing_notes || undefined,
  shift_close_voucher_id: data.gl_voucher_no || data.gl_voucher_id || undefined,
});

export const createEodRegisterCloseout = ({
  shiftId,
  zReport,
  actualCash,
  actualCard,
  actualUpi,
  cashVariance,
  remarks,
}: {
  shiftId: string;
  zReport: POSZReportData;
  actualCash: number;
  actualCard: number;
  actualUpi: number;
  cashVariance: number;
  remarks: string;
}): EodRegisterCloseout => ({
  registerId: zReport.register_id,
  shiftId,
  openedAt: zReport.start_time ? new Date(zReport.start_time).toLocaleTimeString() : "—",
  closedAt: new Date().toLocaleTimeString(),
  cashierName: zReport.cashier_name || "—",
  openingFloat: zReport.opening_float,
  systemCash: zReport.net_expected_cash,
  actualCash,
  systemCard: zReport.card_sales,
  actualCard,
  cardVariance: actualCard - zReport.card_sales,
  systemUpi: zReport.upi_sales,
  actualUpi,
  upiVariance: actualUpi - zReport.upi_sales,
  totalBills: zReport.total_bills,
  totalSales: zReport.total_sales,
  discountsTotal: zReport.discount_total,
  cashVariance,
  status: Math.abs(cashVariance) < 0.01
    && Math.abs(actualCard - zReport.card_sales) < 0.01
    && Math.abs(actualUpi - zReport.upi_sales) < 0.01
    ? "Balanced"
    : "Variance_Detected",
  remarks,
});

export const parseTenderCount = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const calculateTenderVariance = (
  expected: number,
  actual: number | undefined,
  persistedVariance?: number,
) => {
  if (actual === undefined) {
    return { amount: undefined, isMatched: false, isRecorded: false };
  }
  const amount = persistedVariance ?? actual - expected;
  return { amount, isMatched: Math.abs(amount) < 0.01, isRecorded: true };
};

export const buildShiftClosePayload = (
  actualCashCounted: number,
  actualCardCounted: number,
  actualUpiCounted: number,
  denominations: CashDenominations,
  remarks: string,
) => ({
  closing_balance: actualCashCounted,
  actual_card_counted: actualCardCounted,
  actual_upi_counted: actualUpiCounted,
  closing_notes: remarks.trim() || undefined,
  denominations: {
    notes_2000: denominations.notes_2000 || 0,
    notes_500: denominations.notes_500 || 0,
    notes_200: denominations.notes_200 || 0,
    notes_100: denominations.notes_100 || 0,
    notes_50: denominations.notes_50 || 0,
    notes_20: denominations.notes_20 || 0,
    notes_10: denominations.notes_10 || 0,
    notes_5: denominations.notes_5 || 0,
    notes_2: denominations.notes_2 || 0,
    notes_1: denominations.notes_1 || 0,
    coins_total: denominations.coins || 0,
  },
});

export const CashCountWarning: React.FC<{
  expectedCash: number;
  actualCashCounted: number;
  isLocked: boolean;
}> = ({ expectedCash, actualCashCounted, isLocked }) => {
  if (isLocked || expectedCash <= 0 || actualCashCounted !== 0) return null;

  return (
    <div
      role="alert"
      className="p-4 rounded-2xl bg-[#fff7ed] dark:bg-[#431407] border border-[#fed7aa] text-[#9a3412] dark:text-[#fdba74] flex items-start gap-3"
    >
      <AlertTriangle size={20} className="shrink-0 mt-0.5" />
      <div>
        <div className="text-xs font-bold">Cash count is still zero</div>
        <div className="text-[11px] mt-0.5">
          The system expects ₹{expectedCash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })},
          but no notes or coins have been counted. Count the drawer before closing. If ₹0 is correct, explain why in the closeout notes.
        </div>
      </div>
    </div>
  );
};

export const TenderCountWarning: React.FC<{
  isOpen: boolean;
  cardEntered: boolean;
  upiEntered: boolean;
}> = ({ isOpen, cardEntered, upiEntered }) => {
  if (!isOpen || (cardEntered && upiEntered)) return null;

  return (
    <div
      role="alert"
      className="p-4 rounded-2xl bg-[#fff7ed] dark:bg-[#431407] border border-[#fed7aa] text-[#9a3412] dark:text-[#fdba74] flex items-start gap-3"
    >
      <AlertTriangle size={20} className="shrink-0 mt-0.5" />
      <div>
        <div className="text-xs font-bold">Card and UPI totals still need verification</div>
        <div className="text-[11px] mt-0.5">
          Enter the totals from the terminal settlement reports. Enter ₹0.00 if there were no payments. Day Close cannot be finalized until both amounts are recorded.
        </div>
      </div>
    </div>
  );
};

export const VarianceNotesWarning: React.FC<{
  isOpen: boolean;
  hasVariance: boolean;
  notesEntered: boolean;
}> = ({ isOpen, hasVariance, notesEntered }) => {
  if (!isOpen || !hasVariance || notesEntered) return null;

  return (
    <div
      role="alert"
      className="mt-1 text-[11px] font-medium text-[#9a3412] dark:text-[#fdba74]"
    >
      Add a short explanation for the cash, card, or UPI difference before closing.
    </div>
  );
};

export const selectOpenShift = (shifts: ShiftListItem[]): ShiftListItem | null =>
  shifts.find((shift) => shift.status.toUpperCase() === "OPEN") ?? null;

export const SmritiProPosEodReport: React.FC<SmritiProPosEodReportProps> = ({
  initialEod,
  onCommitCloseout,
  onNotification
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [zReport, setZReport] = useState<POSZReportData | null>(null);
  
  // Physical Denominations state
  const [denominations, setDenominations] = useState<CashDenominations>({
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
  });

  const [actualCardInput, setActualCardInput] = useState<string>("");
  const [actualUpiInput, setActualUpiInput] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [closingGLVoucher, setClosingGLVoucher] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load shifts list and active shift
  const loadShiftsAndActive = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const shifts = await apiFetchV1<ShiftListItem[]>("/pos/shifts/");
      const currentShift = selectOpenShift(shifts || []);
      if (currentShift) {
        setSelectedShiftId(currentShift.id);
        await loadZReportForShift(currentShift.id);
      } else {
        setSelectedShiftId("");
        setZReport(null);
        setLoadError("There is no open shift to close. Open a shift first or ask your manager for help.");
      }
    } catch (err) {
      console.error("Could not fetch live shifts list:", err);
      setSelectedShiftId("");
      setZReport(null);
      setLoadError("Live shift data could not be loaded. Day Close is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const loadZReportForShift = async (shiftId: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiFetchV1<PosZReportApiResponse>(`/pos/shifts/${shiftId}/z-report`);
      const data = normalizeZReport(response);
      setZReport(data);
      if (data.denominations) {
        setDenominations(data.denominations);
      }
      if (data.status === "CLOSED") {
        setIsLocked(true);
        setClosingGLVoucher(data.shift_close_voucher_id || "JV-BALANCED");
      } else {
        setIsLocked(false);
        setClosingGLVoucher(null);
      }
      setActualCardInput(data.actual_card_counted?.toFixed(2) || "");
      setActualUpiInput(data.actual_upi_counted?.toFixed(2) || "");
    } catch (err: any) {
      console.error("Failed to load shift Z-Report:", err);
      setZReport(null);
      setLoadError("Live Z-Report could not be loaded. Day Close is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftsAndActive();
  }, []);

  const systemCash = zReport?.net_expected_cash ?? 0;
  const systemCard = zReport?.card_sales ?? 0;
  const systemUpi = zReport?.upi_sales ?? 0;
  const actualCard = parseTenderCount(actualCardInput);
  const actualUpi = parseTenderCount(actualUpiInput);
  const totalSales = zReport?.total_sales ?? 0;
  const discountsTotal = zReport?.discount_total ?? 0;

  const actualCashCounted = calculateDenominationTotal(denominations);
  const cashVariance = actualCashCounted - systemCash;
  const cashVarianceMatched = Math.abs(cashVariance) < 0.01;
  const cardVariance = calculateTenderVariance(
    systemCard,
    actualCard,
    zReport?.status === "CLOSED" ? zReport.card_variance : undefined,
  );
  const upiVariance = calculateTenderVariance(
    systemUpi,
    actualUpi,
    zReport?.status === "CLOSED" ? zReport.upi_variance : undefined,
  );
  const hasTenderVariance =
    !cashVarianceMatched
    || (cardVariance.isRecorded && !cardVariance.isMatched)
    || (upiVariance.isRecorded && !upiVariance.isMatched);
  const hasUnrecordedTender = !cardVariance.isRecorded || !upiVariance.isRecorded;
  const varianceNoteRequired = zReport?.status === "OPEN" && hasTenderVariance;
  const varianceNoteMissing = varianceNoteRequired && !remarks.trim();

  const handleCloseRegister = async () => {
    if (selectedShiftId && zReport?.status === "OPEN") {
      if (actualCard === undefined || actualUpi === undefined) {
        onNotification?.(
          "Terminal totals required",
          "Enter the actual card and UPI settlement totals. Enter 0.00 when there were no payments.",
          "error",
        );
        return;
      }
      if (varianceNoteMissing) {
        onNotification?.(
          "Variance explanation required",
          "Add a short explanation for the cash, card, or UPI difference before closing.",
          "error",
        );
        return;
      }

      try {
        setLoading(true);
        const payload = buildShiftClosePayload(
          actualCashCounted,
          actualCard,
          actualUpi,
          denominations,
          remarks,
        );

        const res = await apiFetchV1<any>(`/pos/shifts/close/${selectedShiftId}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setIsLocked(true);
        setClosingGLVoucher(res.shift_close_voucher_id || "JV-BALANCED");

        const eodRecord = createEodRegisterCloseout({
          shiftId: selectedShiftId,
          zReport,
          actualCash: actualCashCounted,
          actualCard,
          actualUpi,
          cashVariance,
          remarks,
        });

        onCommitCloseout(eodRecord);
        let assignmentIssue: string | null = null;
        try {
          if (!zReport.branch_id) {
            throw new Error("The shift report did not include its branch, so it could not be assigned.");
          }
          const businessDate = getRetailBusinessDate();
          const storeDays = await apiFetchV1<Array<{ id: string; status: string }>>(
            `/pos/store-days?branch_id=${encodeURIComponent(zReport.branch_id)}&business_date=${businessDate}`
          );
          if (!Array.isArray(storeDays)) {
            throw new Error("The Store Day service returned an invalid response.");
          }
          const openDay = storeDays.find((day) => day.status === "OPEN");
          if (!openDay) {
            assignmentIssue = `No open Store Day was found for ${businessDate}. This shift is closed but must be assigned before Store Day close.`;
          } else {
            await apiFetchV1(`/pos/store-days/${openDay.id}/assign-shift`, {
              method: "POST",
              body: JSON.stringify({ shift_id: selectedShiftId }),
            });
          }
        } catch (assignmentError: any) {
          console.error("Shift closed but Store Day assignment failed:", assignmentError);
          assignmentIssue = assignmentError?.detail || assignmentError?.message
            || "The shift closed but could not be assigned to its Store Day.";
        }

        if (assignmentIssue) {
          onNotification?.("Shift closed; Store Day assignment needed", assignmentIssue, "error");
        } else {
          onNotification?.("Z-Report Finalized", `Shift closed, assigned to the open Store Day, and locked. GL Voucher: ${res.shift_close_voucher_id || "Balanced"}`, "success");
        }
      } catch (err: any) {
        console.error("Failed to close shift:", err);
        onNotification?.("Closeout Failed", err?.message || "Failed to commit register closeout.", "error");
      } finally {
        setLoading(false);
      }
    } else {
      onNotification?.("Closeout unavailable", "No live shift is selected. Day Close was not posted.", "error");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Derive branchId and today's date for the Store Day Panel
  const todayDate = getRetailBusinessDate();
  const panelBranchId = zReport?.branch_id || "";

  const printableZReport = (
    <div id="propos-eod-printable-statement" className="hidden print:block bg-white text-black font-sans p-8">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          #root {
            display: none !important;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          #propos-eod-printable-statement {
            position: static !important;
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
      <div className="space-y-6 text-black">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-black">SMRITI Retail OS</h1>
            <p className="text-xs text-gray-700 font-semibold">Point of Sale (ProPOS) Daily Register Closeout &amp; Z-Report</p>
            <p className="text-[11px] text-gray-600 font-mono mt-0.5">Branch: {(zReport as any)?.branch_name || panelBranchId || "Store HQ"} | Business Date: {todayDate}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-black text-white text-xs font-mono font-bold uppercase rounded">
              Z-REPORT #{zReport?.shift_code || "EOD-CLOSEOUT"}
            </span>
            <p className="text-[11px] font-mono text-gray-700 mt-1">Generated: {new Date().toLocaleString("en-IN")}</p>
            <p className="text-[10px] font-mono text-gray-500">Status: {isLocked ? "FINALIZED & LOCKED" : "PROVISIONAL RECONCILIATION"}</p>
          </div>
        </div>

        {/* Shift Operational Summary Strip */}
        <div className="grid grid-cols-4 gap-4 p-3 bg-gray-100 rounded-lg border border-gray-300 text-xs font-mono">
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold block">Cashier ID</span>
            <span className="font-bold text-black">{zReport?.cashier_name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold block">Register ID</span>
            <span className="font-bold text-black">{zReport?.register_id || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold block">Opening Time</span>
            <span className="text-black">{zReport?.start_time ? new Date(zReport.start_time).toLocaleTimeString("en-IN") : "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold block">Closing Time</span>
            <span className="text-black">{new Date().toLocaleTimeString("en-IN")}</span>
          </div>
        </div>

        {/* Revenue & Tax Summary */}
        <div className="grid grid-cols-2 gap-6">
          <div className="border border-gray-300 rounded-lg overflow-hidden text-xs">
            <div className="bg-gray-200 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-gray-800">
              Transaction Breakdown
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-200 font-mono">
                <tr>
                  <td className="px-3 py-2 text-gray-700">Total Sales</td>
                  <td className="px-3 py-2 text-right font-bold">₹{totalSales.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Discounts Allowed</td>
                  <td className="px-3 py-2 text-right text-red-600 font-bold">-₹{discountsTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Output GST Tax Total</td>
                  <td className="px-3 py-2 text-right font-bold">₹{(zReport?.tax_total ?? 0).toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                  <td className="px-3 py-2 text-black">Invoices in Shift</td>
                  <td className="px-3 py-2 text-right text-black font-extrabold text-sm">{zReport?.total_bills ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border border-gray-300 rounded-lg overflow-hidden text-xs">
            <div className="bg-gray-200 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-gray-800">
              Tender Reconciliation
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-200 font-mono">
                <tr>
                  <td className="px-3 py-2 text-gray-700">Cash Tendered</td>
                  <td className="px-3 py-2 text-right font-bold">₹{actualCashCounted.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Credit / Debit Cards</td>
                  <td className="px-3 py-2 text-right font-bold">
                    {actualCard === undefined ? "Not entered" : `₹${actualCard.toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Card Variance</td>
                  <td className={`px-3 py-2 text-right font-bold ${cardVariance.isMatched ? "text-emerald-700" : "text-red-600"}`}>
                    {!cardVariance.isRecorded
                      ? "Not entered"
                      : cardVariance.isMatched
                        ? "₹0.00"
                        : `${(cardVariance.amount ?? 0) > 0 ? "+" : "-"}₹${Math.abs(cardVariance.amount ?? 0).toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">UPI / Dynamic QR</td>
                  <td className="px-3 py-2 text-right font-bold">
                    {actualUpi === undefined ? "Not entered" : `₹${actualUpi.toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">UPI Variance</td>
                  <td className={`px-3 py-2 text-right font-bold ${upiVariance.isMatched ? "text-emerald-700" : "text-red-600"}`}>
                    {!upiVariance.isRecorded
                      ? "Not entered"
                      : upiVariance.isMatched
                        ? "₹0.00"
                        : `${(upiVariance.amount ?? 0) > 0 ? "+" : "-"}₹${Math.abs(upiVariance.amount ?? 0).toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Cash Variance</td>
                  <td className={`px-3 py-2 text-right font-bold ${cashVarianceMatched ? "text-emerald-700" : "text-red-600"}`}>
                    {cashVariance >= 0 ? `+₹${cashVariance.toFixed(2)}` : `-₹${Math.abs(cashVariance).toFixed(2)}`}
                  </td>
                </tr>
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                  <td className="px-3 py-2 text-black">Total Shift Inflow</td>
                  <td className="px-3 py-2 text-right text-black font-extrabold text-sm">
                    {actualCard === undefined || actualUpi === undefined
                      ? "Terminal totals not entered"
                      : `₹${(actualCashCounted + actualCard + actualUpi).toFixed(2)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-8 border-t border-gray-400 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center space-y-3">
            <div className="h-10 border-b border-dashed border-gray-400"></div>
            <p className="font-bold text-gray-800">Cashier / Operator Signature</p>
          </div>
          <div className="text-center space-y-3">
            <div className="h-10 border-b border-dashed border-gray-400"></div>
            <p className="font-bold text-gray-800">Store Manager / Auditor Signature</p>
          </div>
        </div>
      </div>
    </div>
  );

  const mountedPrintable = typeof document !== "undefined" && document?.body && typeof (document.body as any).appendChild === "function"
    ? createPortal(printableZReport, document.body)
    : printableZReport;

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-y-auto p-6 font-sans">
      {mountedPrintable}
      <div className="max-w-5xl mx-auto w-full space-y-6">

        {/* Store Business Day Control Panel */}
        {panelBranchId && (
          <ProPosStoreDayPanel
            branchId={panelBranchId}
            businessDate={todayDate}
            onNotification={onNotification}
          />
        )}

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c4c5d5] dark:border-[#444653]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#00288e] text-white font-mono text-[11px] font-bold rounded">
                Z-REPORT #{zReport?.shift_code || `ZR-${todayDate}`}
              </span>
              <h1 className="text-xl font-bold text-[#00288e] dark:text-[#a8b8ff]">
                End of Day (EOD) Register Closeout &amp; Cash Reconciliation
              </h1>
            </div>
            <p className="text-xs text-[#565e74] dark:text-[#bec6e0] mt-0.5">
              Daily sales settlement, denomination audit, safe transfers, petty payouts, and dual-entry GL balancing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (selectedShiftId) loadZReportForShift(selectedShiftId);
              }}
              className="px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer size={14} />
              <span>Print Z-Report</span>
            </button>

            <button
              type="button"
              disabled={
                isLocked
                || loading
                || !zReport
                || zReport.status !== "OPEN"
                || actualCard === undefined
                || actualUpi === undefined
                || varianceNoteMissing
              }
              onClick={handleCloseRegister}
              className="px-6 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-40"
            >
              <Lock size={14} />
              <span>{isLocked ? "Register Locked (Closed)" : "Finalize & Close Register"}</span>
            </button>
          </div>
        </div>

        {zReport && (
          <TenderCountWarning
            isOpen={zReport.status === "OPEN" && !isLocked}
            cardEntered={cardVariance.isRecorded}
            upiEntered={upiVariance.isRecorded}
          />
        )}

        {zReport && (
          <CashCountWarning
            expectedCash={systemCash}
            actualCashCounted={actualCashCounted}
            isLocked={isLocked}
          />
        )}

        {loadError && (
          <div className="p-4 rounded-2xl bg-[#fff7ed] dark:bg-[#431407] border border-[#fed7aa] text-[#9a3412] dark:text-[#fdba74] flex items-center gap-3">
            <AlertTriangle size={20} />
            <div>
              <div className="text-xs font-bold">Day Close unavailable</div>
              <div className="text-[11px] mt-0.5">{loadError} No sample totals or local closeout will be used.</div>
            </div>
          </div>
        )}

        {/* GL Balancing Confirmation Banner */}
        {closingGLVoucher && (
          <div className="p-4 rounded-2xl bg-[#dcfce7] dark:bg-[#14532d]/40 border border-[#86efac] text-[#166534] dark:text-[#86efac] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck size={24} />
              <div>
                <div className="text-xs font-bold">Shift Closed &amp; Double-Entry GL Balanced</div>
                <div className="text-[11px] font-mono mt-0.5">Voucher Reference: {closingGLVoucher}</div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white/60 dark:bg-black/30 rounded-lg">
              Status: CLOSED
            </span>
          </div>
        )}

        {/* Register Overview KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Total Sales</span>
            <div className="text-xl font-bold font-mono text-[#00288e] dark:text-[#a8b8ff] mt-1">₹{totalSales.toFixed(2)}</div>
            <span className="text-[10px] text-[#565e74]">{zReport?.total_bills ?? 0} Invoices</span>
          </div>

          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Discounts &amp; Promos</span>
            <div className="text-xl font-bold font-mono text-[#ba1a1a] mt-1">-₹{discountsTotal.toFixed(2)}</div>
            <span className="text-[10px] text-[#565e74]">Schemes Applied</span>
          </div>

          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Cash Drops (Safe)</span>
            <div className="text-xl font-mono font-bold text-[#ba1a1a] mt-1">
              -₹{(zReport?.cash_drops_total || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-[#565e74]">Safe Transfers</span>
          </div>

          <div className="bg-white dark:bg-[#2d3133] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Till Expenses</span>
            <div className="text-xl font-mono font-bold text-[#ba1a1a] mt-1">
              -₹{(zReport?.till_expenses_total || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-[#565e74]">Petty Disbursals</span>
          </div>

          <div className="bg-[#dde1ff] dark:bg-[#1e40af]/30 p-4 rounded-xl border border-[#00288e]/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00288e] dark:text-[#a8b8ff]">Net Expected Cash</span>
            <div className="text-2xl font-bold font-mono text-[#00288e] dark:text-white mt-1">₹{systemCash.toFixed(2)}</div>
            <span className="text-[10px] text-[#00288e] dark:text-[#a8b8ff] font-semibold">Opening + Cash Sales - Drops - Exp</span>
          </div>
        </div>

        {/* Physical Cash Denomination Breakdown Component */}
        <ProPosDenomination
          denominations={denominations}
          onChange={(updated) => setDenominations(updated)}
          expectedCash={systemCash}
          readOnly={isLocked}
        />

        {/* Mid-Shift Cash Movements History (if any) */}
        {zReport?.cash_movements && zReport.cash_movements.length > 0 && (
          <div className="bg-white dark:bg-[#2d3133] rounded-2xl border border-[#c4c5d5] dark:border-[#444653] p-6 shadow-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#eceef0] dark:border-[#444653]">
              <h3 className="text-sm font-bold text-[#191c1d] dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Vault size={16} className="text-[#00288e]" />
                Mid-Shift Cash Movements &amp; Petty Disbursals
              </h3>
              <span className="text-xs font-mono font-bold text-[#565e74]">
                {zReport.cash_movements.length} transactions recorded
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
                <tr>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Reason &amp; Reference</th>
                  <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                  <th className="px-4 py-2.5 text-right">GL Voucher ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                {zReport.cash_movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-[#f8f9fa] dark:hover:bg-[#131b2e]">
                    <td className="px-4 py-2.5 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mov.type === "CASH_DROP" ? "bg-[#e0e7ff] text-[#3730a3]" : "bg-[#fef3c7] text-[#92400e]"
                      }`}>
                        {mov.type === "CASH_DROP" ? "Safe Drop" : "Till Expense"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      <span>{mov.reason}</span>
                      {mov.reference && <span className="text-[#94a3b8] ml-2">({mov.reference})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#ba1a1a]">
                      -₹{mov.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-[#00288e] dark:text-[#a8b8ff]">
                      {mov.journalVoucherId || "JV-AUTO"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tender Reconciliation Table */}
        <div className="bg-white dark:bg-[#2d3133] rounded-2xl border border-[#c4c5d5] dark:border-[#444653] p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#eceef0] dark:border-[#444653]">
            <h3 className="text-sm font-bold text-[#191c1d] dark:text-white uppercase tracking-wider">
              Tender Reconciliation &amp; Settlement Variance
            </h3>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
              hasTenderVariance
                ? "bg-[#ffdad6] text-[#93000a]"
                : hasUnrecordedTender
                ? "bg-[#fef3c7] text-[#92400e]"
                : "bg-[#dcfce7] text-[#166534]"
            }`}>
              {hasTenderVariance
                ? !cashVarianceMatched
                  ? `⚠️ Cash Variance: ₹${cashVariance.toFixed(2)}`
                  : "⚠️ Card / UPI Variance"
                : hasUnrecordedTender
                  ? "⚠️ Terminal totals not entered"
                  : "✓ Cash / Card / UPI Matched"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
                <tr>
                  <th className="px-4 py-3">Tender Mode</th>
                  <th className="px-4 py-3 text-right">System Expected</th>
                  <th className="px-4 py-3 text-right">Counted / Terminal Total</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                {/* Cash Row */}
                <tr>
                  <td className="px-4 py-3 font-bold flex items-center gap-2">
                    <Banknote size={16} className="text-[#00288e]" />
                    <span>Physical Cash in Drawer</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">₹{systemCash.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
                    ₹{actualCashCounted.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    cashVarianceMatched ? "text-[#16a34a]" : "text-[#ba1a1a]"
                  }`}>
                    ₹{cashVariance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cashVarianceMatched ? (
                      <span className="text-[#16a34a] font-bold">Matched</span>
                    ) : (
                      <span className="text-[#ba1a1a] font-bold">
                        {cashVariance < 0 ? "Shortage (5070)" : "Overage (4050)"}
                      </span>
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
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      required
                      aria-label="Actual card terminal total"
                      placeholder="Required"
                      disabled={isLocked}
                      value={actualCardInput}
                      onChange={e => setActualCardInput(e.target.value)}
                      className="w-32 px-2 py-1 text-right font-mono font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
                    />
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    cardVariance.isMatched ? "text-[#16a34a]" : cardVariance.isRecorded ? "text-[#ba1a1a]" : "text-[#92400e]"
                  }`}>
                    {!cardVariance.isRecorded
                      ? "—"
                      : cardVariance.isMatched
                        ? "₹0.00"
                        : `${(cardVariance.amount ?? 0) > 0 ? "+" : "-"}₹${Math.abs(cardVariance.amount ?? 0).toFixed(2)}`}
                  </td>
                  <td className={`px-4 py-3 text-center font-bold ${
                    cardVariance.isMatched ? "text-[#16a34a]" : cardVariance.isRecorded ? "text-[#ba1a1a]" : "text-[#92400e]"
                  }`}>
                    {cardVariance.isMatched ? "Matched" : cardVariance.isRecorded ? "Variance" : "Not entered"}
                  </td>
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
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      required
                      aria-label="Actual UPI terminal total"
                      placeholder="Required"
                      disabled={isLocked}
                      value={actualUpiInput}
                      onChange={e => setActualUpiInput(e.target.value)}
                      className="w-32 px-2 py-1 text-right font-mono font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
                    />
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    upiVariance.isMatched ? "text-[#16a34a]" : upiVariance.isRecorded ? "text-[#ba1a1a]" : "text-[#92400e]"
                  }`}>
                    {!upiVariance.isRecorded
                      ? "—"
                      : upiVariance.isMatched
                        ? "₹0.00"
                        : `${(upiVariance.amount ?? 0) > 0 ? "+" : "-"}₹${Math.abs(upiVariance.amount ?? 0).toFixed(2)}`}
                  </td>
                  <td className={`px-4 py-3 text-center font-bold ${
                    upiVariance.isMatched ? "text-[#16a34a]" : upiVariance.isRecorded ? "text-[#ba1a1a]" : "text-[#92400e]"
                  }`}>
                    {upiVariance.isMatched ? "Matched" : upiVariance.isRecorded ? "Variance" : "Not entered"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks input */}
          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
              Cashier Closeout Notes / Shift Handover Remarks {varianceNoteRequired ? "(Required for Variance Audit)" : "(Optional)"}
            </label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              aria-required={varianceNoteRequired}
              aria-invalid={varianceNoteMissing}
              placeholder="Enter any variance notes, safe drop handover references, or shift remarks..."
              className="w-full p-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#191c1e] text-xs outline-none"
            />
            <VarianceNotesWarning
              isOpen={zReport?.status === "OPEN"}
              hasVariance={hasTenderVariance}
              notesEntered={Boolean(remarks.trim())}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosEodReport;
