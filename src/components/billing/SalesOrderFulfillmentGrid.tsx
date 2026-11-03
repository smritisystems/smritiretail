import React, { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, FileSpreadsheet, X } from "lucide-react";
import {
  applySourceBarcodeQuantityRows,
  parseSourceBarcodeQuantityCsv,
  type SourceBarcodeQuantityResult,
} from "../../utils/sourceBillingQuantities.ts";
import type { SelectedSourceBilling } from "./modals/SourceBillingSelectionModal.tsx";
import { getVisibleBillingGridColumns, type BillingGridLayout } from "./billingGridPreferences.ts";
import type { BillingPreviewResult } from "./billingPreview.ts";

interface Props {
  source: SelectedSourceBilling;
  layout: BillingGridLayout;
  previewLines?: Record<string, BillingPreviewResult["lines"][number]>;
  validationEnabled: boolean;
  readOnly: boolean;
  rejectedRows: SourceBarcodeQuantityResult["rejectedRows"];
  onValidationEnabledChange: (enabled: boolean) => void;
  onQuantitiesChange: (quantities: Record<string, string>) => void;
  onRejectedRowsChange: (rows: SourceBarcodeQuantityResult["rejectedRows"]) => void;
}

export function SalesOrderFulfillmentGrid({
  source,
  layout,
  previewLines = {},
  validationEnabled,
  readOnly,
  rejectedRows,
  onValidationEnabledChange,
  onQuantitiesChange,
  onRejectedRowsChange,
}: Props) {
  const [pasteValue, setPasteValue] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const quantities = useMemo(
    () => Object.fromEntries(source.lines.map(line => [line.sourceLineId, String(line.quantity)])),
    [source.lines],
  );
  const preparedLines = source.prepared.lines;
  const itemTotals = useMemo(() => preparedLines.reduce((totals, line) => ({
    ordered: totals.ordered + Number(line.po_quantity ?? line.ordered_quantity ?? 0),
    fulfilled: totals.fulfilled + Number(line.previously_billed_order_quantity ?? line.previously_billed_quantity ?? 0),
    pending: totals.pending + Number(line.remaining_quantity ?? 0),
  }), { ordered: 0, fulfilled: 0, pending: 0 }), [preparedLines]);
  const selectedCount = source.lines.length;
  const currentOrderNumbers = source.prepared.source_documents?.map(document => document.number)
    ?? [source.documentNumber];
  const visibleColumns = getVisibleBillingGridColumns("salesOrder", layout);

  const applyRows = (rows: Array<[string, string]>, label: string) => {
    const result = applySourceBarcodeQuantityRows(rows, preparedLines, quantities);
    onQuantitiesChange(result.quantities);
    onRejectedRowsChange([...rejectedRows, ...result.rejectedRows]);
    setStatus(`${label}: applied ${rows.length - result.rejectedRows.length} valid row(s).`);
  };

  const handlePasteList = () => {
    try {
      applyRows(parseSourceBarcodeQuantityCsv(pasteValue), "Paste list");
      setPasteValue("");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Pasted barcode rows could not be read.");
    }
  };

  const handleCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      applyRows(parseSourceBarcodeQuantityCsv(await file.text()), file.name);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Barcode CSV file could not be read.");
    }
  };

  const setLineQuantity = (sourceLineId: string, value: string) => {
    const quantity = value === "" ? 0 : Number(value);
    const line = preparedLines.find(candidate => candidate.source_line_id === sourceLineId);
    if (!line || !Number.isFinite(quantity) || quantity < 0
      || quantity > Number(line.remaining_quantity)
      || Number(quantity.toFixed(4)) !== quantity) {
      setStatus(`${line?.code || "Item"}: Bill Qty must be between zero and SO Pending Qty.`);
      return;
    }
    onQuantitiesChange({ ...quantities, [sourceLineId]: quantity ? String(quantity) : "0" });
  };

  const eligibleLines = preparedLines.filter(line => line.eligible && Number(line.remaining_quantity) > 0);
  const allEligibleSelected = eligibleLines.length > 0 && eligibleLines.every(line =>
    Number(quantities[line.source_line_id] || 0) >= Number(line.remaining_quantity)
  );
  const someEligibleSelected = eligibleLines.some(line => Number(quantities[line.source_line_id] || 0) > 0);

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someEligibleSelected && !allEligibleSelected;
    }
  }, [someEligibleSelected, allEligibleSelected]);
  const renderPreparedCell = (key: string, line: typeof preparedLines[number], index: number) => {
    const ordered = Number(line.po_quantity ?? line.ordered_quantity ?? 0);
    const fulfilled = Number(line.previously_billed_order_quantity ?? line.previously_billed_quantity ?? 0);
    const pending = Number(line.remaining_quantity ?? 0);
    const quantity = Number(quantities[line.source_line_id] || 0);
    const isFulfilled = pending <= 0;
    const statusLabel = isFulfilled ? "Fulfilled" : line.eligible ? "Valid" : "Invalid";
    const statusClass = isFulfilled
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
      : line.eligible
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    const preview = previewLines[line.source_line_id];
    const textCell = "overflow-hidden text-ellipsis border-r border-slate-200 px-1 dark:border-slate-700";
    switch (key) {
      case "select": return <td key={key} className="border-r border-slate-200 text-center dark:border-slate-700"><input type="checkbox" aria-label={`Bill ${line.code}`} title={pending <= 0 ? "This Sales Order line is already fulfilled." : `Include ${line.code} in this bill`} checked={quantity > 0} disabled={readOnly || !validationEnabled || !line.eligible || pending <= 0} onChange={event => setLineQuantity(line.source_line_id, event.target.checked ? String(pending) : "0")} className="accent-blue-600" /></td>;
      case "row": return <td key={key} className={`${textCell} text-center`}>{index + 1}</td>;
      case "soNumber": return <td key={key} className={textCell}>{line.source_document_number || source.documentNumber}</td>;
      case "barcode": return <td key={key} className={`${textCell} font-mono`}>{line.barcodes?.[0] || line.code}</td>;
      case "article": return <td key={key} className={textCell}>{line.article_no || line.code}</td>;
      case "description": return <td key={key} className={`${textCell} font-medium text-slate-800 dark:text-slate-100`} title={line.name}>{line.name}</td>;
      case "color": return <td key={key} className={textCell}>{line.color || "—"}</td>;
      case "size": return <td key={key} className={textCell}>{line.size || "—"}</td>;
      case "soQty": return <td key={key} className={`${textCell} text-right`}>{ordered}</td>;
      case "fulfilledQty": return <td key={key} className={`${textCell} text-right`}>{fulfilled}</td>;
      case "pendingQty": return <td key={key} className={`${textCell} text-right`}><span className={`inline-block min-w-10 rounded px-1.5 py-0.5 font-bold ${pending > 0 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"}`}>{pending}</span></td>;
      case "billQty": return <td key={key} className={`${textCell} text-right`}><input aria-label={`Bill quantity for ${line.code}`} type="number" min="0" max={pending} step="0.0001" value={quantity} disabled={readOnly || !validationEnabled || !line.eligible || pending <= 0} onChange={event => setLineQuantity(line.source_line_id, event.target.value)} className="w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-right font-semibold outline-none focus:ring-1 focus:ring-blue-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-blue-800 dark:bg-slate-950 dark:disabled:bg-slate-800" /></td>;
      case "rate": return <td key={key} className={`${textCell} text-right font-mono`}>{Number(line.unit_price || 0).toFixed(2)}</td>;
      case "discountPercent": return <td key={key} className={`${textCell} text-right font-mono`}>{Number(preview?.disc_pct ?? line.discount_percent ?? 0) > 0 ? `${Number(preview?.disc_pct ?? line.discount_percent).toFixed(2)}%` : "—"}</td>;
      case "discountAmount": return <td key={key} className={`${textCell} text-right font-mono`}>{preview ? Number(preview.discount_amount).toFixed(2) : "—"}</td>;
      case "taxable": return <td key={key} className={`${textCell} text-right font-mono`}>{preview ? Number(preview.taxable_value).toFixed(2) : "—"}</td>;
      case "gst": return <td key={key} className={`${textCell} text-right font-mono`}>{Number(line.gst_rate || 0)}%</td>;
      case "gstAmount": return <td key={key} className={`${textCell} text-right font-mono`}>{preview ? Number(preview.tax_amount).toFixed(2) : "—"}</td>;
      case "total": return <td key={key} className={`${textCell} text-right font-mono font-semibold`}>{preview ? Number(preview.total_amount).toFixed(2) : "—"}</td>;
      case "status": return <td key={key} className="px-1"><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${statusClass}`}>{line.eligible || isFulfilled ? <Check size={12} /> : <X size={12} />}{statusLabel}</span></td>;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-500">SO Qty:</span><strong>{itemTotals.ordered}</strong>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-500">SO Fulfilled:</span><strong>{itemTotals.fulfilled}</strong>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span>SO Pending:</span><strong>{itemTotals.pending}</strong>
        </div>
        <span className="mx-1 hidden h-6 border-l border-slate-300 md:block dark:border-slate-700" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={readOnly || !validationEnabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <FileSpreadsheet size={14} className="text-emerald-600" />Import CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => void handleCsvFile(event)} />
        <button
          type="button"
          onClick={() => setShowPaste(value => !value)}
          disabled={readOnly || !validationEnabled}
          aria-expanded={showPaste}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Clipboard size={14} className="text-blue-600" />Paste List
        </button>
        <label className="ml-1 inline-flex h-8 cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          <input
            ref={selectAllRef}
            type="checkbox"
            role="switch"
            aria-label="Sales Order validation"
            checked={validationEnabled}
            disabled={readOnly}
            onChange={event => onValidationEnabledChange(event.target.checked)}
            className="accent-emerald-600"
          />
          <span className={validationEnabled ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            SO Validate: {validationEnabled ? "ON" : "OFF"}
          </span>
        </label>
        {rejectedRows.length > 0 && (
          <button type="button" onClick={() => onRejectedRowsChange([])} className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 px-2 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300">
            <X size={12} />Clear invalid
          </button>
        )}
        <div className="relative ml-auto">
          <button
            type="button"
            aria-expanded={showItems}
            onClick={() => setShowItems(value => !value)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Items ({selectedCount}) <ChevronDown size={13} />
          </button>
          {showItems && (
            <div className="absolute right-0 top-full z-30 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px] shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-1 font-semibold text-slate-500">Selected Sales Orders</p>
              {currentOrderNumbers.map(number => <p key={number} className="truncate py-0.5">{number}</p>)}
              <p className="mt-1 border-t border-slate-200 pt-1 font-semibold dark:border-slate-700">
                {selectedCount} billable item line(s)
              </p>
            </div>
          )}
        </div>
      </div>

      {showPaste && (
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
          <label className="min-w-[220px] flex-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            Barcode list or Barcode,Qty
            <textarea
              aria-label="Paste Sales Order barcode list"
              value={pasteValue}
              onChange={event => setPasteValue(event.target.value)}
              placeholder={"Barcode,Qty\n8901234567890,2\n8901234567891"}
              rows={2}
              className="mt-1 block w-full resize-y rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950"
            />
          </label>
          <button type="button" onClick={handlePasteList} disabled={!pasteValue.trim()} className="h-8 rounded bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
            Validate &amp; Add
          </button>
          <button type="button" aria-label="Close pasted list" onClick={() => setShowPaste(false)} className="h-8 rounded border border-slate-300 px-2 text-slate-500 dark:border-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {!validationEnabled && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Sales Order validation is required before quantities can be changed or the invoice posted.
        </p>
      )}
      {status && <p role="status" className="border-b border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{status}</p>}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max table-fixed border-collapse text-[11px] tabular-nums">
          <colgroup>
            {visibleColumns.map(column => <col key={column.key} style={{ width: column.width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr className="h-8">
              {visibleColumns.map(column => (
                <th key={column.key} style={{ width: column.width }} className={`border-r border-slate-200 px-1 dark:border-slate-700 ${["select", "row"].includes(column.key) ? "text-center" : ""} ${["soQty", "fulfilledQty", "pendingQty", "billQty", "rate", "discountPercent", "discountAmount", "taxable", "gst", "gstAmount", "total"].includes(column.key) ? "text-right" : ""}`}>
                  {column.key === "select" ? (
                    <input
                      type="checkbox"
                      aria-label="Select all pending Sales Order items"
                      checked={allEligibleSelected}
                      disabled={readOnly || !validationEnabled || eligibleLines.length === 0}
                      onChange={event => onQuantitiesChange(Object.fromEntries(preparedLines.map(line => [
                        line.source_line_id,
                        line.eligible && Number(line.remaining_quantity) > 0 && event.target.checked ? String(line.remaining_quantity) : "0",
                      ])))}
                      className="accent-blue-600"
                    />
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preparedLines.map((line, index) => {
              const pending = Number(line.remaining_quantity ?? 0);
              return (
                <tr key={line.source_line_id} className={`h-8 border-b border-slate-200 dark:border-slate-700 ${line.eligible ? "bg-white dark:bg-slate-900" : "bg-rose-50/70 dark:bg-rose-950/20"}`}>
                  {visibleColumns.map(column => renderPreparedCell(column.key, line, index))}
                </tr>
              );
            })}
            {rejectedRows.map((row, index) => (
              <React.Fragment key={`rejected-${index}-${row.barcode}`}>
                <tr className="h-8 border-b border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  {visibleColumns.map(column => {
                    switch (column.key) {
                      case "select": return <td key={column.key} className="border-r border-rose-200 text-center dark:border-rose-900"><input type="checkbox" disabled aria-label={`Invalid barcode ${row.barcode}`} /></td>;
                      case "row": return <td key={column.key} className="border-r border-rose-200 px-1 text-center dark:border-rose-900">{preparedLines.length + index + 1}</td>;
                      case "barcode": return <td key={column.key} className="overflow-hidden text-ellipsis border-r border-rose-200 px-1 font-mono dark:border-rose-900" title={row.reason}>{row.barcode}</td>;
                      case "status": return (
                        <td key={column.key} className="px-1">
                          <span title={row.reason} className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 font-bold dark:bg-rose-900/50">
                            <X size={12} />{row.status === "NOT_IN_SO" ? "Not in SO" : "Invalid"}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove invalid barcode ${row.barcode}`}
                            title="Remove this invalid row"
                            onClick={() => onRejectedRowsChange(rejectedRows.filter((_, rowIndex) => rowIndex !== index))}
                            className="ml-1 rounded p-1 text-rose-700 hover:bg-rose-200 dark:text-rose-200 dark:hover:bg-rose-900"
                          >
                            <X size={12} />
                          </button>
                        </td>
                      );
                      default: return <td key={column.key} className="border-r border-rose-200 px-1 text-right dark:border-rose-900">—</td>;
                    }
                  })}
                </tr>
                <tr className="border-b border-rose-200 bg-rose-50 text-[10px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  <td colSpan={visibleColumns.length} className="px-2 py-1" title={row.reason}>
                    {row.status === "NOT_IN_SO"
                      ? `Barcode ${row.barcode} is not on the selected Sales Order and was excluded.`
                      : row.reason.includes("exceeds total SO Pending Qty")
                        ? `Barcode ${row.barcode}: requested quantity exceeds SO Pending Qty and was excluded.`
                        : row.reason.includes("matches different Sales Order items")
                          ? `Barcode ${row.barcode} matches multiple Sales Order items and was excluded.`
                          : row.reason.includes("quantity must be positive")
                            ? `Barcode ${row.barcode}: quantity must be positive (max 4 decimal places).`
                            : row.reason.includes("not eligible for billing")
                              ? `Barcode ${row.barcode}: Sales Order item is not eligible for billing.`
                              : `Barcode ${row.barcode}: invalid barcode or quantity; row was excluded.`}
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {preparedLines.length === 0 && rejectedRows.length === 0 && (
              <tr><td colSpan={visibleColumns.length} className="h-28 text-center text-slate-500">Scan a barcode or import/paste a list to select Sales Order items.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
