/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * 
 * Founders
 * 
 * * Pushpa Devi Jawahar Mallah — Founder & Chairperson
 * * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 * 
 * * Version    : 6.52.0
 * * Created    : 2026-10-02
 * * Modified   : 2026-10-02
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * Classification: Statutory Tax Remittance (Challan 281) & Form 26Q Quarterly Return
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  RefreshCw,
  Download,
  Building2,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Plus,
  Landmark,
  ShieldAlert,
  ArrowRight,
  Eye,
  Trash2,
  Calendar,
  Layers,
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { VendorDetail } from "../../../types/vendor";

export interface Form26QDeducteeLine {
  deductee_code: string;
  pan: string;
  pan_valid: boolean;
  vendor_name: string;
  section: string;
  payment_credit_date: string;
  gross_amount: number;
  tds_rate: number;
  tds_amount: number;
  challan_no?: string;
  bsr_code?: string;
  reason_code?: string;
}

export interface Form26QChallanLine {
  challan_no: string;
  bsr_code: string;
  challan_date: string;
  tax_amount: number;
  interest: number;
  fee: number;
  total_amount: number;
  minor_head: string;
  section: string;
  is_cancelled: boolean;
}

export interface Form26QSummary {
  quarter: string;
  financial_year: string;
  company_name: string;
  tan: string;
  pan: string;
  total_deductees_count: number;
  total_challans_count: number;
  total_tds_deducted: number;
  total_tds_deposited: number;
  unallocated_shortfall: number;
  deductees: Form26QDeducteeLine[];
  challans: Form26QChallanLine[];
}

export interface ChallanRecord {
  voucher_id: string;
  voucher_no: string;
  challan_no: string;
  bsr_code: string;
  challan_date: string;
  quarter: string;
  financial_year: string;
  tds_section: string;
  major_head: string;
  minor_head: string;
  tax_amount: number;
  surcharge: number;
  cess: number;
  interest: number;
  fee: number;
  penalty: number;
  total_amount: number;
  bank_name?: string;
  bank_account_code: string;
  narration?: string;
  is_cancelled: boolean;
  created_at: string;
}

interface VendorChallan281ModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor?: VendorDetail;
  initialQuarter?: string;
  initialFy?: string;
}

