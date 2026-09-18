/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.40.1
 * Created      : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: B2B Dispatch & Tax Invoicing Studio Tab
 */

import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  RefreshCw,
  Truck,
  Building2,
  Calendar,
  Percent,
  Hash,
  ShieldCheck,
  ArrowRight,
  Package,
  Layers,
  Check,
  Clock,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetchV1, openAuthenticatedDocument } from "../../lib/apiFetchV1";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import { withCapability } from "../../types/architecture";

interface DispatchStoreSummary {
  store_code: string;
  store_name: string;
  po_number?: string;
  po_date?: string;
  state: string;
  state_code: number;
  gstin: string;
  pincode?: number;
  city?: string;
  distance_km?: number;
  is_interstate: boolean;
  pairs_count: number;
  rows_count: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  grand_total: number;
  rounding_amount: number;
  status: "READY" | "WARNING" | "ERROR";
  validation_errors: string[];
  validation_warnings: string[];
}

interface DispatchValidationIssue {
  severity: "ERROR" | "WARNING";
  store_code?: string;
  row_index?: number;
  message: string;
  guidance?: string;
}

interface DispatchPreflightAuditResponse {
  sheet_name: string;
  available_sheets: string[];
  detected_sizes: string[];
  total_stores: number;
  total_pairs: number;
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  total_invoice_value: number;
  stores: DispatchStoreSummary[];
  issues: DispatchValidationIssue[];
  is_valid_to_generate: boolean;
  audit_token: string;
}

interface DispatchGeneratedInvoice {
  invoice_id: string;
  invoice_no: string;
  identity_code: string;
  store_code: string;
  site_name: string;
  po_number?: string;
  pairs_count: number;
  taxable_value: number;
  tax_total: number;
  grand_total: number;
  eway_bill_id?: string;
  eway_identity_code?: string;
  pdf_filename: string;
}

interface DispatchBatchResult {
  batch_id: string;
  status: string;
  invoice_date: string;
  total_invoices: number;
  total_pairs: number;
  total_value: number;
  generated_invoices: DispatchGeneratedInvoice[];
  zip_download_url: string;
  execution_time_seconds: number;
  message: string;
}

interface DispatchInvoicingStudioTabProps {
  currentUser?: any;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

const DispatchInvoicingStudioTabBase: React.FC<DispatchInvoicingStudioTabProps> = ({
  currentUser,
  onNotification
}) => {
  // File & Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration Parameters
  const [sheetName, setSheetName] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("2026-09-05");
  const [customerName, setCustomerName] = useState<string>("Reliance Retail Limited");
  const [seriesPrefix, setSeriesPrefix] = useState<string>("TT2026-2027/");
  const [discountPct, setDiscountPct] = useState<number>(43.76);
  const [gstRate, setGstRate] = useState<number>(5.00);
  const [startingSeq, setStartingSeq] = useState<string>("");

  // Audit & Execution States
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<DispatchPreflightAuditResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [batchResult, setBatchResult] = useState<DispatchBatchResult | null>(null);

  // File Drop & Select Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setSelectedFile(file);
        setAuditResult(null);
        setBatchResult(null);
      } else {
        if (onNotification) {
          onNotification("Invalid File Format", "Please upload an Excel workbook (.xlsx or .xls).", "error");
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setAuditResult(null);
      setBatchResult(null);
    }
  };

