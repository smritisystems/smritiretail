/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-15
 * Modified     : 2026-09-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Barcode Billing CSV Import Modal
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, X, FileText, CheckCircle2, AlertTriangle,
  XCircle, ChevronDown, ChevronUp, Tag, Loader2,
  ShieldAlert, ClipboardList, Info, Building2,
  Sparkles, CheckSquare, ListOrdered,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import {
  CsvImportRow, CsvImportResult, CsvRowStatus,
} from "./types";
import { Product } from "../../types";
import { SmritiSalesPromotionService } from "../../services/smritiSalesPromotionService";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BarcodeCSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: {
    id?: string;
    code?: string;
    name?: string;
    customerGroup?: string;
    customerGroupId?: string;
  } | null;
  /** Called with validated resolved rows when user confirms import */
  onImportConfirmed: (items: ResolvedCartItem[]) => void;
}

export interface ResolvedCartItem {
  barcode: string;
  resolved_item: string;
  resolved_sku: string;
  product_id?: string;
  hsn_code?: string;
  quantity: number;
  catalog_mrp: number;
  effective_selling_price: number;
  is_tax_inclusive?: boolean;
  tax_mode_display?: string;
  gst_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  line_total: number;
  uom: string;
  batch_no?: string;
  salesperson_id?: string;
  mrp_markdown_display?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Format tier metadata
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, string> = {
  FORMAT_1: "bg-sky-900/40 text-sky-300 border-sky-700",
  FORMAT_2: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  FORMAT_3: "bg-violet-900/40 text-violet-300 border-violet-700",
  FORMAT_4: "bg-amber-900/40 text-amber-300 border-amber-700",
  FORMAT_5: "bg-orange-900/40 text-orange-300 border-orange-700",
  FORMAT_6: "bg-rose-900/40 text-rose-300 border-rose-700",
  FORMAT_PDT: "bg-teal-900/40 text-teal-300 border-teal-700",
  FORMAT_B2B_RATE: "bg-cyan-900/40 text-cyan-300 border-cyan-700",
  FORMAT_COMMERCIAL_DISC: "bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-700",
};

const FORMAT_SAMPLE: Record<string, string> = {
  FORMAT_1: "barcode",
  FORMAT_2: "barcode, quantity",
  FORMAT_3: "barcode, quantity, selling_price",
  FORMAT_4: "barcode, quantity, rate",
  FORMAT_5: "barcode, quantity, discount_percent",
  FORMAT_6: "barcode, sku, quantity, mrp, selling_price, gst_rate, hsn_code",
  FORMAT_PDT: "890100~2~50.00  (tilde-delimited)",
  FORMAT_B2B_RATE: "barcode, quantity, rate, is_tax_inclusive",
  FORMAT_COMMERCIAL_DISC: "barcode, quantity, rate, disc%, disc_amt, is_tax_inclusive",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CsvRowStatus }) {
  if (status === "VALID")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700">
        <CheckCircle2 size={10} /> VALID
      </span>
    );
  if (status === "WARNING")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/50 text-amber-300 border border-amber-700">
        <AlertTriangle size={10} /> WARN
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-900/50 text-rose-400 border border-rose-700">
      <XCircle size={10} /> ERROR
    </span>
  );
}

