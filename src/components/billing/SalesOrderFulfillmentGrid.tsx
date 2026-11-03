import React, { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, FileSpreadsheet, X } from "lucide-react";
import {
  applySourceBarcodeQuantityRows,
  parseSourceBarcodeQuantityCsv,
  type SourceBarcodeQuantityResult,
} from "../../utils/sourceBillingQuantities.ts";
import type { SelectedSourceBilling } from "./modals/SourceBillingSelectionModal.tsx";

interface Props {
  source: SelectedSourceBilling;
  validationEnabled: boolean;
  readOnly: boolean;
  rejectedRows: SourceBarcodeQuantityResult["rejectedRows"];
  onValidationEnabledChange: (enabled: boolean) => void;
  onQuantitiesChange: (quantities: Record<string, string>) => void;
  onRejectedRowsChange: (rows: SourceBarcodeQuantityResult["rejectedRows"]) => void;
}

export function SalesOrderFulfillmentGrid({
  source,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-500">SO Qty:</span><strong>{itemTotals.ordered}</strong>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-500">Fulfilled:</span><strong>{itemTotals.fulfilled}</strong>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span>Pending:</span><strong>{itemTotals.pending}</strong>
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
        <table className="w-full min-w-[980px] table-fixed border-collapse text-[11px] tabular-nums">
          <colgroup>
            <col className="w-8" /><col className="w-9" /><col className="w-[9%]" /><col className="w-[13%]" />
            <col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[6%]" />
            <col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[7%]" />
            <col className="w-[8%]" /><col className="w-[10%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr className="h-8">
              <th className="border-r border-slate-200 px-1 text-center dark:border-slate-700">
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
              </th>
              <th className="border-r border-slate-200 px-1 dark:border-slate-700">#</th>
              <th className="border-r border-slate-200 px-1">SO No.</th>
              <th className="border-r border-slate-200 px-1">Barcode</th>
              <th className="border-r border-slate-200 px-1">Article</th>
              <th className="border-r border-slate-200 px-1">Color</th>
              <th className="border-r border-slate-200 px-1">Size</th>
              <th className="border-r border-slate-200 px-1 text-right">SO Qty</th>
              <th className="border-r border-slate-200 px-1 text-right">Fulfilled</th>
              <th className="border-r border-slate-200 px-1 text-right">Pending</th>
              <th className="border-r border-slate-200 px-1 text-right">Bill Qty</th>
              <th className="px-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {preparedLines.map((line, index) => {
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
              return (
                <tr key={line.source_line_id} className={`h-8 border-b border-slate-200 dark:border-slate-700 ${line.eligible ? "bg-white dark:bg-slate-900" : "bg-rose-50/70 dark:bg-rose-950/20"}`}>
                  <td className="border-r border-slate-200 text-center dark:border-slate-700">
                    <input
                      type="checkbox"
                      aria-label={`Include ${line.code}`}
                      checked={quantity > 0}
                      disabled={readOnly || !validationEnabled || !line.eligible || pending <= 0}
                      onChange={event => setLineQuantity(line.source_line_id, event.target.checked ? String(pending) : "0")}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="border-r border-slate-200 px-1 text-center dark:border-slate-700">{index + 1}</td>
                  <td className="overflow-hidden text-ellipsis border-r border-slate-200 px-1 dark:border-slate-700">{line.source_document_number || source.documentNumber}</td>
                  <td className="overflow-hidden text-ellipsis border-r border-slate-200 px-1 font-mono dark:border-slate-700">{line.barcodes?.[0] || line.code}</td>
                  <td className="overflow-hidden text-ellipsis border-r border-slate-200 px-1 dark:border-slate-700">{line.article_no || line.code}</td>
                  <td className="overflow-hidden text-ellipsis border-r border-slate-200 px-1 dark:border-slate-700">{line.color || "—"}</td>
                  <td className="overflow-hidden text-ellipsis border-r border-slate-200 px-1 dark:border-slate-700">{line.size || "—"}</td>
                  <td className="border-r border-slate-200 px-1 text-right dark:border-slate-700">{ordered}</td>
                  <td className="border-r border-slate-200 px-1 text-right dark:border-slate-700">{fulfilled}</td>
                  <td className="border-r border-slate-200 px-1 text-right dark:border-slate-700">
                    <span className={`inline-block min-w-10 rounded px-1.5 py-0.5 font-bold ${pending > 0 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"}`}>{pending}</span>
                  </td>
                  <td className="border-r border-slate-200 px-1 text-right dark:border-slate-700">
                    <input
                      aria-label={`Bill quantity for ${line.code}`}
                      type="number"
                      min="0"
                      max={pending}
                      step="0.0001"
                      value={quantity}
                      disabled={readOnly || !validationEnabled || !line.eligible || pending <= 0}
                      onChange={event => setLineQuantity(line.source_line_id, event.target.value)}
                      className="w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-right font-semibold outline-none focus:ring-1 focus:ring-blue-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-blue-800 dark:bg-slate-950 dark:disabled:bg-slate-800"
                    />
                  </td>
                  <td className="px-1">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${statusClass}`}>
                      {line.eligible || isFulfilled ? <Check size={12} /> : <X size={12} />}
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rejectedRows.map((row, index) => (
              <tr key={`rejected-${index}-${row.barcode}`} className="h-8 border-b border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <td className="border-r border-rose-200 text-center dark:border-rose-900"><input type="checkbox" disabled aria-label={`Invalid barcode ${row.barcode}`} /></td>
                <td className="border-r border-rose-200 px-1 text-center dark:border-rose-900">{preparedLines.length + index + 1}</td>
                <td className="border-r border-rose-200 px-1 dark:border-rose-900">—</td>
                <td className="border-r border-rose-200 px-1 font-mono dark:border-rose-900">{row.barcode}</td>
                <td colSpan={6} className="border-r border-rose-200 px-1 dark:border-rose-900">{row.reason}</td>
                <td className="border-r border-rose-200 px-1 text-right dark:border-rose-900">—</td>
                <td className="px-1"><span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 font-bold dark:bg-rose-900/50"><X size={12} />{row.status === "NOT_IN_SO" ? "Not in SO" : "Invalid"}</span></td>
              </tr>
            ))}
            {preparedLines.length === 0 && rejectedRows.length === 0 && (
              <tr><td colSpan={12} className="h-28 text-center text-slate-500">Scan a barcode or import/paste a list to select Sales Order items.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