export const VendorChallan281Modal: React.FC<VendorChallan281ModalProps> = ({
  isOpen,
  onClose,
  vendor,
  initialQuarter = "Q2",
  initialFy = "2026-27",
}) => {
  const [quarter, setQuarter] = useState<string>(initialQuarter);
  const [financialYear, setFinancialYear] = useState<string>(initialFy);
  const [activeTab, setActiveTab] = useState<"deductees" | "challans">("deductees");
  const [loading, setLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<Form26QSummary | null>(null);
  const [challansList, setChallansList] = useState<ChallanRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Record Deposit Drawer State
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);
  const [challanNo, setChallanNo] = useState<string>("");
  const [bsrCode, setBsrCode] = useState<string>("");
  const [challanDate, setChallanDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [tdsSection, setTdsSection] = useState<string>("194Q");
  const [majorHead, setMajorHead] = useState<string>("0021");
  const [minorHead, setMinorHead] = useState<string>("200");
  const [bankName, setBankName] = useState<string>("HDFC Bank");
  const [bankAccountCode, setBankAccountCode] = useState<string>("1020");
  const [taxAmount, setTaxAmount] = useState<string>("0.00");
  const [surcharge, setSurcharge] = useState<string>("0.00");
  const [cess, setCess] = useState<string>("0.00");
  const [interest, setInterest] = useState<string>("0.00");
  const [fee, setFee] = useState<string>("0.00");
  const [depositNarration, setDepositNarration] = useState<string>("");

  // NSDL ASCII Raw Text Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewFilename, setPreviewFilename] = useState<string>("");

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Form 26Q Summary
      try {
        const sumRes = await apiFetchV1<Form26QSummary>(
          `/tax/tds/form26q/summary?quarter=${quarter}&financial_year=${encodeURIComponent(financialYear)}`
        );
        if (sumRes) {
          setSummary(sumRes);
        }
      } catch {
        // Fallback to purchase tax tds path if needed
        try {
          const fallbackRes = await apiFetchV1<Form26QSummary>(
            `/purchase/tax/tds/form26q/summary?quarter=${quarter}&financial_year=${encodeURIComponent(financialYear)}`
          );
          if (fallbackRes) {
            setSummary(fallbackRes);
          }
        } catch {
          // ignore fallback error
        }
      }

      // 2. Fetch Recorded Challans
      try {
        const chlRes = await apiFetchV1<ChallanRecord[]>(
          `/tax/tds/challan281?quarter=${quarter}&financial_year=${encodeURIComponent(financialYear)}`
        );
        if (chlRes && Array.isArray(chlRes)) {
          setChallansList(chlRes);
        }
      } catch {
        setChallansList([]);
      }
    } catch (err: any) {
      console.error("Failed to load TDS & Form 26Q data:", err);
      setErrorMsg("Failed to synchronize government remittance and return records.");
    } finally {
      setLoading(false);
    }
  }, [quarter, financialYear]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Compute Deposit Totals
  const numTax = parseFloat(taxAmount) || 0;
  const numSur = parseFloat(surcharge) || 0;
  const numCess = parseFloat(cess) || 0;
  const numInt = parseFloat(interest) || 0;
  const numFee = parseFloat(fee) || 0;
  const depositTaxComponent = numTax + numSur + numCess;
  const depositChargesComponent = numInt + numFee;
  const depositTotal = depositTaxComponent + depositChargesComponent;

  // Handle Record Challan 281 Submit
  const handleRecordChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositTotal <= 0) {
      alert("Total remittance amount must be greater than ₹0.00");
      return;
    }
    if (bsrCode.trim().length !== 7 || !/^\d{7}$/.test(bsrCode.trim())) {
      alert("BSR code must be exactly 7 numeric digits (e.g. 0002134)");
      return;
    }
    if (!challanNo.trim()) {
      alert("Please provide Challan Serial Number (e.g. 00142)");
      return;
    }

    setSubmittingDeposit(true);
    try {
      const payload = {
        challan_no: challanNo.trim(),
        bsr_code: bsrCode.trim(),
        challan_date: challanDate,
        tax_amount: numTax,
        surcharge: numSur,
        cess: numCess,
        interest: numInt,
        fee: numFee,
        penalty: 0,
        tds_section: tdsSection,
        major_head: majorHead,
        minor_head: minorHead,
        financial_year: financialYear,
        quarter: quarter,
        bank_name: bankName.trim(),
        bank_account_code: bankAccountCode.trim() || "1020",
        narration: depositNarration.trim(),
      };

      const res = await apiFetchV1<any>("/tax/tds/challan281", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res) {
        setIsDepositOpen(false);
        setChallanNo("");
        setBsrCode("");
        setTaxAmount("0.00");
        setInterest("0.00");
        setFee("0.00");
        await loadData();
      }
    } catch (err: any) {
      alert("Error submitting Challan 281 remittance: " + (err.message || err));
    } finally {
      setSubmittingDeposit(false);
    }
  };

  // Handle Cancel Challan
  const handleCancelChallan = async (voucherId: string, chlNo: string) => {
    const reason = window.prompt(`Enter reason for cancelling Challan 281 #${chlNo}:`, "BSR re-entry correction");
    if (reason === null) return;

    try {
      setLoading(true);
      const res = await apiFetchV1<any>(`/tax/tds/challan281/${voucherId}/cancel?reason=${encodeURIComponent(reason)}`, {
        method: "POST",
      });
      if (res) {
        await loadData();
      }
    } catch (err: any) {
      alert("Error cancelling Challan: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Export Form 26Q NSDL ASCII File
  const handleExportForm26Q = async () => {
    try {
      setLoading(true);
      const res = await apiFetchV1<{
        filename: string;
        file_content: string;
        total_records: number;
      }>(`/tax/tds/form26q/export?quarter=${quarter}&financial_year=${encodeURIComponent(financialYear)}`);

      if (res && res.file_content) {
        const blob = new Blob([res.file_content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || `FORM26Q_${quarter}_${financialYear}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert("Failed to export Form 26Q return file.");
      }
    } catch (err: any) {
      alert("Error exporting Form 26Q: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Preview Form 26Q NSDL Text
  const handlePreviewForm26Q = async () => {
    try {
      setLoading(true);
      const res = await apiFetchV1<{
        filename: string;
        file_content: string;
        total_records: number;
      }>(`/tax/tds/form26q/export?quarter=${quarter}&financial_year=${encodeURIComponent(financialYear)}`);

      if (res && res.file_content) {
        setPreviewFilename(res.filename);
        setPreviewContent(res.file_content);
        setIsPreviewOpen(true);
      }
    } catch (err: any) {
      alert("Error generating preview: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Landmark size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Government Challan 281 & Form 26Q Compliance Studio
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/40">
                    Statutory Tax Remittance & e-TDS Return
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Income Tax Department (NSDL) Compliance • Income Tax Act 1961 (Sec 194Q / 194C / 206AA) • TAN: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{summary?.tan || "DELA12345A"}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Quarter & FY Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-2xs">
              {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuarter(q)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    quarter === q
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              <option value="2026-27">FY 2026-27 (AY 2027-28)</option>
              <option value="2025-26">FY 2025-26 (AY 2026-27)</option>
              <option value="2024-25">FY 2024-25 (AY 2025-26)</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh compliance records"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 4 Financial Health KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Gross Invoiced Base */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-600 dark:text-slate-400" />
                  Gross Base Billed
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Assessed Base</span>
              </div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                {fmt(
                  (summary?.deductees || []).reduce((acc, curr) => acc + curr.gross_amount, 0)
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                Total commercial bills & adjustments in {quarter}
              </div>
            </div>

            {/* Card 2: Total TDS Deducted */}
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                <span className="flex items-center gap-1.5">
                  <Receipt size={14} className="text-indigo-600 dark:text-indigo-400" />
                  Statutory TDS Withheld
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                  Account 2030
                </span>
              </div>
              <div className="text-lg font-black font-mono text-indigo-700 dark:text-indigo-400">
                {fmt(summary?.total_tds_deducted || 0)}
              </div>
              <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">
                {summary?.total_deductees_count || 0} deductee transaction(s) accrued
              </div>
            </div>

            {/* Card 3: Deposited via Challan 281 */}
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                  Remitted via Challan 281
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                  Account 1020
                </span>
              </div>
              <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                {fmt(summary?.total_tds_deposited || 0)}
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                {summary?.total_challans_count || 0} BSR challan remittance(s)
              </div>
            </div>

            {/* Card 4: Net Variance / Shortfall */}
            <div className={`p-3.5 rounded-xl border shadow-2xs space-y-1 ${
              (summary?.unallocated_shortfall || 0) > 0
                ? "border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className={`flex items-center gap-1.5 ${
                  (summary?.unallocated_shortfall || 0) > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
                }`}>
                  <ShieldAlert size={14} />
                  Net Remittance Shortfall
                </span>
                <span className={`text-[9px] uppercase font-bold px-1 rounded ${
                  (summary?.unallocated_shortfall || 0) > 0
                    ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                }`}>
                  {(summary?.unallocated_shortfall || 0) > 0 ? "Due" : "Balanced"}
                </span>
              </div>
              <div className={`text-lg font-black font-mono ${
                (summary?.unallocated_shortfall || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {fmt(summary?.unallocated_shortfall || 0)}
              </div>
              <div className="text-[10px] text-slate-400">
                {(summary?.unallocated_shortfall || 0) > 0
                  ? "Pending discharge into central government treasury"
                  : "Quarterly liability 100% matched & remitted"}
              </div>
            </div>
          </div>

          {/* Action Strip: Record Challan, Export Form 26Q, View Text */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDepositOpen(!isDepositOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <Plus size={14} />
                <span>Record Challan 281 Deposit</span>
              </button>

              <button
                type="button"
                onClick={handlePreviewForm26Q}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors"
              >
                <Eye size={13} />
                <span>Inspect NSDL ASCII Layout</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportForm26Q}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
                title="Download e-TDS text file ready for NSDL e-Filing Utility verification"
              >
                <Download size={13} />
                <span>Export Form 26Q (NSDL .txt)</span>
              </button>
            </div>
          </div>

          {/* Record Challan 281 Form Sub-Panel */}
          {isDepositOpen && (
            <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-xs space-y-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Record Government TDS Remittance (ITNS 281)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDepositOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRecordChallan} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Challan No */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Challan Serial No *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 00142"
                      value={challanNo}
                      onChange={(e) => setChallanNo(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* BSR Code (7 Digits) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      BSR Code (7 Digits) *
                    </label>
                    <input
                      type="text"
                      maxLength={7}
                      placeholder="e.g. 0002134"
                      value={bsrCode}
                      onChange={(e) => setBsrCode(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Challan Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Deposit Date *
                    </label>
                    <input
                      type="date"
                      value={challanDate}
                      onChange={(e) => setChallanDate(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* TDS Section */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      TDS Section *
                    </label>
                    <select
                      value={tdsSection}
                      onChange={(e) => setTdsSection(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="194Q">Sec 194Q - Purchase of Goods (0.10%)</option>
                      <option value="194C">Sec 194C - Contractor Payments (1% / 2%)</option>
                      <option value="194J">Sec 194J - Professional / Tech Fees (10%)</option>
                      <option value="194H">Sec 194H - Commission / Brokerage (5%)</option>
                      <option value="194I">Sec 194I - Rent on Land/Building (10%)</option>
                    </select>
                  </div>

                  {/* Tax Component */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Tax Component (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Surcharge */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Surcharge (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={surcharge}
                      onChange={(e) => setSurcharge(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Education Cess */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Education Cess (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cess}
                      onChange={(e) => setCess(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Remitting Bank */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Drawn Bank Account
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Statutory Interest (Sec 201(1A)) */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">
                      Interest Sec 201(1A) (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={interest}
                      onChange={(e) => setInterest(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                    />
                  </div>

                  {/* Late Filing Fee (Sec 234E) */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">
                      Late Fee Sec 234E (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                    />
                  </div>

                  {/* Minor Head */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Tax Head (Minor)
                    </label>
                    <select
                      value={minorHead}
                      onChange={(e) => setMinorHead(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="200">200 - TDS/TCS Payable by Taxpayer</option>
                      <option value="400">400 - TDS/TCS Regular Assessment</option>
                    </select>
                  </div>

                  {/* Narration */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Voucher Narration
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Q2 Remittance HDFC Netbanking"
                      value={depositNarration}
                      onChange={(e) => setDepositNarration(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Double-Entry Balancing Preview */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Authoritative General Ledger Postings
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
                      <span>DR 2030 (TDS Payable): <strong className="text-indigo-600 dark:text-indigo-400">{fmt(depositTaxComponent)}</strong></span>
                      {depositChargesComponent > 0 && (
                        <span>DR 5090 (Statutory Charges): <strong className="text-amber-600 dark:text-amber-400">{fmt(depositChargesComponent)}</strong></span>
                      )}
                      <span>CR 1020 (Bank Account): <strong className="text-emerald-600 dark:text-emerald-400">{fmt(depositTotal)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                      <CheckCircle2 size={13} />
                      Σ Debit == Σ Credit ({fmt(depositTotal)})
                    </span>
                    <button
                      type="submit"
                      disabled={submittingDeposit || depositTotal <= 0}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      {submittingDeposit ? "Posting to Ledger..." : "Commit Remittance →"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Sub-Tabs: Deductees vs Recorded Challans */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("deductees")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    activeTab === "deductees"
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Form 26Q Deductee Register ({summary?.total_deductees_count || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("challans")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    activeTab === "challans"
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Recorded Challan 281 Vouchers ({challansList.length})
                </button>
              </div>
            </div>

            {/* TAB 1: Deductees Table */}
            {activeTab === "deductees" && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Deductee Entity</th>
                        <th className="py-2.5 px-3">PAN & Type</th>
                        <th className="py-2.5 px-3">Section</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Base Amount</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">TDS Withheld</th>
                        <th className="py-2.5 px-3">Reason Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {(summary?.deductees || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            No deductee transactions recorded in {quarter} {financialYear}.
                          </td>
                        </tr>
                      ) : (
                        (summary?.deductees || []).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                              {row.vendor_name}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.pan_valid
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                  : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                              }`}>
                                {row.pan}
                              </span>
                              <span className="ml-1 text-[10px] text-slate-400">
                                ({row.deductee_code === "01" ? "Company" : "Non-Co"})
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                              {row.section}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {row.payment_credit_date}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900 dark:text-white">
                              {fmt(row.gross_amount)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                              {row.tds_rate.toFixed(2)}%
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                              {fmt(row.tds_amount)}
                            </td>
                            <td className="py-2 px-3">
                              {row.reason_code === "C" ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300" title="Section 206AA Penal Rate Applied">
                                  'C' Sec 206AA
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Recorded Challan 281 Vouchers Table */}
            {activeTab === "challans" && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Challan / BSR</th>
                        <th className="py-2.5 px-3">Deposit Date</th>
                        <th className="py-2.5 px-3">Section & Head</th>
                        <th className="py-2.5 px-3 text-right">Tax (2030)</th>
                        <th className="py-2.5 px-3 text-right">Interest / Fee (5090)</th>
                        <th className="py-2.5 px-3 text-right">Total Remitted (1020)</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {challansList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            No Challan 281 remittance vouchers recorded in {quarter} {financialYear}.
                          </td>
                        </tr>
                      ) : (
                        challansList.map((ch) => (
                          <tr key={ch.voucher_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 dark:text-white">#{ch.challan_no}</span>
                              <div className="text-[10px] text-slate-400">BSR: {ch.bsr_code}</div>
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {ch.challan_date}
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{ch.tds_section}</span>
                              <div className="text-[10px] text-slate-400">Head: {ch.minor_head}</div>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900 dark:text-white">
                              {fmt(ch.tax_amount + (ch.surcharge || 0) + (ch.cess || 0))}
                            </td>
                            <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">
                              {fmt((ch.interest || 0) + (ch.fee || 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {fmt(ch.total_amount)}
                            </td>
                            <td className="py-2 px-3">
                              {ch.is_cancelled ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300">
                                  CANCELLED
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                  POSTED
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {!ch.is_cancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelChallan(ch.voucher_id, ch.challan_no)}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Cancel Challan & Revert General Ledger Voucher"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>SMRITI e-TDS Engine v6.52.0</span>
            <span>•</span>
            <span>NSDL Form 26Q File Specification Compliant</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
          >
            Close Studio
          </button>
        </div>
      </div>

      {/* NSDL ASCII Text Inspection Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileText size={16} className="text-emerald-400" />
                <span>NSDL ASCII e-TDS Return Payload: {previewFilename}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-[60vh] whitespace-pre select-all border border-slate-800">
              {previewContent}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewContent);
                  alert("Copied NSDL ASCII content to clipboard!");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Copy to Clipboard
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