  // 1. Run Pre-Flight Audit
  const handleRunAudit = async () => {
    if (!selectedFile) {
      if (onNotification) onNotification("File Required", "Please upload a dispatch Excel workbook.", "warning");
      return;
    }

    setIsAuditing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (sheetName.trim()) {
        formData.append("sheet_name", sheetName.trim());
      }
      formData.append("discount_pct", discountPct.toString());
      formData.append("gst_rate", gstRate.toString());

      const res = await apiFetchV1("/dispatch-invoicing/pre-flight-audit", {
        method: "POST",
        body: formData,
      });

      setAuditResult(res);
      if (res.available_sheets && res.available_sheets.length > 0 && !sheetName) {
        setSheetName(res.sheet_name);
      }

      if (res.is_valid_to_generate) {
        if (onNotification) {
          onNotification(
            "Pre-Flight Audit Passed",
            `Verified ${res.total_stores} stores and ${res.total_pairs} pairs with 100% tax parity.`,
            "success"
          );
        }
      } else {
        if (onNotification) {
          onNotification(
            "Audit Identified Issues",
            "Please review the issues table before generating invoices.",
            "warning"
          );
        }
      }
    } catch (err: any) {
      if (onNotification) {
        onNotification("Audit Failed", err.message || "Failed to execute pre-flight audit.", "error");
      }
    } finally {
      setIsAuditing(false);
    }
  };

  // 2. Generate Invoices & Package Delivery
  const handleGenerateBatch = async () => {
    if (!auditResult || !auditResult.audit_token) {
      if (onNotification) onNotification("Audit Required", "Please run Pre-Flight Audit first.", "warning");
      return;
    }

    setIsGenerating(true);
    setGenerationStep("1/4: Allocating Sovereign Document Numbers & PostgreSQL Invoices...");

    try {
      const payload: any = {
        audit_token: auditResult.audit_token,
        invoice_date: invoiceDate,
        series_prefix: seriesPrefix,
        customer_name: customerName,
        discount_pct: discountPct,
        hsn_code: "64041990",
        gst_rate: gstRate,
      };

      if (startingSeq.trim()) {
        payload.starting_sequence = parseInt(startingSeq.trim(), 10);
      }

      setGenerationStep("2/4: Generating NIC E-Way Bill Payloads & Allocation Logs...");
      
      const res: DispatchBatchResult = await apiFetchV1("/dispatch-invoicing/generate-batch", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setGenerationStep("3/4: Rendering Statutory A4 PDFs & Stamping Excel Sheet...");
      setBatchResult(res);

      if (onNotification) {
        onNotification(
          "Invoicing Completed",
          `Generated ${res.total_invoices} tax invoices and packaged delivery bundle in ${res.execution_time_seconds}s.`,
          "success"
        );
      }
    } catch (err: any) {
      if (onNotification) {
        onNotification("Batch Generation Failed", err.message || "Failed to generate dispatch batch.", "error");
      }
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  // Download ZIP Package Handler
  const handleDownloadZip = () => {
    if (!batchResult) return;
    window.open(batchResult.zip_download_url, "_blank");
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                B2B Dispatch & Tax Invoicing Studio
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                v6.40.1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated Excel Matrix-to-Invoice Pipeline: Store Resolution, Monotonic Numbering, Golden CSS A4 PDFs & NIC E-Way Bills
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {batchResult && (
            <button
              onClick={() => {
                setBatchResult(null);
                setAuditResult(null);
                setSelectedFile(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Dispatch
            </button>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Identity Governed (Rule 13)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Parameters */}
      {!batchResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Upload Dropzone (1 Column) */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                1. Upload Dispatch Excel Matrix
              </h2>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50/50"
                    : selectedFile
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800 truncate max-w-[220px] mx-auto">
                      {selectedFile.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to replace
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      Drag & Drop Dispatch Matrix here
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Supports client sheets with sizes (36..42)
                    </div>
                  </div>
                )}
              </div>

              {auditResult && auditResult.available_sheets.length > 1 && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Sheet in Workbook
                  </label>
                  <select
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {auditResult.available_sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleRunAudit}
              disabled={!selectedFile || isAuditing}
              className={`w-full mt-4 py-2 px-3 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-xs transition-colors ${
                !selectedFile || isAuditing
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isAuditing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running Pre-Flight Audit...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Run Pre-Flight Audit
                </>
              )}
            </button>
          </div>

          {/* Invoicing Parameters (2 Columns) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-blue-600" />
              2. Commercial Billing & Dispatch Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Invoice Statutory Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Commercial Customer
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Series Prefix (Monotonic)
                </label>
                <input
                  type="text"
                  value={seriesPrefix}
                  onChange={(e) => setSeriesPrefix(e.target.value)}
                  placeholder="TT2026-2027/"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  Trade Discount % (MRP Markdown)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  Dispatch Location Depot
                </label>
                <input
                  type="text"
                  disabled
                  value="Tattly Threads Nagpur Depot (WH-NGP, 440029, GST: 27)"
                  className="w-full text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Override Starting Sequence (Optional)
                </label>
                <input
                  type="number"
                  value={startingSeq}
                  onChange={(e) => setStartingSeq(e.target.value)}
                  placeholder="Auto-detect next maximum in DB"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50/60 border border-blue-200/70 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Statutory Legal Metrology & GST Rule 46(b):</span> Unit rates are derived cleanly as{" "}
                <code className="bg-blue-100/80 px-1 py-0.5 rounded text-[11px] font-mono">
                  round(MRP * {(1 - discountPct / 100).toFixed(4)}, 2)
                </code>
                . Destination state code is automatically evaluated for IGST 5% vs Intra-state CGST 2.5% + SGST 2.5%.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Results Deck */}
      {auditResult && !batchResult && (
        <div className="space-y-6">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Stores</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{auditResult.total_stores}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{auditResult.detected_sizes.join(", ")} sizes</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Pairs</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{formatNumber(auditResult.total_pairs)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Physical Footwear Pairs</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Taxable Value</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(auditResult.total_taxable)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Pre-Tax Commercial Base</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">GST Total (5%)</div>
              <div className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(auditResult.total_tax)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">IGST: {formatCurrency(auditResult.total_igst)}</div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">Net Invoiced Value</div>
              <div className="text-xl font-bold text-emerald-900 mt-1">{formatCurrency(auditResult.total_invoice_value)}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">Inclusive of Round-off</div>
            </div>
          </div>

          {/* Issues / Alerts Banner */}
          {auditResult.issues.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Pre-Flight Validation Messages ({auditResult.issues.length})
              </h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {auditResult.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                      issue.severity === "ERROR"
                        ? "bg-rose-50 text-rose-900 border border-rose-200"
                        : "bg-amber-50 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {issue.severity === "ERROR" ? (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold">{issue.store_code ? `[${issue.store_code}] ` : ""}</span>
                      {issue.message}
                      {issue.guidance && <span className="text-slate-600 block text-[11px] mt-0.5">Guidance: {issue.guidance}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Store Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Store Breakdown & Tax Partitioning Matrix
              </h3>
              <span className="text-xs text-slate-500">
                {auditResult.stores.length} Store Sites Identified
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Store Code</th>
                    <th className="py-2.5 px-3">Store Name</th>
                    <th className="py-2.5 px-3">PO Number</th>
                    <th className="py-2.5 px-3 text-center">Pairs</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-3 text-right">GST (5%)</th>
                    <th className="py-2.5 px-3 text-right">Net Value</th>
                    <th className="py-2.5 px-3">Destination State</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditResult.stores.map((store) => (
                    <tr key={store.store_code} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {store.store_code}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[200px] truncate">
                        {store.store_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {store.po_number || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {store.pairs_count}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatCurrency(store.taxable_value)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700">
                        {formatCurrency(store.tax_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                        {formatCurrency(store.grand_total)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-slate-700 mr-1.5">{store.state}</span>
                        {store.is_interstate ? (
                          <span className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded">
                            IGST
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded">
                            INTRA
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {store.status === "READY" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" /> Ready
                          </span>
                        ) : store.status === "WARNING" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Execution Footer Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Clicking Generate will commit invoices to PostgreSQL and package all printable PDFs and NIC E-Way JSONs.
              </div>

              <button
                onClick={handleGenerateBatch}
                disabled={!auditResult.is_valid_to_generate || isGenerating}
                className={`py-2 px-5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all ${
                  !auditResult.is_valid_to_generate || isGenerating
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {generationStep || "Generating Batch..."}
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Generate {auditResult.total_stores} Invoices & Package Delivery
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 3: Completed Delivery Package & Download Center */}
      {batchResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Dispatch Batch Invoiced & Packaged Successfully!
            </h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Generated {batchResult.total_invoices} statutory GST Tax Invoices ({formatNumber(batchResult.total_pairs)} pairs) totaling{" "}
              <span className="font-semibold text-slate-800">{formatCurrency(batchResult.total_value)}</span> in{" "}
              {batchResult.execution_time_seconds} seconds.
            </p>
          </div>

          {/* Direct Download Button */}
          <div className="flex justify-center">
            <button
              onClick={handleDownloadZip}
              className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2.5 shadow-md hover:shadow-lg transition-all"
            >
              <Download className="w-5 h-5" />
              Download Complete Delivery Package (ZIP)
            </button>
          </div>

          {/* Generated Invoices List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
              <span>Generated Invoices & NIC E-Way Bills</span>
              <span className="text-[11px] text-slate-500">Batch: {batchResult.batch_id}</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
              {batchResult.generated_invoices.map((inv) => (
                <div key={inv.invoice_id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 font-mono flex items-center gap-2">
                        {inv.invoice_no}
                        <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {inv.identity_code}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Store: {inv.store_code} ({inv.site_name}) • PO: {inv.po_number || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-emerald-800 font-mono">{formatCurrency(inv.grand_total)}</div>
                    <div className="text-[11px] text-slate-500">{inv.pairs_count} PRS</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DispatchInvoicingStudioTab = withCapability(DispatchInvoicingStudioTabBase, {
  entity: "SALES",
  capability: "B2B_DISPATCH_INVOICING_STUDIO",
  role: "ADAPTER",
  canonicalOwner: "backend/app/services/dispatch_invoicing_engine.py",
});