function RowCard({ row, idx }: { row: CsvImportRow; idx: number }) {
  const [open, setOpen] = useState(false);
  const isOk = row.status !== "REJECTED";

  return (
    <div
      className={`rounded-lg border text-xs transition-all ${
        row.status === "REJECTED"
          ? "border-rose-700/60 bg-rose-950/30"
          : row.status === "WARNING"
          ? "border-amber-700/50 bg-amber-950/20"
          : "border-outline-variant/60 bg-surface-container-lowest"
      }`}
    >
      {/* Row header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setOpen((p) => !p)}
        role="button"
        aria-expanded={open}
      >
        <span className="font-code-md text-on-surface-variant w-6 text-center shrink-0">
          {idx + 1}
        </span>
        <span className="font-mono font-bold text-on-surface flex-1 truncate">
          {row.barcode}
        </span>

        {isOk && row.resolved_item && (
          <span className="text-on-surface-variant truncate max-w-[160px]">
            {row.resolved_item}
          </span>
        )}
        {isOk && row.quantity !== undefined && (
          <span className="font-bold text-on-surface shrink-0">
            ×{row.quantity}
          </span>
        )}
        {isOk && row.effective_selling_price !== undefined && (
          <span className="text-primary font-bold shrink-0">
            ₹{row.effective_selling_price.toFixed(2)}
          </span>
        )}
        {isOk && row.mrp_markdown_display && (
          <span className="bg-emerald-900/50 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0">
            {row.mrp_markdown_display}
          </span>
        )}
        {isOk && (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
              row.is_tax_inclusive === false
                ? "bg-amber-900/50 text-amber-300 border-amber-700"
                : "bg-sky-900/50 text-sky-300 border-sky-700"
            }`}
          >
            {row.is_tax_inclusive === false ? "EXC TAX" : "INC TAX"}
          </span>
        )}

        <StatusBadge status={row.status} />
        {open ? (
          <ChevronUp size={14} className="text-on-surface-variant shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-on-surface-variant shrink-0" />
        )}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-outline-variant/50 px-3 py-2.5 space-y-2">
          {row.status === "REJECTED" ? (
            <div className="flex gap-2 items-start">
              <ShieldAlert size={14} className="text-rose-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-rose-400">{row.error_code}</p>
                <p className="text-rose-300/90 leading-snug">{row.error_message}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Resolution details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Detail label="SKU" value={row.resolved_sku} mono />
                <Detail label="UOM" value={row.uom} />
                <Detail label="Tax Mode" value={row.tax_mode_display || (row.is_tax_inclusive ? "INCLUSIVE" : "EXCLUSIVE")} />
                <Detail label="Catalogue MRP" value={row.catalog_mrp !== undefined ? `₹${row.catalog_mrp.toFixed(2)}` : undefined} />
                <Detail label={row.is_tax_inclusive === false ? "Base Rate" : "Selling Price"} value={row.effective_selling_price !== undefined ? `₹${row.effective_selling_price.toFixed(2)}` : undefined} highlight />
                <Detail label="GST Rate" value={row.gst_rate !== undefined ? `${row.gst_rate}%` : undefined} />
                <Detail label="Taxable Value" value={row.taxable_value !== undefined ? `₹${row.taxable_value.toFixed(2)}` : undefined} />
                <Detail label="CGST" value={row.cgst_amount !== undefined ? `₹${row.cgst_amount.toFixed(2)}` : undefined} />
                <Detail label="SGST" value={row.sgst_amount !== undefined ? `₹${row.sgst_amount.toFixed(2)}` : undefined} />
                <Detail label="Line Total" value={row.line_total !== undefined ? `₹${row.line_total.toFixed(2)}` : undefined} highlight />
                <Detail label="Stock Available" value={row.available_stock !== undefined ? `${row.available_stock} ${row.uom ?? "PCS"}` : undefined} />
              </div>
              {/* Warnings */}
              {row.warnings && row.warnings.length > 0 && (
                <div className="mt-1 space-y-1">
                  {row.warnings.map((w, wi) => (
                    <div key={wi} className="flex gap-2 items-start text-amber-300/90">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span className="leading-snug">{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="text-on-surface-variant whitespace-nowrap">{label}:</span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          highlight ? "font-bold text-primary" : "text-on-surface"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary strip
// ─────────────────────────────────────────────────────────────────────────────

function SummaryStrip({ result }: { result: CsvImportResult }) {
  const grandTotal = result.rows
    .filter((r) => r.status !== "REJECTED" && r.line_total !== undefined)
    .reduce((sum, r) => sum + (r.line_total ?? 0), 0);

  return (
    <div className="grid grid-cols-4 gap-2 bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5">
      <Pill label="Total Rows" value={String(result.total_rows)} color="default" />
      <Pill label="Valid" value={String(result.valid_rows + result.warning_rows)} color="green" />
      <Pill label="Rejected" value={String(result.rejected_rows)} color={result.rejected_rows > 0 ? "red" : "default"} />
      <Pill label="Grand Total" value={`₹${grandTotal.toFixed(2)}`} color="primary" />
    </div>
  );
}

function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "default" | "green" | "red" | "primary";
}) {
  const cls = {
    default: "text-on-surface",
    green: "text-emerald-300",
    red: "text-rose-400",
    primary: "text-primary",
  }[color];
  return (
    <div className="text-center">
      <p className={`font-bold text-base ${cls}`}>{value}</p>
      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Format selector (help panel)
// ─────────────────────────────────────────────────────────────────────────────

function FormatHelp({ detected }: { detected?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg text-xs">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-3 py-2 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Info size={13} />
          <span className="font-semibold">Supported CSV Formats</span>
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="border-t border-outline-variant divide-y divide-outline-variant/50">
          {Object.entries(FORMAT_SAMPLE).map(([tier, sample]) => (
            <div
              key={tier}
              className={`flex items-center gap-3 px-3 py-1.5 ${
                detected === tier ? "bg-primary/10" : ""
              }`}
            >
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                  FORMAT_COLORS[tier] ?? ""
                }`}
              >
                {tier.replace("FORMAT_", "F").replace("PDT", "PDT")}
              </span>
              <span className="font-mono text-on-surface-variant">{sample}</span>
              {detected === tier && (
                <span className="ml-auto text-primary font-bold text-[9px]">DETECTED</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column Sequence, Alias Mapping & Suggestions
// ─────────────────────────────────────────────────────────────────────────────

function ColumnSequenceStrip({ result }: { result: CsvImportResult }) {
  if (!result.raw_headers || result.raw_headers.length === 0) return null;

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
          <ListOrdered size={14} className="text-primary" />
          <span>Detected Column Sequence &amp; Alias Mapping ({result.raw_headers.length} columns)</span>
        </div>
        <span className="text-[10px] text-on-surface-variant font-mono">Preserved in parsed order</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {result.raw_headers.map((raw, idx) => {
          const canonical = result.header_mappings?.[raw] || result.canonical_headers?.[idx];
          const isUnrecognized = result.unrecognized_headers?.includes(raw);
          const hasAliasTranslation = canonical && canonical.toLowerCase() !== raw.toLowerCase();

          return (
            <div
              key={`${raw}-${idx}`}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${
                isUnrecognized
                  ? "bg-amber-950/30 border-amber-700/60 text-amber-200"
                  : "bg-surface-container border-outline-variant text-on-surface"
              }`}
            >
              <span className="text-[10px] text-on-surface-variant font-mono font-bold">#{idx + 1}</span>
              <span className="font-mono font-semibold">{raw}</span>
              {canonical && (
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="text-on-surface-variant">→</span>
                  <span className="px-1 py-0.2 rounded bg-primary/20 text-primary font-mono font-bold">
                    {canonical}
                  </span>
                  {hasAliasTranslation && (
                    <span className="text-[9px] text-emerald-400 font-medium">(alias)</span>
                  )}
                </span>
              )}
              {isUnrecognized && (
                <span className="px-1 py-0.2 rounded bg-amber-900/60 text-amber-300 font-bold text-[9px]">
                  Unmapped
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderSuggestionsCard({ result }: { result: CsvImportResult }) {
  const hasSuggestions = result.header_suggestions && result.header_suggestions.length > 0;
  const hasUnrecognized = result.unrecognized_headers && result.unrecognized_headers.length > 0;

  if (!hasSuggestions && !hasUnrecognized) return null;

  return (
    <div className="bg-amber-950/25 border border-amber-700/60 rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2 text-amber-300 font-bold">
        <Sparkles size={14} className="text-amber-400 shrink-0" />
        <span>Column Header Validation &amp; Suggestions</span>
      </div>
      {hasSuggestions && (
        <ul className="space-y-1 text-amber-200/90 pl-5 list-disc text-[11px]">
          {result.header_suggestions!.map((sug, i) => (
            <li key={i}>{sug}</li>
          ))}
        </ul>
      )}
      {hasUnrecognized && !hasSuggestions && (
        <p className="text-[11px] text-amber-300/80">
          Unrecognized column headers: {result.unrecognized_headers!.join(", ")}. These will be ignored or defaulted during resolution.
        </p>
      )}
    </div>
  );
}

function DistinguishedValidationsCard({ validations }: { validations?: string[] }) {
  if (!validations || validations.length === 0) return null;

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2 text-on-surface font-semibold">
        <CheckSquare size={14} className="text-emerald-400 shrink-0" />
        <span>Active Validation Rules Distinguished by Column Mapping</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {validations.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-on-surface-variant bg-surface-container-lowest border border-outline-variant/60 rounded p-1.5">
            <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
            <span className="leading-snug">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export const BarcodeCSVImportModal: React.FC<BarcodeCSVImportModalProps> = ({
  isOpen,
  onClose,
  customer,
  onImportConfirmed,
}) => {
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [taxPolicy, setTaxPolicy] = useState<"AUTO" | "INCLUSIVE" | "EXCLUSIVE">("AUTO");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isReliance = SmritiSalesPromotionService.isRelianceCustomer(customer);

  // Auto-validate whenever rawText or taxPolicy changes
  useEffect(() => {
    if (!rawText.trim()) {
      setResult(null);
      setApiError(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const taxDefault = taxPolicy === "AUTO" ? null : (taxPolicy === "INCLUSIVE");
        const data = await apiFetchV1("/billing/csv/validate", {
          method: "POST",
          body: JSON.stringify({
            raw_text: rawText,
            delimiter_hint: null,
            tax_inclusive_default: taxDefault,
            file_name: fileName || "uploaded.csv",
            customer_id: customer?.id,
            customer_name: customer?.name,
            customer_group: customer?.customerGroup || (customer as any)?.customerGroupId,
          }),
          signal: controller.signal,
        });
        if (!cancelled) setResult(data as CsvImportResult);
      } catch (e: any) {
        if (!cancelled && e?.name !== "AbortError") {
          setApiError(
            "Unable to validate the file against the product catalogue. Please check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(run, 400); // debounce
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [rawText, taxPolicy, fileName, customer]);

  const loadFile = useCallback((file: File) => {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawText((e.target?.result as string) ?? "");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleClear = () => {
    setRawText("");
    setFileName("");
    setResult(null);
    setApiError(null);
  };

  const handleConfirm = () => {
    if (!result) return;
    const items: ResolvedCartItem[] = result.rows
      .filter((r) => r.status !== "REJECTED" && Boolean(r.product_id))
      .map((r) => {
        let effSp = r.effective_selling_price ?? 0;
        let markdownDisplay = r.mrp_markdown_display;
        if (isReliance && r.catalog_mrp && r.catalog_mrp > 0) {
          effSp = Math.round(r.catalog_mrp * (1 - 0.4376) * 100) / 100;
          markdownDisplay = "43.76% off MRP [REL_RET_4376]";
        }
        return {
          barcode: r.barcode,
          resolved_item: r.resolved_item ?? r.barcode,
          resolved_sku: r.resolved_sku ?? "",
          product_id: r.product_id!,
          hsn_code: r.hsn_code,
          quantity: r.quantity ?? 1,
          catalog_mrp: r.catalog_mrp ?? 0,
          effective_selling_price: effSp,
          is_tax_inclusive: r.is_tax_inclusive ?? true,
          tax_mode_display: r.tax_mode_display,
          batch_no: r.batch_no,
          salesperson_id: r.salesperson_id,
          gst_rate: r.gst_rate ?? 0,
          taxable_value: r.taxable_value ?? 0,
          cgst_amount: r.cgst_amount ?? 0,
          sgst_amount: r.sgst_amount ?? 0,
          line_total: r.line_total ?? 0,
          uom: r.uom ?? "PCS",
          mrp_markdown_display: markdownDisplay,
        };
      });

    if (items.length === 0) {
      setApiError("No valid products found in the database. Only items verified in the catalogue can be added to billing.");
      return;
    }

    onImportConfirmed(items);
    onClose();
  };

  if (!isOpen) return null;

  const displayedRows = result
    ? showAll
      ? result.rows
      : result.rows.slice(0, 20)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl border border-outline-variant overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/15 rounded-lg">
              <ClipboardList size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-headline-md text-sm text-on-surface font-bold m-0 leading-tight">
                Barcode Billing CSV Import
              </h2>
              <p className="text-[10px] text-on-surface-variant m-0">
                Upload CSV or PDT file — catalog resolves all pricing &amp; GST
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors rounded-lg p-1.5 hover:bg-error-container"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body (scrollable) ───────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Institutional Contract Active: Reliance Retail Ltd. */}
          {isReliance && (
            <div id="reliance-contract-banner" className="flex items-start gap-2.5 bg-primary/10 border border-primary/40 rounded-lg px-3.5 py-2.5 text-xs text-on-surface">
              <Building2 size={16} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-primary flex items-center gap-1.5">
                  <span>Contract Active: {customer?.name || "Reliance Retail Ltd."}</span>
                  <span className="bg-primary text-on-primary text-[9px] px-1.5 py-0.5 rounded font-bold">43.76% Markdown</span>
                </p>
                <p className="text-on-surface-variant text-[11px] mt-0.5 leading-snug">
                  Institutional trade agreement active: Flat <strong>43.76% trade discount on MRP</strong> auto-assigned across all imported line items. All other general promotional schemes suppressed.
                </p>
              </div>
            </div>
          )}

          {/* Format help */}
          <FormatHelp detected={result?.format_detected} />

          {/* Pricing Policy Selector */}
          <div className="flex items-center justify-between bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-on-surface">
              <Tag size={13} className="text-primary" />
              <span>Pricing & Tax Mode</span>
            </span>
            <select
              id="csv-tax-policy-select"
              value={taxPolicy}
              onChange={(e) => setTaxPolicy(e.target.value as any)}
              className="bg-surface-container border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="AUTO">Auto-detect (From CSV Column / Channel Default)</option>
              <option value="INCLUSIVE">Tax Inclusive (MRP / Retail Standard)</option>
              <option value="EXCLUSIVE">Tax Exclusive (Base Rate + GST Added)</option>
            </select>
          </div>

          {/* Upload zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/10"
                : "border-outline-variant/70 hover:border-primary/60 bg-surface-container-lowest"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload CSV or PDT file"
          >
            <div className="flex flex-col items-center justify-center py-8 gap-2 pointer-events-none select-none">
              {fileName ? (
                <>
                  <FileText size={32} className="text-primary" />
                  <p className="font-semibold text-on-surface text-sm">{fileName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {rawText.split("\n").filter(Boolean).length} lines loaded
                  </p>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-on-surface-variant/60" />
                  <p className="text-sm font-medium text-on-surface">
                    Drop your CSV / PDT / TXT file here
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    or click to browse — UTF-8 encoding, max 5,000 rows
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.pdt,.dat"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Paste / manual textarea */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                Or paste raw CSV / PDT text
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-on-surface-variant">Quick Headers:</span>
                <button
                  id="btn-quick-standard"
                  type="button"
                  onClick={() => setRawText("barcode,quantity\n")}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-primary border border-outline-variant transition-colors"
                  title="Insert standard barcode,quantity header"
                >
                  + Standard
                </button>
                <button
                  id="btn-quick-b2b"
                  type="button"
                  onClick={() => setRawText("barcode,quantity,rate\n")}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-cyan-300 border border-cyan-800/60 transition-colors"
                  title="Insert B2B wholesale rate header"
                >
                  + B2B Rate
                </button>
                <button
                  id="btn-quick-retail"
                  type="button"
                  onClick={() => setRawText("barcode,quantity,selling_price\n")}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-emerald-300 border border-emerald-800/60 transition-colors"
                  title="Insert retail selling price header"
                >
                  + Retail SP
                </button>
                <button
                  id="btn-quick-commercial"
                  type="button"
                  onClick={() => setRawText("barcode,quantity,rate,discount_percent\n")}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-fuchsia-300 border border-fuchsia-800/60 transition-colors"
                  title="Insert commercial rate + discount header"
                >
                  + Commercial
                </button>
              </div>
            </div>
            <textarea
              id="csv-paste-area"
              value={rawText}
              onChange={(e) => {
                setFileName("");
                setRawText(e.target.value);
              }}
              rows={5}
              spellCheck={false}
              placeholder={"barcode,quantity\n890100000006,2\n890100000007,1"}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-mono text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
            />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Loader2 size={14} className="animate-spin" />
              <span>Validating against product catalogue…</span>
            </div>
          )}

          {/* API error */}
          {apiError && !loading && (
            <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-700/60 rounded-lg px-3 py-2.5 text-xs text-rose-300">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <>
              {/* Format badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
                  Format Detected:
                </span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                    FORMAT_COLORS[result.format_detected] ?? ""
                  }`}
                >
                  {result.format_detected}
                </span>
                <span className="text-xs text-on-surface-variant">
                  — {result.format_label}
                </span>
              </div>

              {/* Column sequence & alias mappings */}
              <ColumnSequenceStrip result={result} />

              {/* Suggestions for unrecognized / misspelled headers */}
              <HeaderSuggestionsCard result={result} />

              {/* Distinguished statutory and pricing validation rules */}
              <DistinguishedValidationsCard validations={result.distinguished_validations} />

              {/* Summary strip */}
              <SummaryStrip result={result} />

              {/* Per-row results */}
              <div className="space-y-1.5">
                {displayedRows.map((row, i) => (
                  <RowCard key={`${row.barcode}-${i}`} row={row} idx={row.row_index} />
                ))}
              </div>

              {/* Show more / less */}
              {result.rows.length > 20 && (
                <button
                  type="button"
                  onClick={() => setShowAll((p) => !p)}
                  className="w-full text-xs text-primary hover:underline py-1"
                >
                  {showAll
                    ? "Show fewer rows"
                    : `Show all ${result.rows.length} rows`}
                </button>
              )}

              {/* No valid rows info */}
              {!result.can_proceed && (
                <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-700/50 rounded-lg px-3 py-2.5 text-xs text-rose-300">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    All rows were rejected. Please correct the errors above and
                    re-upload before proceeding.
                  </span>
                </div>
              )}

              {/* GST note */}
              <div className="flex items-start gap-2 bg-sky-950/20 border border-sky-800/40 rounded-lg px-3 py-2 text-[10px] text-sky-300/80">
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>
                  GST is computed on the effective selling price, not on MRP. The
                  catalogue GST rate and HSN code are always used — values in your
                  file are advisory only. MRP markdown (e.g. "50% off MRP") is a
                  display-only label and does not affect invoice calculations.
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="bg-surface-container-low px-6 py-3.5 border-t border-outline-variant flex justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            disabled={!rawText && !result}
            className="px-4 py-2 rounded-lg border border-outline text-on-surface-variant font-title-sm text-xs font-semibold hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
          >
            Clear
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-outline text-on-surface font-title-sm text-xs font-semibold hover:bg-surface-container-highest transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!result || !result.can_proceed || (result.valid_rows + result.warning_rows) === 0 || loading}
              className="px-6 py-2 rounded-lg bg-primary text-on-primary font-title-sm text-xs font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-sm flex items-center gap-2"
            >
              <Tag size={13} />
              {result && (result.valid_rows + result.warning_rows) > 0
                ? `Add ${result.valid_rows + result.warning_rows} Verified DB Item(s) to Bill`
                : "Add to Bill"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BarcodeCSVImportModal;
