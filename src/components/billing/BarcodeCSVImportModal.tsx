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
  ShieldAlert, ClipboardList, Info,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import {
  CsvImportRow, CsvImportResult, CsvRowStatus,
} from "./types";
import { Product } from "../../types";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BarcodeCSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  gst_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  line_total: number;
  uom: string;
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
};

const FORMAT_SAMPLE: Record<string, string> = {
  FORMAT_1: "barcode",
  FORMAT_2: "barcode, quantity",
  FORMAT_3: "barcode, quantity, selling_price",
  FORMAT_4: "barcode, quantity, rate",
  FORMAT_5: "barcode, quantity, discount_percent",
  FORMAT_6: "barcode, sku, quantity, mrp, selling_price, gst_rate, hsn_code",
  FORMAT_PDT: "890100~2~50.00  (tilde-delimited)",
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
                <Detail label="Catalogue MRP" value={row.catalog_mrp !== undefined ? `₹${row.catalog_mrp.toFixed(2)}` : undefined} />
                <Detail label="Selling Price" value={row.effective_selling_price !== undefined ? `₹${row.effective_selling_price.toFixed(2)}` : undefined} highlight />
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
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export const BarcodeCSVImportModal: React.FC<BarcodeCSVImportModalProps> = ({
  isOpen,
  onClose,
  onImportConfirmed,
}) => {
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-validate whenever rawText changes
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
        const data = await apiFetchV1("/billing/csv/validate", {
          method: "POST",
          body: JSON.stringify({ raw_text: rawText, delimiter_hint: null }),
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
  }, [rawText]);

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
      .map((r) => ({
        barcode: r.barcode,
        resolved_item: r.resolved_item ?? r.barcode,
        resolved_sku: r.resolved_sku ?? "",
        product_id: r.product_id!,
        hsn_code: r.hsn_code,
        quantity: r.quantity ?? 1,
        catalog_mrp: r.catalog_mrp ?? 0,
        effective_selling_price: r.effective_selling_price ?? 0,
        gst_rate: r.gst_rate ?? 0,
        taxable_value: r.taxable_value ?? 0,
        cgst_amount: r.cgst_amount ?? 0,
        sgst_amount: r.sgst_amount ?? 0,
        line_total: r.line_total ?? 0,
        uom: r.uom ?? "PCS",
        mrp_markdown_display: r.mrp_markdown_display,
      }));

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

          {/* Format help */}
          <FormatHelp detected={result?.format_detected} />

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
            <label className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
              Or paste raw CSV / PDT text
            </label>
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
