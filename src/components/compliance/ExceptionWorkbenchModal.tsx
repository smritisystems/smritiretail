/**
 * Project      : SMRITI Business OS
 * Component    : ExceptionWorkbenchModal (SCP Exception Manager Studio)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Compliance Platform (SCP v1.0)
 */

import React, { useState } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Edit3, 
  Search, 
  Check, 
  X,
  FileSpreadsheet
} from "lucide-react";
import { ComplianceException } from "../../sdk/IComplianceModule";

interface ExceptionWorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  period?: string;
}

const MOCK_EXCEPTIONS: ComplianceException[] = [
  {
    exceptionId: "exc-001",
    voucherId: "inv-2026-881",
    voucherNo: "INV-2026-0881",
    entityType: "SALES_INVOICE",
    severity: "ERROR",
    category: "GSTIN",
    errorCode: "INVALID_GSTIN_CHECKSUM",
    title: "Invalid Customer GSTIN Format",
    description: "Customer GSTIN '27AAACG1234F1Z0' fails state code 27 statutory checksum validation.",
    suggestedFix: "Update customer GSTIN in Master to a valid 15-digit state format.",
    fieldRef: "customer_gstin",
    currentValue: "27AAACG1234F1Z0"
  },
  {
    exceptionId: "exc-002",
    voucherId: "inv-2026-892",
    voucherNo: "INV-2026-0892",
    entityType: "SALES_INVOICE",
    severity: "ERROR",
    category: "HSN",
    errorCode: "MISSING_MANDATORY_HSN",
    title: "Missing HSN Code on B2B Line Item",
    description: "B2B Line Item 'Cotton Apparel Special' requires mandatory 6-digit HSN code for GSTR-1.",
    suggestedFix: "Enter HSN Code 620520 in Item Master or Invoice line item.",
    fieldRef: "items[0].hsn_code",
    currentValue: ""
  },
  {
    exceptionId: "exc-003",
    voucherId: "inv-2026-905",
    voucherNo: "INV-2026-0905",
    entityType: "SALES_INVOICE",
    severity: "WARNING",
    category: "EWAY_BILL",
    errorCode: "EWAY_THRESHOLD_EXCEEDED",
    title: "Consignment Exceeds â‚¹50,000 Threshold",
    description: "Interstate B2B invoice total is â‚¹1,24,500. Statutory E-Way bill is required prior to dispatch.",
    suggestedFix: "Generate E-Way Bill or provide vehicle number & transporter ID.",
    fieldRef: "eway_bill_no",
    currentValue: "PENDING"
  },
  {
    exceptionId: "exc-004",
    voucherId: "rcpt-2026-104",
    voucherNo: "RCPT-2026-0104",
    entityType: "PURCHASE_RECEIPT",
    severity: "WARNING",
    category: "MSME",
    errorCode: "MSME_PAYMENT_DUE",
    title: "MSME Micro-Supplier Payment Due (45-Day Rule)",
    description: "Payment to MSME vendor 'Apex Cottons' exceeds 30 days. Statutory 45-day deadline approaches.",
    suggestedFix: "Schedule payment voucher before month end to claim Income Tax deduction.",
    fieldRef: "payment_status",
    currentValue: "UNPAID"
  }
];

export const ExceptionWorkbenchModal: React.FC<ExceptionWorkbenchModalProps> = ({
  isOpen,
  onClose,
  period = "2026-07"
}) => {
  const [exceptions, setExceptions] = useState<ComplianceException[]>(MOCK_EXCEPTIONS);
  const [activeTab, setActiveTab] = useState<"ALL" | "ERRORS" | "WARNINGS" | "RESOLVED">("ALL");
  const [selectedException, setSelectedException] = useState<ComplianceException | null>(null);
  const [correctionValue, setCorrectionValue] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelectException = (exc: ComplianceException) => {
    setSelectedException(exc);
    setCorrectionValue(exc.currentValue || "");
  };

  const handleResolveException = () => {
    if (!selectedException) return;
    setIsRevalidating(true);
    setTimeout(() => {
      setExceptions((prev) => prev.filter((e) => e.exceptionId !== selectedException.exceptionId));
      setSelectedException(null);
      setIsRevalidating(false);
    }, 600);
  };

  const filtered = exceptions.filter((exc) => {
    if (activeTab === "ERRORS" && exc.severity !== "ERROR") return false;
    if (activeTab === "WARNINGS" && exc.severity !== "WARNING") return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        exc.voucherNo.toLowerCase().includes(q) ||
        exc.title.toLowerCase().includes(q) ||
        exc.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const errorCount = exceptions.filter((e) => e.severity === "ERROR").length;
  const warningCount = exceptions.filter((e) => e.severity === "WARNING").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--sds-color-border)] flex items-center justify-between bg-[var(--sds-color-surface)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/60 border border-indigo-500/30 rounded-xl text-indigo-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-theme-heading flex items-center gap-2">
                <span>SCP Exception Workbench</span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-theme-surface-2 border border-theme-divider rounded-full text-indigo-400">
                  {period}
                </span>
              </h3>
              <p className="text-xs text-theme-muted">
                Pre-Flight Statutory Exception Manager & Instant Revalidation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsRevalidating(true);
                setTimeout(() => setIsRevalidating(false), 500);
              }}
              className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider hover:border-indigo-500/40 text-theme-body text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isRevalidating ? "animate-spin text-indigo-400" : ""} />
              <span>Revalidate Period</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover rounded-xl transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Telemetry Tabs Bar */}
        <div className="px-6 py-3 border-b border-theme-divider/60 bg-theme-surface-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "ALL"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-theme-surface-2 text-theme-muted hover:text-theme-body"
              }`}
            >
              <span>All Exceptions</span>
              <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-mono">{exceptions.length}</span>
            </button>

            <button
              onClick={() => setActiveTab("ERRORS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "ERRORS"
                  ? "bg-rose-600 text-white shadow-md"
                  : "bg-rose-950/30 text-rose-400 border border-rose-500/20 hover:bg-rose-900/40"
              }`}
            >
              <XCircle size={13} />
              <span>Errors (Blocking)</span>
              <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-mono">{errorCount}</span>
            </button>

            <button
              onClick={() => setActiveTab("WARNINGS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === "WARNINGS"
                  ? "bg-amber-600 text-white shadow-md"
                  : "bg-amber-950/30 text-amber-400 border border-amber-500/20 hover:bg-amber-900/40"
              }`}
            >
              <AlertTriangle size={13} />
              <span>Warnings</span>
              <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-mono">{warningCount}</span>
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher, title, category..."
              className="pl-9 pr-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-xl text-xs text-theme-body focus:border-[var(--c-seef-accent)] outline-none w-64"
            />
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* List Table */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-theme-muted">
                <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-2 opacity-80" />
                <p className="font-bold text-sm text-theme-body">All Statutory Exceptions Resolved!</p>
                <p className="text-xs mt-1">Period {period} is 100% compliant and ready for filing submission.</p>
              </div>
            ) : (
              filtered.map((exc) => {
                const isSelected = selectedException?.exceptionId === exc.exceptionId;
                return (
                  <div
                    key={exc.exceptionId}
                    onClick={() => handleSelectException(exc)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex items-start justify-between gap-4 ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/60 shadow-lg"
                        : "bg-theme-surface-1 border-theme-divider hover:border-theme-muted hover:bg-theme-surface-hover"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            exc.severity === "ERROR"
                              ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                              : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {exc.severity}
                        </span>
                        <span className="font-mono text-xs font-bold text-theme-heading">{exc.voucherNo}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-theme-surface-2 text-theme-muted border border-theme-divider">
                          {exc.category}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-theme-heading">{exc.title}</h4>
                      <p className="text-xs text-theme-muted leading-relaxed">{exc.description}</p>
                    </div>

                    <button
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-theme-surface-2 border-theme-divider text-indigo-400 hover:bg-indigo-950/30"
                      }`}
                    >
                      <Edit3 size={13} />
                      <span>Fix & Revalidate</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Fix & Revalidate Side Drawer */}
          {selectedException && (
            <div className="w-96 border-l border-theme-divider bg-[#0F1420] p-5 flex flex-col justify-between animate-in slide-in-from-right duration-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-divider">
                  <h4 className="font-bold text-xs font-display text-theme-heading uppercase tracking-wide flex items-center gap-2">
                    <Edit3 size={14} className="text-indigo-400" />
                    <span>Inline Exception Fix</span>
                  </h4>
                  <button
                    onClick={() => setSelectedException(null)}
                    className="text-theme-muted hover:text-theme-body"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-indigo-400">{selectedException.voucherNo}</div>
                  <div className="text-xs font-bold text-theme-heading">{selectedException.title}</div>
                  <p className="text-xs text-theme-muted bg-theme-surface-2 p-3 rounded-xl border border-theme-divider leading-relaxed">
                    {selectedException.suggestedFix}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
                    Target Field ({selectedException.fieldRef})
                  </label>
                  <input
                    type="text"
                    value={correctionValue}
                    onChange={(e) => setCorrectionValue(e.target.value)}
                    className="w-full px-3 py-2 bg-theme-surface-1 border border-indigo-500/40 rounded-xl text-xs text-theme-heading outline-none focus:border-[var(--c-seef-accent)] focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    placeholder="Enter corrected value..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-theme-divider flex items-center gap-2">
                <button
                  onClick={() => setSelectedException(null)}
                  className="flex-1 py-2 bg-theme-surface-2 border border-theme-divider text-theme-muted text-xs font-semibold rounded-xl hover:bg-theme-surface-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveException}
                  disabled={isRevalidating}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                >
                  {isRevalidating ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Apply & Revalidate</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
